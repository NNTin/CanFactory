import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { activeParts, artifactFormat, cameraHousing, CAMERA_BOARD_ID, CAMERA_HARDWARE, CAMERA_LID_INSERT, CAMERA_MOUNT_INSERTS, DEFAULT_CAMERA_HOUSING as P,
  cameraHousingLayout, devBoardLayout, dimensionOf, findPart, partUsage, RenderRequestSchema, resolveAssembly, scadDefines, validateParameters } from './index.ts';

describe('XIAO Sense camera housing', () => {
  it('registers a customizable two-print assembly and a typed render request', () => {
    expect(validateParameters(cameraHousing, P)).toEqual([]);
    expect(artifactFormat(cameraHousing)).toBe('zip');
    expect(activeParts(cameraHousing, P).map(p => p.id)).toEqual(['base', 'lid']);
    expect(Value.Check(RenderRequestSchema, { modelId: cameraHousing.id, modelVersion: cameraHousing.version, parameters: P })).toBe(true);
    expect(cameraHousing.controls.map(c => c.key).sort()).toEqual(Object.keys(P).sort());
    for (const overrides of [{ width: '48' }, { unexpected: true }, { cameraDiameter: NaN }, { mountInsert: 'ruthex-rx-m5x9-5' }])
      expect(validateParameters(cameraHousing, { ...P, ...overrides })).not.toEqual([]);
  });
  it('models the camera/expansion stack, underside clearance, external antenna and battery pads', () => {
    const board = findPart(CAMERA_BOARD_ID); assert.ok(board);
    const layout = devBoardLayout(board); assert.ok(layout);
    expect(dimensionOf(board, 'H')).toBe(15);
    expect(layout.components.filter(c => ['pcb', 'camera'].includes(c.kind))).toHaveLength(2);
    expect(layout.components.find(c => c.kind === 'camera')?.top?.shape).toBe('round');
    expect(layout.bareUnderside).toBe(false);
    expect(layout.externalAntenna).toMatchObject({ kind: 'connector', x: 4.04, y: 1.73 });
    expect(layout.bottomPads.map(p => p.name)).toEqual(['BAT+', 'BAT− (GND)']);
    expect(board.dimensions['H']?.basis).toBe('manufacturer');
    expect(layout.components.find(c => c.kind === 'camera')?.sized).toBe('estimated');
  });
  it('passes library dimensions and derived stack constants to both generators', () => {
    const scad = readFileSync(new URL('../../../models/xiao-sense-camera-housing/generator.scad', import.meta.url), 'utf8');
    for (const part of activeParts(cameraHousing, P)) {
      const defines = Object.fromEntries(scadDefines(cameraHousing, part, P));
      expect(defines).toMatchObject({ BOARD_W: '17.8', BOARD_H: '15', BOARD_T: '1.25', MOUNT_HOLE: '4', MOUNT_DEPTH: '6.7', MOUNT_WALL: '1.6', LID_HOLE: '3.2' });
      for (const [key, value] of Object.entries(part.scadConstants ?? {})) {
        expect(scad).toMatch(new RegExp(`^${key} = `, 'm'));
        if (typeof value === 'number') expect(Number(new RegExp(`^${key} = ([\\d.]+);`, 'm').exec(scad)?.[1]), key).toBeCloseTo(value, 8);
      }
    }
  });
  it('rejects colliding mounts, insufficient roof rim, obscured lenses and floor-breaking USB openings', () => {
    const bad = [
      { mountSpacing: 60 }, { mountSpacing: 28, mountInsert: 'ruthex-rx-m4x8-1' },
      { cameraOffsetX: 3, cameraDiameter: 10 }, { cameraOffsetY: 3, cameraDiameter: 20 },
      { standoff: 3, usbHeight: 12 }, { standoff: 3, mountInsert: 'ruthex-rx-m4x8-1' },
    ];
    for (const overrides of bad) expect(validateParameters(cameraHousing, { ...P, ...overrides }), JSON.stringify(overrides)).not.toEqual([]);
  });
  it('accepts each insert, custom alignment, small and large envelopes and switchable openings', () => {
    for (const mountInsert of CAMERA_MOUNT_INSERTS) expect(validateParameters(cameraHousing, { ...P, mountInsert })).toEqual([]);
    for (const overrides of [
      { width: 44, length: 40, mountSpacing: 32 },
      { width: 80, length: 80, mountSpacing: 60, wall: 3.6, headroom: 4, standoff: 8 },
      { cameraOffsetX: 1.2, cameraOffsetY: -0.5, cameraDiameter: 14, usbRecess: 4 },
      { ventilation: false, chargeWindow: false, antennaDiameter: 8, batteryDiameter: 8 },
    ]) expect(validateParameters(cameraHousing, { ...P, ...overrides })).toEqual([]);
  });
  it('keeps print poses, hardware counts, screw engagement and USB position consistent as settings change', () => {
    for (const overrides of [{}, { length: 70, wall: 3.6, standoff: 8, headroom: 4, mountInsert: 'cnc-kitchen-m4x4' as const }]) {
      const p = { ...P, ...overrides }, l = cameraHousingLayout(p);
      const assembly = resolveAssembly(cameraHousing, cameraHousing.assembly, p); assert.ok(assembly);
      expect(assembly.poses['lid']).toEqual({ position: [0, 0, l.top], rotation: [180, 0, 0] });
      expect(assembly.poses['camera-board']?.position).toEqual([-CAMERA_HARDWARE.width / 2, l.boardY, l.boardZ]);
      expect(l.boardY + CAMERA_HARDWARE.length + CAMERA_HARDWARE.usbOverhang + p.usbRecess + p.wall).toBeCloseTo(p.length / 2);
      expect(assembly.references?.filter(r => r.part === CAMERA_LID_INSERT)).toHaveLength(4);
      expect(assembly.references?.filter(r => r.part === p.mountInsert)).toHaveLength(2);
      expect(assembly.references?.filter(r => r.part === l.screw?.id)).toHaveLength(4);
      expect(assembly.steps.map(s => s.title)).toHaveLength(3);
      assert.ok(l.screw);
      const engagement = dimensionOf(l.screw, 'l') - l.grip;
      expect(engagement).toBeGreaterThanOrEqual(3 - 1e-9);
      expect(engagement).toBeLessThan(CAMERA_HARDWARE.lidHoleDepth);
      expect(l.boardZ - 1.5 - p.wall).toBeGreaterThanOrEqual(1.5);
    }
    const board = findPart(CAMERA_BOARD_ID); assert.ok(board);
    expect(partUsage(board).map(u => u.modelId)).toContain(cameraHousing.id);
    expect(cameraHousing.derived(P).notes?.join(' ')).toMatch(/Not physically fit-tested/);
  });
});
