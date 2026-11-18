import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WIRE_GUIDE_GEOMETRY, wireGuideGeometry, wireGuidePieceId, wireGuidePieces, type WireGuideDesign } from '@canfactory/contracts';
import { bounds, transform, volume, type Mesh } from './stl-to-scad/stl.ts';

/** The checked-in sample designs (models/prototype-wire-guide/samples), by file name: the renderer tests render each. */
export function wireGuideSamples(root: string): [string, WireGuideDesign][] {
  const directory = join(root, 'models/prototype-wire-guide/samples');
  return readdirSync(directory).filter(name => name.endsWith('.json')).sort()
    .map(name => [name, JSON.parse(readFileSync(join(directory, name), 'utf8')) as WireGuideDesign]);
}

/**
 * The real-render checks of a wire-guide design's prints (tools/test-renderer.ts), given its mesh helpers, against the geometry the
 * trusted encoder worked out (`wireGuideGeometry`), in the board's frame. Each print is one closed solid, as big as its block and
 * its registration; every channel is open from its floor to the top, with solid plate under it; every funnel open from below the
 * plate up through the top; where a higher channel crosses a lower one, the lower wire's tunnel is open under a solid bridge and the
 * higher channel open above it; pockets are open over their bodies; bosses' pins and clips' lips are solid.
 */
export function checkWireGuide(mesh: (print: number) => Mesh, design: WireGuideDesign, name: string,
  shells: (mesh: Mesh) => number, solid: (mesh: Mesh, point: [number, number, number]) => boolean): number {
  const G = WIRE_GUIDE_GEOMETRY;
  let probes = 0;
  const is = (m: Mesh, point: [number, number, number], want: boolean, what: string) => {
    probes++;
    assert.equal(solid(m, point), want, `wire guide ${name}: ${what} at ${point.map(v => v.toFixed(3)).join(', ')} should be ${want ? 'solid' : 'open'}`);
  };
  wireGuideGeometry(design).forEach((print, index) => {
    if (print.stack.pieces === 'layers') return;
    const m = mesh(index), label = `print ${index + 1}`;
    assert.equal(shells(m), 1, `wire guide ${name}: ${label} is one closed solid`);
    const { block, grid, layers, plateTop } = print;
    const at = (column: number, row: number) => [grid.x0 + column * grid.pitch, grid.y0 + row * grid.pitch] as const;

    // its size: the block, the bosses' pins below it, or the clips beside and below the board
    const box = bounds(m);
    const bottom = print.clips.length ? -G.clip.below : print.bosses.length ? Math.min(...print.bosses.map(boss => boss.pinBottom)) : block.zBase;
    assert.ok(Math.abs(box.min[2] - bottom) < 0.01 && Math.abs(box.max[2] - block.zTop) < 0.01, `wire guide ${name}: ${label} spans z ${box.min[2]}–${box.max[2]}, not ${bottom}–${block.zTop}`);
    const y0 = print.clips.length ? -G.clip.gap - G.clip.wall : block.y0, y1 = print.clips.length ? print.board.W + G.clip.gap + G.clip.wall : block.y1;
    assert.ok(Math.abs(box.min[1] - y0) < 0.01 && Math.abs(box.max[1] - y1) < 0.01, `wire guide ${name}: ${label} spans y ${box.min[1]}–${box.max[1]}, not ${y0}–${y1}`);

    // channels: open from the floor up, the plate solid under the lowest; a probe in the middle of each segment
    type Wire = typeof print.wires[number];
    const cells = new Map<string, Wire[]>();
    print.wires.forEach((wire, w) => {
      const layer = layers[wire.layer];
      if (!layer) throw new Error('No layer.');
      wire.points.forEach((b, p) => {
        const a = wire.points[p - 1];
        if (!a) return;
        const steps = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
        for (let s = 0; s <= steps; s++) {
          const cell = `${a[0] + Math.sign(b[0] - a[0]) * s},${a[1] + Math.sign(b[1] - a[1]) * s}`;
          if (!cells.get(cell)?.includes(wire)) cells.set(cell, [...cells.get(cell) ?? [], wire]);
        }
        const [ax, ay] = at(...a), [bx, by] = at(...b);
        const middle = [(ax + bx) / 2 + (ay === by ? 0.3 : 0), (ay + by) / 2 + (ax === bx ? 0.3 : 0)] as const;
        // the middle may be a crossing: there a higher channel's bridge stands over the lower one, so probe just above the floor
        is(m, [...middle, layer.floor + 0.1], false, `${label} wire ${w + 1}'s channel`);
        is(m, [...middle, plateTop - 0.2], true, `${label} the plate under wire ${w + 1}'s channel`);
      });
    });

    // crossings: the lower wire's tunnel under a solid bridge, the higher channel open above
    for (const [cell, crossing] of cells) {
      if (crossing.length < 2) continue;
      const [column, row] = cell.split(',').map(Number) as [number, number];
      const sorted = [...crossing].sort((a, b) => a.layer - b.layer);
      const [low, high] = [sorted[0], sorted.at(-1)];
      const [lower, higher] = [low && layers[low.layer], high && layers[high.layer]];
      if (!low || !high || !lower || !higher || higher.bridgeBottom === null) continue;
      const [x, y] = at(column, row);
      is(m, [x, y, lower.floor + low.width / 2], false, `${label} the tunnel at [${cell}]`);
      is(m, [x, y, higher.bridgeBottom + G.bridge / 2], true, `${label} the bridge at [${cell}]`);
      is(m, [x, y, higher.floor + high.width / 2], false, `${label} the higher channel at [${cell}]`);
    }

    // funnels: open down to the board (through a boss's column or a clip's foot beside the hole), through the plate and up the shaft
    for (const funnel of print.funnels) {
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]] as const)
        is(m, [funnel.x + dx * 0.3 * funnel.bottom, funnel.y + dy * 0.3 * funnel.bottom, print.board.t + 0.05], false, `${label} the funnel's bore over the board`);
      is(m, [funnel.x, funnel.y, block.zBase + 0.05], false, `${label} the funnel's outlet`);
      is(m, [funnel.x, funnel.y, (block.zBase + plateTop) / 2], false, `${label} the funnel`);
      is(m, [funnel.x, funnel.y, block.zTop - 0.1], false, `${label} the funnel's shaft`);
    }

    // pockets: open over their bodies; through ones open just under the top
    for (const pocket of print.pockets) {
      const [x, y] = pocket.kind === 'box' ? [pocket.x + pocket.w / 2, pocket.y + pocket.h / 2] : [pocket.x, pocket.y];
      if (x < block.x0 || x > block.x1 || y < block.y0 || y > block.y1) continue;
      is(m, [x, y, Math.min(pocket.top, block.zTop) - 0.1], false, `${label} the pocket`);
      if (pocket.top < block.zTop) is(m, [x, y, pocket.top + 0.1], true, `${label} the plate over the pocket`);
    }

    // registration: a pin in each mounting hole, standing on a column; or the clips' walls and lips under the board's edges
    for (const boss of print.bosses) {
      is(m, [boss.x, boss.y, (boss.pinBottom + print.board.t) / 2], true, `${label} the boss's pin`);
      is(m, [boss.x + boss.pin / 2 + 0.15, boss.y, print.board.t / 2], false, `${label} beside the boss's pin, in the hole`);
      if (boss.columnBottom !== null) is(m, [boss.x + boss.pin / 2 + 0.3, boss.y, (print.board.t + block.zBase) / 2], true, `${label} the boss's column`);
    }
    for (const clip of print.clips) for (const [y, lip] of [[-G.clip.gap - G.clip.wall / 2, -G.clip.gap + 0.1], [print.board.W + G.clip.gap + G.clip.wall / 2, print.board.W + G.clip.gap - 0.1]] as const) {
      is(m, [clip.x, y, -0.5], true, `${label} the clip's wall`);
      is(m, [clip.x, lip, -0.3], true, `${label} the clip's lip`);
      is(m, [clip.x, lip, print.board.t / 2], false, `${label} the board's place in the clip`);
    }
  });
  return probes;
}

/** What `checkWireGuidePieces` found, for the evidence file: each piece's mesh and the assembled stack's shared volumes. */
export interface WireGuidePieceReport {
  piece: string; title: string; triangles: number; shells: number; volume: number;
  size: [number, number, number]; position: [number, number, number];
}

/**
 * The real-render checks of a design's separate layers and pegs (`guide.parts` `layers`), against `wireGuideGeometry`'s stack:
 *
 * - each piece is the STL `wireGuidePieces` names, one closed solid (the bottom layer may be the pieces its notes count), lying
 *   on the print bed: a layer from z = 0 to its thickness over its block, a peg upright on its lowest point;
 * - in each layer (probed where it goes, its pose's lift undone): its own channels open from their floor up with solid floor under
 *   them, the lower levels' channels closed over (its underside lies on their wires), every funnel open through it (the bottom
 *   layer's down to the board, as before), pockets open, each peg's hole open at the hole's radius and solid just beyond it, a
 *   socket closed above, and the bottom layer's clips;
 * - each peg's mesh is its outline turned about its axis (solid just inside it, open just outside, at every bend);
 * - assembled at their poses: the layers stack without gaps, every peg's shaft stands in its holes with play all round, and no two
 *   pieces share volume (`intersection`).
 */
export function checkWireGuidePieces(entry: (id: string) => Mesh | undefined, design: WireGuideDesign, name: string,
  shells: (mesh: Mesh) => number, solid: (mesh: Mesh, point: [number, number, number]) => boolean,
  intersection: (a: Mesh, b: Mesh) => number): { probes: number; pieces: WireGuidePieceReport[]; shared: number } {
  const G = WIRE_GUIDE_GEOMETRY, P = G.peg;
  let probes = 0;
  const pieces = wireGuidePieces(design), reports: WireGuidePieceReport[] = [];
  const meshOf = (id: string) => { const m = entry(id); if (!m) throw new Error(`wire guide ${name}: no ${id}.stl in the ZIP`); return m; };
  for (const piece of pieces) {
    const m = meshOf(piece.id), box = bounds(m);
    reports.push({ piece: piece.id, title: piece.title, triangles: m.tris.length / 9, shells: shells(m), volume: Math.round(volume(m) * 1000) / 1000,
      size: [0, 1, 2].map(axis => Math.round(((box.max[axis] ?? 0) - (box.min[axis] ?? 0)) * 1000) / 1000) as [number, number, number], position: piece.position });
  }
  let shared = 0;
  wireGuideGeometry(design).forEach((print, p) => {
    if (print.stack.pieces !== 'layers') return;
    const { block, grid, stack } = print;
    const at = (column: number, row: number) => [grid.x0 + column * grid.pitch, grid.y0 + row * grid.pitch] as const;
    const layerMesh = stack.layers.map((_, k) => meshOf(wireGuidePieceId(p, 'layer', k)));
    const pegMesh = stack.pegs.map((_, j) => meshOf(wireGuidePieceId(p, 'peg', j)));
    // a point where it goes on the board, in layer k's STL (lying on the bed) or peg j's (upright at the origin)
    const inLayer = (k: number, point: [number, number, number], want: boolean, what: string) => {
      probes++;
      const layer = stack.layers[k], m = layerMesh[k];
      if (!layer || !m) throw new Error('No layer.');
      assert.equal(solid(m, [point[0], point[1], point[2] - layer.zBottom]), want, `wire guide ${name}: print ${p + 1} layer ${k + 1}: ${what} at ${point.map(v => v.toFixed(3)).join(', ')} should be ${want ? 'solid' : 'open'}`);
    };
    const plateBodies = /bottom layer is (\d+) pieces/.exec(stack.notes.join(' '))?.[1];

    stack.layers.forEach((layer, k) => {
      const m = layerMesh[k];
      if (!m) throw new Error('No layer.');
      const label = `print ${p + 1} layer ${k + 1}`;
      assert.equal(shells(m), k === 0 && plateBodies ? Number(plateBodies) : 1, `wire guide ${name}: ${label} is one closed solid`);
      const box = bounds(m);
      const height = layer.zTop - layer.zBottom;
      assert.ok(Math.abs(box.min[2]) < 0.01 && Math.abs(box.max[2] - height) < 0.01, `wire guide ${name}: ${label} spans z ${box.min[2]}–${box.max[2]} on the bed, not 0–${height}`);
      const [y0, y1] = print.clips.length && k === 0 ? [-G.clip.gap - G.clip.wall, print.board.W + G.clip.gap + G.clip.wall] : [block.y0, block.y1];
      assert.ok(Math.abs(box.min[0] - block.x0) < 0.01 && Math.abs(box.max[0] - block.x1) < 0.01 && Math.abs(box.min[1] - y0) < 0.01 && Math.abs(box.max[1] - y1) < 0.01,
        `wire guide ${name}: ${label} spans x ${box.min[0]}–${box.max[0]}, y ${box.min[1]}–${box.max[1]}`);
      const floor = k === 0 ? print.plateTop : print.layers[k]?.floor ?? 0;
      const bottom = k === 0 ? block.zBase : layer.zBottom;
      const holeAt = (x: number, y: number) => stack.pegs.some(peg => Math.hypot(peg.x - x, peg.y - y) < peg.hole / 2 + 0.2)
        || print.funnels.some(funnel => Math.hypot(funnel.x - x, funnel.y - y) < funnel.top / 2 + 0.2);
      for (const wire of print.wires) wire.points.forEach((b, i) => {
        const a = wire.points[i - 1];
        if (!a) return;
        const [ax, ay] = at(...a), [bx, by] = at(...b);
        const middle = [(ax + bx) / 2 + (ay === by ? 0.3 : 0), (ay + by) / 2 + (ax === bx ? 0.3 : 0)] as const;
        if (holeAt(...middle)) return;
        if (wire.layer === k) {
          inLayer(k, [...middle, floor + 0.1], false, `its own channel`);
          inLayer(k, [...middle, layer.zTop - 0.05], false, `its own channel, open at the top`);
          inLayer(k, [...middle, (bottom + floor) / 2], true, `the floor under its channel`);
        } else if (wire.layer < k) inLayer(k, [...middle, layer.zBottom + 0.1], true, `its cover over a lower level's channel`);
      });
      for (const funnel of print.funnels) {
        inLayer(k, [funnel.x, funnel.y, (Math.max(layer.zBottom, block.zBase) + layer.zTop) / 2], false, 'a funnel’s shaft through it');
        if (k === 0) {
          inLayer(k, [funnel.x, funnel.y, block.zBase + 0.05], false, 'a funnel’s outlet');
          inLayer(k, [funnel.x, funnel.y, (block.zBase + print.plateTop) / 2], false, 'a funnel');
        }
      }
      for (const pocket of print.pockets) {
        const [x, y] = pocket.kind === 'box' ? [pocket.x + pocket.w / 2, pocket.y + pocket.h / 2] : [pocket.x, pocket.y];
        if (x < block.x0 || x > block.x1 || y < block.y0 || y > block.y1) continue;
        const z = Math.min(pocket.top, layer.zTop) - 0.1;
        if (z > bottom + 0.05) inLayer(k, [x, y, z], false, 'a pocket');
        if (pocket.top > bottom + 0.05 && pocket.top < layer.zTop - 0.1) inLayer(k, [x, y, pocket.top + 0.1], true, 'the plate over a pocket');
      }
      for (const peg of stack.pegs) {
        const [from, to] = [Math.max(peg.holeBottom, bottom), Math.min(peg.holeTop, layer.zTop)];
        if (to - from < 0.1) {
          if (peg.holeTop < layer.zTop && peg.holeTop > bottom) inLayer(k, [peg.x, peg.y, peg.holeTop + 0.1], true, 'the plate over a peg’s socket');
          continue;
        }
        const z = (from + to) / 2;
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
          inLayer(k, [peg.x + dx * (peg.hole / 2 - 0.05), peg.y + dy * (peg.hole / 2 - 0.05), z], false, 'a peg’s hole, at its radius');
          inLayer(k, [peg.x + dx * (peg.hole / 2 + 0.1), peg.y + dy * (peg.hole / 2 + 0.1), z], true, 'the wall round a peg’s hole');
        }
        if (peg.holeTop < layer.zTop) inLayer(k, [peg.x, peg.y, peg.holeTop + 0.1], true, 'the plate over a peg’s socket');
      }
      if (k === 0) for (const clip of print.clips) for (const [y, lip] of [[-G.clip.gap - G.clip.wall / 2, -G.clip.gap + 0.1], [print.board.W + G.clip.gap + G.clip.wall / 2, print.board.W + G.clip.gap - 0.1]] as const) {
        inLayer(0, [clip.x, y, -0.5], true, 'the clip’s wall');
        inLayer(0, [clip.x, lip, -0.3], true, 'the clip’s lip');
      }
      // the layers stack without gaps
      const next = stack.layers[k + 1];
      if (next) assert.ok(Math.abs(layer.zTop - next.zBottom) < 1e-6, `wire guide ${name}: ${label} ends where the next starts`);
    });

    stack.pegs.forEach((peg, j) => {
      const m = pegMesh[j];
      if (!m) throw new Error('No peg.');
      const label = `print ${p + 1} peg ${j + 1}`;
      assert.equal(shells(m), 1, `wire guide ${name}: ${label} is one closed solid`);
      const box = bounds(m), top = Math.max(...peg.profile.map(([, z]) => z)), widest = Math.max(...peg.profile.map(([r]) => r));
      assert.ok(Math.abs(box.min[2]) < 0.01 && Math.abs(box.max[2] - top) < 0.01, `wire guide ${name}: ${label} stands on the bed, ${box.min[2]}–${box.max[2]} high, not 0–${top}`);
      assert.ok(Math.abs(box.max[0] - widest) < 0.02 && Math.abs(box.min[0] + widest) < 0.02, `wire guide ${name}: ${label} is ${widest * 2} mm across, not ${box.max[0] - box.min[0]}`);
      // at the middle of every outline segment that isn't level: solid just inside it, open just outside
      peg.profile.slice(1, -1).forEach(([r1, z1], i) => {
        const [r0, z0] = peg.profile[i] ?? [0, 0];
        if (Math.abs(z1 - z0) < 0.1 || i === 0) return;
        const [r, z] = [(r0 + r1) / 2, (z0 + z1) / 2];
        for (const [inside, want] of [[r - 0.08, true], [r + 0.08, false]] as const) {
          probes++;
          assert.equal(solid(m, [inside, 0, z]), want, `wire guide ${name}: ${label} at radius ${inside.toFixed(3)}, height ${z.toFixed(3)} should be ${want ? 'solid' : 'open'}`);
        }
      });
      // assembled: its shaft in each layer's hole with play all round (open just outside the shaft, in the layer)
      const shaftTop = peg.zBottom + top - P.chamfer;
      stack.layers.forEach((layer, k) => {
        const [from, to] = [Math.max(layer.zBottom, peg.holeBottom, peg.zBottom + 0.1), Math.min(layer.zTop, peg.holeTop, shaftTop)];
        if (to - from < 0.2) return;
        const z = (from + to) / 2;
        for (let a = 0; a < 8; a++) {
          const [dx, dy] = [Math.cos(a * Math.PI / 4), Math.sin(a * Math.PI / 4)];
          inLayer(k, [peg.x + dx * (peg.shaft / 2 + 0.02), peg.y + dy * (peg.shaft / 2 + 0.02), z], false, `play round peg ${j + 1}’s shaft`);
        }
      });
    });

    // assembled at their poses, no two pieces share volume
    const placed = [...stack.layers.map((layer, k) => transform(layerMesh[k] ?? { tris: new Float64Array() }, 1, [0, 0, layer.zBottom])),
      ...stack.pegs.map((peg, j) => transform(pegMesh[j] ?? { tris: new Float64Array() }, 1, [peg.x, peg.y, peg.zBottom]))];
    for (let i = 0; i < placed.length; i++) for (let k = i + 1; k < placed.length; k++) {
      const [a, b] = [placed[i], placed[k]];
      if (!a || !b) continue;
      const v = intersection(a, b);
      shared = Math.max(shared, v);
      assert.ok(v < 0.05, `wire guide ${name}: print ${p + 1}'s pieces ${i + 1} and ${k + 1} share ${v.toFixed(3)} mm³ assembled`);
    }
  });
  return { probes, pieces: reports, shared };
}
