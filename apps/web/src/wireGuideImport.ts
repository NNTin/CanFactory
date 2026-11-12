import { validateWireGuideDesign, type WireGuideDesign, type WireGuideIssue } from '@canfactory/contracts';

/**
 * The most bytes of a design file the editor reads: only a bound on `JSON.parse`, far above any valid design. The real bound is
 * `validateWireGuideDesign`'s on the parsed design (`WIRE_GUIDE_LIMITS.bytes`, as compact JSON), so that a pretty-printed design
 * (the editor's own Download design, or a KiPrint or assistant export) imports as well as a compact one.
 */
export const WIRE_GUIDE_FILE_MAX_BYTES = 5_000_000;

/** A design read from a .json file's text: the design when it is valid, else the issues `validateWireGuideDesign` finds. */
export function readWireGuideFile(text: string): { design: WireGuideDesign } | { issues: WireGuideIssue[] } {
  if (text.length > WIRE_GUIDE_FILE_MAX_BYTES) return { issues: [{ path: '', message: `This file is larger than ${WIRE_GUIDE_FILE_MAX_BYTES / 1_000_000} MB.` }] };
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { issues: [{ path: '', message: 'This file is not JSON.' }] }; }
  const issues = validateWireGuideDesign(parsed);
  return issues.length ? { issues } : { design: parsed as WireGuideDesign };
}

/** A design as the editor's Download design writes it: indented, readable JSON, which `readWireGuideFile` reads back. */
export const wireGuideFileText = (design: WireGuideDesign): string => `${JSON.stringify(design, null, 2)}\n`;
