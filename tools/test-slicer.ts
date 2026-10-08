/**
 * Slicer check for the QR tag (docs/qr-magnet-tag.md#slicer-check). CI only: it needs OrcaSlicer, which CI installs pinned
 * (tools/install-orca-slicer.sh), and it renders through the pinned OpenSCAD image as the worker does.
 *
 * For every module style and every nozzle the tag offers, at no bleed, the default bleed and the most bleed, it renders the centre
 * with the smallest module validation allows (`minModuleSize`), slices it with OrcaSlicer's generic profile for that nozzle, reads
 * the dark filament's lines from the G-code and checks every module (tools/slicer/check.ts): one module read wrong fails the case.
 * Each combination is sliced twice: with a real code (which jsQR must also decode) and with the neighbourhood coupon, which holds
 * every 3 × 3 pattern of dark and light modules (tools/slicer/coupon.ts). Negative controls, well under the minimum, must fail, so
 * that a check which can no longer see anything does not pass.
 *
 *   ORCA_SLICER=path        OrcaSlicer's executable (AppRun); ORCA_RESOURCES its resources (default: beside it)
 *   SLICER_SWEEP=1          instead: every style and nozzle at the default bleed, from the minimum to twice it in 10 % steps (nightly)
 *   SLICER_ONLY=dots        only the cases whose name contains this
 *   SLICER_CONCURRENCY=2    cases at once
 *   SLICER_ARTIFACTS=dir    where each failing case's STL, G-code, profiles, picture and report go (default slicer-artifacts)
 *   OPENSCAD_TEST_MODE      the renderer (tools/renderers.ts): Docker by default, or `native`
 */
import { appendFile, cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DEFAULT_QR_MAGNET_TAG, minModuleSize, QR_BLEED, QR_MIN_MODULE, QR_MODULE_STYLES, QR_NOZZLES, qrMagnetTag, validateParameters, type ParameterValues, type QrModuleStyle } from '@canfactory/contracts';
import { selectRunner } from './renderers.ts';
import { CHECK_ECC as ECC, CHECK_TEXT as TEXT, COUPON, sliceSample, type SampleKind } from './slicer/centre.ts';
import { checkPrint, moduleMap, type Grid, type PrintCheck } from './slicer/check.ts';
import { ORCA_PRESETS, orcaInstall, orcaVersion } from './slicer/orca.ts';

const found = orcaInstall();
if (!found) {
  if (process.env['CI']) { console.error('::error title=Slicer check::ORCA_SLICER is not set: install OrcaSlicer with tools/install-orca-slicer.sh first.'); process.exit(1); }
  console.log('Slicer check skipped: it runs in CI, where tools/install-orca-slicer.sh installs OrcaSlicer (set ORCA_SLICER to run it here).');
  process.exit(0);
}
const install = found;

const sweep = process.env['SLICER_SWEEP'] === '1';
const only = process.env['SLICER_ONLY'];
const concurrency = Math.max(1, Number(process.env['SLICER_CONCURRENCY'] ?? '2'));
const artifacts = resolve(process.env['SLICER_ARTIFACTS'] ?? 'slicer-artifacts');

interface Case { name: string; kind: SampleKind; style: QrModuleStyle; nozzle: string; bleed: number; module: number; minimum: number; expect: 'pass' | 'fail' }

const cases: Case[] = [];
for (const style of QR_MODULE_STYLES) for (const nozzle of QR_NOZZLES) {
  const minimum = (bleed: number) => minModuleSize(style, Number(nozzle), bleed);
  if (sweep) {
    for (let step = 0; step <= 10; step++) {
      const module = Math.round(minimum(QR_BLEED.default) * (1 + step / 10) * 1000) / 1000;
      cases.push({ name: `${style}, ${nozzle} mm nozzle, bleed ${QR_BLEED.default} mm, ${module} mm modules (minimum × ${1 + step / 10}), code`, kind: 'code', style, nozzle, bleed: QR_BLEED.default, module, minimum: minimum(QR_BLEED.default), expect: 'pass' });
    }
    continue;
  }
  for (const bleed of [QR_BLEED.minimum, QR_BLEED.default, QR_BLEED.maximum]) for (const kind of ['code', 'coupon'] as const)
    cases.push({ name: `${style}, ${nozzle} mm nozzle, bleed ${bleed} mm, ${kind}`, kind, style, nozzle, bleed, module: minimum(bleed), minimum: minimum(bleed), expect: 'pass' });
  // negative control: at 60 % of the minimum the check must see the code fail
  if (nozzle === '0.4') cases.push({ name: `${style}, 0.4 mm nozzle, bleed ${QR_BLEED.default} mm, 60 % of the minimum (must fail), coupon`, kind: 'coupon', style, nozzle, bleed: QR_BLEED.default, module: Math.round(minimum(QR_BLEED.default) * 0.6 * 1000) / 1000, minimum: minimum(QR_BLEED.default), expect: 'fail' });
}
const selected = cases.filter(c => !only || c.name.includes(only));

interface Outcome { c: Case; ok: boolean; check?: PrintCheck; grid?: Grid; error?: string; seconds: number; command?: string[]; parameters: ParameterValues; size: number; directory: string }

const data = await mkdtemp(join(tmpdir(), 'canfactory-slicer-'));
const runner = selectRunner(data);
const version = await orcaVersion(install);
console.log(`Slicer check: ${version}, presets "${ORCA_PRESETS.machine}" (nozzle changed per case), "${ORCA_PRESETS.process}" (layer height changed), "${ORCA_PRESETS.filament}"; ${selected.length} cases${sweep ? ' (sweep)' : ''}.`);

async function run(c: Case, index: number): Promise<Outcome> {
  const started = Date.now();
  const directory = join(data, `case-${index}`);
  await mkdir(directory, { recursive: true });
  const outcome: Outcome = { c, ok: false, seconds: 0, parameters: {}, size: 0, directory };
  try {
    const sliced = await sliceSample(c, directory, runner, install);
    Object.assign(outcome, { parameters: sliced.parameters, size: Number(sliced.parameters['size']), command: sliced.command, grid: sliced.grid });
    const check = checkPrint(sliced.lines, sliced.changeHeight, sliced.grid, c.bleed);
    const reads = check.errors.length === 0 && check.extrusions > 0 && (c.kind === 'coupon' || check.decoded === TEXT);
    Object.assign(outcome, { check, ok: c.expect === 'pass' ? reads : check.errors.length > 0 });
  } catch (error) {
    outcome.error = error instanceof Error ? `${error.message}${'command' in error ? `\n    command: ${(error.command as string[]).join(' ')}` : ''}` : String(error);
  }
  outcome.seconds = (Date.now() - started) / 1000;
  return outcome;
}

const percent = (share: number) => `${Math.round(share * 100)} %`;
const differing = (parameters: ParameterValues) => Object.fromEntries(Object.entries(parameters).filter(([key, value]) => (DEFAULT_QR_MAGNET_TAG as ParameterValues)[key] !== value));

/** Everything needed to find the bug from the log alone; also written to the case's report.txt. */
function report(o: Outcome): string {
  const { c, check, grid } = o;
  const factor = QR_MIN_MODULE[c.style];
  const lines = [
    `FAIL ${c.name}`,
    `  expected: ${c.expect === 'pass' ? 'every module read right' + (c.kind === 'code' ? ' and jsQR decodes the text' : '') : 'at least one module read wrong (a negative control)'}`,
    `  module ${c.module} mm; validation's minimum for ${c.style} with a ${c.nozzle} mm nozzle and ${c.bleed} mm bleed: ${c.minimum} mm`
      + ` (QR_MIN_MODULE['${c.style}'] = ${c.nozzle} × ${factor.nozzle} + ${c.bleed} × ${factor.bleed}, at least ${factor.floor}; packages/contracts/src/qrMagnetTag.ts)`,
    `  tile ${o.size} mm, layer ${o.parameters['layerHeight']} mm; parameters differing from the defaults: ${JSON.stringify(differing(o.parameters))}`,
    `  ${c.kind === 'coupon' ? `the ${COUPON.length} × ${COUPON.length} neighbourhood coupon (tools/slicer/coupon.ts) in place of the code` : `the code of ${JSON.stringify(TEXT)} at ${ECC}`}`,
  ];
  if (o.error) lines.push(`  error: ${o.error}`);
  if (check && grid) {
    lines.push(`  dark lines: ${check.extrusions} extrusions on ${check.layers.length} layers (z ${check.layers.join(', ')})`);
    lines.push(`  ${check.errors.length} of ${check.modules} modules read wrong; least dark middle of a dark module ${percent(check.worstDark)}, darkest light module ${percent(check.worstLight)} (the limit is 50 %)`);
    if (c.kind === 'code') lines.push(`  jsQR: ${check.decoded === undefined ? 'does not decode' : check.decoded === TEXT ? 'decodes the text' : `decodes ${JSON.stringify(check.decoded)}`}`);
    const light = check.errors.filter(error => error.shouldBe === 'light').length;
    const rings = check.errors.filter(error => error.shouldBe === 'dark' && error.whole >= 0.6).length, thin = check.errors.length - light - rings;
    const causes = [
      light > 0 ? `${light} light modules fill in (the lines plus the bleed close the gaps)` : '',
      rings > 0 ? `${rings} dark modules print as rings (mostly dark, but the walls leave their middle empty: see min_bead_width in tools/slicer/orca.ts)` : '',
      thin > 0 ? `${thin} dark modules thin out or vanish (narrower than the slicer prints)` : '',
    ].filter(Boolean);
    if (c.expect === 'pass' && check.errors.length > 0)
      lines.push(`  likely cause: ${causes.join('; ')}. Raise QR_MIN_MODULE['${c.style}'], or fix the style's shapes in models/qr-magnet-tag/generator.scad (modules_2d)`);
    if (c.expect === 'fail' && check.errors.length === 0)
      lines.push(`  the check read a code at 60 % of the minimum as perfect: it no longer sees what slicing does (tools/slicer/check.ts, gcode.ts)`);
    for (const error of check.errors.slice(0, 20)) lines.push(`    row ${error.row}, column ${error.column}: should be ${error.shouldBe}; middle ${percent(error.middle)} dark, whole module ${percent(error.whole)}`);
    if (check.errors.length > 20) lines.push(`    … and ${check.errors.length - 20} more`);
    if (check.errors.length > 0) lines.push('  module map (# dark, . light, X should be dark but reads light, O should be light but reads dark):', ...moduleMap(grid, check.errors).split('\n').map(row => `    ${row}`));
  }
  if (o.command) lines.push(`  OrcaSlicer: ${o.command.join(' ')}`);
  lines.push(`  artefacts: ${join(artifacts, slug(c.name))}/ (centre.stl, plate_1.gcode, the profiles, top.png with the wrong modules framed, report.txt)`);
  lines.push(`  reproduce: ORCA_SLICER=<AppRun> SLICER_ONLY=${JSON.stringify(c.name)} npm run test:slicer`);
  return lines.join('\n');
}
const slug = (name: string) => name.replace(/[^a-z0-9.]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

const results: (Outcome | undefined)[] = selected.map(() => undefined);
let next = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < selected.length) {
    const index = next++;
    const c = selected[index];
    if (!c) continue;
    const o = await run(c, index);
    results[index] = o;
    const summary = o.check ? `${o.check.errors.length} of ${o.check.modules} modules wrong, darkest light ${percent(o.check.worstLight)}, least dark ${percent(o.check.worstDark)}${c.kind === 'code' ? `, ${o.check.decoded === TEXT ? 'decodes' : 'does not decode'}` : ''}` : 'no result';
    if (o.ok) console.log(`PASS ${c.name}: ${c.module} mm modules, ${summary}, ${o.seconds.toFixed(1)} s`);
    else {
      const text = report(o);
      console.log(text);
      console.log(`::error title=Slicer check: ${c.name}::${c.expect === 'pass' ? `${o.error ? 'error' : summary} at ${c.module} mm modules (minimum ${c.minimum} mm). See the log and the slicer-artifacts for the module map.` : 'the negative control read perfectly'}`);
      const keep = join(artifacts, slug(c.name));
      await mkdir(keep, { recursive: true });
      await cp(o.directory, keep, { recursive: true }).catch(() => undefined);
      if (o.check) await writeFile(join(keep, 'top.png'), o.check.png);
      await writeFile(join(keep, 'report.txt'), `${text}\n`);
    }
    await rm(o.directory, { recursive: true, force: true });
  }
}));

const outcomes = results.filter((o): o is Outcome => o !== undefined);

// validation agrees with the check: at the minimum (rounded up to a whole millimetre of tile) it accepts the code, below it refuses
const disagreements: string[] = [];
for (const o of outcomes) {
  if (o.c.kind !== 'code' || o.c.expect !== 'pass' || sweep) continue;
  const at = Math.ceil(o.size - 1e-9), below = Math.floor(o.size - 0.02);
  const issues = (size: number) => size >= 30 && size <= 120 ? validateParameters(qrMagnetTag, { ...o.parameters, size }).filter(issue => issue.field === 'qrText') : undefined;
  const accepted = issues(at), refused = issues(below);
  if (accepted && accepted.length > 0) disagreements.push(`${o.c.name}: validation refuses a ${at} mm tile: ${accepted.map(issue => issue.message).join(' ')}`);
  if (refused && refused.length === 0 && o.size - below > 0.05) disagreements.push(`${o.c.name}: validation accepts a ${below} mm tile, below the minimum module`);
}
for (const line of disagreements) console.log(`::error title=Slicer check: validation::${line}`);

const failed = outcomes.filter(o => !o.ok);
const table = ['| Case | Module | Result |', '|---|---|---|', ...outcomes.map(o => `| ${o.c.name} | ${o.c.module} mm | ${o.ok ? 'pass' : `**FAIL**${o.check ? `: ${o.check.errors.length} modules wrong` : o.error ? ': error' : ''}`} |`)].join('\n');
if (process.env['GITHUB_STEP_SUMMARY']) await appendFile(process.env['GITHUB_STEP_SUMMARY'], `## Slicer check (${version})\n\n${failed.length} of ${outcomes.length} cases failed.\n\n${table}\n`);
await rm(data, { recursive: true, force: true });
console.log(`\nSlicer check: ${outcomes.length - failed.length} of ${outcomes.length} cases passed${disagreements.length ? `; ${disagreements.length} validation disagreements` : ''}.`);
if (failed.length > 0 || disagreements.length > 0) process.exit(1);
