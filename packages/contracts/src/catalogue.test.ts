import { describe, expect, it } from 'vitest';
import { AI_DUCK_VARIANTS, aiRubberDuck, artifactFormat, cigaretteCase, findPart, fruitFlyTrap, litterShovel, models, mossPlanter, partFamilies, parts, partsOfFamily, partUsage, plankConnector, type ModelDefinition } from './index.ts';

const part = (id: string) => findPart(id) ?? (() => { throw new Error(id); })();

// The web app reads the catalogue straight from this registry; no API serves it (#95).
describe('the bundled catalogue', () => {
  it('lists every model, with its file format', () => {
    expect(models.map(model => model.id).sort()).toEqual(['ai-rubber-duck', 'cat-collar-tag', 'cigarette-case', 'esp32-c3-supermini-case', 'fruit-fly-trap', 'litter-shovel', 'magnetic-cat-toy', 'moss-planter', 'outside-corner-toggle-latch', 'plank-connector', 'pressure-pad', 'printed-corner-bracket', 'printed-screen-hook', 'qr-magnet-tag', 'spring-ball-detent', 'toggle-latch', 'window-cat-guard', 'xiao-sense-camera-housing']);
    expect(fruitFlyTrap.parameterSchema).toMatchObject({ type: 'object', additionalProperties: false, properties: { trapDiameter: { type: 'number', minimum: 20, maximum: 200 } } });
    expect([fruitFlyTrap, plankConnector].map(artifactFormat)).toEqual(['stl', 'stl']);
    expect([aiRubberDuck, mossPlanter, cigaretteCase, litterShovel].map(artifactFormat)).toEqual(['zip', 'zip', 'zip', 'zip']);
  });

  it('describes the editors of the duck, the moss planter, the cigarette case, the plank connector and the litter shovel', () => {
    // As the editor sees them: any model definition, not its registered literal type.
    const [duck, moss, cigarette, plank, shovel] = ([aiRubberDuck, mossPlanter, cigaretteCase, plankConnector, litterShovel] as const).map((model): ModelDefinition => model);
    if (!duck || !moss || !cigarette || !plank || !shovel) throw new Error('missing model');
    expect(duck.controls.map(control => control.key)).toEqual(['variant', 'bodyLength', 'clearance']);
    expect(duck.controls[0]?.options?.map(option => option.value)).toEqual([...AI_DUCK_VARIANTS]);
    expect(duck.assembly?.partColors).toEqual({ body: '#ffda4a', face: '#d7774b' });
    expect(moss.controls.map(control => control.key)).toEqual(['towerDiameter', 'spikeLength', 'shortRauteRows', 'tallRauteRows', 'rauteColumns']);
    expect(moss.parts).toHaveLength(5);
    expect(moss.assembly).toBeUndefined();
    expect(moss.referencePath).toBeUndefined();
    expect(cigarette.controls.map(control => control.kind)).toEqual(['enum', 'enum', 'enum', 'enum', 'enum', 'enum', 'enum', 'text', 'enum', 'number', 'svg', 'number', 'enum', 'number', ...Array<string>(9).fill('number')]);
    // the magnets are real parts, linked to the parts library, and offered only in magnet mode
    expect(cigarette.controls.find(control => control.key === 'magnet')).toMatchObject({ part: { family: 'magnet', attribute: null }, visibleWhen: { control: 'snap', values: ['magnet'] }, default: 'supermagnete-s-06-02-n' });
    const clearance = cigarette.controls.find(control => control.key === 'clearance');
    expect(clearance).toMatchObject({ key: 'clearance', group: 'advanced', default: 0.2, minimum: 0.1, maximum: 0.6 });
    expect(clearance?.recommended?.map(entry => entry.control)).toEqual(['snap', 'miniLidSnap', 'holderSnap', 'lighterSnap', 'miniBoxSnap']);
    expect(cigarette.parts?.map(item => item.id)).toEqual(['case-box', 'case-lid', 'mini-holder', 'mini-box', 'mini-lid', 'case-text']);
    expect(cigarette.referencePath).toBeUndefined();
    expect(plank.controls.find(control => control.key === 'screwHoles')?.options?.map(option => option.value)).toEqual(['none', 'M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8']);
    expect(plank.controls.map(control => control.key)).toEqual(['pocketWidth', 'pocketThickness', 'insertionDepth', 'screwHoles', 'holeFit', 'holesPerEnd', 'wallThickness', 'stopThickness', 'entryChamfer']);
    expect(plank.parts).toBeUndefined();
    expect(shovel.parts?.map(item => item.id)).toEqual(['container', 'scoop', 'handle']);
    expect(shovel.assembly?.steps.map(step => step.parts)).toEqual([['scoop'], ['handle']]);
    expect(shovel.controls.find(control => control.key === 'sievePattern')?.options?.map(option => option.value)).toEqual(['slots', 'staggered', 'round', 'hex']);
  });

  it('groups every part into a family, and lists the models and concept pages that use a part', () => {
    expect(partFamilies.reduce((sum, family) => sum + partsOfFamily(family.id).length, 0)).toBe(parts.length);
    // the plank connector links every M3 screw through its screw-hole sizes; the toggle latch by its thread and as a machine screw
    expect(partUsage(part('iso-4762-m3x10'))).toEqual([{ modelId: 'plank-connector', modelTitle: plankConnector.title, via: 'Screw holes', kind: 'model' },
      { modelId: 'toggle-latch', modelTitle: 'Toggle latch', via: 'Thread', kind: 'model' }, { modelId: 'toggle-latch', modelTitle: 'Toggle latch', via: 'Machine screw', kind: 'model' }]);
    // a concept page that uses a part is listed too, as a concept
    expect(partUsage(part('ganter-gn-343-2-32-m8-63-kr'))).toEqual([
      { modelId: 'catio/window-insert', modelTitle: 'Window catio: window insert', via: 'Spreader feet (32 mm)', kind: 'concept' },
      { modelId: 'catio/tunnel', modelTitle: 'Window catio: tunnel', via: 'Support feet (32 mm)', kind: 'concept' },
    ]);
    expect(partUsage(part('bic-j25-mini-lighter'))).toEqual([{ modelId: 'cigarette-case', modelTitle: cigaretteCase.title, via: 'Assembly preview', kind: 'model' }]);
  });
});
