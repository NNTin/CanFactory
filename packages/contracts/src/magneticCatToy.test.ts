import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { DEFAULT_MAGNETIC_CAT_TOY as P, TOY, TOY_BALL_MAGNETS, TOY_GRID_MAGNETS, activeParts, artifactFormat, assemblyOffset, assemblyState, controlShown, dimensionOf, findModel, findPart, magneticCatToy as model, magneticCatToyLayout, partUsage, RenderRequestSchema, resolveAssembly, scadDefines, validateParameters } from './index.ts';

function magnetPart(id: string) { const p = findPart(id); assert.ok(p); return p; }

describe('original magnetic cat toy', () => {
  it('registers five prints in four functional layers and a strictly typed request', () => {
    expect(findModel(model.id)).toBe(model);
    expect(artifactFormat(model)).toBe('zip');
    expect(activeParts(model, P)).toHaveLength(5);
    expect('referencePath' in model).toBe(false);
    expect(model.controls.map(c => c.key).sort()).toEqual(Object.keys(P).sort());
    expect(validateParameters(model, P)).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion: '1', parameters: P })).toBe(true);
    for (const overrides of [{ ballDiameter: '36' }, { extra: true }, { gridMagnet: 'generic-magnet' }, { ballMagnet: 'supermagnete-q-05-05-02-n' }, { clearance: 0.1 }, { layout: 'corners' }, { socketSpacing: 19 }, { socketSpacing: 61 }, { detentEngage: 0.15 }, { ballShellThickness: 1.4 }, { ballShellThickness: 2.6 }])
      expect(validateParameters(model, { ...P, ...overrides })).not.toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion: '2', parameters: P })).toBe(false);
  });
  it('uses sourced greatest diameters, nominal flush-grid depth and both tolerance bounds for retained ball discs in every generator', () => {
    for (const gridMagnet of TOY_GRID_MAGNETS) for (const ballMagnet of TOY_BALL_MAGNETS) {
      const p = { ...P, gridMagnet, ballMagnet };
      expect(validateParameters(model, p)).toEqual([]);
      for (const part of activeParts(model, p)) {
        const defines = Object.fromEntries(scadDefines(model, part, p));
        expect(defines['GRID_D']).toBe(String(dimensionOf(magnetPart(gridMagnet), 'diameter', 'max')));
        expect(defines['GRID_T']).toBe(String(dimensionOf(magnetPart(gridMagnet), 'thickness')));
        expect(defines['BALL_MAGNET_D']).toBe(String(dimensionOf(magnetPart(ballMagnet), 'diameter', 'max')));
        expect(defines['BALL_MAGNET_MIN_D']).toBe(String(dimensionOf(magnetPart(ballMagnet), 'diameter', 'min')));
        expect(defines['BALL_MAGNET_T']).toBe(String(dimensionOf(magnetPart(ballMagnet), 'thickness', 'max')));
      }
    }
    for (const id of [...TOY_GRID_MAGNETS, ...TOY_BALL_MAGNETS]) expect(partUsage(magnetPart(id)).some(u => u.modelId === model.id)).toBe(true);
  });
  it('derives a centred socket array from real pitch, never from a magnet layout preset', () => {
    expect(model.controls.some(c => c.key === 'layout')).toBe(false);
    for (const socketSpacing of [20, 30, 60]) for (const width of [120, 160, 200]) for (const length of [120, 140, 200]) {
      const p = { ...P, socketSpacing, width, length }, l = magneticCatToyLayout(p);
      expect(validateParameters(model, p)).toEqual([]);
      expect(l.columns).toBe(Math.floor((width - 2 * TOY.edgeMargin) / socketSpacing) + 1);
      expect(l.rows).toBe(Math.floor((length - 2 * TOY.edgeMargin) / socketSpacing) + 1);
      expect(l.sockets).toHaveLength(l.columns * l.rows);
      expect(new Set(l.sockets.map(h => h.join(','))).size).toBe(l.sockets.length);
      const first = l.sockets[0], nextColumn = l.sockets[1], nextRow = l.sockets[l.columns];
      assert.ok(first); assert.ok(nextColumn); assert.ok(nextRow);
      expect(nextColumn[0] - first[0]).toBe(socketSpacing);
      expect(nextRow[1] - first[1]).toBe(socketSpacing);
      for (const [x, y] of l.sockets) {
        expect(Math.abs(x)).toBeLessThanOrEqual(width / 2 - TOY.edgeMargin);
        expect(Math.abs(y)).toBeLessThanOrEqual(length / 2 - TOY.edgeMargin);
      }
      expect(l.sockets[0]?.map((v, k) => v + (l.sockets.at(-1)?.[k] ?? 0))).toEqual([0, 0]);
      expect(l.socketOuterDiameter + 2).toBeLessThanOrEqual(socketSpacing);
      expect(l.magnetToField).toBeCloseTo(TOY.air + P.fieldThickness);
      expect(l.fieldTop).toBeCloseTo(TOY.floor + l.grid.nominalThickness + TOY.air + P.fieldThickness);
      expect(TOY.pushHole).toBeLessThan(dimensionOf(magnetPart(P.gridMagnet), 'diameter', 'min') / 2);
      const gridPart = model.parts[0]; assert.ok(gridPart);
      expect(Object.fromEntries(scadDefines(model, gridPart, p))['SOCKET_SPACING']).toBe(String(socketSpacing));
    }
    expect(magneticCatToyLayout(P).sockets).toHaveLength(20);
    expect(magneticCatToyLayout({ ...P, width: 200, length: 200, socketSpacing: 20 }).sockets).toHaveLength(81);
  });
  it('keeps bare magnet faces nominally flush and captures even the thinnest tolerated disc beneath the field', () => {
    for (const gridMagnet of TOY_GRID_MAGNETS) {
      const l = magneticCatToyLayout({ ...P, gridMagnet }), part = magnetPart(gridMagnet);
      expect(TOY.pushHole).toBeLessThan(dimensionOf(part, 'diameter', 'min') / 2); // annular bearing remains for every sourced disc
      expect(l.socketTop).toBeCloseTo(TOY.floor + dimensionOf(part, 'thickness'));
      const smallest = dimensionOf(part, 'thickness', 'min'), greatest = dimensionOf(part, 'thickness', 'max');
      expect(TOY.floor + greatest).toBeLessThan(l.fieldZ); // tolerance does not force the field upward
      expect(l.fieldZ + TOY.fieldRetainGap - TOY.floor - smallest).toBeLessThan(smallest); // cannot lift out of a socket
      expect(l.socketOuterDiameter - l.socketDiameter).toBeCloseTo(2 * TOY.socketWall);
      expect(l.fieldZ).toBeLessThan(TOY.mountBase); // only fastening ears retain their 6 mm grip height
    }
  });
  it('changes the pocket, not the outside sphere, for eccentric rolling and rejects colliding seats', () => {
    const a = magneticCatToyLayout(P), b = magneticCatToyLayout({ ...P, magnetPlacement: 'eccentric' });
    expect(a.offset).toBe(0); expect(b.offset).toBe(6); expect(b.radius).toBe(a.radius);
    expect(validateParameters(model, { ...P, magnetPlacement: 'eccentric' })).toEqual([]);
    expect(validateParameters(model, { ...P, ballDiameter: 28, ballMagnet: TOY_BALL_MAGNETS[2], magnetPlacement: 'eccentric', eccentricOffset: 8 }).length).toBeGreaterThan(0);
    const control = model.controls.find(c => c.key === 'eccentricOffset'); assert.ok(control);
    expect(controlShown(control, P)).toBe(false);
    expect(controlShown(control, { ...P, magnetPlacement: 'eccentric' })).toBe(true);
  });
  it('uses a hollow shell with removable, mechanically retained exposed magnets, not a bonded solid ball', () => {
    expect(model.controls.some(c => c.key === 'detentEngage')).toBe(false);
    const half = model.parts.find(part => part.id === 'ball-lower'); assert.ok(half);
    for (const ballMagnet of TOY_BALL_MAGNETS) {
      const l = magneticCatToyLayout({ ...P, ballMagnet });
      expect(TOY.gripHole).toBeLessThan(l.ball.minDiameter);
      expect(TOY.ballPushHole).toBeLessThan(l.ball.minDiameter);
      expect(l.ballSeatDepth).toBeCloseTo(TOY.ballLip + l.ball.thickness);
      expect(l.offset + l.ballBossRadius).toBeLessThan(l.radius - P.ballShellThickness);
      expect(l.ballSeatDepth + TOY.ballSeatFloor).toBeLessThan(l.radius - P.ballShellThickness);
      expect(Object.fromEntries(scadDefines(model, half, { ...P, ballMagnet }))['BALL_SHELL']).toBe(String(P.ballShellThickness));
    }
  });
  it('bounds long paw slots by sphere width, leaves webs and rejects unsafe diameter/width combinations', () => {
    for (const ballDiameter of [28, 36, 44]) for (const width of [120, 200]) {
      const p = { ...P, width, ballDiameter, slotWidth: 16 }, l = magneticCatToyLayout(p);
      expect(validateParameters(model, p)).toEqual([]);
      expect(l.slotLength).toBeGreaterThan(ballDiameter);
      expect(l.slotLength).toBeLessThanOrEqual(p.length - 24);
      expect((l.slotCentres[1] ?? 0) - (l.slotCentres[0] ?? 0) - p.slotWidth).toBeGreaterThanOrEqual(4 - 1e-9);
      expect(l.roofZ - l.fieldTop).toBe(ballDiameter + TOY.ballHeadroom);
    }
    expect(validateParameters(model, { ...P, ballDiameter: 28, slotWidth: 18 })).toContainEqual(expect.objectContaining({ field: 'slotWidth' }));
  });
  it('animates bare magnet insertion, field, ball closure/placement, then cover and fasteners', () => {
    for (const magnetPlacement of ['centred', 'eccentric'] as const) {
      const p = { ...P, magnetPlacement }, l = magneticCatToyLayout(p), a = resolveAssembly(model, model.assembly, p); assert.ok(a);
      expect(a.steps).toHaveLength(5);
      expect(a.references).toHaveLength(l.sockets.length + 10);
      expect(Object.keys(a.poses)).toHaveLength(l.sockets.length + 15);
      expect(a.steps[0]?.parts).toContain('grid-magnet-1');
      expect(a.steps[2]?.parts).toContain('ball-magnet-upper');
      expect(a.steps[3]?.parts).toContain('ball-magnet-lower');
      expect(a.steps[4]?.parts).toContain('cover-screw-1');
      expect(a.poses['cover-screw-1']?.position[2]).toBe(0); // 6 mm base + 2 mm flange − 8 mm shaft: full nut engagement, flush tip.
      expect(a.poses['ball-magnet-lower']?.position).toEqual([l.offset, 0, l.fieldTop + l.radius - l.ballSeatDepth]);
      expect(a.poses['ball-magnet-upper']?.position).toEqual([l.offset, 0, l.fieldTop + l.radius + l.ballSeatDepth]);
      expect(a.poses['ball-magnet-upper']?.rotation).toEqual([180, 0, 0]);
      expect(a.poses['grid-magnet-1']?.position[2]).toBe(TOY.floor);
      expect((a.poses['grid-magnet-1']?.position[2] ?? 0) + l.grid.nominalThickness).toBe(l.socketTop);
      expect(Object.keys(a.poses).some(id => id.startsWith('holder'))).toBe(false);
      const seatedField = assemblyState(a, 3 / 6);
      expect(assemblyOffset(a, 'field', seatedField)).toEqual([0, 0, a.lift]);
      expect(assemblyOffset(a, 'ball-lower', seatedField)[2]).toBe(95 + a.lift);
      for (const id of Object.keys(a.poses)) expect(assemblyOffset(a, id, assemblyState(a, 1))).toEqual([0, 0, 0]);
    }
  });
  it('retains the field edges without a lip that the rigid ball can reach', () => {
    // Field has 1 mm lateral clearance inside the cover; lip overlaps it by 2 mm, even if shifted fully to one side.
    expect(TOY.fieldLip - 1 - 1).toBeGreaterThan(0);
    for (const ballDiameter of [28, 36, 44]) {
      const radius = ballDiameter / 2;
      // Conservative bounding rectangle of the lip (including its overlap into the wall).
      // The centre of a captive sphere stays >= radius from the field and each full-height inner wall.
      expect(Math.hypot(radius - TOY.fieldLip, radius - TOY.fieldRetainGap - TOY.fieldLip - 0.5)).toBeGreaterThan(radius);
    }
  });
  it('keeps fixed SCAD dimensions synchronized with the TypeScript layout', () => {
    const scad = readFileSync(new URL('../../../models/magnetic-cat-toy/generator.scad', import.meta.url), 'utf8');
    for (const [key, value] of Object.entries({ FLOOR: TOY.floor, SOCKET_WALL: TOY.socketWall, EDGE_MARGIN: TOY.edgeMargin, PUSH_HOLE: TOY.pushHole, RIM: TOY.rim, MOUNT_BASE: TOY.mountBase, PLAY: TOY.pocketPlay, AIR: TOY.air, WALL: TOY.wall, ROOF: TOY.roof, FIELD_LIP: TOY.fieldLip, FIELD_RETAIN_GAP: TOY.fieldRetainGap, PIN: TOY.pin, PIN_L: TOY.pinLength, BALL_LIP: TOY.ballLip, BALL_SEAT_FLOOR: TOY.ballSeatFloor, BALL_SEAT_WALL: TOY.ballSeatWall, BALL_PUSH_HOLE: TOY.ballPushHole, GRIP_HOLE: TOY.gripHole, SPOKE_W: TOY.spokeWidth }))
      expect(scad).toContain(`${key} = ${value};`);
    expect(scad).not.toContain('DETENT_ENGAGE');
    expect(model.printNotes).toMatch(/100% infill/);
    expect(model.printNotes).toMatch(/do not glue the seam/);
    expect(model.printNotes).toMatch(/2.5 mm external rear hole/);
    expect(model.parts.map(p => p.id)).toEqual(['grid', 'field', 'ball-lower', 'ball-upper', 'cover']);
    expect(scad).not.toMatch(/module (holder|cap)\(/);
  });
});

it('provides a fully assembled magnetic mechanism with switchable real grid locations and a welded, offset-aware ball', async () => {
  const { magneticCatToyPhysics, PhysicsSpecSchema, toyDipole, toyCoverPieces } = await import('./index.ts');
  for (const socketSpacing of [20, 30, 60]) for (const magnetPlacement of ['centred', 'eccentric'] as const) {
    const p = { ...P, socketSpacing, magnetPlacement }, l = magneticCatToyLayout(p), spec = magneticCatToyPhysics(p);
    expect(Value.Check(PhysicsSpecSchema, spec)).toBe(true);
    const assembly = resolveAssembly(model, model.assembly, p); assert.ok(assembly);
    expect(spec.bodies.map(b => b.id).sort()).toEqual(Object.keys(assembly.poses).sort());
    expect(spec.bodies.filter(b => !b.fixed).map(b => b.id)).toEqual(['ball-lower']);
    expect(spec.bodies.find(b => b.id === 'ball-upper')?.joint?.parent).toBe('ball-lower');
    for (const half of ['lower', 'upper']) expect(spec.bodies.find(b => b.id === `ball-magnet-${half}`)?.mass).toBe(0.64);
    expect(spec.bodies.find(b => b.id === 'ball-magnet-upper')?.joint?.parent).toBe('ball-upper');
    expect(spec.magnets?.at(-2)?.moment[2]).toBeGreaterThan(0);
    expect(spec.magnets?.at(-1)?.moment[2]).toBeLessThan(0); // upper reference is rotated: global moments align
    expect(spec.magnets).toHaveLength(l.sockets.length + 2);
    expect(spec.magnets?.filter(m => m.switchable).map(m => m.id)).toEqual(l.sockets.map((_, i) => `grid-magnet-${i + 1}`));
    expect(spec.magnets?.at(-1)?.switchable).toBeUndefined();
    expect(spec.magnets?.filter(m => m.switchable).every(m => m.enabled === false && m.hideWhenDisabled)).toBe(true);
    l.sockets.forEach(([x, y], i) => expect(assembly.poses[`grid-magnet-${i + 1}`]?.position.slice(0, 2)).toEqual([x, y]));
    expect(assembly.poses['ball-magnet-lower']?.position[0]).toBe(l.offset);
    expect(spec.scenarios?.map(s => s.id)).toContain('switch-on');
    expect(toyCoverPieces(p).every(piece => piece.length >= 12 && piece.length % 3 === 0 && piece.every(Number.isFinite))).toBe(true);
  }
  expect(toyDipole(TOY_GRID_MAGNETS[1]).moment).toBeCloseTo(0.2446875, 8);
  expect(toyDipole(TOY_BALL_MAGNETS[2]).mass).toBe(1.1);
  expect(toyDipole(TOY_BALL_MAGNETS[2]).moment).toBeGreaterThan(toyDipole(TOY_BALL_MAGNETS[0]).moment);
});

it('keeps the rounded paw openings empty in the physics roof, with solid webs and closed slot ends', async () => {
  const { toyCoverPieces } = await import('./index.ts');
  const l = magneticCatToyLayout(P), pieces = toyCoverPieces(P);
  const roofContains = (x: number, y: number) => pieces.some(piece => {
    // Every authored prism has its first profile at minZ and the same profile at maxZ.
    const half = piece.length / 2, z0 = piece[2] ?? 0, z1 = piece[half + 2] ?? 0;
    if (Math.min(z0, z1) > 1.5 || Math.max(z0, z1) < 1.5) return false;
    for (let i = 0; i < half; i += 3) {
      const next = (i + 3) % half, ax = piece[i] ?? 0, ay = piece[i + 1] ?? 0, bx = piece[next] ?? 0, by = piece[next + 1] ?? 0;
      if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < -1e-9) return false;
    }
    return true;
  });
  for (const x of l.slotCentres) {
    expect(roofContains(x, 0)).toBe(false);
    expect(roofContains(x + P.slotWidth / 2 + 0.2, 0)).toBe(true);
    expect(roofContains(x, l.slotLength / 2 - 0.2)).toBe(false);
    expect(roofContains(x, l.slotLength / 2 + 0.2)).toBe(true);
  }
  expect(roofContains(0, 0)).toBe(true);
  expect(roofContains(P.width / 2 - 1, P.length / 2 - 1)).toBe(false);
});
