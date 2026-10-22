import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TREAT_DISPENSER, DISC_ROTATION, TREAT_EXIT_MARGIN, outletOutline, posePoint, treatBodyPieces, treatDispenserPlacement, treatOutletCounter, treatVertices,
  type PhysicsSpec,
} from '@canfactory/contracts';
import { buildScene } from './build.ts';
import { loadEngine } from './engine.ts';
import { Simulation } from './simulation.ts';

/**
 * The treat dispenser's outlet counter against the real chute (`treatBodyPieces`): one treat released inside the chute counts only
 * once it has left the mouth, never while it is still in the chute (review of PR #139: the plane used to lie 15 mm inside it).
 */
const p = DEFAULT_TREAT_DISPENSER;
const placement = treatDispenserPlacement(p);
const { l, T } = placement;
const mouth = l.plateBottom - T.chuteDepth;

function spec(blocked: boolean): PhysicsSpec {
  // a plate across the whole outlet, 2 mm inside the mouth: the chute blocked downstream of where the old plane was
  const outline = outletOutline(l);
  const stopper = [mouth + 2, mouth + 4].flatMap(z => outline.flatMap(([x, y]) => [x, y, z]));
  // the treat lying flat in the chute, its centre 10 mm below the plate (D frame)
  const at = posePoint(placement.discPose, [0, (l.chuteFloor + l.rimOuter) / 2, l.plateBottom - 10]);
  return {
    maxStep: 0.0002,
    bodies: [
      { id: 'body', material: 'petg', fixed: true, collision: { kind: 'pieces', pieces: treatBodyPieces(l) } },
      { id: 'stopper', material: 'petg', fixed: true, collision: blocked ? { kind: 'pieces', pieces: [stopper] } : { kind: 'none' } },
    ],
    poses: { body: placement.discPose, stopper: placement.discPose },
    items: [{ id: 'treat-1', title: 'Treat', group: 'treats', vertices: treatVertices(p), mass: 0.5, friction: 0.4, pose: { position: at, rotation: DISC_ROTATION } }],
    counters: [treatOutletCounter(placement)],
  };
}

async function run(blocked: boolean): Promise<{ counted: number; depth: number }> {
  const s = spec(blocked);
  const simulation = new Simulation(await loadEngine(), buildScene({ spec: s, poses: s.poses ?? {}, geometry: {} }));
  try {
    simulation.advance(1.0);
    // the treat's centre along the chute (D z), mm
    const o = placement.discPose.position;
    const d = simulation.pose('treat-1').pos.map((value, k) => value * 1000 - (o[k] ?? 0));
    // D = R⁻¹ (W − offset); DISC_ROTATION is its own inverse
    const depth = posePoint({ position: [0, 0, 0], rotation: DISC_ROTATION }, d)[2];
    return { counted: simulation.counted('out').length, depth };
  } finally { simulation.dispose(); }
}

describe('treat dispenser outlet counter', () => {
  it('lies beyond the chute’s mouth by half a treat’s diagonal', () => {
    expect(treatOutletCounter(placement).point?.[2]).toBeCloseTo(mouth - TREAT_EXIT_MARGIN, 9);
    expect(TREAT_EXIT_MARGIN).toBeGreaterThanOrEqual(Math.hypot(p.treatLength, p.treatWidth, p.treatThickness) / 2);
  });

  it('counts nothing while a treat is stuck in a blocked chute, and one once it leaves an open one', async () => {
    const blocked = await run(true);
    expect(blocked.depth).toBeGreaterThan(mouth);
    expect(blocked.counted).toBe(0);
    const open = await run(false);
    expect(open.depth).toBeLessThan(mouth - TREAT_EXIT_MARGIN);
    expect(open.counted).toBe(1);
  }, 60_000);
});
