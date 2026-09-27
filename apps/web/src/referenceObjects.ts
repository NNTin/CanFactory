import { findPart, partAssetPath, type Assembly, type Part } from '@canfactory/contracts';
import type { BufferGeometry } from 'three';
import { partGeometry } from './partGeometry.ts';

// The parts library's rendered models (e.g. a lighter), bundled as static files: they do not depend on any model's settings, so
// they are not rendered per preview (see `partAssetPath`). Only this folder is bundled, never the models' own STLs.
const urls = import.meta.glob<string>('../../../parts/**/*.stl', { query: '?url', import: 'default', eager: true });

/** The bundled STL of a part with an STL preview. */
export function partStlUrl(part: Part): string | undefined {
  const path = partAssetPath(part, 'stl');
  return path ? urls[`../../../${path}`] : undefined;
}

/** A reference object as the viewer loads it: its bundled STL, or its geometry built from the part's dimensions (e.g. a magnet). */
export type ReferenceObject = { id: string; url: string } | { id: string; geometry: () => BufferGeometry | null };

/** The assembly's reference objects that the viewer can show, in the order the assembly lists them. */
export function referenceObjects(assembly: Assembly | undefined): ReferenceObject[] {
  return (assembly?.references ?? []).flatMap(({ id, part }): ReferenceObject[] => {
    const found = findPart(part);
    if (!found) return [];
    const url = partStlUrl(found);
    return url ? [{ id, url }] : [{ id, geometry: () => partGeometry(found) }];
  });
}
