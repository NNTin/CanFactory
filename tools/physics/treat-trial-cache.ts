/**
 * Where the treat dispenser trials cache the parts' rendered meshes (for their mass properties). The file is keyed on everything
 * the meshes come from: the generator's source, the layout it is given and the model's version, so a redesign never pairs new
 * collision pieces with an old mesh's inertia.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findModel, treatScadLayout, type TreatDispenserParameters } from '@canfactory/contracts';

export const TRIAL_CACHE = 'node_modules/.cache/canfactory-treat-trials';
export const GENERATOR = 'models/treat-dispenser/generator.scad';

/** The cache key for these sources: a SHA-256 of the generator, the layout and the model's version. */
export function meshCacheKey(generator: string, layout: string, version: number | string): string {
  return createHash('sha256').update(`${version}\n${layout}\n${generator}`).digest('hex').slice(0, 24);
}

/** The cache file for these parameters, from the generator as it is on disk now. */
export async function meshCacheFile(p: TreatDispenserParameters, root = '.'): Promise<string> {
  const generator = await readFile(join(root, GENERATOR), 'utf8');
  const version = findModel('treat-dispenser')?.version ?? 0;
  return join(root, TRIAL_CACHE, `meshes-${meshCacheKey(generator, treatScadLayout(p), version)}.json`);
}
