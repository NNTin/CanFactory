import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { artifactFormat, findModel, partUsage, scadDefines, validateParameters, wandHolder } from './models.ts';
import { dimensionOf, findPart } from './parts/index.ts';
import { DEFAULT_WAND_HOLDER, WAND_HOLDER, WAND_HOLDER_POST, WAND_HOLDER_STRAIN_LIMIT, wandHolderAssembly, wandHolderBand, wandHolderFlex, wandHolderLayout, type WandHolderParameters } from './wandHolder.ts';

const source = readFileSync(new URL('../../../models/wand-holder/generator.scad', import.meta.url), 'utf8');
const postSource = readFileSync(new URL('../../../parts/everyday-objects/trixie-43991-sisal-trunk.scad', import.meta.url), 'utf8');
const scadValue = (text: string, name: string) => Number(new RegExp(`^${name} = ([\\d.]+);`, 'm').exec(text)?.[1]);
const settings = (overrides: Partial<WandHolderParameters> = {}): WandHolderParameters => ({ ...DEFAULT_WAND_HOLDER, ...overrides });
const posts = Array.from({ length: WAND_HOLDER.postMax - WAND_HOLDER.postMin + 1 }, (_, i) => WAND_HOLDER.postMin + i);

describe('wand holder contract', () => {
  it('is a registered one-part assembly whose defaults validate, with no post-diameter setting', () => {
    expect(findModel('wand-holder')).toBe(wandHolder);
    expect(artifactFormat(wandHolder)).toBe('zip');
    expect(wandHolder.parts.map(part => part.id)).toEqual(['clip']);
    expect(wandHolder.defaults).toEqual(DEFAULT_WAND_HOLDER);
    expect(validateParameters(wandHolder, wandHolder.defaults)).toEqual([]);
    // one fixed clip for every post (#149): only the socket has settings
    expect(wandHolder.controls.map(control => control.key)).toEqual(['handleDiameter', 'socketDepth', 'clearance', 'squeeze']);
  });

  it('keeps the generator’s fixed sizes and defaults equal to wandHolder.ts', () => {
    const fixed: Record<string, number> = {
      POST_MIN: WAND_HOLDER.postMin, POST_MAX: WAND_HOLDER.postMax, GRIP_D: WAND_HOLDER.gripD, RIDGE: WAND_HOLDER.ridge, RIDGE_PITCH: WAND_HOLDER.ridgePitch,
      RIDGE_LAND: WAND_HOLDER.ridgeLand, BAND: WAND_HOLDER.band, HEIGHT: WAND_HOLDER.height, WRAP: WAND_HOLDER.wrap, FLARE: WAND_HOLDER.flare,
      FLARE_ANGLE: WAND_HOLDER.flareAngle, BACK: WAND_HOLDER.back, WALL: WAND_HOLDER.wall, FLOOR: WAND_HOLDER.floor, VENT_D: WAND_HOLDER.vent,
      RIBS: WAND_HOLDER.ribs, RIB_W: WAND_HOLDER.ribWidth, LEAD: WAND_HOLDER.lead, RIB_RAMP: WAND_HOLDER.ribRamp, SINK: WAND_HOLDER.sink,
      HANDLE_D: DEFAULT_WAND_HOLDER.handleDiameter, SOCKET_DEPTH: DEFAULT_WAND_HOLDER.socketDepth, CLEARANCE: DEFAULT_WAND_HOLDER.clearance, SQUEEZE: DEFAULT_WAND_HOLDER.squeeze,
    };
    for (const [name, value] of Object.entries(fixed)) expect(scadValue(source, name), name).toBe(value);
    const defines = Object.fromEntries(scadDefines(wandHolder, wandHolder.parts[0] ?? { scadMapping: {} }, settings({ handleDiameter: 9.5, socketDepth: 50 })));
    expect(defines).toEqual({ HANDLE_D: '9.5', SOCKET_DEPTH: '50', CLEARANCE: '0.2', SQUEEZE: '0.15' });
  });

  it('grips every post in its range: squeezed, wrapped past the widest line, and bent within PETG’s elastic range', () => {
    const band = wandHolderBand();
    for (const post of posts) {
      const flex = wandHolderFlex(post);
      // relaxed smaller than the post, so it always squeezes it
      expect(2 * band.crest, `${post}`).toBeLessThan(post);
      expect(flex.wrap, `${post}`).toBeGreaterThan(210);
      expect(flex.behind, `${post}`).toBeGreaterThan(2.5);
      expect(flex.seated, `${post}`).toBeGreaterThan(0);
      expect(flex.passing, `${post}`).toBeLessThan(WAND_HOLDER_STRAIN_LIMIT);
      expect(flex.seated, `${post}`).toBeLessThan(flex.passing);
    }
    // the mouth is narrower than any post, so the post has to spread the arms (it snaps)
    expect(wandHolderFlex(WAND_HOLDER.postMin).mouth).toBeLessThan(WAND_HOLDER.postMin - 20);
    expect(wandHolderFlex(WAND_HOLDER.postMax).passing).toBeGreaterThan(wandHolderFlex(WAND_HOLDER.postMin).passing);
  });

  it('meets every post in its range with the lips’ inner faces, so they spread the arms as a wedge', () => {
    const band = wandHolderBand(), a = WAND_HOLDER.flareAngle * Math.PI / 180, half = WAND_HOLDER.band / 2;
    const tipY = band.middle * Math.sin(band.tip * Math.PI / 180);
    // the inner face's offset from the mouth's axis, from the band's end to the lip's end
    const from = tipY - half * Math.cos(a), to = tipY + WAND_HOLDER.flare * Math.sin(a) - half * Math.cos(a);
    for (const post of posts) {
      const contact = post / 2 * Math.cos(a);
      expect(contact, `${post}`).toBeGreaterThan(from);
      expect(contact, `${post}`).toBeLessThan(to);
    }
  });

  it('sizes the socket from the handle: play all round, ribs that squeeze it, and a depth of at least three diameters', () => {
    const l = wandHolderLayout(settings());
    expect(2 * l.bore).toBeCloseTo(8.4, 9);
    expect(l.ribCircle).toBeCloseTo(7.7, 9);
    expect(l.tubeHeight).toBe(42);
    // the bore stays clear of the band
    expect(-l.tubeX - l.bore).toBeGreaterThan(l.outside + 1);
    expect(validateParameters(wandHolder, settings({ handleDiameter: 12, socketDepth: 35 }))).toEqual([{ field: 'socketDepth', message: expect.stringContaining('at least 3 handle diameters deep (36.0 mm') }]);
    expect(validateParameters(wandHolder, settings({ handleDiameter: 12, socketDepth: 36 }))).toEqual([]);
    expect(validateParameters(wandHolder, settings({ handleDiameter: 5, socketDepth: 25, clearance: 0.5, squeeze: 0 }))).toEqual([]);
    expect(validateParameters(wandHolder, { ...settings(), postDiameter: 100 })).not.toEqual([]);
  });

  it('shows the clip snapping round the library’s TRIXIE trunk, whose dimensions equal its SCAD model', () => {
    const post = findPart(WAND_HOLDER_POST.part);
    if (!post) throw new Error('Expected the trunk');
    expect([dimensionOf(post, 'width'), dimensionOf(post, 'height')]).toEqual([WAND_HOLDER_POST.diameter, WAND_HOLDER_POST.height]);
    expect([scadValue(postSource, 'DIAMETER'), scadValue(postSource, 'HEIGHT'), scadValue(postSource, 'ROPE')]).toEqual([dimensionOf(post, 'width'), dimensionOf(post, 'height'), dimensionOf(post, 'rope')]);
    expect(WAND_HOLDER_POST.diameter).toBe(WAND_HOLDER.postMin);
    expect(partUsage(post)).toEqual([{ modelId: 'wand-holder', modelTitle: 'Wand holder', via: 'Assembly preview', kind: 'model' }]);
    const assembly = wandHolderAssembly();
    expect(wandHolder.assembly).toEqual(assembly);
    const seated = assembly.poses['clip']?.scale ?? [];
    // seated, the ridges' crests lie on the post; spread, the tips clear it
    expect((seated[0] ?? 0) * WAND_HOLDER.gripD).toBeCloseTo(WAND_HOLDER_POST.diameter, 9);
    const spread = assembly.steps[0]?.scaleFrom ?? [];
    const band = wandHolderBand();
    expect((spread[1] ?? 0) * band.crest * Math.sin(band.tip * Math.PI / 180)).toBeGreaterThan(WAND_HOLDER_POST.diameter / 2);
    expect(assembly.steps[1]?.scaleFrom).toEqual(spread);
  });
});
