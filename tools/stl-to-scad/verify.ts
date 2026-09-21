import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { compareMeshes, type Comparison } from './compare.ts';
import { renderScad, type Defines, type Render } from './openscad.ts';
import { bounds, parseStl, sha256, size, type Mesh } from './stl.ts';
import { analyzeTopology, type Topology } from './topology.ts';

/** Acceptance limits. Defaults are documented in .claude/skills/stl-to-scad/SKILL.md. */
export interface Tolerance {
  /** Max per-axis bounding-box size difference, mm. */
  size: number;
  /** Max |relative volume error|. */
  volume: number;
  /** Min intersection-over-union. */
  iou: number;
}

export const DEFAULT_TOLERANCE: Tolerance = { size: 0.1, volume: 0.02, iou: 0.96 };

export interface ManifestPart {
  name: string;
  /** Paths are relative to the manifest file. */
  scad: string;
  stl: string;
  /** Scale applied to the STL before comparing (e.g. render a small SCAD and compare with a larger twin). */
  scale?: number;
  defines?: Defines;
  /** SHA-256 of the source STL, recorded so the report stays meaningful once the STL leaves the repository. */
  sourceSha256?: string;
  note?: string;
}

export interface Manifest { tolerance?: Partial<Tolerance>; cellSize?: number; parts: ManifestPart[] }

export interface VerifyResult {
  name: string;
  scad: string;
  stl: string;
  pass: boolean;
  failures: string[];
  scadBytes: number;
  reference: { triangles: number; size: [number, number, number]; sha256: string };
  candidate: { triangles: number; size: [number, number, number]; topology: Topology };
  comparison: Comparison;
  render: Pick<Render, 'runner' | 'version' | 'milliseconds'>;
  tolerance: Tolerance;
}

export interface VerifyOptions { defines?: Defines; scale?: number; tolerance?: Partial<Tolerance>; cellSize?: number; bandHeight?: number; name?: string }

/** Judge a comparison against tolerances. Pure so it can be unit tested without a renderer. */
export function judge(topology: Topology, comparison: Comparison, tolerance: Tolerance): string[] {
  const failures: string[] = [];
  if (!topology.watertight)
    failures.push(`rendered mesh is not one closed manifold body (open edges ${topology.openOrNonManifoldEdges}, winding conflicts ${topology.windingConflicts}, degenerate ${topology.degenerate}, bodies ${topology.bodies})`);
  if (comparison.maxSizeDelta > tolerance.size) failures.push(`bounding box differs by ${comparison.maxSizeDelta.toFixed(3)} mm (limit ${tolerance.size})`);
  if (Math.abs(comparison.volumeRelativeError) > tolerance.volume) failures.push(`volume differs by ${(comparison.volumeRelativeError * 100).toFixed(2)} % (limit ${tolerance.volume * 100} %)`);
  if (comparison.iou < tolerance.iou) failures.push(`IoU ${comparison.iou.toFixed(4)} below ${tolerance.iou}`);
  if (comparison.skippedColumns > 0.005 * comparison.occupiedColumns) failures.push(`${comparison.skippedColumns} ray columns were unusable`);
  return failures;
}

export function verifyMeshes(reference: Mesh, referenceBytes: Buffer, candidateBytes: Buffer, render: Render, names: { name: string; scad: string; stl: string; scadBytes: number }, options: VerifyOptions = {}): VerifyResult {
  const tolerance = { ...DEFAULT_TOLERANCE, ...options.tolerance };
  const candidate = parseStl(candidateBytes);
  const topology = analyzeTopology(candidate);
  const comparison = compareMeshes(reference, candidate, { ...(options.cellSize === undefined ? {} : { cellSize: options.cellSize }), ...(options.scale === undefined ? {} : { referenceScale: options.scale }), ...(options.bandHeight === undefined ? {} : { bandHeight: options.bandHeight }) });
  const failures = judge(topology, comparison, tolerance);
  return {
    ...names, pass: failures.length === 0, failures,
    reference: { triangles: reference.tris.length / 9, size: size(bounds(reference)), sha256: sha256(referenceBytes) },
    candidate: { triangles: candidate.tris.length / 9, size: size(bounds(candidate)), topology },
    comparison, render: { runner: render.runner, version: render.version, milliseconds: render.milliseconds }, tolerance,
  };
}

export async function verifyScad(scadPath: string, stlPath: string, options: VerifyOptions = {}): Promise<VerifyResult> {
  const referenceBytes = await readFile(stlPath);
  const reference = parseStl(referenceBytes);
  const render = await renderScad(scadPath, options.defines ?? {});
  return verifyMeshes(reference, referenceBytes, render.stl, render, { name: options.name ?? scadPath, scad: scadPath, stl: stlPath, scadBytes: (await stat(scadPath)).size }, options);
}

export async function verifyManifest(manifestPath: string, only?: string[]): Promise<VerifyResult[]> {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
  const base = dirname(resolve(manifestPath));
  const results: VerifyResult[] = [];
  for (const part of manifest.parts) {
    if (only && only.length > 0 && !only.some(pattern => part.name.includes(pattern))) continue;
    results.push(await verifyScad(resolve(base, part.scad), resolve(base, part.stl), {
      name: part.name,
      ...(part.defines ? { defines: part.defines } : {}),
      ...(part.scale === undefined ? {} : { scale: part.scale }),
      ...(manifest.tolerance ? { tolerance: manifest.tolerance } : {}),
      ...(manifest.cellSize === undefined ? {} : { cellSize: manifest.cellSize }),
    }));
  }
  return results;
}

const mm = (v: number, digits = 3): string => v.toFixed(digits);

export function toMarkdown(results: VerifyResult[], title = 'STL to SCAD verification'): string {
  const first = results[0];
  const lines = [
    `# ${title}`, '',
    first ? `Renderer: ${first.render.runner} — ${first.render.version} (Manifold backend). Tolerance: bbox ≤ ${first.tolerance.size} mm, volume ≤ ${first.tolerance.volume * 100} %, IoU ≥ ${first.tolerance.iou}, one closed manifold body; cell ${first.comparison.cellSize} mm.` : '',
    '',
    '| Part | Result | Size Δ (mm) | Volume Δ | IoU | Mean dev (mm) | Ref tris | SCAD bytes | Render (s) |',
    '|---|---|---|---|---|---|---|---|---|',
    ...results.map(r => `| ${r.name} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.comparison.sizeDelta.map(v => mm(v, 3)).join(' / ')} | ${(r.comparison.volumeRelativeError * 100).toFixed(2)} % | ${mm(r.comparison.iou, 4)} | ${mm(r.comparison.meanDeviation, 3)} | ${r.reference.triangles} | ${r.scadBytes} | ${(r.render.milliseconds / 1000).toFixed(1)} |`),
    '',
    '## Sources',
    '',
    ...results.map(r => `- \`${r.name}\`: source STL SHA-256 \`${r.reference.sha256}\`, ${r.reference.size.map(v => mm(v, 2)).join(' × ')} mm`),
    '',
  ];
  const failed = results.filter(r => !r.pass);
  if (failed.length > 0) lines.push('## Failures', '', ...failed.flatMap(r => [`- ${r.name}: ${r.failures.join('; ')}`]), '');
  return lines.join('\n');
}
