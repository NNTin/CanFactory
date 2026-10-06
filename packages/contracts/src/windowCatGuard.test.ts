import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { activeParts, artifactFormat, AssemblySchema, DEFAULT_WINDOW_CAT_GUARD, findModel, JOINT_INSERTS, JOINT_NUTS, JOINT_SCREWS, JOINT_THREADS, jointInsertFits, jointNutFits, jointScrewFits, jointScrewHolds, scadDefines, validateParameters, windowCatGuard, windowCatGuardAssembly, type ParameterValues } from './models.ts';
import { assemblyStops, resolveAssembly } from './assembly.ts';
import { findPart, parts as libraryParts, type Part } from './parts/index.ts';
import { RenderRequestSchema } from './index.ts';
import { leastRibSpacing, placePoint, segmentCount, sideJointWidth, sideWidth, spineAngle, WINDOW_CAT_GUARD, WINDOW_CAT_GUARD_MAX_SEGMENTS, WINDOW_CAT_GUARD_SPLICE, windowCatGuardBolts, windowCatGuardLayout, windowCatGuardPieces } from './windowCatGuard.ts';

const source = readFileSync(new URL('../../../models/window-cat-guard/generator.scad', import.meta.url), 'utf8');
const defaults = windowCatGuard.defaults;
const ids = (parameters: ParameterValues) => activeParts(windowCatGuard, { ...defaults, ...parameters }).map(part => part.id);
const shape = (parameters: ParameterValues = {}) => ({ ...DEFAULT_WINDOW_CAT_GUARD, ...parameters }) as typeof DEFAULT_WINDOW_CAT_GUARD;
const part = (id: string): Part => findPart(id) ?? (() => { throw new Error(id); })();
const segments = (kind: string, count: number) => Array.from({ length: count }, (_, i) => `${kind}-${i + 1}`);

/** Rotates about X, then Y, then Z (degrees), as the preview and tools/check-assembly.ts place a part; rounded to 1e-6 mm. */
function place(point: [number, number, number], rotation: readonly number[], position: readonly number[]): number[] {
  return placePoint(point, rotation, position).map(value => Math.round(value * 1e6) / 1e6 + 0);
}

describe('window cat guard contract', () => {
  it('is a registered model of up to eight segments per panel whose defaults validate', () => {
    expect(findModel('window-cat-guard')).toBe(windowCatGuard);
    expect(artifactFormat(windowCatGuard)).toBe('zip');
    // the segments, then a splice bar per joint of each side panel and two (one per rib) per joint of the strip
    expect(windowCatGuard.parts).toHaveLength(3 * WINDOW_CAT_GUARD_MAX_SEGMENTS + 4 * (WINDOW_CAT_GUARD_MAX_SEGMENTS - 1));
    expect(defaults).toEqual(DEFAULT_WINDOW_CAT_GUARD);
    expect(validateParameters(windowCatGuard, defaults)).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: 'window-cat-guard', modelVersion: '1', parameters: defaults })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'window-cat-guard', modelVersion: '1', parameters: { ...defaults, extra: 1 } })).toBe(false);
  });

  it('splits every panel longer than the longest part into equal segments, with a splice bar over every joint', () => {
    // 550 mm in parts of at most 210 mm: three side segments; the strip is 900 - 2 × 11.5 = 877 mm: five
    const glue = { segmentJoints: 'glue' };
    expect(ids(glue)).toEqual(['left-1', 'left-2', 'left-3', 'right-1', 'right-2', 'right-3', 'strip-1', 'strip-2', 'strip-3', 'strip-4', 'strip-5']);
    expect(ids({ ...glue, maxPartLength: 300 })).toEqual(['left-1', 'left-2', 'right-1', 'right-2', 'strip-1', 'strip-2', 'strip-3']);
    expect(ids({ ...glue, height: 420 })).toEqual(['left-1', 'left-2', 'right-1', 'right-2', 'strip-1', 'strip-2', 'strip-3', 'strip-4', 'strip-5']);
    expect(ids({ ...glue, topStrip: false })).toEqual(['left-1', 'left-2', 'left-3', 'right-1', 'right-2', 'right-3']);
    expect(ids({ ...glue, height: 200, width: 300, maxPartLength: 210 })).toEqual(['left-1', 'right-1', 'strip-1', 'strip-2']);
    // with splice bars (the default): two per side panel, and four pairs on the strip
    expect(ids({})).toEqual([...segments('left', 3), ...segments('right', 3), ...segments('strip', 5), 'left-bar-1', 'left-bar-2', 'right-bar-1', 'right-bar-2',
      'strip-bar-1-1', 'strip-bar-1-2', 'strip-bar-2-1', 'strip-bar-2-2', 'strip-bar-3-1', 'strip-bar-3-2', 'strip-bar-4-1', 'strip-bar-4-2']);
    expect(ids({ segmentJoints: 'threaded-insert', topStrip: false })).toEqual([...segments('left', 3), ...segments('right', 3), 'left-bar-1', 'left-bar-2', 'right-bar-1', 'right-bar-2']);
    expect(ids({ height: 200, width: 300, maxPartLength: 210 })).toEqual(['left-1', 'right-1', 'strip-1', 'strip-2', 'strip-bar-1-1', 'strip-bar-1-2']);
    // exactly the longest part is one segment, a hair over is two
    expect(segmentCount(210, 210)).toBe(1);
    expect(segmentCount(210.01, 210)).toBe(2);
    const layout = windowCatGuardLayout(shape({ height: 1000 }));
    expect(layout.sideSegments).toBe(5);
    expect(layout.sideLength).toBe(200);
  });

  it('keeps every SCAD default and fixed size equal to the contract', () => {
    const [side] = windowCatGuard.parts;
    const strip = windowCatGuard.parts.find(part => part.id === 'strip-1');
    const bar = windowCatGuard.parts.find(part => part.id === 'left-bar-1');
    const constants = new Set(['PART', 'SIDE', 'SEGMENT']);
    for (const [name, literal] of [side, strip, bar].flatMap(source => scadDefines(windowCatGuard, source ?? {}, defaults)).filter(([name]) => !constants.has(name)))
      expect(source, name).toMatch(new RegExp(`^${name} = ${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};`, 'm'));
    expect(scadDefines(windowCatGuard, windowCatGuard.parts[WINDOW_CAT_GUARD_MAX_SEGMENTS + 2] ?? {}, defaults))
      .toEqual(expect.arrayContaining([['PART', '"side"'], ['SIDE', '"right"'], ['SEGMENT', '3']]));
    const g = WINDOW_CAT_GUARD;
    const fixed = {
      SPINE_W: g.spineWidth, RIB_W: g.ribWidth, RIB_SPACING: g.ribSpacing, TAB_DEPTH: g.tabDepth, TAB_FLARE: g.tabFlare, TAB_MARGIN: g.tabMargin, LAP: g.lap,
      PIN_D: g.pinDiameter, PIN_FLAT: g.pinFlat, BOSS_D: g.bossDiameter, BOSS_H: g.bossHeight, BOSS_INSET: g.bossInset, END_GAP: g.endGap,
    };
    const s = WINDOW_CAT_GUARD_SPLICE;
    Object.assign(fixed, { SPLICE_W: s.width, SPLICE_T: s.thickness, SPLICE_NEAR: s.near, SPLICE_FAR: s.far, SPLICE_END: s.end, SINK_PLAY: s.sinkPlay, NUT_PLAY: s.nutPlay, NUT_RECESS: s.nutRecess, NUT_ROOF: s.nutRoof });
    for (const [name, value] of Object.entries(fixed)) expect(source, name).toMatch(new RegExp(`^${name} += ${String(value).replace('.', '\\.')};`, 'm'));
    // the bar is as wide as the spine; every bar is the same render (the same overrides)
    expect(s.width).toBe(g.spineWidth);
    const calls = activeParts(windowCatGuard, defaults).filter(p => p.id.includes('-bar-')).map(p => JSON.stringify(scadDefines(windowCatGuard, p, defaults)));
    expect(new Set(calls).size).toBe(1);
  });

  it('refuses layouts that do not fit the joints or the part count', () => {
    const issues = (parameters: ParameterValues) => validateParameters(windowCatGuard, { ...defaults, ...parameters });
    const said = (parameters: ParameterValues, field: string) => issues(parameters).filter(issue => issue.field === field).map(issue => issue.message).join(' ');
    expect(said({ height: 1500, maxPartLength: 150 }, 'maxPartLength')).toContain('at least 188 mm');
    expect(said({ width: 1600, maxPartLength: 120 }, 'maxPartLength')).toContain('top strip');
    expect(issues({ width: 1600, maxPartLength: 120, topStrip: false, height: 900, tipWidth: 30 })).toEqual([]);
    expect(issues({ tipWidth: 60, gap: 60 })).toContainEqual(expect.objectContaining({ field: 'tipWidth' }));
    // a short bottom segment's joint is too narrow for the dovetail: 10 + 95 × 150 / 1200 = 21.875 mm < 32.2 mm
    expect(sideJointWidth(shape())).toBeCloseTo(32.2, 9);
    expect(sideWidth(shape({ height: 1200 }), 150)).toBe(21.875);
    expect(said({ height: 1200, maxPartLength: 150 }, 'tipWidth')).toContain('only 21.8 mm');
    // the bosses either side of the spine need room across the gap
    expect(leastRibSpacing()).toBe(25);
    expect(issues({ gap: 60, border: 12, height: 300, maxPartLength: 300 })).toContainEqual(expect.objectContaining({ field: 'gap' }));
    expect(issues({ gap: 60, border: 12, height: 300, maxPartLength: 300, topStrip: false })).toEqual([]);
    expect(issues({ gap: 60, tipWidth: 20 })).toEqual([]);
    expect(issues({ cell: 5 })).toContainEqual(expect.objectContaining({ field: 'cell' }));
    expect(issues({ cell: 0 })).toEqual([]);
  });

  it('sets the clearance of every fit with one basic setting, 0.1 mm by default', () => {
    const clearance = windowCatGuard.controls.find(control => control.key === 'fit');
    expect(clearance).toMatchObject({ label: 'Clearance', group: 'basic', default: 0.1, minimum: 0.05, maximum: 0.4, step: 0.01 });
    expect(clearance?.bands?.[0]?.minimum).toBe(0.05);
    expect(clearance?.bands?.at(-1)?.maximum).toBe(0.4);
    expect(validateParameters(windowCatGuard, { ...defaults, fit: 0.37 })).toEqual([]);
    expect(validateParameters(windowCatGuard, { ...defaults, fit: 0.5 })).toContainEqual(expect.objectContaining({ field: 'fit' }));
    expect(validateParameters(windowCatGuard, { ...defaults, fit: 0.04 })).toContainEqual(expect.objectContaining({ field: 'fit' }));
    // every part with a fit takes it: the segments (dovetails, ends, the bosses' holes), not the splice bars
    for (const part of activeParts(windowCatGuard, defaults))
      expect(scadDefines(windowCatGuard, part, { ...defaults, fit: 0.17 }).some(([name, value]) => name === 'FIT' && value === '0.17'), part.id).toBe(!part.id.includes('-bar-'));
  });

  it('offers every library fastener that fits a splice bar, and checks that the screw holds in its nut or insert', () => {
    const fitting = (fits: (p: Part) => boolean) => libraryParts.filter(p => fits(p) && (JOINT_THREADS as readonly string[]).includes(p.attributes['thread'] ?? '')).map(p => p.id);
    expect([...JOINT_SCREWS]).toEqual(fitting(jointScrewFits));
    expect([...JOINT_INSERTS]).toEqual(fitting(jointInsertFits));
    expect([...JOINT_NUTS]).toEqual(fitting(jointNutFits));
    // every thread has a screw and a nut or an insert
    for (const thread of JOINT_THREADS) {
      expect(JOINT_SCREWS.some(id => part(id).attributes['thread'] === thread), thread).toBe(true);
      expect([...JOINT_INSERTS, ...JOINT_NUTS].some(id => part(id).attributes['thread'] === thread), thread).toBe(true);
    }
    // M3 × 10 through the 4 mm bar into 9 mm of plate and spine: the tip 3 mm over the back, an M3 nut (2.4 mm) round it, 3.6 mm of spine over it
    const nut = part('iso-4032-m3'), insert = part('cnc-kitchen-m3x5-7');
    expect(jointScrewHolds(9, 'nut-bolt', part('iso-10642-m3x10'), nut)).toBe(true);
    expect(jointScrewHolds(9, 'nut-bolt', part('iso-10642-m3x16'), nut)).toBe(false);
    expect(jointScrewHolds(4.4, 'nut-bolt', part('iso-10642-m3x8'), nut)).toBe(true);
    expect(jointScrewHolds(4.4, 'nut-bolt', part('iso-10642-m3x10'), nut)).toBe(false);
    // an insert takes a screw at least as long as itself past the bar, and no longer than the plate and spine
    expect(jointScrewHolds(9, 'threaded-insert', part('iso-10642-m3x10'), insert)).toBe(true);
    expect(jointScrewHolds(9, 'threaded-insert', part('iso-10642-m3x8'), insert)).toBe(false);
    expect(jointScrewHolds(9, 'threaded-insert', part('iso-10642-m3x16'), insert)).toBe(false);
    const said = (parameters: ParameterValues) => validateParameters(windowCatGuard, { ...defaults, ...parameters }).filter(issue => issue.field === 'jointScrew').map(issue => issue.message).join(' ');
    expect(said({})).toBe('');
    expect(said({ thickness: 2.4, ribHeight: 2 })).toContain('Use Countersunk head screw M3 × 8');
    expect(said({ jointScrew: 'iso-10642-m3x16' })).toMatch(/reaches 12 mm past the splice bar, out of the 9 mm.*Use Countersunk head screw M3 × 8/);
    expect(said({ segmentJoints: 'threaded-insert', jointScrew: 'iso-10642-m3x8' })).toMatch(/only 4 mm.*5\.7 mm long.*Use Countersunk head screw M3 × 10/);
    expect(said({ segmentJoints: 'threaded-insert', thickness: 2.4, ribHeight: 2 })).toContain('No listed screw');
    // glued joints take no screws, so any screw goes
    expect(said({ segmentJoints: 'glue', jointScrew: 'iso-10642-m3x20' })).toBe('');
    // the screw's thread must be the chosen one
    expect(validateParameters(windowCatGuard, { ...defaults, jointScrew: 'iso-10642-m4x10' })).toContainEqual(expect.objectContaining({ field: 'jointScrew' }));
    expect(validateParameters(windowCatGuard, { ...defaults, jointThread: 'M4', jointScrew: 'iso-10642-m4x10', jointNut: 'iso-4032-m4' })).toEqual([]);
  });

  it('stands the side panels in the window’s side planes and lays the strip’s pins in their bosses', () => {
    const p = shape();
    const pieces = windowCatGuardPieces(p);
    const pose = (id: string) => pieces.find(piece => piece.id === id) ?? (() => { throw new Error(id); })();
    const left = pose('left-1'), right = pose('right-1'), strip = pose('strip-1');
    // a side panel's print frame: x across the gap, y up from its tip, z (the spine's side) inwards
    expect(place([0, 0, 0], left.rotation, left.position)).toEqual([0, 0, 0]);
    expect(place([p.gap, p.height, 0], left.rotation, left.position)).toEqual([0, p.gap, p.height]);
    expect(place([0, 0, 1], left.rotation, left.position)).toEqual([1, 0, 0]);
    // the right one is printed mirrored (x from -gap to 0) and stands at the window's far side, facing in
    expect(place([-p.gap, p.height, 0], right.rotation, right.position)).toEqual([p.width, p.gap, p.height]);
    expect(place([0, 0, 1], right.rotation, right.position)).toEqual([p.width - 1, 0, 0]);
    // every boss's axis is a pin's axis
    const layout = windowCatGuardLayout(p);
    for (const rib of layout.ribs) {
      const boss = place([rib, p.height - WINDOW_CAT_GUARD.bossInset, 0], left.rotation, left.position);
      const pin = place([0, rib, layout.pinZ], strip.rotation, strip.position);
      expect(pin.slice(1)).toEqual(boss.slice(1));
      expect(pin[0]).toBe(p.thickness + WINDOW_CAT_GUARD.bossHeight + WINDOW_CAT_GUARD.endGap);
      const far = place([layout.stripLength, rib, layout.pinZ], strip.rotation, strip.position);
      expect(far[0]).toBe(p.width - (pin[0] ?? 0));
    }
    // the pins end 0.5 mm short of the side panels' outer faces
    expect(layout.pinLength).toBe(WINDOW_CAT_GUARD.endGap + WINDOW_CAT_GUARD.bossHeight + p.thickness - 0.5);
  });

  it('assembles every segment it renders, in steps that name only those segments', () => {
    for (const parameters of [{}, { topStrip: false }, { height: 1000, width: 1400 }, { maxPartLength: 300 }, { segmentJoints: 'glue' }, { segmentJoints: 'threaded-insert', height: 200, width: 300 }] as ParameterValues[]) {
      const all = { ...defaults, ...parameters };
      const assembly = resolveAssembly(windowCatGuard, windowCatGuard.assembly, all);
      if (!assembly) throw new Error('Expected an assembly');
      expect(Value.Check(AssemblySchema, assembly)).toBe(true);
      const active = ids(parameters);
      const references = (assembly.references ?? []).map(reference => reference.id);
      expect(Object.keys(assembly.poses).sort()).toEqual([...active, ...references].sort());
      expect(Object.keys(assembly.partColors ?? {}).sort()).toEqual([...active].sort());
      for (const step of assembly.steps) for (const id of step.parts) expect([...active, ...references]).toContain(id);
      const layout = windowCatGuardLayout(shape(parameters));
      // one step per joint, a step for each panel's splice bars, then the strip onto the left panel and the right panel onto the strip
      const bars = parameters['segmentJoints'] === 'glue' ? 0 : 2 * Number(layout.sideSegments > 1) + Number(layout.stripSegments > 1);
      expect(assembly.steps).toHaveLength(2 * (layout.sideSegments - 1) + (layout.stripSegments > 0 ? layout.stripSegments - 1 + 2 : 0) + bars);
      expect(assemblyStops(assembly)).toBe(assembly.steps.length + 2);
      // a screw and a nut (or an insert) for each end of each bar
      expect(references).toHaveLength(parameters['segmentJoints'] === 'glue' ? 0 : 4 * active.filter(id => id.includes('-bar-')).length);
    }
    expect(windowCatGuardAssembly(defaults).steps.map(step => step.title)).toEqual([
      'Left panel: drop segment 2’s dovetail into segment 1',
      'Left panel: drop segment 3’s dovetail into segment 2',
      'Left panel: screw a splice bar over every joint',
      'Right panel: drop segment 2’s dovetail into segment 1',
      'Right panel: drop segment 3’s dovetail into segment 2',
      'Right panel: screw a splice bar over every joint',
      'Top strip: lay segment 4’s dovetails into segment 5',
      'Top strip: lay segment 3’s dovetails into segment 4',
      'Top strip: lay segment 2’s dovetails into segment 3',
      'Top strip: lay segment 1’s dovetails into segment 2',
      'Top strip: screw a splice bar over every joint, on both ribs',
      'Plug the top strip’s pins into the left panel’s bosses',
      'Push the right panel’s bosses onto the strip’s other pins; stand the guard in the window',
    ]);
  });

  it('lays every splice bar on its spine or rib across its joint, its countersunk holes on the screws’ axes', () => {
    for (const parameters of [{}, { height: 1000, width: 1400, gap: 150, tipWidth: 30, thickness: 3, ribHeight: 8 }] as ParameterValues[]) {
      const p = shape(parameters);
      const pieces = windowCatGuardPieces(p);
      const bolts = windowCatGuardBolts(p);
      const s = WINDOW_CAT_GUARD_SPLICE;
      const stack = p.thickness + p.ribHeight;
      for (const bar of pieces.filter(piece => piece.kind === 'bar')) {
        const [near, far] = (['near', 'far'] as const).map(end => bolts.find(bolt => bolt.bar === bar.id && bolt.end === end) ?? (() => { throw new Error(bar.id); })());
        // the bar's back is on the spine's top: its holes (±pitch / 2 along its x) are the screws' axes there, and its top is the bar's thickness further out
        const half = (s.far - s.near) / 2;
        const round = (v: number[]) => v.map(value => Math.round(value * 1e6) / 1e6 + 0);
        expect(place([-half, 0, 0], bar.rotation, bar.position), bar.id).toEqual(round(near?.at(stack) ?? []));
        expect(place([half, 0, 0], bar.rotation, bar.position), bar.id).toEqual(round(far?.at(stack) ?? []));
        expect(place([half, 0, s.thickness], bar.rotation, bar.position), bar.id).toEqual(round(far?.at(stack + s.thickness) ?? []));
        // a part turned by 0 has its x along the bar, from the near screw to the far one (a nut's pocket has its corners that way)
        for (const bolt of [near, far]) {
          const along = place([1, 0, 0], bolt?.turned(0) ?? [], [0, 0, 0]);
          const axis = place([1, 0, 0], bar.rotation, [0, 0, 0]);
          along.forEach((value, i) => expect(value, bar.id).toBeCloseTo(axis[i] ?? NaN, 6));
          expect(place([0, 0, 1], bolt?.turned(37) ?? [], [0, 0, 0])).toEqual(place([0, 0, 1], bolt?.rotation ?? [], [0, 0, 0]));
        }
        // the screw into the segment with the tab is the lower (left) one's, the other the upper (right) one's
        expect(near?.segment).toBe(`${bar.panel}-${bar.panel === 'strip' ? bar.segment : bar.segment + 1}`);
        expect(far?.segment).toBe(`${bar.panel}-${bar.panel === 'strip' ? bar.segment + 1 : bar.segment}`);
      }
      // on the left panel, the first bar's screws lie on the spine, `near` and `far` past the joint along it, in the window's side plane
      const layout = windowCatGuardLayout(p);
      const joint = p.height - layout.sideLength;
      const a = spineAngle(p) * Math.PI / 180;
      const near = bolts.find(bolt => bolt.bar === 'left-bar-1' && bolt.end === 'near');
      expect(place(near?.at(0) ?? [0, 0, 0], [0, 0, 0], [0, 0, 0])).toEqual(place([0, sideWidth(p, joint) / 2 + s.near * Math.cos(a), joint + s.near * Math.sin(a)], [0, 0, 0], [0, 0, 0]));
    }
    expect(windowCatGuardPieces(shape({ segmentJoints: 'glue' })).some(piece => piece.kind === 'bar')).toBe(false);
  });
});
