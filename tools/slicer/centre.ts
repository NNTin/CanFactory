/**
 * Render the QR tag's centre with a module of an exact width and slice it with OrcaSlicer: the step the slicer check
 * (tools/test-slicer.ts) and its calibration (tools/slicer/calibrate.ts) share.
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DEFAULT_QR_MAGNET_TAG, filamentChangeHeight, FONTS_DIR, mergeModules, moduleColumns, qrMagnetTag, qrTagCode, qrTagLayout, qrTagSettings, scadDefines, type ParameterValues, type QrModuleStyle } from '@canfactory/contracts';
import { repositoryRoot } from '@canfactory/server';
import type { OpenScadRunner } from '../../apps/worker/src/render.ts';
import type { Grid } from './check.ts';
import { neighbourhoodCoupon } from './coupon.ts';
import { readExtrusions, type Extrusion } from './gcode.ts';
import { BED_CENTRE, slice, type OrcaInstall } from './orca.ts';

/** The real code every check slices: the default text at H (version 3, 29 × 29 modules), with a quiet zone of two modules. */
export const CHECK_TEXT = 'https://example.com';
export const CHECK_ECC = 'H';
export const CHECK_QUIET = 2;
/** The neighbourhood coupon (tools/slicer/coupon.ts). */
export const COUPON = neighbourhoodCoupon(32);

export type SampleKind = 'code' | 'coupon';
export interface Sample { kind: SampleKind; style: QrModuleStyle; nozzle: string; bleed: number; module: number }

/** The layer height the check slices a nozzle at: Orca's own for its 0.2 mm nozzle profiles, 0.2 mm otherwise. */
export const layerFor = (nozzle: number): number => nozzle <= 0.25 ? 0.1 : 0.2;

const centrePart = qrMagnetTag.parts.find(part => part.id === 'centre') ?? (() => { throw new Error('The QR tag has no centre part.'); })();

/** The centre's settings for a sample: the module exactly `module` mm wide (the size need not be a whole millimetre here). */
export function sampleParameters(sample: Sample): ParameterValues {
  const base = { ...DEFAULT_QR_MAGNET_TAG, qrText: CHECK_TEXT, errorCorrection: CHECK_ECC, quietZone: CHECK_QUIET, moduleStyle: sample.style, nozzle: sample.nozzle, bleed: sample.bleed, layerHeight: layerFor(Number(sample.nozzle)) } as ParameterValues;
  const modules = sample.kind === 'code' ? qrTagCode({ qrText: CHECK_TEXT, errorCorrection: CHECK_ECC, logo: '', logoSize: 20 }).symbol.size : COUPON.length;
  // the code's width grows one for one with the tile's size (the seat's corner radius stays the same)
  const offset = 60 - qrTagLayout(qrTagSettings({ ...base, size: 60 })).codeWidth;
  return { ...base, size: Math.round((sample.module * (modules + 2 * CHECK_QUIET) + offset) * 1e6) / 1e6 };
}

export interface SlicedSample { parameters: ParameterValues; grid: Grid; lines: Extrusion[]; changeHeight: number; command: string[] }

/** Renders the sample's centre into `directory` (centre.stl), slices it there, and returns its lines relative to the code's centre. */
export async function sliceSample(sample: Sample, directory: string, runner: OpenScadRunner, install: OrcaInstall): Promise<SlicedSample> {
  const parameters = sampleParameters(sample);
  const defines = scadDefines(qrMagnetTag, centrePart, parameters).map(([name, literal]): [string, string] =>
    name === 'QR' && sample.kind === 'coupon' ? [name, JSON.stringify([COUPON.length, 0, mergeModules(COUPON), [], sample.style === 'connected-dots' ? moduleColumns(COUPON) : []])] : [name, literal]);
  const stl = join(directory, 'centre.stl');
  await runner(['--backend', 'Manifold', '--export-format', 'binstl', '-o', stl, ...defines.flatMap(([name, literal]) => ['-D', `${name}=${literal}`]), resolve(repositoryRoot, centrePart.sourcePath)],
    new AbortController().signal, resolve(repositoryRoot, FONTS_DIR));
  const sliced = await slice(install, stl, directory, { nozzle: Number(sample.nozzle), layerHeight: Number(parameters['layerHeight']) });
  const lines = readExtrusions(await readFile(sliced.gcode, 'utf8')).map(line => ({ ...line, x0: line.x0 - BED_CENTRE[0], y0: line.y0 - BED_CENTRE[1], x1: line.x1 - BED_CENTRE[0], y1: line.y1 - BED_CENTRE[1] }));
  const dark = sample.kind === 'code' ? qrTagCode({ qrText: CHECK_TEXT, errorCorrection: CHECK_ECC, logo: '', logoSize: 20 }).dark : COUPON;
  return { parameters, grid: { dark, module: sample.module, quietZone: CHECK_QUIET }, lines, changeHeight: filamentChangeHeight(Number(parameters['baseThickness']), Number(parameters['layerHeight'])), command: sliced.command };
}
