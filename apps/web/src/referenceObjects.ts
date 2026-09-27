import { referenceObjectPath, type Assembly } from '@canfactory/contracts';

// Every assembly's reference objects, bundled as static files: they do not depend on the model's settings, so they are not
// rendered per preview (see `referenceObjectPath`). Only this folder is bundled, never the models' other STLs.
const urls = import.meta.glob<string>('../../../models/*/reference-objects/*.stl', { query: '?url', import: 'default', eager: true });

export interface ReferenceObject { id: string; url: string }

/** The assembly's reference objects that have a bundled STL, in the order the assembly lists them. */
export function referenceObjects(modelId: string, assembly: Assembly | undefined): ReferenceObject[] {
  return (assembly?.references ?? []).flatMap(({ id }) => {
    const url = urls[`../../../${referenceObjectPath(modelId, id, 'stl')}`];
    return url ? [{ id, url }] : [];
  });
}
