import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parseArgs } from 'node:util';
import { detectScaleVariant } from './compare.ts';
import { renderScad } from './openscad.ts';
import { meshToPolyhedron } from './polyhedron.ts';
import { sectionsToSvg, simplifyLoop, sliceAxial, sliceZ, toPieces } from './sections.ts';
import { bounds, center, isBinaryStl, parseStl, sha256, size, volume, type Mesh } from './stl.ts';
import { analyzeTopology } from './topology.ts';
import { DEFAULT_TOLERANCE, readManifest, toMarkdown, verifyManifest, verifyScad, type VerifyResult } from './verify.ts';

const USAGE = `Usage: tsx tools/stl-to-scad/cli.ts <command> [options]

  inspect <stl...>                         format, size, volume, topology, SHA-256; detects scaled copies among the inputs
  sections <stl> (--z a,b,c | --step s)    slice at heights; JSON of pieces (area, centroid, angle/radius about the axis)
        [--svg out.svg] [--center x,y]
  profile <stl> [--angle deg] [--simplify mm]   axial (r,z) outline through the axis: the profile for rotate_extrude() on a revolved part
                                           (--full keeps loops that cross the axis, e.g. solid parts, with r < 0 on the far side)
        [--center x,y] [--svg out.svg] [--full]
  polyhedron <stl> -o out.scad             FALLBACK: dump the mesh as one polyhedron() (large, not editable)
        [--decimals 3] [--cluster mm] [--name module] [--force]
  render <scad> -o out.stl [-D NAME=value]...   render a SCAD to binary STL with the Manifold backend (check the result with inspect)
  verify <scad> <stl>                      render with OpenSCAD (Manifold) and compare with the STL
        [-D NAME=value]... [--scale k] [--size mm] [--volume frac] [--iou frac] [--cell mm] [--bands mm] [--json]
  verify --manifest file.json              verify every part of a manifest [--only name...] [--report out.md] [--json]

Exit status is 1 when a verification fails.`;

const load = async (path: string): Promise<{ bytes: Buffer; mesh: Mesh }> => {
  const bytes = await readFile(path);
  return { bytes, mesh: parseStl(bytes) };
};

const round = (v: number, digits = 4): number => Number(v.toFixed(digits));

async function inspect(paths: string[]): Promise<void> {
  const loaded = await Promise.all(paths.map(async path => ({ path, ...(await load(path)) })));
  for (const { path, bytes, mesh } of loaded) {
    const b = bounds(mesh);
    const topology = analyzeTopology(mesh);
    console.log(JSON.stringify({
      file: basename(path), format: isBinaryStl(bytes) ? 'binary' : 'ascii', sha256: sha256(bytes), bytes: bytes.length,
      triangles: topology.triangles, uniqueVertices: topology.uniqueVertices, bboxMin: b.min.map(v => round(v, 3)), bboxMax: b.max.map(v => round(v, 3)),
      size: size(b).map(v => round(v, 3)), center: center(b).map(v => round(v, 3)), volume: round(volume(mesh), 2), topology,
    }));
  }
  for (let i = 0; i < loaded.length; i++) {
    for (let j = i + 1; j < loaded.length; j++) {
      const a = loaded[i], b = loaded[j];
      if (!a || !b) continue;
      const same = a.bytes.equals(b.bytes);
      const variant = same ? undefined : detectScaleVariant(a.mesh, b.mesh);
      if (same) console.log(`IDENTICAL   ${basename(a.path)} == ${basename(b.path)}`);
      else if (variant) console.log(`SCALE COPY  ${basename(b.path)} = ${basename(a.path)} x ${variant.scale.toFixed(4)} (max vertex deviation ${variant.maxDeviation.toExponential(1)} mm)`);
    }
  }
}

function sections(path: string, values: { z?: string | undefined; step?: string | undefined; svg?: string | undefined; center?: string | undefined }, mesh: Mesh): Promise<void> | void {
  const b = bounds(mesh);
  const [mx, my] = values.center ? values.center.split(',').map(Number) as [number, number] : [center(b)[0], center(b)[1]];
  const heights = values.z
    ? values.z.split(',').map(Number)
    : Array.from({ length: Math.floor((b.max[2] - b.min[2]) / Number(values.step ?? 5)) + 1 }, (_, i) => round(b.min[2] + 0.5 * Number(values.step ?? 5) + i * Number(values.step ?? 5), 3)).filter(z => z < b.max[2]);
  const cuts = heights.map(z => ({ z, loops: sliceZ(mesh, z) }));
  for (const { z, loops } of cuts) {
    const pieces = toPieces(loops).map(p => ({
      area: round(p.area, 3), holes: p.holes.length, centroid: p.centroid.map(v => round(v, 3)),
      angleDeg: round(((Math.atan2(p.centroid[1] - my, p.centroid[0] - mx) * 180) / Math.PI + 360) % 360, 2),
      radius: round(Math.hypot(p.centroid[0] - mx, p.centroid[1] - my), 3),
    }));
    console.log(JSON.stringify({ file: basename(path), z, pieces: pieces.length, loops: loops.length, netArea: round(pieces.reduce((s, p) => s + p.area, 0), 3), detail: pieces }));
  }
  if (values.svg) return writeFile(values.svg, sectionsToSvg(cuts));
}

function printResult(result: VerifyResult): void {
  const c = result.comparison;
  console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}: size Δ ${c.sizeDelta.map(v => v.toFixed(3)).join('/')} mm, volume ${(c.volumeRelativeError * 100).toFixed(2)} %, IoU ${c.iou.toFixed(4)}, mean deviation ${c.meanDeviation.toFixed(3)} mm, ${result.scadBytes} SCAD bytes, ${(result.render.milliseconds / 1000).toFixed(1)} s (${result.render.runner})`);
  for (const failure of result.failures) console.log(`  - ${failure}`);
  for (const band of c.bands ?? []) console.log(`  z ${band.z0.toFixed(1)}-${band.z1.toFixed(1)}: IoU ${band.iou.toFixed(3)} volume ref ${band.referenceVolume.toFixed(0)} / scad ${band.candidateVolume.toFixed(0)}`);
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(USAGE);
    return 0;
  }
  const { values, positionals } = parseArgs({
    args: rest, allowPositionals: true,
    options: {
      angle: { type: 'string' }, simplify: { type: 'string' }, z: { type: 'string' }, step: { type: 'string' }, svg: { type: 'string' }, center: { type: 'string' }, o: { type: 'string', short: 'o' },
      decimals: { type: 'string' }, cluster: { type: 'string' }, name: { type: 'string' }, force: { type: 'boolean' }, full: { type: 'boolean' },
      D: { type: 'string', short: 'D', multiple: true }, scale: { type: 'string' }, size: { type: 'string' }, volume: { type: 'string' }, iou: { type: 'string' },
      cell: { type: 'string' }, bands: { type: 'string' }, json: { type: 'boolean' }, manifest: { type: 'string' }, only: { type: 'string', multiple: true }, report: { type: 'string' },
    },
  });
  switch (command) {
    case 'inspect':
      if (positionals.length === 0) break;
      await inspect(positionals);
      return 0;
    case 'sections': {
      const [path] = positionals;
      if (!path || (!values.z && !values.step)) break;
      await sections(path, values, (await load(path)).mesh);
      return 0;
    }
    case 'profile': {
      const [path] = positionals;
      if (!path) break;
      const { mesh } = await load(path);
      const b = bounds(mesh);
      const [mx, my] = values.center ? values.center.split(',').map(Number) as [number, number] : [center(b)[0], center(b)[1]];
      const loops = sliceAxial(mesh, mx, my, Number(values.angle ?? 0)).filter(l => (values.full || l.points.every(p => p[0] >= -1e-6)) && Math.abs(l.signedArea) > 1e-6);
      const tolerance = Number(values.simplify ?? 0.02);
      const simplified = loops.map(l => ({ ...l, points: simplifyLoop(l.points, tolerance) }));
      console.log(JSON.stringify({ file: basename(path), center: [mx, my], angle: Number(values.angle ?? 0), simplifyMm: tolerance,
        loops: simplified.map(l => ({ signedArea: round(l.signedArea, 3), hole: l.signedArea < 0, points: l.points.map(p => [round(p[0], 3), round(p[1], 3)]) })) }));
      if (values.svg) await writeFile(values.svg, sectionsToSvg([{ z: Number(values.angle ?? 0), loops: simplified }]));
      return 0;
    }
    case 'render': {
      const [scad] = positionals;
      if (!scad || !values.o) break;
      const defines = Object.fromEntries((values.D ?? []).map(entry => { const [name, ...value] = entry.split('='); return [name ?? '', value.join('=')]; }));
      const rendered = await renderScad(scad, defines);
      await writeFile(values.o, rendered.stl);
      console.log(`${values.o}: ${rendered.stl.length} bytes, ${(rendered.milliseconds / 1000).toFixed(1)} s (${rendered.runner}: ${rendered.version})`);
      return 0;
    }
    case 'polyhedron': {
      const [path] = positionals;
      if (!path || !values.o) break;
      const result = meshToPolyhedron((await load(path)).mesh, {
        ...(values.name ? { name: values.name } : {}), ...(values.decimals ? { decimals: Number(values.decimals) } : {}),
        ...(values.cluster ? { cluster: Number(values.cluster) } : {}),
        header: [`Derived from ${basename(path)} by tools/stl-to-scad (polyhedron fallback).`],
      });
      const megabytes = result.bytes / 1_048_576;
      if (megabytes > 5 && !values.force) throw new Error(`Output would be ${megabytes.toFixed(1)} MB; reduce with --cluster/--decimals or pass --force. Prefer a parametric reconstruction.`);
      await writeFile(values.o, result.scad);
      console.log(`${values.o}: ${result.points} points, ${result.faces} faces, ${megabytes.toFixed(2)} MB${megabytes > 0.5 ? ' (LARGE: do not commit without review)' : ''}`);
      return 0;
    }
    case 'verify': {
      const tolerance = {
        size: values.size ? Number(values.size) : DEFAULT_TOLERANCE.size,
        volume: values.volume ? Number(values.volume) : DEFAULT_TOLERANCE.volume,
        iou: values.iou ? Number(values.iou) : DEFAULT_TOLERANCE.iou,
      };
      let results: VerifyResult[];
      if (values.manifest) {
        results = await verifyManifest(values.manifest, values.only);
      } else {
        const [scad, stl] = positionals;
        if (!scad || !stl) break;
        const defines = Object.fromEntries((values.D ?? []).map(entry => { const [name, ...value] = entry.split('='); return [name ?? '', value.join('=')]; }));
        results = [await verifyScad(scad, stl, {
          defines, tolerance, ...(values.scale ? { scale: Number(values.scale) } : {}), ...(values.cell ? { cellSize: Number(values.cell) } : {}), ...(values.bands ? { bandHeight: Number(values.bands) } : {}),
        })];
      }
      if (values.json) console.log(JSON.stringify(results, null, 2));
      else results.forEach(printResult);
      if (values.report) {
        const manifest = values.manifest ? await readManifest(values.manifest) : undefined;
        await writeFile(values.report, toMarkdown(results, manifest?.title, manifest?.notes));
      }
      return results.every(r => r.pass) ? 0 : 1;
    }
    default:
  }
  console.error(USAGE);
  return 2;
}

main().then(code => { process.exitCode = code; }, (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
