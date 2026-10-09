import { describe, expect, it } from 'vitest';
import { isConvex, spurGearOutline, spurGearPairPhysics, spurGearRadii, spurGearTooth, type SpurGear } from '@canfactory/contracts';
import { loadEngine } from './engine.ts';
import { runScenario } from './scenario.ts';

const driver: SpurGear = { module: 1.5, teeth: 20, width: 6, backlash: 0.05 };
const driven: SpurGear = { module: 1.5, teeth: 40, width: 6, backlash: 0.05 };

describe('spur gear pieces', () => {
  it('gives each tooth as a convex polygon between the root and tip circles', () => {
    const tooth = spurGearTooth(driver);
    const { root, tip } = spurGearRadii(driver);
    expect(isConvex(tooth)).toBe(true);
    const radii = tooth.map(([x, y]) => Math.hypot(x, y));
    expect(Math.min(...radii)).toBeCloseTo(root, 9);
    expect(Math.max(...radii)).toBeCloseTo(tip, 9);
    expect(spurGearOutline(driver)).toHaveLength(tooth.length * driver.teeth);
  });
});

describe('a gear pair coupled by its teeth', () => {
  it('turns at the ratio of its teeth, and has the backlash of its thinned teeth', async () => {
    const engine = await loadEngine();
    const spec = spurGearPairPhysics(driver, driven);
    for (const scenario of spec.scenarios ?? []) {
      const result = runScenario(engine, { spec, poses: {}, geometry: {} }, scenario);
      expect(result.checks.map(check => `${String(check.pass)} ${check.description}`)).toEqual(result.checks.map(check => `true ${check.description}`));
    }
  });
});
