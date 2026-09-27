import { findPart, partAssetPath, type Assembly, type Part } from '@canfactory/contracts';

// The parts library's rendered models (e.g. a lighter), bundled as static files: they do not depend on any model's settings, so
// they are not rendered per preview (see `partAssetPath`). Only this folder is bundled, never the models' own STLs.
const urls = import.meta.glob<string>('../../../parts/**/*.stl', { query: '?url', import: 'default', eager: true });

/** The bundled STL of a part with an STL preview. */
export function partStlUrl(part: Part): string | undefined {
  const path = partAssetPath(part, 'stl');
  return path ? urls[`../../../${path}`] : undefined;
}

export interface ReferenceObject { id: string; url: string }

/** The assembly's reference objects that have a bundled STL, in the order the assembly lists them. */
export function referenceObjects(assembly: Assembly | undefined): ReferenceObject[] {
  return (assembly?.references ?? []).flatMap(({ id, part }) => {
    const found = findPart(part);
    const url = found && partStlUrl(found);
    return url ? [{ id, url }] : [];
  });
}
