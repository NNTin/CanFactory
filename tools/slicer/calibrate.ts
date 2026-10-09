/**
 * How QR_MIN_MODULE (packages/contracts/src/qrMagnetTag.ts) was found, and how to find it again after an OrcaSlicer upgrade: for every
 * module style and nozzle, slice the real code and the neighbourhood coupon at module widths from large to small (5 % apart), check
 * each at several bleeds, and report per bleed the smallest width from which every larger width read right. Needs OrcaSlicer
 * (ORCA_SLICER, as tools/test-slicer.ts) and OpenSCAD (OPENSCAD_TEST_MODE).
 *
 *   npx tsx tools/slicer/calibrate.ts > calibration.json     (CALIBRATE_ONLY=dots, CALIBRATE_CONCURRENCY=4)
 */
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { QR_MODULE_STYLES, QR_NOZZLES, type QrModuleStyle } from '@canfactory/contracts';
import { selectRunner } from '../renderers.ts';
import { CHECK_TEXT, sliceSample, type SampleKind } from './centre.ts';
import { checkPrint } from './check.ts';
import { orcaInstall } from './orca.ts';

const install = orcaInstall() ?? (() => { throw new Error('Set ORCA_SLICER.'); })();
const BLEEDS = [0, 0.05, 0.1, 0.15, 0.2];
const only = process.env['CALIBRATE_ONLY'];
const concurrency = Math.max(1, Number(process.env['CALIBRATE_CONCURRENCY'] ?? '4'));
const data = await mkdtemp(join(tmpdir(), 'canfactory-calibrate-'));
const runner = selectRunner(data);
let counter = 0;

/** Whether a module width reads right at each bleed (code and coupon both). */
async function reads(style: QrModuleStyle, nozzle: string, module: number): Promise<boolean[]> {
  const results = await Promise.all((['code', 'coupon'] as SampleKind[]).map(async kind => {
    const directory = join(data, `s${counter++}`);
    await mkdir(directory, { recursive: true });
    try {
      const sliced = await sliceSample({ kind, style, nozzle, bleed: 0, module }, directory, runner, install);
      return BLEEDS.map(bleed => { const check = checkPrint(sliced.lines, sliced.changeHeight, sliced.grid, bleed); return check.errors.length === 0 && (kind === 'coupon' || check.decoded === CHECK_TEXT); });
    } catch (error) { console.error(`${style} ${nozzle} ${module}: ${error instanceof Error ? error.message : String(error)}`); return BLEEDS.map(() => false); }
    finally { await rm(directory, { recursive: true, force: true }); }
  }));
  return BLEEDS.map((_, b) => results.every(result => result[b]));
}

const jobs = QR_MODULE_STYLES.flatMap(style => QR_NOZZLES.map(nozzle => ({ style, nozzle }))).filter(job => !only || job.style === only);
const out: { style: string; nozzle: string; ladder: [number, boolean[]][]; minimum: Record<string, number | null> }[] = [];
let next = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++];
    if (!job) continue;
    const nozzle = Number(job.nozzle);
    const ladder: [number, boolean[]][] = [];
    // from comfortably large down, until two widths in a row fail at every bleed (no bleed fails some widths that more bleed
    // passes: it leaves the middle of small modules empty)
    let failedInARow = 0;
    for (let module = 4 * nozzle + 0.8; module > 0.8 * nozzle && failedInARow < 2; module *= 0.95) {
      const rounded = Math.round(module * 1000) / 1000;
      const result = await reads(job.style, job.nozzle, rounded);
      ladder.push([rounded, result]);
      failedInARow = result.some(Boolean) ? 0 : failedInARow + 1;
    }
    const minimum = Object.fromEntries(BLEEDS.map((bleed, b) => {
      let smallest: number | null = null;
      for (const [module, result] of ladder) { if (!result[b]) break; smallest = module; }
      return [String(bleed), smallest];
    }));
    out.push({ ...job, ladder, minimum });
    console.error(`${job.style}, ${job.nozzle} mm: ${JSON.stringify(minimum)}`);
  }
}));
await rm(data, { recursive: true, force: true });
console.log(JSON.stringify(out, null, 1));
