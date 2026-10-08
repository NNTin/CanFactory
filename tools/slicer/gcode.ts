/**
 * The lines a slicer prints, read from its G-code: every extruding move, with the width the slicer planned for it (PrusaSlicer and
 * OrcaSlicer write `;WIDTH:` before each change of width) and its height. Travel, retraction and wipe moves extrude nothing and are
 * left out.
 */

export interface Extrusion { x0: number; y0: number; x1: number; y1: number; z: number; width: number; type: string }

export function readExtrusions(gcode: string): Extrusion[] {
  const out: Extrusion[] = [];
  let x = 0, y = 0, z = 0, e = 0, width = 0, type = '', relative = false;
  const lines = gcode.split('\n');
  for (let number = 0; number < lines.length; number++) {
    const raw = lines[number] ?? '';
    if (raw.startsWith(';WIDTH:')) { width = Number(raw.slice(7)); continue; }
    if (raw.startsWith(';TYPE:')) { type = raw.slice(6).trim(); continue; }
    const code = (raw.split(';')[0] ?? '').trim();
    if (code === '') continue;
    const word = code.split(/\s+/)[0];
    if (word === 'M82') { relative = false; continue; }
    if (word === 'M83') { relative = true; continue; }
    if (word === 'G2' || word === 'G3') throw new Error(`G-code line ${number + 1}: an arc move (${code}); turn arc fitting off.`);
    if (word === 'G91') throw new Error(`G-code line ${number + 1}: relative positioning (G91) is not read.`);
    if (word !== 'G0' && word !== 'G1' && word !== 'G92') continue;
    const value = (axis: string) => { const match = code.match(new RegExp(`(?:^|\\s)${axis}(-?[\\d.]+)`)); return match ? Number(match[1]) : undefined; };
    const X = value('X'), Y = value('Y'), Z = value('Z'), E = value('E');
    if (word === 'G92') { if (E !== undefined) e = E; continue; }
    const nx = X ?? x, ny = Y ?? y;
    if (Z !== undefined) z = Z;
    const extrudes = E !== undefined && (relative ? E > 1e-9 : E > e + 1e-9);
    if (E !== undefined && !relative) e = E;
    if (extrudes && (nx !== x || ny !== y)) {
      if (!(width > 0)) throw new Error(`G-code line ${number + 1}: an extrusion with no ;WIDTH: before it.`);
      out.push({ x0: x, y0: y, x1: nx, y1: ny, z, width, type });
    }
    x = nx; y = ny;
  }
  return out;
}
