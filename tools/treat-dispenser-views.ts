/**
 * Evidence for the treat dispenser's form (docs/treat-dispenser.md, "Packaging"): renders every part as the worker does, then
 *   - parts.json / a table: each printed part's geometric volume and bounding box, and the assembly's overall size;
 *   - with PRUSA_SLICER set (a PrusaSlicer executable): each printed part sliced with one fixed profile (tools/treat-dispenser.ini:
 *     0.4 mm nozzle, 0.2 mm layers, PETG, automatic supports), its filament and support estimate as the slicer reports them;
 *   - views/*.png: front, side, three-quarter and cutaway views of the assembly with a representative bottle envelope.
 *
 *   PATH=/path/to/openscad:$PATH OPENSCAD_RUNNER=native npx tsx tools/treat-dispenser-views.ts <out-dir>
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { findModel, posePoint, resolveAssembly, treatDispenserPlacement, TREAT_PRINTED_PARTS, type TreatDispenserParameters } from '@canfactory/contracts';
import { renderAssemblyMeshes } from './assembly-meshes.ts';
import { writeBinaryStl, type Mesh } from './stl-to-scad/stl.ts';

const exec = promisify(execFile);
const out = resolve(process.argv[2] ?? 'treat-dispenser-views');
const model = findModel('treat-dispenser');
if (!model?.assembly) throw new Error('No treat dispenser model.');
const p = model.defaults as TreatDispenserParameters;
const assembly = resolveAssembly(model, model.assembly, model.defaults) ?? model.assembly;
const meshes = await renderAssemblyMeshes(model as never, assembly, model.defaults);
await mkdir(join(out, 'stl'), { recursive: true });
await mkdir(join(out, 'views'), { recursive: true });

/** Volume (mm³) and bounds of a closed mesh. */
function measure(mesh: Mesh): { volume: number; min: number[]; max: number[] } {
  const t = mesh.tris;
  let volume = 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < t.length; i += 9) {
    const [ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0, cx = 0, cy = 0, cz = 0] = t.subarray(i, i + 9);
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  for (let i = 0; i < t.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k] ?? 0, t[i + k] ?? 0); max[k] = Math.max(max[k] ?? 0, t[i + k] ?? 0); }
  return { volume: Math.abs(volume), min, max };
}

const rows: { id: string; volume: number; size: number[]; filament?: string; support?: string; time?: string }[] = [];
const slicer = process.env['PRUSA_SLICER'];
for (const id of TREAT_PRINTED_PARTS) {
  const mesh = meshes.get(id);
  if (!mesh) throw new Error(`No mesh for ${id}.`);
  const file = join(out, 'stl', `${id}.stl`);
  await writeFile(file, writeBinaryStl(mesh));
  const m = measure(mesh);
  const row: (typeof rows)[number] = { id, volume: m.volume, size: m.max.map((value, k) => value - (m.min[k] ?? 0)) };
  if (slicer) {
    const gcode = join(out, 'stl', `${id}.gcode`);
    // the part as exported (its print orientation), centred on the bed; supports wherever the profile's overhang rule asks
    await exec(slicer, ['--load', resolve('tools/treat-dispenser.ini'), '--center', '125,105', '--export-gcode', '--output', gcode, file], { maxBuffer: 1 << 26 });
    const text = await readFile(gcode, 'utf8');
    const read = (pattern: RegExp) => pattern.exec(text)?.[1]?.trim();
    row.filament = read(/; filament used \[g\] = ([\d.]+)/) ?? '?';
    row.time = read(/; estimated printing time \(normal mode\) = (.+)/) ?? '?';
    // support: the extrusion the slicer labels as support material, in mm of filament
    // (the profile extrudes in relative E)
    let support = 0, inSupport = false;
    for (const line of text.split('\n')) {
      if (line.startsWith(';TYPE:')) inSupport = /Support/i.test(line);
      const e = / E(-?[\d.]+)/.exec(line);
      if (inSupport && line.startsWith('G1') && e && Number(e[1]) > 0) support += Number(e[1]);
    }
    // 1.75 mm filament, PETG 1.27 g/cm³
    row.support = (support * Math.PI * 0.875 ** 2 / 1000 * 1.27).toFixed(1);
  }
  rows.push(row);
}

// the posed scene: every part and reference at its assembly pose, and a representative 1.5 l bottle (Ø per the parameters)
const colors = assembly.partColors ?? {};
const placement = treatDispenserPlacement(p);
const all = new Map(meshes);
const lines: string[] = [];
let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (const [id, mesh] of all) {
  const pose = assembly.poses[id];
  if (!pose) continue;
  const file = join(out, 'stl', `${id}.stl`);
  if (!(TREAT_PRINTED_PARTS as readonly string[]).includes(id)) await writeFile(file, writeBinaryStl(mesh));
  const rotation = pose.rotation ?? [0, 0, 0];
  lines.push(`color("${colors[id] ?? '#9aa0a6'}") translate([${pose.position.join(',')}]) rotate([${rotation.join(',')}]) import("${file}");`);
}
const seat = placement.seatW, r = p.bottleDiameter / 2;
// inverted bottle: neck (Ø28, 20 mm) up from the adapter, a 40 mm shoulder, then the body to 300 mm
const bottle = `translate([${seat[0]},${seat[1]},${seat[2] + 4}]) { cylinder(d = 28, h = 22, $fn = 48); translate([0, 0, 22]) cylinder(d1 = 28, d2 = ${2 * r}, h = 40, $fn = 96); translate([0, 0, 62]) cylinder(r = ${r}, h = 238, $fn = 96); }`;
const scene = (cut: boolean, withBottle: boolean) => [
  cut ? 'difference() { union() {' : 'union() {',
  ...lines,
  withBottle ? `%${bottle}` : '',
  cut ? '} translate([0, -500, -10]) cube([500, 1000, 1000]); }' : '}',
].join('\n');
await writeFile(join(out, 'scene.scad'), scene(false, true));
await writeFile(join(out, 'cutaway.scad'), scene(true, true));
await writeFile(join(out, 'mechanism.scad'), scene(false, false));
// the assembled dispenser's overall size (every posed part and reference, not the coupon or the bottle)
for (const [id, mesh] of all) {
  const pose = assembly.poses[id];
  if (!pose || id === 'coupon') continue;
  const t = mesh.tris;
  for (let i = 0; i < t.length; i += 3) {
    const q = posePoint({ position: pose.position, rotation: pose.rotation ?? [0, 0, 0] }, [t[i] ?? 0, t[i + 1] ?? 0, t[i + 2] ?? 0]);
    lo = lo.map((value, k) => Math.min(value, q[k] ?? 0)); hi = hi.map((value, k) => Math.max(value, q[k] ?? 0));
  }
}
const overall = hi.map((value, k) => value - (lo[k] ?? 0));
const views: [string, string, number[]][] = [
  ['front', 'scene.scad', [0, -600, 150, 0, 0, 120]],
  ['side', 'scene.scad', [600, 0, 150, 0, 0, 120]],
  ['three-quarter', 'scene.scad', [420, -460, 330, 20, 0, 110]],
  ['three-quarter-close', 'mechanism.scad', [260, -300, 200, 20, 20, 60]],
  ['cutaway', 'cutaway.scad', [600, -60, 120, 0, 20, 90]],
  ['back', 'mechanism.scad', [-200, 500, 200, 20, 20, 60]],
];
for (const [name, file, camera] of views) {
  await exec('openscad', ['-o', join(out, 'views', `${name}.png`), `--camera=${camera.join(',')}`, '--projection=p', '--autocenter', '--viewall', '--imgsize=1400,1100', '--colorscheme=Tomorrow', join(out, file)], { maxBuffer: 1 << 26 });
  console.log(`view ${name}`);
}

const total = rows.reduce((sum, row) => sum + row.volume, 0);
const table = ['| Part | Volume (cm³) | Size as printed (mm) | Filament (g) | Of which support (g) | Time |', '| --- | --- | --- | --- | --- | --- |',
  ...rows.map(row => `| ${row.id} | ${(row.volume / 1000).toFixed(1)} | ${row.size.map(v => v.toFixed(0)).join(' × ')} | ${row.filament ?? '—'} | ${row.support ?? '—'} | ${row.time ?? '—'} |`),
  `| **all printed parts** | **${(total / 1000).toFixed(1)}** | | ${slicer ? rows.reduce((s, row) => s + Number(row.filament ?? 0), 0).toFixed(1) : '—'} | ${slicer ? rows.reduce((s, row) => s + Number(row.support ?? 0), 0).toFixed(1) : '—'} | |`].join('\n');
const size = `Assembled dispenser (without bottle and coupon): ${overall.map(v => v.toFixed(0)).join(' × ')} mm (X × Y × Z)`;
await writeFile(join(out, 'parts.json'), JSON.stringify({ overall, rows }, null, 2));
await writeFile(join(out, 'parts.md'), `${table}\n\n${size}\n`);
console.log(`${table}\n\n${size}`);
