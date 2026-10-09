/**
 * Runs a mechanism spec's scenarios (contracts `PhysicsScenario`): builds the scene with the scenario's gravity, plays its drives
 * and checks what it asks at the times it asks. CI runs these (`npm run check:physics`).
 */
import type { PhysicsCheck, PhysicsDrive, PhysicsScenario } from '@canfactory/contracts';
import { buildScene, type BuildInput } from './build.ts';
import type { Engine } from './engine.ts';
import { DEG, MM, type Vec3 } from './scene.ts';
import { Simulation } from './simulation.ts';
import { add, scale, sub } from './transform.ts';

/** A push's fingertip: a ball of 1 mm radius, touching the pushed point from outside at the start. */
const FINGER_RADIUS = 1 * MM;

export interface CheckResult { check: PhysicsCheck; value: number | boolean; pass: boolean; description: string }
export interface ScenarioResult { scenario: PhysicsScenario; pass: boolean; checks: CheckResult[] }

/** The timeline's value at `t`: linear between its points, held before the first and after the last. */
export function interpolate(timeline: readonly (readonly number[])[], t: number): number[] {
  const first = timeline[0];
  if (!first) throw new Error('A timeline needs at least one point.');
  if (t <= (first[0] ?? 0)) return first.slice(1);
  for (let i = 1; i < timeline.length; i++) {
    const a = timeline[i - 1] ?? first, b = timeline[i] ?? first;
    const ta = a[0] ?? 0, tb = b[0] ?? 0;
    if (t <= tb) {
      const f = tb === ta ? 1 : (t - ta) / (tb - ta);
      return a.slice(1).map((value, k) => value + ((b[k + 1] ?? value) - value) * f);
    }
  }
  return (timeline.at(-1) ?? first).slice(1);
}

function jointUnit(input: BuildInput, body: string): number {
  const joint = input.spec.bodies.find(candidate => candidate.id === body)?.joint;
  if (!joint || joint.model === 'contact') throw new Error(`Scenario: ${body} has no ideal joint.`);
  return joint.type === 'hinge' ? DEG : MM;
}

function measure(simulation: Simulation, input: BuildInput, start: Map<string, Vec3>, check: PhysicsCheck): { value: number | boolean; description: string } {
  switch (check.kind) {
    case 'position': {
      const displacement = (simulation.pose(check.body).pos[check.axis] - (start.get(check.body)?.[check.axis] ?? 0)) / MM;
      return { value: displacement, description: `${check.body} moved ${displacement.toFixed(3)} mm along ${'XYZ'[check.axis] ?? '?'}` };
    }
    case 'joint': {
      const value = simulation.jointValue(check.body) / jointUnit(input, check.body);
      return { value, description: `${check.body}'s joint at ${value.toFixed(3)}` };
    }
    case 'force': {
      const hinge = jointUnit(input, check.body) === DEG;
      const value = simulation.jointConstraintForce(check.body) * (hinge ? 1 / MM : 1);
      return { value, description: `${check.body}'s joint holds ${value.toFixed(3)} ${hinge ? 'N·mm' : 'N'}` };
    }
    case 'contact': {
      const [a = '', b = ''] = check.bodies;
      const touching = simulation.touching(a, b);
      return { value: touching, description: `${a} and ${b} ${touching ? 'touch' : 'do not touch'}` };
    }
  }
}

function passes(check: PhysicsCheck, value: number | boolean): boolean {
  if (check.kind === 'contact') return value === check.touching;
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  return (check.min === undefined || value >= check.min) && (check.max === undefined || value <= check.max);
}

/** Applies the drives at time `t` (s). */
function drive(simulation: Simulation, input: BuildInput, drives: readonly PhysicsDrive[], t: number, origins: Map<number, Vec3>): void {
  drives.forEach((item, index) => {
    const key = `drive-${index}`;
    switch (item.kind) {
      case 'joint': {
        simulation.driveJoint(item.body, (interpolate(item.timeline, t)[0] ?? 0) * jointUnit(input, item.body));
        return;
      }
      case 'push': {
        const origin = origins.get(index) ?? [0, 0, 0];
        // taken away: a metre back
        if (item.until !== undefined && t > item.until) { simulation.moveFinger(key, add(origin, [0, 0, 1])); return; }
        const [x = 0, y = 0, z = 0] = interpolate(item.timeline, t);
        simulation.moveFinger(key, add(origin, [x * MM, y * MM, z * MM]));
        return;
      }
      case 'force': {
        if (t >= item.from && t < item.to) simulation.addForce(key, item.body, simulation.pose(item.body).pos, [item.force[0] ?? 0, item.force[1] ?? 0, item.force[2] ?? 0]);
        else simulation.removeForce(key);
        return;
      }
    }
  });
}

/** Runs one scenario on a fresh simulation. */
export function runScenario(engine: Engine, input: BuildInput, scenario: PhysicsScenario): ScenarioResult {
  const gravity = scenario.gravity;
  const drives = scenario.drives ?? [];
  const simulation = new Simulation(engine, buildScene({
    ...input,
    ...(gravity ? { gravity: [gravity[0] ?? 0, gravity[1] ?? 0, gravity[2] ?? 0] } : {}),
    ...(scenario.poses ? { startPoses: scenario.poses } : {}),
    drives: [...new Set(drives.flatMap(item => item.kind === 'joint' ? [item.body] : []))],
    fingers: drives.flatMap((item, index) => item.kind === 'push' ? [{ name: `drive-${index}`, radius: FINGER_RADIUS }] : []),
  }));
  try {
    const dt = simulation.scene.options.timestep;
    const start = new Map(simulation.bodies.map(name => [name, simulation.pose(name).pos]));
    const origins = new Map<number, Vec3>();
    drives.forEach((item, index) => {
      if (item.kind !== 'push') return;
      // the fingertip's centre starts a radius behind the point, against the direction of its first move
      const point: Vec3 = [(item.point[0] ?? 0) * MM, (item.point[1] ?? 0) * MM, (item.point[2] ?? 0) * MM];
      const move = item.timeline.map(([, x = 0, y = 0, z = 0]) => [x, y, z] as Vec3).find(step => Math.hypot(...step) > 0) ?? [0, 0, -1];
      origins.set(index, sub(point, scale(move, FINGER_RADIUS / Math.hypot(...move))));
    });
    const checks = [...scenario.checks].sort((a, b) => a.at - b.at);
    const results: CheckResult[] = [];
    const steps = Math.round(scenario.duration / dt);
    let next = 0;
    for (let step = 0; step <= steps; step++) {
      const t = step * dt;
      while (next < checks.length && (checks[next]?.at ?? Infinity) <= t + dt / 2) {
        const check = checks[next++];
        if (!check) break;
        const { value, description } = measure(simulation, input, start, check);
        results.push({ check, value, pass: passes(check, value), description: `${description} at ${check.at} s` });
      }
      if (step === steps) break;
      drive(simulation, input, drives, t + dt, origins);
      simulation.step();
    }
    for (const check of checks.slice(next)) results.push({ check, value: Number.NaN, pass: false, description: `${check.at} s is after the scenario's end` });
    return { scenario, pass: results.every(result => result.pass), checks: results };
  } finally {
    simulation.dispose();
  }
}
