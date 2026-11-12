import { describe, expect, it } from 'vitest';
import { DEFAULT_WIRE_GUIDE_DESIGN, WIRE_GUIDE_LIMITS } from '@canfactory/contracts';
import { readWireGuideFile, WIRE_GUIDE_FILE_MAX_BYTES, wireGuideFileText } from './wireGuideImport.ts';

describe('readWireGuideFile', () => {
  it('reads back the editor’s own pretty-printed download', () => {
    expect(readWireGuideFile(wireGuideFileText(DEFAULT_WIRE_GUIDE_DESIGN))).toEqual({ design: DEFAULT_WIRE_GUIDE_DESIGN });
  });
  it('bounds the parsed design, not the file: a design under the bound as compact JSON imports even when its file is over it', () => {
    // a valid design near the bound: the pretty-printed default with its source padded until the file passes 200 kB
    const design = { ...structuredClone(DEFAULT_WIRE_GUIDE_DESIGN), source: { tool: 'kiprint' as const, version: '1', projectId: 'p' } };
    const text = wireGuideFileText(design).replace('\n}', `${' '.repeat(WIRE_GUIDE_LIMITS.bytes)}\n}`);
    expect(text.length).toBeGreaterThan(WIRE_GUIDE_LIMITS.bytes);
    expect(JSON.stringify(JSON.parse(text)).length).toBeLessThan(WIRE_GUIDE_LIMITS.bytes);
    expect(readWireGuideFile(text)).toEqual({ design });
  });
  it('rejects what validateWireGuideDesign rejects, with its field-level issues', () => {
    // a second part on U1's first pin
    const shared = structuredClone(DEFAULT_WIRE_GUIDE_DESIGN);
    shared.components = [...shared.components ?? [], { ref: 'R1', footprint: 'R_Axial', pins: [[14, 5], [14, 2]], body: { kind: 'box', x: 41, y: 9, w: 1, h: 6, height: 2 } }];
    expect(readWireGuideFile(wireGuideFileText(shared))).toEqual({ issues: [{ path: '/components/1/pins/0', message: 'R1’s pin [14, 5] is also a pin of U1.' }] });
    const broken = structuredClone(DEFAULT_WIRE_GUIDE_DESIGN); broken.guide.coverThickness = 9;
    const read = readWireGuideFile(JSON.stringify(broken));
    expect('issues' in read ? read.issues.map(issue => issue.path) : []).toContain('/guide/coverThickness');
  });
  it('refuses a file that is not JSON or far too large to parse', () => {
    expect(readWireGuideFile('{')).toEqual({ issues: [{ path: '', message: 'This file is not JSON.' }] });
    expect(readWireGuideFile(' '.repeat(WIRE_GUIDE_FILE_MAX_BYTES + 1))).toEqual({ issues: [{ path: '', message: 'This file is larger than 5 MB.' }] });
  });
});
