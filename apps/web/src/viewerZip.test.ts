import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { partsFromZip } from './viewerZip.ts';

describe('partsFromZip', () => {
  it('takes the STL parts, in archive order, and leaves the other files the ZIP carries for the reader', () => {
    const zip = zipSync({ 'print-1-layer-1.stl': strToU8('solid a'), 'wire-guide-assembly.txt': strToU8('Print one of each STL file.'),
      'print-1-peg-1.STL': strToU8('solid b'), 'wire-guide-design.json': strToU8('{}') });
    const parts = partsFromZip(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength));
    expect(parts.map(part => part.name)).toEqual(['print-1-layer-1.stl', 'print-1-peg-1.STL']);
    expect(new TextDecoder().decode(parts[0]?.bytes)).toBe('solid a');
  });
  it('refuses an archive without a part', () => {
    const zip = zipSync({ 'wire-guide-assembly.txt': strToU8('x') });
    expect(() => partsFromZip(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength))).toThrow(/no parts/);
  });
});
