import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WIRE_GUIDE_GEOMETRY, wireGuideGeometry, type WireGuideDesign } from '@canfactory/contracts';
import { bounds, type Mesh } from './stl-to-scad/stl.ts';

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

    // funnels: open below the plate, through it and up the shaft; solid plate beside the outlet
    for (const funnel of print.funnels) {
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
