import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { activeParts, artifactFormat, AssemblySchema, DEFAULT_WINDOW_CAT_GUARD, findModel, scadDefines, validateParameters, windowCatGuard, windowCatGuardAssembly, type ParameterValues } from './models.ts';
import { assemblyStops, resolveAssembly } from './assembly.ts';
import { RenderRequestSchema } from './index.ts';
import { leastRibSpacing, segmentCount, sideJointWidth, sideWidth, WINDOW_CAT_GUARD, WINDOW_CAT_GUARD_MAX_SEGMENTS, windowCatGuardLayout, windowCatGuardPieces } from './windowCatGuard.ts';

const source = readFileSync(new URL('../../../models/window-cat-guard/generator.scad', import.meta.url), 'utf8');
const defaults = windowCatGuard.defaults;
const ids = (parameters: ParameterValues) => activeParts(windowCatGuard, { ...defaults, ...parameters }).map(part => part.id);
const shape = (parameters: ParameterValues = {}) => ({ ...DEFAULT_WINDOW_CAT_GUARD, ...parameters }) as typeof DEFAULT_WINDOW_CAT_GUARD;

/** Rotates about X, then Y, then Z (degrees), as the preview and tools/check-assembly.ts place a part. */
function place(point: [number, number, number], rotation: readonly number[], position: readonly number[]): number[] {
  const [ax, ay, az] = rotation.map(degrees => degrees * Math.PI / 180) as [number, number, number];
  let [x, y, z] = point;
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  return [x, y, z].map((value, axis) => Math.round((value + (position[axis] ?? 0)) * 1e6) / 1e6 + 0);
}

describe('window cat guard contract', () => {
  it('is a registered model of up to eight segments per panel whose defaults validate', () => {
    expect(findModel('window-cat-guard')).toBe(windowCatGuard);
    expect(artifactFormat(windowCatGuard)).toBe('zip');
    expect(windowCatGuard.parts).toHaveLength(3 * WINDOW_CAT_GUARD_MAX_SEGMENTS);
    expect(defaults).toEqual(DEFAULT_WINDOW_CAT_GUARD);
    expect(validateParameters(windowCatGuard, defaults)).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: 'window-cat-guard', modelVersion: '1', parameters: defaults })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'window-cat-guard', modelVersion: '1', parameters: { ...defaults, extra: 1 } })).toBe(false);
  });

  it('splits every panel longer than the longest part into equal segments', () => {
    // 550 mm in parts of at most 210 mm: three side segments; the strip is 900 - 2 × 11.5 = 877 mm: five
    expect(ids({})).toEqual(['left-1', 'left-2', 'left-3', 'right-1', 'right-2', 'right-3', 'strip-1', 'strip-2', 'strip-3', 'strip-4', 'strip-5']);
    expect(ids({ maxPartLength: 300 })).toEqual(['left-1', 'left-2', 'right-1', 'right-2', 'strip-1', 'strip-2', 'strip-3']);
    expect(ids({ height: 420 })).toEqual(['left-1', 'left-2', 'right-1', 'right-2', 'strip-1', 'strip-2', 'strip-3', 'strip-4', 'strip-5']);
    expect(ids({ topStrip: false })).toEqual(['left-1', 'left-2', 'left-3', 'right-1', 'right-2', 'right-3']);
    expect(ids({ height: 200, width: 300, maxPartLength: 210 })).toEqual(['left-1', 'right-1', 'strip-1', 'strip-2']);
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
    const constants = new Set(['PART', 'SIDE', 'SEGMENT']);
    for (const [name, literal] of [...scadDefines(windowCatGuard, side ?? {}, defaults), ...scadDefines(windowCatGuard, strip ?? {}, defaults)].filter(([name]) => !constants.has(name)))
      expect(source, name).toMatch(new RegExp(`^${name} = ${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};`, 'm'));
    expect(scadDefines(windowCatGuard, windowCatGuard.parts[WINDOW_CAT_GUARD_MAX_SEGMENTS + 2] ?? {}, defaults))
      .toEqual(expect.arrayContaining([['PART', '"side"'], ['SIDE', '"right"'], ['SEGMENT', '3']]));
    const g = WINDOW_CAT_GUARD;
    const fixed = {
      SPINE_W: g.spineWidth, RIB_W: g.ribWidth, RIB_SPACING: g.ribSpacing, TAB_DEPTH: g.tabDepth, TAB_FLARE: g.tabFlare, TAB_MARGIN: g.tabMargin, LAP: g.lap,
      PIN_D: g.pinDiameter, PIN_FLAT: g.pinFlat, BOSS_D: g.bossDiameter, BOSS_H: g.bossHeight, BOSS_INSET: g.bossInset, END_GAP: g.endGap,
    };
    for (const [name, value] of Object.entries(fixed)) expect(source, name).toMatch(new RegExp(`^${name} += ${String(value).replace('.', '\\.')};`, 'm'));
  });

  it('refuses layouts that do not fit the joints or the part count', () => {
    const issues = (parameters: ParameterValues) => validateParameters(windowCatGuard, { ...defaults, ...parameters });
    const said = (parameters: ParameterValues, field: string) => issues(parameters).filter(issue => issue.field === field).map(issue => issue.message).join(' ');
    expect(said({ height: 1500, maxPartLength: 150 }, 'maxPartLength')).toContain('at least 188 mm');
    expect(said({ width: 1600, maxPartLength: 120 }, 'maxPartLength')).toContain('top strip');
    expect(issues({ width: 1600, maxPartLength: 120, topStrip: false, height: 900, tipWidth: 30 })).toEqual([]);
    expect(issues({ tipWidth: 60, gap: 60 })).toContainEqual(expect.objectContaining({ field: 'tipWidth' }));
    // a short bottom segment's joint is too narrow for the dovetail: 10 + 95 × 150 / 1200 = 21.875 mm < 32.5 mm
    expect(sideJointWidth(shape())).toBe(32.5);
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
    for (const parameters of [{}, { topStrip: false }, { height: 1000, width: 1400 }, { maxPartLength: 300 }] as ParameterValues[]) {
      const all = { ...defaults, ...parameters };
      const assembly = resolveAssembly(windowCatGuard, windowCatGuard.assembly, all);
      if (!assembly) throw new Error('Expected an assembly');
      expect(Value.Check(AssemblySchema, assembly)).toBe(true);
      const active = ids(parameters);
      expect(Object.keys(assembly.poses).sort()).toEqual([...active].sort());
      expect(Object.keys(assembly.partColors ?? {}).sort()).toEqual([...active].sort());
      for (const step of assembly.steps) for (const id of step.parts) expect(active).toContain(id);
      const layout = windowCatGuardLayout(shape(parameters));
      // one step per joint, then the strip onto the left panel and the right panel onto the strip
      expect(assembly.steps).toHaveLength(2 * (layout.sideSegments - 1) + (layout.stripSegments > 0 ? layout.stripSegments - 1 + 2 : 0));
      expect(assemblyStops(assembly)).toBe(assembly.steps.length + 2);
    }
    expect(windowCatGuardAssembly(defaults).steps.map(step => step.title)).toEqual([
      'Left panel: drop segment 2’s dovetail into segment 1',
      'Left panel: drop segment 3’s dovetail into segment 2',
      'Right panel: drop segment 2’s dovetail into segment 1',
      'Right panel: drop segment 3’s dovetail into segment 2',
      'Top strip: lay segment 4’s dovetails into segment 5',
      'Top strip: lay segment 3’s dovetails into segment 4',
      'Top strip: lay segment 2’s dovetails into segment 3',
      'Top strip: lay segment 1’s dovetails into segment 2',
      'Plug the top strip’s pins into the left panel’s bosses',
      'Push the right panel’s bosses onto the strip’s other pins; stand the guard in the window',
    ]);
  });
});
