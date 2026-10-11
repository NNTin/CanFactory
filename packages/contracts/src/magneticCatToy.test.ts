import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { DEFAULT_MAGNETIC_CAT_TOY as P, TOY, TOY_BALL_MAGNETS, TOY_GRID_MAGNETS, activeParts, artifactFormat, assemblyOffset, assemblyState, controlShown, dimensionOf, findModel, findPart, magneticCatToy as model, magneticCatToyLayout, partUsage, RenderRequestSchema, resolveAssembly, scadDefines, validateParameters } from './index.ts';

function libraryPart(id: string) { const p = findPart(id); assert.ok(p); return p; }

describe('original magnetic cat toy', () => {
  it('registers five prints in four functional layers and a strictly typed request', () => {
    expect(findModel(model.id)).toBe(model);
    expect(artifactFormat(model)).toBe('zip');
    expect(activeParts(model, P)).toHaveLength(5);
    expect('referencePath' in model).toBe(false);
    expect(model.controls.map(c => c.key).sort()).toEqual(Object.keys(P).sort());
    expect(validateParameters(model, P)).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion: '1', parameters: P })).toBe(true);
    for (const overrides of [{ ballDiameter: '36' }, { extra: true }, { gridMagnet: 'generic-magnet' }, { ballMagnet: 'supermagnete-q-05-05-02-n' }, { clearance: 0.1 }, { layout: 'corners' }, { socketSpacing: 19 }, { socketSpacing: 61 }, { detentEngage: 0.15 }, { ballShellThickness: 1.4 }, { ballShellThickness: 2.6 }, { ballGripHoleDiameter: 5.5 }, { ballGripHoleDiameter: 12.5 }, { ballMagnetFloorThickness: 0.2 }, { ballMagnetFloorThickness: 1.2 }])
      expect(validateParameters(model, { ...P, ...overrides })).not.toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion: '2', parameters: P })).toBe(false);
  });
  it('uses sourced greatest diameters, nominal flush-grid depth and both tolerance bounds for retained ball discs in every generator', () => {
    for (const gridMagnet of TOY_GRID_MAGNETS) for (const ballMagnet of TOY_BALL_MAGNETS) {
      const p = { ...P, gridMagnet, ballMagnet };
      expect(validateParameters(model, p)).toEqual([]);
      for (const part of activeParts(model, p)) {
        const defines = Object.fromEntries(scadDefines(model, part, p));
        expect(defines['GRID_D']).toBe(String(dimensionOf(libraryPart(gridMagnet), 'diameter', 'max')));
        expect(defines['GRID_T']).toBe(String(dimensionOf(libraryPart(gridMagnet), 'thickness')));
        expect(defines['BALL_MAGNET_D']).toBe(String(dimensionOf(libraryPart(ballMagnet), 'diameter', 'max')));
        expect(defines['BALL_MAGNET_MIN_D']).toBe(String(dimensionOf(libraryPart(ballMagnet), 'diameter', 'min')));
        expect(defines['BALL_MAGNET_T']).toBe(String(dimensionOf(libraryPart(ballMagnet), 'thickness', 'max')));
      }
    }
    for (const id of [...TOY_GRID_MAGNETS, ...TOY_BALL_MAGNETS]) expect(partUsage(libraryPart(id)).some(u => u.modelId === model.id)).toBe(true);
  });
  it("supports the owner's 10×2 and 8×1 discs in either role and minimises grid print height", () => {
    for (const id of ['supermagnete-s-10-02-n', 'supermagnete-s-08-01-n']) {
      expect(TOY_GRID_MAGNETS).toContain(id); expect(TOY_BALL_MAGNETS).toContain(id);
    }
    expect(P.gridMagnet).toBe('supermagnete-s-10-02-n'); expect(P.ballMagnet).toBe('supermagnete-s-08-01-n');
    const thin = magneticCatToyLayout({ ...P, gridMagnet: 'supermagnete-s-08-01-n' });
    const medium = magneticCatToyLayout(P);
    const thick = magneticCatToyLayout({ ...P, gridMagnet: 'supermagnete-s-10-03-n' });
    [thin.fieldZ, medium.fieldZ, thick.fieldZ].forEach((height, i) => expect(height).toBeCloseTo([2.4, 3.4, 4.4][i] ?? NaN));
    expect([thin.mountBase, medium.mountBase, thick.mountBase]).toEqual([3.8, 3.8, 4.4]);
    expect([thin.screwLength, medium.screwLength, thick.screwLength]).toEqual([6, 6, 8]);
    for (const gridMagnet of TOY_GRID_MAGNETS) {
      const p = { ...P, gridMagnet }, l = magneticCatToyLayout(p), assembly = resolveAssembly(model, model.assembly, p); assert.ok(assembly);
      expect(l.mountBase - l.nutDepth).toBeGreaterThanOrEqual(TOY.mountRoof - 1e-9);
      expect(l.mountBase).toBeGreaterThanOrEqual(l.fieldZ - 1e-9);
      // No redundant full layer remains above either the rim or nut-pocket bearing requirement.
      expect(l.mountBase - TOY.layer).toBeLessThan(Math.max(l.fieldZ, l.nutDepth + TOY.mountRoof));
      expect(l.coverFlange).toBeGreaterThanOrEqual(TOY.minFlange);
      expect(l.mountBase + l.coverFlange).toBeCloseTo(dimensionOf(libraryPart(l.screwId), 'l'));
      expect(assembly.references?.filter(r => r.id.startsWith('cover-screw-')).map(r => r.part)).toEqual(Array(4).fill(l.screwId));
      expect(l.mountBase / TOY.layer).toBeCloseTo(Math.round(l.mountBase / TOY.layer));
    }
    expect(medium.mountBase / TOY.layer).toBeCloseTo(19); // formerly 30 layers at 0.2 mm
  });
  it('changes only the internal seat for magnet thickness, never the outer ball, shell or mating floors', () => {
    const thin = { ...P, ballMagnet: 'supermagnete-s-08-01-n' as const }, thick = { ...P, ballMagnet: 'supermagnete-s-08-03-n' as const };
    const a = magneticCatToyLayout(thin), b = magneticCatToyLayout(thick);
    expect(a.ball.diameter).toBe(b.ball.diameter);
    expect(a.ballSeatDepth).toBeCloseTo(2.1); expect(b.ballSeatDepth).toBeCloseTo(4.1);
    expect(a.radius).toBe(b.radius); expect(a.top).toBe(b.top);
    const part = model.parts.find(part => part.id === 'ball-lower'); assert.ok(part);
    const ad = Object.fromEntries(scadDefines(model, part, thin)), bd = Object.fromEntries(scadDefines(model, part, thick));
    for (const key of ['BALL_D', 'BALL_SHELL', 'BALL_FLOOR', 'GRIP_HOLE']) expect(ad[key]).toBe(bd[key]);
    expect(ad['BALL_MAGNET_T']).toBe('1.1'); expect(bd['BALL_MAGNET_T']).toBe('3.1');
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
      expect(TOY.pushHole).toBeLessThan(dimensionOf(libraryPart(P.gridMagnet), 'diameter', 'min') / 2);
      const gridPart = model.parts[0]; assert.ok(gridPart);
      expect(Object.fromEntries(scadDefines(model, gridPart, p))['SOCKET_SPACING']).toBe(String(socketSpacing));
    }
    expect(magneticCatToyLayout(P).sockets).toHaveLength(20);
    expect(magneticCatToyLayout({ ...P, width: 200, length: 200, socketSpacing: 20 }).sockets).toHaveLength(81);
  });
  it('keeps bare magnet faces nominally flush and captures even the thinnest tolerated disc beneath the field', () => {
    for (const gridMagnet of TOY_GRID_MAGNETS) {
      const l = magneticCatToyLayout({ ...P, gridMagnet }), part = libraryPart(gridMagnet);
      expect(TOY.pushHole).toBeLessThan(dimensionOf(part, 'diameter', 'min') / 2); // annular bearing remains for every sourced disc
      expect(l.socketTop).toBeCloseTo(TOY.floor + dimensionOf(part, 'thickness'));
      const smallest = dimensionOf(part, 'thickness', 'min'), greatest = dimensionOf(part, 'thickness', 'max');
      expect(TOY.floor + greatest).toBeLessThan(l.fieldZ); // tolerance does not force the field upward
      expect(l.fieldZ + TOY.fieldRetainGap - TOY.floor - smallest).toBeLessThan(smallest); // cannot lift out of a socket
      expect(l.socketOuterDiameter - l.socketDiameter).toBeCloseTo(2 * TOY.socketWall);
      expect(l.fieldZ).toBeLessThanOrEqual(l.mountBase); // nut-safe ears no longer force every tray to 6 mm
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
  it('rear-loads magnets against thin touching bearing floors, with configurable larger grip holes', () => {
    expect(model.controls.some(c => c.key === 'detentEngage')).toBe(false);
    const half = model.parts.find(part => part.id === 'ball-lower'); assert.ok(half);
    expect(P.ballGripHoleDiameter).toBe(8);
    expect(P.ballMagnetFloorThickness).toBe(0.6);
    for (const ballMagnet of TOY_BALL_MAGNETS) {
      const l = magneticCatToyLayout({ ...P, ballMagnet });
      expect(l.gripHoles).toHaveLength(7);
      expect(l.gripWeb).toBeGreaterThanOrEqual(1.2);
      expect(l.ballSeatDepth).toBeCloseTo(P.ballMagnetFloorThickness + l.ball.thickness + TOY.ballLip);
      expect(l.offset + l.ballBossRadius).toBeLessThan(l.radius - P.ballShellThickness);
      expect(l.ballSeatDepth).toBeLessThan(l.radius - P.ballShellThickness);
      const defines = Object.fromEntries(scadDefines(model, half, { ...P, ballMagnet, ballGripHoleDiameter: 10, ballMagnetFloorThickness: 0.4 }));
      expect(defines['BALL_SHELL']).toBe(String(P.ballShellThickness));
      expect(defines['GRIP_HOLE']).toBe('10');
      expect(defines['BALL_FLOOR']).toBe('0.4');
    }
    expect(validateParameters(model, { ...P, ballDiameter: 28, slotWidth: 16, ballGripHoleDiameter: 12 })).toContainEqual(expect.objectContaining({ field: 'ballGripHoleDiameter' }));
    expect(validateParameters(model, { ...P, ballDiameter: 44, ballGripHoleDiameter: 12 })).toEqual([]);
  });
  it('provides push-out access from each separated seam face without aligned holes between the magnets', () => {
    expect(TOY.ballPushHole).toBe(1.2);
    expect(TOY.ballPushOffset).toBe(1.7);
    for (const ballMagnet of TOY_BALL_MAGNETS) {
      const { ball } = magneticCatToyLayout({ ...P, ballMagnet });
      // Even the smallest tolerated disc retains >=0.6 mm radial bearing outside the bore.
      expect(ball.minDiameter / 2 - TOY.ballPushOffset - TOY.ballPushHole / 2).toBeGreaterThanOrEqual(0.6);
      // A 1 mm blunt tool reaches the disc, then exits the open rear lip without obstruction.
      expect(TOY.ballPushHole).toBeGreaterThan(1);
      expect(TOY.ballPushOffset + TOY.ballPushHole / 2).toBeLessThan((ball.minDiameter - 0.3) / 2);
    }
    // Threefold alignment allows 0/120/240 degree clockings in centred mode. No pair of bores overlaps.
    for (const clocking of [0, 120, 240]) {
      const lowerAngle = (-90 + clocking) * Math.PI / 180;
      const dx = TOY.ballPushOffset * Math.cos(lowerAngle);
      const dy = TOY.ballPushOffset * Math.sin(lowerAngle) - TOY.ballPushOffset;
      expect(Math.hypot(dx, dy) - TOY.ballPushHole).toBeGreaterThanOrEqual(0.4);
    }
    expect(model.printNotes).toMatch(/push the disc towards the rear opening/);
    expect(model.derived(P).notes?.join(' ')).toMatch(/1.2 mm off-centre push-out hole/);
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
    for (const ballMagnetFloorThickness of [0.4, 0.6, 1]) for (const magnetPlacement of ['centred', 'eccentric'] as const) {
      const p = { ...P, magnetPlacement, ballMagnetFloorThickness }, l = magneticCatToyLayout(p), a = resolveAssembly(model, model.assembly, p); assert.ok(a);
      expect(a.steps).toHaveLength(5);
      expect(a.references).toHaveLength(l.sockets.length + 10);
      expect(Object.keys(a.poses)).toHaveLength(l.sockets.length + 15);
      expect(a.steps[0]?.parts).toContain('grid-magnet-1');
      expect(a.steps[2]?.parts).toContain('ball-magnet-upper');
      expect(a.steps[3]?.parts).toContain('ball-magnet-lower');
      expect(a.steps[4]?.parts).toContain('cover-screw-1');
      expect(a.poses['cover-screw-1']?.position[2]).toBe(0); // adaptive base + flange = sourced screw length: full nut engagement, flush tip.
      expect(a.poses['ball-magnet-lower']?.position).toEqual([l.offset, 0, l.fieldTop + l.radius - p.ballMagnetFloorThickness]);
      expect(a.poses['ball-magnet-upper']?.position).toEqual([l.offset, 0, l.fieldTop + l.radius + p.ballMagnetFloorThickness]);
      expect(a.poses['ball-magnet-lower']?.rotation).toEqual([180, 0, 0]);
      expect(a.poses['ball-magnet-upper']?.rotation).toBeUndefined();
      expect((a.poses['ball-lower']?.position[2] ?? 0) - TOY.pinLength).toBe(l.fieldTop + l.radius);
      expect((a.poses['ball-upper']?.position[2] ?? 0) + TOY.pinLength).toBe(l.fieldTop + l.radius);
      // Pocket fronts sit at ±floor thickness: their printed faces coincide at the equator.
      expect((a.poses['ball-magnet-upper']?.position[2] ?? 0) - (a.poses['ball-magnet-lower']?.position[2] ?? 0)).toBeCloseTo(2 * p.ballMagnetFloorThickness);
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
    for (const [key, value] of Object.entries({ FLOOR: TOY.floor, SOCKET_WALL: TOY.socketWall, EDGE_MARGIN: TOY.edgeMargin, PUSH_HOLE: TOY.pushHole, RIM: TOY.rim, MOUNT_ROOF: TOY.mountRoof, NUT_PLAY: TOY.nutPlay, MIN_FLANGE: TOY.minFlange, LAYER: TOY.layer, PLAY: TOY.pocketPlay, AIR: TOY.air, WALL: TOY.wall, ROOF: TOY.roof, FIELD_LIP: TOY.fieldLip, FIELD_RETAIN_GAP: TOY.fieldRetainGap, PIN: TOY.pin, PIN_L: TOY.pinLength, BALL_LIP: TOY.ballLip, BALL_SEAT_WALL: TOY.ballSeatWall, BALL_REMOVAL_NOTCH: TOY.ballRemovalNotch, BALL_PUSH_HOLE: TOY.ballPushHole, BALL_PUSH_OFFSET: TOY.ballPushOffset, GRIP_LAT: TOY.gripLatitude, GRIP_COUNT: TOY.gripCount, SPOKE_W: TOY.spokeWidth }))
      expect(scad).toContain(`${key} = ${value};`);
    expect(scad).not.toContain('DETENT_ENGAGE');
    expect(model.printNotes).toMatch(/100% infill/);
    expect(model.printNotes).toMatch(/do not glue the seam/);
    expect(model.printNotes).toMatch(/are staggered by the mirrored halves/);
    expect(scad).toContain('translate([MX,BALL_PUSH_OFFSET,-EPS]) cylinder(d=BALL_PUSH_HOLE,h=BALL_FLOOR+2*EPS);');
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
    for (const half of ['lower', 'upper']) expect(spec.bodies.find(b => b.id === `ball-magnet-${half}`)?.mass).toBe(toyDipole(p.ballMagnet).mass);
    expect(spec.bodies.find(b => b.id === 'ball-magnet-upper')?.joint?.parent).toBe('ball-upper');
    expect(spec.magnets?.at(-2)?.moment[2]).toBeLessThan(0);
    expect(spec.magnets?.at(-1)?.moment[2]).toBeGreaterThan(0); // lower reference is rotated: global moments align
    expect(spec.magnets).toHaveLength(l.sockets.length + 2);
    expect(spec.magnets?.filter(m => m.switchable).map(m => m.id)).toEqual(l.sockets.map((_, i) => `grid-magnet-${i + 1}`));
    expect(spec.magnets?.at(-1)?.switchable).toBeUndefined();
    expect(spec.magnets?.filter(m => m.switchable).every(m => m.enabled === false && m.hideWhenDisabled)).toBe(true);
    l.sockets.forEach(([x, y], i) => expect(assembly.poses[`grid-magnet-${i + 1}`]?.position.slice(0, 2)).toEqual([x, y]));
    expect(assembly.poses['ball-magnet-lower']?.position[0]).toBe(l.offset);
    expect(spec.scenarios?.map(s => s.id)).toContain('switch-on');
    expect(toyCoverPieces(p).every(piece => piece.length >= 12 && piece.length % 3 === 0 && piece.every(Number.isFinite))).toBe(true);
  }
  expect(toyDipole('supermagnete-s-10-03-n').moment).toBeCloseTo(0.2446875, 8);
  expect(toyDipole('supermagnete-s-08-03-n').mass).toBe(1.1);
  expect(toyDipole('supermagnete-s-08-03-n').moment).toBeGreaterThan(toyDipole(TOY_BALL_MAGNETS[0]).moment);
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
