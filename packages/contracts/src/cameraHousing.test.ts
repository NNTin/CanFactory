import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { activeParts, artifactFormat, cameraHousing, CAMERA_BOARD_ID, CAMERA_HARDWARE, CAMERA_LID_INSERT, CAMERA_MOUNT_INSERTS, CAMERA_MOUNT_NUTS, CAMERA_HEATSINKS, CAMERA_HEATSINK_GAP, DEFAULT_CAMERA_HOUSING as P,
  cameraHousingLayout, devBoardLayout, dimensionOf, findPart, partUsage, RenderRequestSchema, resolveAssembly, scadDefines, validateParameters, cameraHardwarePart, controlShown } from './index.ts';

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
    expect(layout.bareUnderside).toBe(true);
    expect(layout.externalAntenna).toMatchObject({ kind: 'connector', x: 4.04, y: 1.73 });
    expect(layout.bottomPads.map(p => p.name)).toEqual(['BAT+', 'BAT− (GND)']);
    expect(board.dimensions['H']?.basis).toBe('manufacturer');
    expect(layout.components.find(c => c.kind === 'camera')?.sized).toBe('estimated');
  });
  it('passes library dimensions and derived stack constants to both generators', () => {
    const scad = readFileSync(new URL('../../../models/xiao-sense-camera-housing/generator.scad', import.meta.url), 'utf8');
    for (const part of activeParts(cameraHousing, P)) {
      const defines = Object.fromEntries(scadDefines(cameraHousing, part, P));
      expect(defines).toMatchObject({ BOARD_W: '17.8', BOARD_H: '15', BOARD_T: '1.25', MOUNT_HOLE: '4', MOUNT_DEPTH: '6.7', MOUNT_WALL: '1.6', LID_HOLE: '3.2', SEAM_FIT: '0.2', SEAM_DEPTH: '1.2' });
      for (const [key, value] of Object.entries(part.scadConstants ?? {})) {
        expect(scad).toMatch(new RegExp(`^${key} = `, 'm'));
        if (typeof value === 'number') expect(Number(new RegExp(`^${key} = ([\\d.]+);`, 'm').exec(scad)?.[1]), key).toBeCloseTo(value, 8);
      }
    }
  });
  it('sizes the alignment rabbet with per-side clearance without changing headroom or screw engagement', () => {
    for (const wall of [1.6, 2, 3.6]) for (const seamFit of [0.15, 0.2, 0.45]) for (const seamDepth of [0.8, 1.2, 2.4]) {
      const p = { ...P, width: 54, mountSpacing: 36, wall, seamFit, seamDepth }, l = cameraHousingLayout(p);
      const before = cameraHousingLayout({ ...p, seamFit: P.seamFit, seamDepth: P.seamDepth });
      expect(validateParameters(cameraHousing, p)).toEqual([]);
      expect(l.seamShoulder).toBeGreaterThanOrEqual(0.8);
      expect(l.tongueThickness).toBe(wall / 2);
      expect(l.tongueBottom).toBeCloseTo(l.seam - seamDepth);
      expect(l.tongueBottom - l.grooveFloor).toBeCloseTo(seamFit);
      // On every straight side the tongue is translated inward, not shrunk in thickness; the rebate is open on the inside.
      const grooveEdge = p.width / 2 - l.seamShoulder, tongueEdge = grooveEdge - seamFit;
      expect(grooveEdge - tongueEdge).toBeCloseTo(seamFit);
      expect(tongueEdge - l.tongueThickness).toBeCloseTo(p.width / 2 - wall - seamFit);
      expect(l.tongueThickness - seamFit).toBeGreaterThan(0); // overlap with the hood wall above the seam
      expect(l.mountDepth + wall).toBeLessThan(l.grooveFloor);
      for (const key of ['boardZ', 'seam', 'roof', 'top', 'grip', 'screw', 'corners'] as const) expect(l[key]).toEqual(before[key]);
      for (const part of activeParts(cameraHousing, p)) {
        const defines = Object.fromEntries(scadDefines(cameraHousing, part, p));
        expect(Number(defines['SEAM_FIT'])).toBe(seamFit);
        expect(Number(defines['SEAM_DEPTH'])).toBe(seamDepth);
      }
    }
    expect(cameraHousing.derived(P).notes?.join(' ')).toMatch(/Alignment rabbet: 1.2 mm overlap.*0.20 mm clearance per side/);
    for (const seamDepth of [0.6, 1.3, 2.6]) expect(validateParameters(cameraHousing, { ...P, seamDepth })).not.toEqual([]);
  });
  it('keeps blind rear mounting caps below the groove, including compact housings', () => {
    const p = { ...P, heatsinkEnabled: false, standoff: 3 };
    expect(validateParameters(cameraHousing, p)).toEqual([]);
    expect(validateParameters(cameraHousing, { ...p, seamDepth: 2.4 })).toContainEqual({
      field: 'standoff', message: 'Increase under-board clearance or reduce alignment overlap: the mounting pockets need a blind cap below the alignment groove.',
    });
    expect(validateParameters(cameraHousing, { ...p, seamDepth: 2.4, standoff: 3.2 })).toEqual([]);
    expect(validateParameters(cameraHousing, { ...P, heatsinkEnabled: false, mountInsert: 'ruthex-rx-m4x8-1' }).some(i => /alignment groove/.test(i.message))).toBe(true);
  });
  it('rejects colliding mounts, insufficient roof rim, obscured lenses and floor-breaking USB openings', () => {
    const bad = [
      { mountSpacing: 60 }, { mountSpacing: 28, mountInsert: 'ruthex-rx-m4x8-1' },
      { cameraOffsetX: 3, cameraDiameter: 10 }, { cameraOffsetY: 3, cameraDiameter: 20 },
      { standoff: 3, usbHeight: 12 }, { standoff: 3, mountInsert: 'ruthex-rx-m4x8-1' },
    ];
    for (const overrides of bad) expect(validateParameters(cameraHousing, { ...P, heatsinkEnabled: false, ...overrides }), JSON.stringify(overrides)).not.toEqual([]);
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
  it('supports hex and square captive nuts, selecting only the active rear fastener in the assembly', () => {
    for (const mountNut of CAMERA_MOUNT_NUTS) {
      const p = { ...P, mountRetention: 'nut' as const, mountNut, width: 54, mountSpacing: 36 };
      expect(validateParameters(cameraHousing, p)).toEqual([]);
      const l = cameraHousingLayout(p), nut = cameraHardwarePart(mountNut);
      const assembly = resolveAssembly(cameraHousing, cameraHousing.assembly, p); assert.ok(assembly);
      expect(assembly.references?.filter(r => r.part === mountNut)).toHaveLength(2);
      expect(assembly.references?.some(r => r.part === p.mountInsert)).toBe(false);
      expect(l.mountRadius).toBeGreaterThan(dimensionOf(nut, 's', 'max') / 2);
      expect(l.mountDepth).toBeGreaterThan(p.wall + dimensionOf(nut, 'm', 'max'));
      expect(assembly.poses['mount-insert-0']?.position[2]).toBeCloseTo(p.wall + 0.15);
      for (const key of ['mountNut', 'mountInsert']) {
        const c = cameraHousing.controls.find(c => c.key === key); assert.ok(c);
        expect(controlShown(c, p)).toBe(key === 'mountNut');
      }
    }
    expect(validateParameters(cameraHousing, { ...P, mountRetention: 'nut', mountNut: 'iso-4032-m4' }).some(i => i.field === 'mountSpacing')).toBe(true);
  });
  it('enables one backside heatsink by default and automatically raises the board, USB, seam and roof', () => {
    expect(P.heatsinkEnabled).toBe(true);
    for (const heatsink of CAMERA_HEATSINKS) {
      const p = { ...P, heatsink, standoff: 3, heatsinkAllowance: 1.2, adhesiveThickness: 0.4 };
      const l = cameraHousingLayout(p), off = cameraHousingLayout({ ...p, heatsinkEnabled: false });
      expect(validateParameters(cameraHousing, p)).toEqual([]);
      expect(l.boardY).toBe(off.boardY);
      expect(l.width).toBe(off.width);
      expect(l.length).toBe(off.length);
      expect(l.clearance).toBeCloseTo(l.heatsinkH + p.heatsinkAllowance + p.adhesiveThickness + CAMERA_HEATSINK_GAP);
      expect(l.heatsinkTop - l.heatsinkH - p.wall).toBeCloseTo(CAMERA_HEATSINK_GAP + p.heatsinkAllowance);
      for (const key of ['boardZ', 'usbZ', 'seam', 'roof', 'top'] as const) expect(l[key] - off[key]).toBeCloseTo(l.clearance - p.standoff);
      expect(l.roof - l.boardZ).toBeCloseTo(CAMERA_HARDWARE.height + p.headroom);
      const assembly = resolveAssembly(cameraHousing, cameraHousing.assembly, p); assert.ok(assembly);
      expect(assembly.references?.filter(r => r.part === heatsink)).toHaveLength(1);
      expect(assembly.poses['cooling-heatsink']).toEqual({ position: [l.heatsinkX, l.heatsinkY, l.heatsinkTop], rotation: [180, 0, 0] });
      expect(assembly.steps[0]?.parts).toContain('cooling-heatsink');
      expect(assembly.steps[1]?.parts).not.toContain('cooling-heatsink');
      expect(cameraHousing.derived(p).notes?.join(' ')).toMatch(/no thermal-performance guarantee/);
      const print = cameraHousing.parts[0]; assert.ok(print);
      const defines = Object.fromEntries(scadDefines(cameraHousing, print, p));
      expect(Number(defines['HEATSINK_H'])).toBe(l.heatsinkH);
      expect(Number(defines['HEATSINK_ALLOWANCE'])).toBe(p.heatsinkAllowance);
      const disabled = resolveAssembly(cameraHousing, cameraHousing.assembly, { ...p, heatsinkEnabled: false });
      expect(disabled?.references?.some(r => r.id === 'cooling-heatsink')).toBe(false);
      expect(off.clearance).toBe(p.standoff);
    }
  });
  it('leaves the backside BAT pads and unsoldered locating holes clear at the largest sink envelope', () => {
    const h = CAMERA_HARDWARE, l = cameraHousingLayout({ ...P, heatsink: 'same-sky-hsb02-101007' });
    const board = cameraHardwarePart(CAMERA_BOARD_ID), boardLayout = devBoardLayout(board); assert.ok(boardLayout);
    const left = h.heatsinkX - l.heatsinkW / 2, right = h.heatsinkX + l.heatsinkW / 2;
    expect(left - Math.max(...boardLayout.bottomPads.map(p => p.x)) - 0.55).toBeGreaterThan(0.3);
    expect(h.width / 2 + h.locatorX - 0.6 - right).toBeGreaterThan(0.2);
    expect(h.heatsinkY - l.heatsinkL / 2).toBeGreaterThan(0);
    expect(l.heatsinkTop).toBeLessThan(l.boardZ);
    expect(l.heatsinkTop - l.heatsinkH).toBeGreaterThan(P.wall);
  });
});
