import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import { fruitFlyTrap, models, mossPlanter, RenderRequestSchema, type RenderRequest } from './index.ts';

/**
 * RenderRequestSchema is derived from `registeredModels` through a cast, which the compiler does not check: these type tests
 * (checked by `npm run typecheck`, as every test file) fail if a model registered with a widened id, version or settings type
 * turns `RenderRequest` from a per-model union into one that takes any model's settings.
 */
type Branch<Id extends RenderRequest['modelId']> = Extract<RenderRequest, { modelId: Id }>;
type FlyTrap = Branch<'fruit-fly-trap'>;
type MossPlanter = Branch<'moss-planter'>;
/** Only compiled, never run: the settings are of each branch's type. */
function typeChecks(flyTrapSettings: FlyTrap['parameters'], mossPlanterSettings: MossPlanter['parameters']) {
  // every model id is a literal, not `string`
  const idsAreLiterals: string extends RenderRequest['modelId'] ? false : true = true;
  // one model's id with its own settings
  const own: RenderRequest = { modelId: 'fruit-fly-trap', modelVersion: fruitFlyTrap.version, parameters: flyTrapSettings };
  // @ts-expect-error one model's id with another model's settings
  const crossed: RenderRequest = { modelId: 'fruit-fly-trap', modelVersion: fruitFlyTrap.version, parameters: mossPlanterSettings };
  // @ts-expect-error a version that is not the model's
  const otherVersion: RenderRequest = { modelId: 'moss-planter', modelVersion: '0-not-a-version', parameters: mossPlanterSettings };
  // @ts-expect-error a setting the model does not have
  const unknownSetting: RenderRequest = { modelId: 'moss-planter', modelVersion: mossPlanter.version, parameters: { ...mossPlanterSettings, arbitraryCode: 'echo(1)' } };
  return [idsAreLiterals, own, crossed, otherVersion, unknownSetting];
}

describe('RenderRequest', () => {
  it('is one branch per registered model, as the types above require', () => {
    expect(typeChecks).toBeTypeOf('function');
    expect(RenderRequestSchema.anyOf.map(branch => branch.properties.modelId.const)).toEqual(models.map(model => model.id));
  });

  it('accepts a model’s own settings and rejects another model’s', () => {
    expect(Value.Check(RenderRequestSchema, { modelId: fruitFlyTrap.id, modelVersion: fruitFlyTrap.version, parameters: fruitFlyTrap.defaults })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: fruitFlyTrap.id, modelVersion: fruitFlyTrap.version, parameters: mossPlanter.defaults })).toBe(false);
  });
});
