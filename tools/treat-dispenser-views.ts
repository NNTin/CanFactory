/**
 * Evidence for the treat dispenser's form (docs/treat-dispenser.md, "Packaging"): renders every part as the worker does, then
 *   - parts.json / a table: each printed part's geometric volume and bounding box, and the assembly's overall size;
 *   - with PRUSA_SLICER set (a PrusaSlicer executable): each printed part sliced with one fixed profile (tools/treat-dispenser.ini:
 *     0.4 mm nozzle, 0.2 mm layers, PETG), its filament and support estimate as the slicer reports them. CanFactory's parts are
 *     sliced without supports (they are drawn to need none: every overhang is at least 50°, a short bridge, or the bottle thread's
 *     1.6 mm groove, which a slicer's automatic supports would fill down through the mechanism); the reused ESP32 case parts with
 *     automatic supports, as their own model prints them. AUTO_SUPPORTS=1 slices every part with automatic supports, for comparison;
 *   - wiring: the room the jumper wires need on both of the SuperMini's header rows and on the ULN2003 (treatWiringRoom), measured
 *     against every posed part and reference (but the boards and headers the wires plug into): it fails if any reaches into it;
 *   - views/*.png: front, side, three-quarter and cutaway views of the assembly with a representative bottle envelope, and three views
 *     inside it (the outer body left out).
 *
 *   PATH=/path/to/openscad:$PATH OPENSCAD_RUNNER=native npx tsx tools/treat-dispenser-views.ts <out-dir>
 */
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { findModel, posePoint, resolveAssembly, treatDispenserLayout, treatWiringRoom, TREAT_PRINTED_PARTS, type TreatDispenserParameters } from '@canfactory/contracts';
import { renderAssemblyMeshes } from './assembly-meshes.ts';
import { intersectionVolume } from './stl-to-scad/compare.ts';
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
const autoSupports = process.env['AUTO_SUPPORTS'] === '1';
const reused = new Set(['case-bottom', 'case-top']);
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
    const supports = autoSupports || reused.has(id) ? [] : ['--no-support-material'];
    await exec(slicer, ['--load', resolve('tools/treat-dispenser.ini'), ...supports, '--center', '125,105', '--export-gcode', '--output', gcode, file], { maxBuffer: 1 << 26 });
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
const layout = treatDispenserLayout(p);
const all = new Map(meshes);
const lines: string[] = [], inside: string[] = [];
let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (const [id, mesh] of all) {
  const pose = assembly.poses[id];
  // the thread coupon is a loose test print, not part of the dispenser
  if (!pose || id === 'coupon') continue;
  const file = join(out, 'stl', `${id}.stl`);
  if (!(TREAT_PRINTED_PARTS as readonly string[]).includes(id)) await writeFile(file, writeBinaryStl(mesh));
  const rotation = pose.rotation ?? [0, 0, 0];
  const line = `color("${colors[id] ?? '#9aa0a6'}") translate([${pose.position.join(',')}]) rotate([${rotation.join(',')}]) import("${file}");`;
  lines.push(line);
  // the inside views leave the outer body out
  if (id !== 'outer-body') inside.push(line);
}
// the jumper wires' room, against every posed part but the boards and the headers they plug into
const placed = new Map<string, Mesh>();
for (const [id, mesh] of all) {
  const pose = assembly.poses[id];
  if (!pose || id === 'coupon') continue;
  const tris = new Float64Array(mesh.tris.length);
  for (let i = 0; i < tris.length; i += 3) tris.set(posePoint({ position: pose.position, rotation: pose.rotation ?? [0, 0, 0] }, [mesh.tris[i] ?? 0, mesh.tris[i + 1] ?? 0, mesh.tris[i + 2] ?? 0]), i);
  placed.set(id, { tris });
}
const boxMesh = (min: number[], max: number[]): Mesh => {
  const [x0 = 0, y0 = 0, z0 = 0] = min, [x1 = 0, y1 = 0, z1 = 0] = max;
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  return { tris: Float64Array.from(faces.flatMap(face => face.flatMap(k => v[k] ?? [0, 0, 0]))) };
};
const plugged = new Set(['board', 'header-1', 'header-2', 'driver']);
let blocked = false;
for (const room of treatWiringRoom(p)) {
  const hits = [...placed].filter(([id]) => !plugged.has(id)).map(([id, mesh]) => [id, intersectionVolume(boxMesh(room.min, room.max), mesh, 0.25)] as const).filter(([, volume]) => volume > 0.01);
  console.log(`${hits.length ? 'FAIL' : 'ok  '} wiring: ${room.title}, ${room.min.map((v, k) => `${v.toFixed(1)}…${(room.max[k] ?? 0).toFixed(1)}`).join(' × ')}${hits.map(([id, volume]) => `; ${id} ${volume.toFixed(2)} mm³`).join('')}`);
  blocked ||= hits.length > 0;
}

const r = p.bottleDiameter / 2;
// an inverted 0.5 l bottle: neck (Ø28, 20 mm) up from the lip, a 25 mm shoulder, then its body, about 200 mm in all
const bottle = `translate([0, 0, ${layout.lipZ}]) { cylinder(d = 28, h = 20, $fn = 48); translate([0, 0, 20]) cylinder(d1 = 28, d2 = ${2 * r}, h = 25, $fn = 96); translate([0, 0, 45]) cylinder(r = ${r}, h = 155, $fn = 96); }`;
const scene = (cut: boolean, withBottle: boolean) => [
  cut ? 'difference() { union() {' : 'union() {',
  ...lines,
  withBottle ? `%${bottle}` : '',
  cut ? '} translate([0, -500, -10]) cube([500, 1000, 1000]); }' : '}',
].join('\n');
await writeFile(join(out, 'scene.scad'), scene(false, true));
await writeFile(join(out, 'cutaway.scad'), scene(true, true));
await writeFile(join(out, 'mechanism.scad'), scene(false, false));
await writeFile(join(out, 'inside.scad'), ['union() {', ...inside, '}'].join('\n'));
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
// close-ups framed on the dispenser (the bottle envelope translucent behind them), one full view with the whole bottle, and a cutaway
// through the dispenser's middle (X = 0), rendered as solids so that the cut faces are clean
const centre = [0, 0, layout.axisZ - 10];
const close = (eye: number[]): number[] => [...eye.map((value, k) => 0.8 * value + (centre[k] ?? 0)), ...centre];
const views: [string, string, number[], boolean][] = [
  ['front', 'scene.scad', close([0, -430, 60]), false],
  ['side', 'scene.scad', close([430, 0, 60]), false],
  ['three-quarter', 'scene.scad', close([300, -320, 200]), false],
  ['back', 'mechanism.scad', close([-260, 380, 160]), false],
  ['cutaway', 'cutaway.scad', close([430, -40, 40]), true],
  ['full', 'scene.scad', [420, -460, 330, 20, 0, 110], false],
  // without the outer body: the motor, the ULN2003 and their screws on the right; the ESP32 case's two header rows from the front left
  ['inside-right', 'inside.scad', close([330, -300, 120]), false],
  ['inside-left', 'inside.scad', close([-330, -260, 60]), false],
  ['inside-back', 'inside.scad', close([-120, 420, 60]), false],
];
for (const [name, file, camera, solid] of views) {
  const fit = name === 'full' ? ['--autocenter', '--viewall'] : [];
  await exec('openscad', ['-o', join(out, 'views', `${name}.png`), `--camera=${camera.join(',')}`, '--projection=p', ...fit, ...(solid ? ['--render', '--backend=manifold'] : []), '--imgsize=1400,1100', '--colorscheme=Tomorrow', join(out, file)], { maxBuffer: 1 << 26 });
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
if (blocked) process.exitCode = 1;
