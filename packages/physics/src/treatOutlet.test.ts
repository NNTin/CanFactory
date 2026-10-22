import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TREAT_DISPENSER, TREAT_DISPENSER, TREAT_EXIT_MARGIN, treatChutePieces, treatDispenserLayout, treatOutletCounter, treatVertices,
  type PhysicsSpec,
} from '@canfactory/contracts';
import { buildScene } from './build.ts';
import { loadEngine } from './engine.ts';
import { Simulation } from './simulation.ts';

/**
 * The treat dispenser's outlet counter against the real chute (`treatChutePieces`): one treat let go on the chute counts only once
 * it has left the chute's end, never while it is still on it (review of PR #139: the plane once lay inside the chute).
 */
const p = DEFAULT_TREAT_DISPENSER;
const l = treatDispenserLayout(p);
const end = TREAT_DISPENSER.chuteEnd;

function spec(blocked: boolean): PhysicsSpec {
  // a plate across the chute 3 mm before its end: the way out blocked
  const z = l.chuteAt(end + 3);
  const stopper = [end + 2, end + 4].flatMap(y => [[-l.chuteIn, z - 1], [l.chuteIn, z - 1], [l.chuteIn, z + 12], [-l.chuteIn, z + 12]].flatMap(([x = 0, h = 0]) => [x, y, h]));
  // the treat lying flat on the chute, half way down it
  const y = (end + l.chuteBack) / 2;
  return {
    maxStep: 0.0002,
    bodies: [
      { id: 'chute', material: 'petg', fixed: true, collision: { kind: 'pieces', pieces: treatChutePieces(l) } },
      { id: 'stopper', material: 'petg', fixed: true, collision: blocked ? { kind: 'pieces', pieces: [stopper] } : { kind: 'none' } },
    ],
    poses: { chute: { position: [0, 0, 0] }, stopper: { position: [0, 0, 0] } },
    items: [{
      id: 'treat-1', title: 'Treat', group: 'treats', vertices: treatVertices(p), mass: 0.5, friction: 0.4,
      pose: { position: [0, y, l.chuteAt(y) + p.treatThickness / 2 + 0.5], rotation: [-TREAT_DISPENSER.chuteSlope, 0, 90] },
    }],
    counters: [treatOutletCounter(p)],
  };
}

async function run(blocked: boolean): Promise<{ counted: number; y: number }> {
  const s = spec(blocked);
  const simulation = new Simulation(await loadEngine(), buildScene({ spec: s, poses: s.poses ?? {}, geometry: {} }));
  try {
    simulation.advance(1.5);
    return { counted: simulation.counted('out').length, y: simulation.pose('treat-1').pos[1] * 1000 };
  } finally { simulation.dispose(); }
}

describe('treat dispenser outlet counter', () => {
  it('lies beyond the chute’s end by half a treat’s diagonal', () => {
    expect(treatOutletCounter(p).point?.[1]).toBeCloseTo(end - TREAT_EXIT_MARGIN, 9);
    expect(TREAT_EXIT_MARGIN).toBeGreaterThanOrEqual(Math.hypot(p.treatLength, p.treatWidth, p.treatThickness) / 2);
  });

  it('counts nothing while a treat is held on a blocked chute, and one once it leaves an open one', async () => {
    const blocked = await run(true);
    expect(blocked.y).toBeGreaterThan(end);
    expect(blocked.counted).toBe(0);
    const open = await run(false);
    expect(open.y).toBeLessThan(end - TREAT_EXIT_MARGIN);
    expect(open.counted).toBe(1);
  }, 60_000);
});
