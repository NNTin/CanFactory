import { unzipSync } from 'fflate';

/**
 * Splits a fetched ZIP into its STL entries, in archive order. A ZIP may carry other files beside its parts (the wire guide's
 * assembly guide and design, `ModelDefinition.zipFiles`): those are for the reader, not the viewer. Throws if it has no STL.
 */
export function partsFromZip(bytes: ArrayBuffer): { name: string; bytes: ArrayBuffer }[] {
  const entries = unzipSync(new Uint8Array(bytes));
  const parts = Object.entries(entries).filter(([name]) => /\.stl$/i.test(name))
    .map(([name, data]) => ({ name, bytes: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) }));
  if (parts.length === 0) throw new Error('The preview archive contained no parts.');
  return parts;
}
