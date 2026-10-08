/**
 * Writes QR_MIN_MODULE (packages/contracts/src/qrMagnetTag.ts) from the output of tools/slicer/calibrate.ts: per style, nozzle and
 * bleed, the measured minimum (a width the calibration sliced, not rounded: a rounded width between two measured ones can fall
 * where small modules print hollow) and never smaller than a finer nozzle's.
 *
 *   npx tsx tools/slicer/min-module-table.ts calibration.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { QR_BLEED_POINTS, QR_MODULE_STYLES, QR_NOZZLES } from '@canfactory/contracts';

interface Calibrated { style: string; nozzle: string; minimum: Record<string, number | null> }
const input = process.argv[2];
if (!input) throw new Error('Usage: min-module-table.ts calibration.json');
const calibration = JSON.parse(readFileSync(input, 'utf8')) as Calibrated[];
const rows = QR_MODULE_STYLES.map(style => {
  const previous = QR_BLEED_POINTS.map(() => 0);
  const nozzles = QR_NOZZLES.map(nozzle => {
    const found = calibration.find(entry => entry.style === style && entry.nozzle === nozzle);
    if (!found) throw new Error(`No calibration for ${style} with a ${nozzle} mm nozzle.`);
    const values = QR_BLEED_POINTS.map((bleed, b) => {
      const measured = found.minimum[String(bleed)];
      if (measured === null || measured === undefined) throw new Error(`${style}, ${nozzle} mm, bleed ${bleed}: no width read right; start calibrate.ts's ladder higher.`);
      previous[b] = Math.max(previous[b] ?? 0, measured);
      return previous[b];
    });
    return `    '${nozzle}': [${values.join(', ')}],`;
  });
  return `  '${style}': {\n${nozzles.join('\n')}\n  },`;
});
const file = new URL('../../packages/contracts/src/qrMagnetTag.ts', import.meta.url);
const source = readFileSync(file, 'utf8');
const updated = source.replace(/(export const QR_MIN_MODULE: [^=]+= )(?:MIN_MODULE_TABLE|\{[\s\S]*?\n\});/, `$1{\n${rows.join('\n')}\n};`);
if (updated === source) throw new Error('QR_MIN_MODULE not found in qrMagnetTag.ts.');
writeFileSync(file, updated);
console.log(rows.join('\n'));
