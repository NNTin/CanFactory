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
    for (const overrides of [{ ballDiameter: '36' }, { extra: true }, { gridMagnet: 'generic-magnet' }, { ballMagnet: 'supermagnete-q-05-05-02-n' }, { clearance: 0.1 }])
      expect(validateParameters(model, { ...P, ...overrides })).not.toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: model.id, modelVersion: '2', parameters: P })).toBe(false);
  });
  it('uses sourced greatest diameters, nominal flush-grid depth and greatest ball depth in every generator', () => {
    for (const gridMagnet of TOY_GRID_MAGNETS) for (const ballMagnet of TOY_BALL_MAGNETS) {
      const p = { ...P, gridMagnet, ballMagnet };
      expect(validateParameters(model, p)).toEqual([]);
      for (const part of activeParts(model, p)) {
        const defines = Object.fromEntries(scadDefines(model, part, p));
        expect(defines['GRID_D']).toBe(String(dimensionOf(magnetPart(gridMagnet), 'diameter', 'max')));
        expect(defines['GRID_T']).toBe(String(dimensionOf(magnetPart(gridMagnet), 'thickness')));
        expect(defines['BALL_MAGNET_D']).toBe(String(dimensionOf(magnetPart(ballMagnet), 'diameter', 'max')));
        expect(defines['BALL_MAGNET_T']).toBe(String(dimensionOf(magnetPart(ballMagnet), 'thickness', 'max')));
      }
    }
    for (const id of [...TOY_GRID_MAGNETS, ...TOY_BALL_MAGNETS]) expect(partUsage(magnetPart(id)).some(u => u.modelId === model.id)).toBe(true);
  });
  it('has sixteen direct sockets, four distinct movable magnets and a minimal dimension-derived magnetic gap', () => {
    for (const layout of ['corners', 'zigzag', 'cluster'] as const) for (const width of [120, 160, 200]) {
      const l = magneticCatToyLayout({ ...P, layout, width });
      expect(l.sockets).toHaveLength(16); expect(l.magnets).toHaveLength(4);
      expect(new Set(l.magnets.map(h => h.join(','))).size).toBe(4);
      for (const h of l.magnets) expect(l.sockets).toContainEqual(h);
      expect(l.socketOuterDiameter + 2).toBeLessThan((width - 40) / 3);
      expect(l.magnetToField).toBeCloseTo(TOY.air + P.fieldThickness);
      expect(l.fieldTop).toBeCloseTo(TOY.floor + l.grid.nominalThickness + TOY.air + P.fieldThickness);
    }
  });
  it('keeps bare magnet faces nominally flush and captures even the thinnest tolerated disc beneath the field', () => {
    for (const gridMagnet of TOY_GRID_MAGNETS) {
      const l = magneticCatToyLayout({ ...P, gridMagnet }), part = magnetPart(gridMagnet);
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
      expect(a.references).toHaveLength(13);
      expect(Object.keys(a.poses)).toHaveLength(18);
      expect(a.steps[0]?.parts).toContain('grid-magnet-1');
      expect(a.steps[3]?.parts).toContain('ball-magnet');
      expect(a.steps[4]?.parts).toContain('cover-screw-1');
      expect(a.poses['cover-screw-1']?.position[2]).toBe(0); // 6 mm base + 2 mm flange − 8 mm shaft: full nut engagement, flush tip.
      expect(a.poses['ball-magnet']?.position).toEqual([l.offset, 0, l.fieldTop + l.radius - l.ball.thickness / 2]);
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
    for (const [key, value] of Object.entries({ FLOOR: TOY.floor, SOCKET_WALL: TOY.socketWall, RIM: TOY.rim, MOUNT_BASE: TOY.mountBase, PLAY: TOY.pocketPlay, AIR: TOY.air, WALL: TOY.wall, ROOF: TOY.roof, FIELD_LIP: TOY.fieldLip, FIELD_RETAIN_GAP: TOY.fieldRetainGap, PIN: TOY.pin, PIN_L: TOY.pinLength }))
      expect(scad).toContain(`${key} = ${value};`);
    expect(scad).toContain('ridge(PIN,1.3,CLEARANCE+DETENT_ENGAGE)');
    expect(model.printNotes).toMatch(/100% infill/);
    expect(model.printNotes).toMatch(/Permanently bond both ball halves/);
    expect(model.parts.map(p => p.id)).toEqual(['grid', 'field', 'ball-lower', 'ball-upper', 'cover']);
    expect(scad).not.toMatch(/module (holder|cap)\(/);
  });
});

it('provides a fully assembled magnetic mechanism with switchable real grid locations and a welded, offset-aware ball', async () => {
  const { magneticCatToyPhysics, PhysicsSpecSchema, toyDipole, toyCoverPieces } = await import('./index.ts');
  for (const layout of ['corners', 'zigzag', 'cluster'] as const) for (const magnetPlacement of ['centred', 'eccentric'] as const) {
    const p = { ...P, layout, magnetPlacement }, l = magneticCatToyLayout(p), spec = magneticCatToyPhysics(p);
    expect(Value.Check(PhysicsSpecSchema, spec)).toBe(true);
    const assembly = resolveAssembly(model, model.assembly, p); assert.ok(assembly);
    expect(spec.bodies.map(b => b.id).sort()).toEqual(Object.keys(assembly.poses).sort());
    expect(spec.bodies.filter(b => !b.fixed).map(b => b.id)).toEqual(['ball-lower']);
    expect(spec.bodies.find(b => b.id === 'ball-upper')?.joint?.parent).toBe('ball-lower');
    expect(spec.bodies.find(b => b.id === 'ball-magnet')?.mass).toBe(0.64);
    expect(spec.magnets).toHaveLength(5);
    expect(spec.magnets?.filter(m => m.switchable).map(m => m.id)).toEqual([1, 2, 3, 4].map(i => `grid-magnet-${i}`));
    expect(spec.magnets?.at(-1)?.switchable).toBeUndefined();
    l.magnets.forEach(([x, y], i) => expect(assembly.poses[`grid-magnet-${i + 1}`]?.position.slice(0, 2)).toEqual([x, y]));
    expect(assembly.poses['ball-magnet']?.position[0]).toBe(l.offset);
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
