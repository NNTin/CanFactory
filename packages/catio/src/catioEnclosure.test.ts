import { describe, expect, it } from 'vitest';
import { enclosureLayout, MODULAR, MODULAR_DEFAULT, type EnclosureBox } from './index.ts';

const size = { width: 1200, depth: 1000, height: 1200 };
const layout = (connected = { rear: true, left: false, right: false }, tunnelSize = MODULAR_DEFAULT.tunnelSize) => enclosureLayout(size, { id: 'a', tunnelSize, connected });
const range = (b: EnclosureBox, i: 0 | 1 | 2): [number, number] => [b.center[i] - b.size[i] / 2, b.center[i] + b.size[i] / 2];

describe('enclosure layout', () => {
  it('stands its frame on four feet inside its outline, from the grass to its height', () => {
    const e = layout();
    expect(e.feet.rods).toHaveLength(4); expect(e.feet.pads).toHaveLength(4);
    for (const b of e.frame) {
      expect(range(b, 0)[0]).toBeGreaterThanOrEqual(-size.width / 2 - 1e-9); expect(range(b, 0)[1]).toBeLessThanOrEqual(size.width / 2 + 1e-9);
      expect(range(b, 1)[0]).toBeGreaterThanOrEqual(-1e-9); expect(range(b, 1)[1]).toBeLessThanOrEqual(size.depth + 1e-9);
      expect(range(b, 2)[0]).toBeGreaterThanOrEqual(-1e-9); expect(range(b, 2)[1]).toBeLessThanOrEqual(size.height + 1e-9);
    }
  });

  it('has a standard port in its rear and each side, facing out, on the sill, docked where asked', () => {
    const e = layout({ rear: true, left: false, right: true });
    expect(e.ports.map(p => [p.id, p.side, p.connected])).toEqual([['a-rear', 'rear', true], ['a-left', 'left', false], ['a-right', 'right', true]]);
    const [rear, left, right] = e.ports;
    expect(rear?.face.n).toEqual([0, -1, 0]); expect(left?.face.n).toEqual([-1, 0, 0]); expect(right?.face.n).toEqual([1, 0, 0]);
    for (const p of e.ports) {
      expect(p.face.at[2]).toBe(MODULAR.sill);
      // the face's frame: across it horizontally, along its normal, and up
      expect(p.face.frame.y).toEqual(p.face.n); expect(p.face.frame.z.map(v => Math.round(v * 1e9) / 1e9 || 0)).toEqual([0, 0, 1]);
    }
    // the side ports over the landing, the rear one in the middle of the rear wall
    expect(rear?.face.at).toEqual([0, 0, MODULAR.sill]);
    expect(left?.face.at).toEqual([-size.width / 2, e.landingDepth / 2, MODULAR.sill]);
  });

  it('leaves each port open in its wall: mesh beside, below and above it, none over it', () => {
    const s = MODULAR_DEFAULT.tunnelSize;
    for (const panels of [layout().rear.mesh, ...layout().sides.map(w => w.mesh)]) {
      const below = panels.find(p => p.id.endsWith('-below')); const above = panels.find(p => p.id.endsWith('-above'));
      if (!below || !above) throw new Error('missing');
      expect(below.width).toBe(s); expect(above.width).toBe(s);
      expect(below.center[2] + below.height / 2).toBeCloseTo(above.center[2] - above.height / 2 - s, 9);
    }
  });

  it('runs the ramp down from the landing to the floor, and hinges the maintenance door on the front', () => {
    const e = layout();
    expect(e.ramp.tilt).toBeLessThan(0); expect(e.ramp.cleats.length).toBeGreaterThan(0);
    expect(e.ramp.board.center[1]).toBeGreaterThan(e.landingDepth);
    expect(e.door.hinge[1]).toBe(size.depth);
    expect(e.door.width).toBeLessThan(size.width); expect(e.door.height).toBeLessThan(size.height);
  });

  it('gives every piece a unique id under the enclosure’s own', () => {
    const e = enclosureLayout(size, { id: 'b', tunnelSize: 300, connected: { rear: false, left: true, right: false } });
    const ids = [...e.floor, ...e.rear.mesh, ...e.sides.flatMap(w => w.mesh), e.roof, e.doorMesh].map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('b-')).toBe(true);
  });

});
