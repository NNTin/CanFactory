import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { artifactFormat, findModel, magneticLighterKeychain, partUsage, scadDefines, validateParameters } from './models.ts';
import { resolveAssembly } from './assembly.ts';
import { bailHole, COLLAR_TAG } from './catCollarTag.ts';
import { dimensionOf, findPart, parts } from './parts/index.ts';
import { cavityRoom, DEFAULT_LIGHTER_KEYCHAIN, KEYCHAIN_LIGHTER, KEYCHAIN_MAGNETS, KEYCHAIN_SPLIT_RINGS, keychainLighterPlan, keychainMagnetFits, LIGHTER_KEYCHAIN, lighterKeychainAssembly, lighterKeychainLayout, lighterKeychainNotes, lighterKeychainReferences, ringGoesRound, type MagneticLighterKeychainParameters } from './magneticLighterKeychain.ts';

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const source = read('models/magnetic-lighter-keychain/generator.scad');
const lighterSource = read('parts/everyday-objects/bic-j25-mini-lighter.scad');
const scadValue = (text: string, name: string) => Number(new RegExp(`^${name} = ([\\d.]+);`, 'm').exec(text)?.[1]);
const settings = (overrides: Partial<MagneticLighterKeychainParameters> = {}): MagneticLighterKeychainParameters => ({ ...DEFAULT_LIGHTER_KEYCHAIN, ...overrides });
const part = (id: string) => findPart(id) ?? (() => { throw new Error(id); })();

describe('magnetic lighter keychain contract', () => {
  it('is a registered four-print assembly, the fit checks first, whose defaults validate', () => {
    expect(findModel('magnetic-lighter-keychain')).toBe(magneticLighterKeychain);
    expect(artifactFormat(magneticLighterKeychain)).toBe('zip');
    expect(magneticLighterKeychain.parts.map(p => p.id)).toEqual(['lighter-fit-check', 'keychain-fit-check', 'keychain-holder', 'lighter-holder']);
    expect(magneticLighterKeychain.defaults).toEqual(DEFAULT_LIGHTER_KEYCHAIN);
    expect(validateParameters(magneticLighterKeychain, magneticLighterKeychain.defaults)).toEqual([]);
    // the holders enclose their magnets' sealed cavities; the fit checks are plain solids
    expect(magneticLighterKeychain.parts.filter(p => p.sealedVoids).map(p => p.id)).toEqual(['keychain-holder', 'lighter-holder']);
    expect(validateParameters(magneticLighterKeychain, { ...settings(), magnet: 'supermagnete-s-12-02-n' })).not.toEqual([]);
    expect(validateParameters(magneticLighterKeychain, { ...settings(), extra: 1 })).not.toEqual([]);
  });

  it('keeps the generator’s fixed sizes and defaults equal to magneticLighterKeychain.ts', () => {
    const k = LIGHTER_KEYCHAIN, d = DEFAULT_LIGHTER_KEYCHAIN;
    const fixed: Record<string, number> = {
      MAGNETS: k.magnets, SIDE_WALL: k.sideWall, CAP: k.cap, HEADROOM: k.headroom, RIB_W: k.ribWidth, RIB_Y: k.ribY, RIB_START: k.ribStart,
      RIB_RAMP: k.ribRamp, MOUTH: k.mouth, EYE_T: k.eyeThickness, EYE_WALL: k.eyeWall, EYE_BASE: k.eyeBase, CHECK_H: k.checkHeight,
      HOLE_PLAY: COLLAR_TAG.holePlay, HOLE_MIN: COLLAR_TAG.holeMin,
      FIT: d.fit, SQUEEZE: d.squeeze, WALL: d.wall, SLEEVE: d.sleeveDepth, MAGNET_FIT: d.magnetFit, SKIN: d.skin, LAYER: d.layerHeight,
      MAGNET_D: dimensionOf(part(d.magnet), 'diameter', 'max'), MAGNET_T: dimensionOf(part(d.magnet), 'thickness', 'max'),
      RING_A: dimensionOf(part(d.splitRing), 'a', 'max'), RING_B: dimensionOf(part(d.splitRing), 'b', 'max'),
    };
    for (const [name, value] of Object.entries(fixed)) expect(scadValue(source, name), name).toBe(value);
  });

  it('fits the sleeve to the lighter’s plan as the parts library models it', () => {
    // the generator copies the lighter's plan (the library's lighter is never changed for the fit); its values must stay the same
    const lighter = part(KEYCHAIN_LIGHTER);
    for (const [name, key] of [['THICKNESS', 'thickness'], ['WIDTH', 'width'], ['PROFILE_N', 'profileExponent']] as const) {
      expect(scadValue(source, `LIGHTER_${name}`), name).toBe(scadValue(lighterSource, name));
      expect(scadValue(lighterSource, name), name).toBe(dimensionOf(lighter, key));
    }
    const renamed = (text: string) => text.replace(/(THICKNESS|WIDTH|PROFILE_N)/g, 'LIGHTER_$1').replace(/function plan(_x)?\(/, 'function lighter_plan$1(');
    const plan = /function plan\(d = 0, steps = 96\) = [^\n]*\n[^\n]*/.exec(lighterSource)?.[0];
    const planX = /function plan_x\(y, d = 0\) = [^\n]*/.exec(lighterSource)?.[0];
    expect(plan && planX).toBeTruthy();
    expect(source).toContain(renamed(plan ?? ''));
    expect(source).toContain(renamed(planX ?? ''));
    // the contract's plan is the same 96-gon, 11 × 22 mm
    const points = keychainLighterPlan();
    expect(points).toHaveLength(96);
    expect(Math.max(...points.map(p => p[0]))).toBeCloseTo(5.5, 9);
    expect(Math.max(...points.map(p => p[1]))).toBeCloseTo(11, 9);
  });

  it('maps each print to only the settings it uses, with the library sizes of the magnet and ring', () => {
    const p = settings({ magnet: 'supermagnete-s-06-03-n', splitRing: 'avco-kr-93400', fit: 0.3 });
    const defines = (id: string) => Object.fromEntries(scadDefines(magneticLighterKeychain, magneticLighterKeychain.parts.find(x => x.id === id) ?? { scadMapping: {} }, p));
    expect(defines('lighter-fit-check')).toEqual({ FIT: '0.3', SQUEEZE: '0.15', WALL: '1.6', SLEEVE: '35', PART: '"lighter-fit-check"' });
    expect(defines('lighter-holder')).toMatchObject({ FIT: '0.3', MAGNET_D: '6.1', MAGNET_T: '3.1', SKIN: '0.4', LAYER: '0.2', PART: '"lighter-holder"' });
    expect(defines('keychain-holder')).toMatchObject({ MAGNET_D: '6.1', RING_A: String(dimensionOf(part('avco-kr-93400'), 'a', 'max')), PART: '"keychain-holder"' });
    // the fit check is the plate's floor and eyelet: the same settings
    expect({ ...defines('keychain-fit-check'), PART: '' }).toEqual({ ...defines('keychain-holder'), PART: '' });
  });

  it('offers exactly the library’s disc magnets up to 10 × 3 mm, and every split ring', () => {
    expect(parts.filter(keychainMagnetFits).map(p => p.id)).toEqual([...KEYCHAIN_MAGNETS]);
    expect(parts.filter(p => p.family === 'split-ring').map(p => p.id)).toEqual([...KEYCHAIN_SPLIT_RINGS]);
    const control = magneticLighterKeychain.controls.find(c => c.key === 'magnet');
    expect(control?.part).toMatchObject({ family: 'magnet', attribute: null });
    expect(partUsage(part('supermagnete-s-08-02-n')).map(u => u.modelId)).toContain('magnetic-lighter-keychain');
    expect(partUsage(part('avco-kr-9335')).map(u => u.modelId)).toContain('magnetic-lighter-keychain');
    expect(partUsage(part(KEYCHAIN_LIGHTER)).map(u => u.modelId)).toEqual(['cigarette-case', 'magnetic-lighter-keychain']);
  });

  it('seals the magnets at a print pause on a layer boundary, under a skin of whole layers', () => {
    const l = lighterKeychainLayout(settings());
    // 0.4 mm skin (two 0.2 mm layers), 8.1 × 2.1 mm magnet + 0.05 mm: pause at 2.6 mm, before layer 14; 0.8 mm cap over it
    expect([l.skin, l.pause, l.pauseLayer, l.floor]).toEqual([0.4, 2.6, 14, 3.4]);
    expect(l.pocketD).toBeCloseTo(8.3, 9);
    expect(l.magnetGap).toBeCloseTo(0.8, 9);
    expect(l.pause - l.skin).toBeGreaterThanOrEqual(l.magnetT + LIGHTER_KEYCHAIN.headroom - 1e-9);
    for (const layerHeight of [0.08, 0.12, 0.16, 0.2, 0.28, 0.32]) {
      const at = lighterKeychainLayout(settings({ layerHeight }));
      for (const height of [at.skin, at.pause]) expect(Math.abs(height / layerHeight - Math.round(height / layerHeight)), `${layerHeight}`).toBeLessThan(1e-6);
      // never less than two layers of skin
      expect(at.skin / layerHeight).toBeGreaterThanOrEqual(2 - 1e-9);
    }
    expect(lighterKeychainLayout(settings({ layerHeight: 0.32 })).skin).toBe(0.64);
    expect(lighterKeychainNotes(settings())[0]).toContain('pause the print at 2.6 mm, before layer 14 at 0.2 mm layers');
    expect(lighterKeychainNotes(settings())[1]).toContain('In the lighter holder put both marked side down (towards the bed); in the keychain holder both marked side up');
  });

  it('keeps every offered magnet’s cavities inside the outline at the default wall, and refuses those that do not fit', () => {
    for (const magnet of KEYCHAIN_MAGNETS) {
      const l = lighterKeychainLayout(settings({ magnet }));
      expect(l.pocketD / 2, magnet).toBeLessThanOrEqual(cavityRoom(l));
      // the two cavities stand a side wall apart
      expect(2 * l.magnetY - l.pocketD).toBeCloseTo(LIGHTER_KEYCHAIN.sideWall, 9);
      expect(validateParameters(magneticLighterKeychain, settings({ magnet }))).toEqual([]);
    }
    const tight = validateParameters(magneticLighterKeychain, settings({ magnet: 'supermagnete-s-10-03-n', wall: 1.2, fit: 0.1 }));
    expect(tight.map(issue => issue.field)).toEqual(['magnet']);
    expect(validateParameters(magneticLighterKeychain, settings({ magnet: 'supermagnete-s-10-03-n', wall: 1.4 }))).toEqual([]);
  });

  it('sizes the eyelet for the split ring, which goes round its bridge and takes a key ring beside it', () => {
    for (const splitRing of KEYCHAIN_SPLIT_RINGS) {
      const l = lighterKeychainLayout(settings({ splitRing }));
      expect(l.hole).toBe(bailHole(l.ringA, l.ringB));
      expect(l.hole).toBeGreaterThanOrEqual(Math.hypot(l.ringA, l.ringB) + COLLAR_TAG.holePlay - 1e-9);
      expect(ringGoesRound(l), splitRing).toBe(true);
      expect(validateParameters(magneticLighterKeychain, settings({ splitRing }))).toEqual([]);
    }
    expect(lighterKeychainLayout(settings()).hole).toBe(3.7);
  });

  it('holds the lighter by its ribs whatever the fit, and takes little filament for the fit checks', () => {
    for (const fit of [0.1, 0.3, 0.6]) {
      const l = lighterKeychainLayout(settings({ fit }));
      expect(l.boreX).toBeCloseTo(11 + 2 * fit, 9);
      // the ribs' crests do not move with the fit: the lighter squeezes each by `squeeze`
      expect(l.ribCircle).toBeCloseTo(lighterKeychainLayout(settings()).ribCircle, 9);
    }
    const l = lighterKeychainLayout(settings());
    expect(l.ribCircle).toBeLessThan(11);
    // about a gram each (the renderer confirms the volumes: 983 and 695 mm³ at the defaults)
    expect(l.lighterCheckVolume).toBeGreaterThan(900); expect(l.lighterCheckVolume).toBeLessThan(1100);
    expect(l.keychainCheckVolume).toBeGreaterThan(600); expect(l.keychainCheckVolume).toBeLessThan(800);
    expect(l.holderVolume).toBeGreaterThan(4 * l.lighterCheckVolume);
  });

  it('previews the lighter in the holder as it hangs from the keys, the magnets paired face to face and the ring through the eyelet', () => {
    const p = settings(), l = lighterKeychainLayout(p);
    const assembly = lighterKeychainAssembly(p);
    expect(magneticLighterKeychain.assembly).toEqual(assembly);
    expect(assembly.references).toEqual([{ id: 'lighter', part: KEYCHAIN_LIGHTER, title: 'BIC Mini lighter (J25)' }]);
    expect(Object.keys(assembly.poses).sort()).toEqual([...magneticLighterKeychain.parts.map(x => x.id), 'lighter'].sort());
    const foot = assembly.poses['keychain-holder']?.position[2] ?? NaN;
    // the lighter's hood on the floor, its base on the holder's floor; the holder turned over, its bed face meeting the plate's
    expect(foot).toBeCloseTo(62 + l.floor, 9);
    expect(assembly.poses['lighter']).toEqual({ position: [0, 0, 62], rotation: [180, 0, 0] });
    expect(assembly.poses['lighter-holder']).toEqual({ position: [0, 0, foot], rotation: [180, 0, 0] });
    const linked = lighterKeychainReferences(p);
    expect(linked.map(r => r.id)).toEqual(['magnet-foot-plus-y', 'magnet-foot-minus-y', 'magnet-plate-plus-y', 'magnet-plate-minus-y', 'split-ring']);
    const z = (id: string) => linked.find(r => r.id === id)?.pose.position[2] ?? NaN;
    // each pair: the foot's magnet ends a skin under the face, the plate's starts a skin over it
    expect(z('magnet-foot-plus-y')).toBeCloseTo(foot - l.skin, 9);
    expect(z('magnet-plate-plus-y')).toBeCloseTo(foot + l.skin, 9);
    const resolved = resolveAssembly(magneticLighterKeychain, magneticLighterKeychain.assembly, p);
    expect(resolved?.steps.map(s => s.parts)).toEqual([['lighter-holder', 'magnet-foot-plus-y', 'magnet-foot-minus-y'], ['keychain-holder', 'magnet-plate-plus-y', 'magnet-plate-minus-y', 'split-ring']]);
    // the poses follow the magnet's height
    expect(lighterKeychainAssembly(settings({ magnet: 'supermagnete-s-10-03-n' })).poses['keychain-holder']?.position[2]).toBeGreaterThan(foot);
  });
});
