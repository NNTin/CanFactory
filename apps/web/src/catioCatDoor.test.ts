import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCatDoor, catDoorBom, catDoorLayout, CAT_DOOR, doorPocket } from './catioCatDoor.ts';
import { createCatioParts } from './catioParts.ts';
import { createModularCatio } from './catioModularScene.ts';
import { MODULAR_DEFAULT, validateModular } from './catioModularDesign.ts';
import { defaultCatioSettings, parseCatioSettings } from './catioSettings.ts';
import { defaultSubassemblySettings, parseSubassemblySettings } from './catioSubassembly.ts';
import { tunnelDefinition, windowInsertDefinition } from './catioSubassemblies.ts';
import { parseWindowInsert, validateWindowInsert, windowFor, windowInsertBom, windowInsertLayout, WINDOW_INSERT_DEFAULT } from './catioWindowInsert.ts';
import { buildInsertContext, createWindowInsertScene } from './catioWindowInsertScene.ts';
import { parseTunnel, tunnelLayout, tunnelCutList, accessMeshQuads, vec, TUNNEL_DEFAULT, TUNNEL_PRESETS } from './catioTunnel.ts';
import { buildSectionPieces, tunnelDrawing } from './catioTunnelPieces.ts';

const state = { progress: 6, windowOpen: true, exploded: false, cutaway: false, hidden: new Set<never>() };
const box = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);

describe('removable turn-button doors', () => {
  it.each([200, 300, 450])('provides a continuous backstop, locating clearance and four retainers for a %i mm port', size => {
    const l = catDoorLayout(size, size);
    expect(l.leafWidth - size).toBe(2 * CAT_DOOR.overlap);
    expect(l.receivingWidth - l.leafWidth).toBe(2 * CAT_DOOR.clearance);
    expect(l.buttons).toHaveLength(4);
    expect(l.buttons.every(b => Math.abs(b.x) > l.leafWidth / 2)).toBe(true);
    expect(l.retainedOverlap).toBeGreaterThan(0);
    const p = createCatioParts();
    buildCatDoor(p, { id: 'test', label: 'Panel', step: 0, width: size, height: size, bottom: 0, y: 0, closure: 'removable', solid: true });
    p.update(state);
    const seat = p.root.getObjectByName('test-seat');
    if (!seat) throw new Error('Missing seat');
    // No backstop across the clear opening; it is a perimeter ring, not a solid blocking sheet.
    const ray = new THREE.Raycaster(new THREE.Vector3(0, -50, size / 2), new THREE.Vector3(0, 1, 0));
    expect(ray.intersectObject(seat, true)).toHaveLength(0);
    p.dispose();
  });

  it('retracts the locking pins, turns the tabs clear, then withdraws normally without upward travel', () => {
    const p = createCatioParts();
    const door = buildCatDoor(p, { id: 'test', label: 'Panel', step: 0, width: 300, height: 300, bottom: 0, y: 0, closure: 'removable', solid: true });
    const tabs = p.root.getObjectByName('test-turn-buttons'); if (!tabs) throw new Error('Missing tabs');
    const first = tabs.children[0]; const arm = first?.getObjectByName('test-tab-0'); const pin = first?.getObjectByName('test-locking-pin-0');
    door.setOpen?.(0.2);
    expect(arm?.rotation.y).toBeCloseTo(0); expect(pin?.position.y).toBe(12); expect(door.moving[0]?.position.y).toBe(0);
    door.setOpen?.(0.5);
    expect(Math.abs(arm?.rotation.y ?? 0)).toBeCloseTo(Math.PI / 2); expect(door.moving[0]?.position.y).toBe(0);
    door.setOpen?.(1);
    expect(door.moving[0]?.position.y).toBeGreaterThan(300); expect(door.moving[0]?.position.z).toBe(0);
    door.setOpen?.(0); expect(pin?.position.y).toBe(0); expect(door.moving[0]?.position.y).toBe(0); p.dispose();
  });

  it('moves mesh, rim and edge battens together, but never its seat', () => {
    const p = createCatioParts();
    const door = buildCatDoor(p, { id: 'test', label: 'Access', step: 0, width: 200, height: 150, bottom: 0, y: 0, closure: 'removable' });
    p.update(state); const seat = p.root.getObjectByName('test-seat'); if (!seat) throw new Error('Missing seat');
    const before = box(seat).clone(); door.setOpen?.(1); p.root.updateMatrixWorld(true);
    expect(box(seat).equals(before)).toBe(true);
    expect(door.moving).toHaveLength(3);
    expect(new Set(door.moving.map(g => g.position.y)).size).toBe(1);
    p.dispose();
  });

  it('seats enclosure panels above the unchanged solid walkway, without a lower surround through the floor', () => {
    const p = createCatioParts();
    const door = buildCatDoor(p, { id: 'port', label: 'Enclosure', step: 0, width: 300, height: 300, bottom: 200, y: 0, closure: 'removable', floorSeated: true });
    p.update(state);
    for (const part of p.components) expect(box(part.group).min.z).toBeGreaterThanOrEqual(200);
    expect(catDoorLayout(300, 300, true).leafHeight).toBe(310);
    const z = box(door.moving[0] ?? p.root).min.z; door.setOpen?.(1); p.root.updateMatrixWorld(true);
    expect(box(door.moving[0] ?? p.root).min.z).toBe(z);
    expect(catDoorBom('port', 300, 300, false, true).find(l => l.name === 'Panel locating surround')?.use).toContain('no threshold pocket');
    p.dispose();
  });

  it('pockets structural timber without removing the outdoor bearing section', () => {
    const pieces = doorPocket({ size: [400, 60, 40], center: [0, 30, 20] }, { size: [356, 20, 10], center: [0, 10, 35] });
    const volume = pieces.reduce((sum, b) => sum + b.size[0] * b.size[1] * b.size[2], 0);
    expect(volume).toBe(400 * 60 * 40 - 356 * 20 * 10);
    expect(pieces.some(b => b.size[1] >= 40 && b.size[2] === 40)).toBe(true);
  });

  it('retains sliding as an upward-moving alternative and changes BOMs by mechanism/material', () => {
    const p = createCatioParts();
    const door = buildCatDoor(p, { id: 'test', label: 'Gate', step: 0, width: 300, height: 300, bottom: 0, y: 0, closure: 'sliding' });
    door.setOpen?.(1); expect(door.moving[0]?.position.z).toBe(330); expect(door.moving[0]?.position.y).toBe(0);
    expect(p.root.getObjectByName('test-turn-buttons')).toBeUndefined(); p.dispose();
    for (const closure of ['sliding', 'removable'] as const) {
      const bom = windowInsertBom('modular', { ...WINDOW_INSERT_DEFAULT, catClosure: closure });
      expect(bom.some(l => l.id === 'gate-tracks')).toBe(closure === 'sliding');
      expect(bom.some(l => l.name === 'Cat-panel gasket')).toBe(closure === 'removable');
      expect(bom.some(l => l.name === 'Removable panel mesh cut')).toBe(false);
    }
    expect(catDoorBom('outdoor', 300, 300, false).find(l => l.name === 'Door turn button (custom)')?.quantity).toBe(4);
    expect(catDoorBom('outdoor', 300, 300, false).some(l => l.name === 'Removable panel mesh cut')).toBe(true);
  });
});

describe('door fit and shared previews', () => {
  it('applies full-height travel restrictions only to sliding gates', () => {
    const w = { ...windowFor('modular'), glassHeight: 500, sashHeight: 650, openingHeight: 740 };
    const removable = validateWindowInsert('modular', WINDOW_INSERT_DEFAULT, w);
    expect(removable).toEqual([]);
    expect(validateWindowInsert('modular', { ...WINDOW_INSERT_DEFAULT, catClosure: 'sliding' }, w).join()).toMatch(/full travel/);
    const config = { ...MODULAR_DEFAULT, glassHeight: 500, sashHeight: 600 };
    expect(validateModular(config, 'removable')).toEqual([]);
    expect(validateModular(config, 'sliding').join()).toMatch(/upward travel/);
  });

  it('checks withdrawal clearance and fits the seated panel ahead of the closed sash', () => {
    expect(validateWindowInsert('modular', WINDOW_INSERT_DEFAULT)).toEqual([]);
    expect(validateWindowInsert('modular', { ...WINDOW_INSERT_DEFAULT, attachment: 'folding-wedges' }).join()).toMatch(/withdrawal/);
    expect(validateWindowInsert('modular', { ...WINDOW_INSERT_DEFAULT, frameFace: 90, frameLip: 35, frameDepth: 120 }).join()).toMatch(/withdrawal/);
    const w = windowFor('modular');
    expect(validateWindowInsert('modular', WINDOW_INSERT_DEFAULT, { ...w, sashWidth: 350 }).join()).toMatch(/withdrawal/);
    const scene = createWindowInsertScene('modular', WINDOW_INSERT_DEFAULT); scene.update({ ...state, windowOpen: false });
    const l = scene.layout;
    for (const part of scene.components.filter(c => c.id.startsWith('window-cat'))) expect(box(part.group).min.y).toBeGreaterThan(l.frame.sashFace);
    // The threshold/sill notch is only at the room-side edge; outdoor support timber is still present.
    const threshold = l.timber.find(t => t.component === 'threshold');
    expect(threshold?.boxes.length).toBeGreaterThan(1);
    scene.dispose();
  });

  it('uses the same closure in the installed context and the window-insert page', () => {
    for (const closure of ['removable', 'sliding'] as const) {
      const config = { ...WINDOW_INSERT_DEFAULT, catClosure: closure }; const l = windowInsertLayout('modular', config);
      const p = createCatioParts(l.mesh); buildInsertContext(p, l); p.update(state);
      const scene = createWindowInsertScene('modular', config); scene.update({ ...state, doors: {} });
      const context = p.root.getObjectByName('window-cat-gate'); const own = scene.root.getObjectByName('window-cat-gate');
      if (!context || !own) throw new Error('Missing shared door');
      expect(box(context).equals(box(own))).toBe(true);
      scene.dispose(); p.dispose();
    }
  });

  it('keeps unused ports shut, all panels retained before connection, and maintenance doors hinged', () => {
    const scene = createModularCatio(MODULAR_DEFAULT);
    scene.update({ ...state, progress: 5, doors: { 'a-rear': true } });
    const rear = scene.doors.find(d => d.id === 'a-rear'); expect(rear?.moving[0]?.position.y).toBe(0);
    scene.update({ ...state, doors: { 'a-left': true, 'a-human': true, 'a-rear': true } });
    expect(scene.doors.find(d => d.id === 'a-left')?.moving[0]?.position.y).toBe(0);
    expect(rear?.moving[0]?.position.z).toBe(0); expect(rear?.moving[0]?.position.y).toBeGreaterThan(0);
    expect(scene.doors.find(d => d.id === 'a-human')?.moving[0]?.rotation.z).toBe(Math.PI / 2);
    scene.dispose();
  });

  it.each(TUNNEL_PRESETS.map(p => [p.label, p.config()] as const))('adds side access clear of flange ends and retains roofs for %s', (_label, config) => {
    const original = tunnelLayout({ ...config, accessPanels: false }); const added = tunnelLayout({ ...config, accessPanels: true });
    const roof = (l: typeof added) => l.panels.filter(p => p.id.endsWith('roof'));
    expect(roof(added)).toEqual(roof(original)); expect(added.members).toEqual(original.members); expect(added.supports).toEqual(original.supports); expect(added.couplings).toEqual(original.couplings);
    const roofCuts = (l: typeof added) => tunnelCutList(l).filter(line => line.name === 'Roof mesh' || line.name === 'Net hood');
    expect(roofCuts(added)).toEqual(roofCuts(original));
    for (const a of added.accessPanels) { expect(a.width + 56).toBeLessThan(a.usable); expect(a.bottom + a.height + 28).toBeLessThan(added.h); }
    const p = createCatioParts(added.mesh); const draw = tunnelDrawing(p); const built = buildSectionPieces(p, draw, added);
    expect(built.access.length).toBe(added.accessPanels.length);
    for (const a of built.access) { expect(a.door.moving).toHaveLength(3); a.door.setOpen?.(1); }
    // The caller owns these unregistered pieces; add them so disposal visits every allocation.
    for (const a of built.access) for (const part of a.parts) p.root.add(part.group);
    draw.dispose(); p.dispose();
  });

  it('cuts exact rectangular access openings at mitred ends, even on a climb', () => {
    const l = tunnelLayout({ ...TUNNEL_DEFAULT, angleJoint: 'mitred-ends' });
    for (const a of l.accessPanels) {
      const piece = l.pieces.find(p => p.id === a.piece); const panel = l.panels.find(p => p.id === a.panel);
      if (!piece || !panel) throw new Error('Missing panel');
      const quads = accessMeshQuads(piece, panel, a);
      const bottom = quads[2]; const top = quads[3]; if (!bottom || !top) throw new Error('Missing cut edges');
      expect(vec.len(vec.sub(bottom[2], bottom[3]))).toBeCloseTo(a.width, 6);
      expect(vec.len(vec.sub(top[0], top[1]))).toBeCloseTo(a.width, 6);
      expect(vec.len(vec.sub(top[0], bottom[3]))).toBeCloseTo(a.height, 6);
      expect(vec.dot(vec.sub(top[0], a.center), piece.frame.z)).toBeCloseTo(a.height, 6);
    }
  });

  it('keeps whole-catio roof geometry, supports and BOM-independent appearance unchanged', () => {
    const original = createModularCatio({ ...MODULAR_DEFAULT, catClosure: 'sliding', tunnelAccess: false }, { ...WINDOW_INSERT_DEFAULT, catClosure: 'sliding' });
    const added = createModularCatio(MODULAR_DEFAULT);
    original.update(state); added.update(state);
    const roofs = (scene: typeof added) => scene.components.filter(p => p.id.includes('roof')).map(p => [p.id, box(p.group).min.toArray(), box(p.group).max.toArray()]);
    expect(roofs(added)).toEqual(roofs(original)); original.dispose(); added.dispose();
  });
});

describe('legacy catio settings', () => {
  it('uses new defaults only for fresh/reset designs; keeps legacy dimensions and viewing state', () => {
    const old = defaultCatioSettings(); old.config.enclosure.width = 1800; old.views.modular.view = 'Top'; old.views.modular.doors['a-rear'] = false;
    const legacy = JSON.parse(JSON.stringify(old)) as { config: Record<string, unknown> }; delete legacy.config['catClosure']; delete legacy.config['tunnelAccess'];
    const parsed = parseCatioSettings(JSON.stringify(legacy));
    expect(parsed.config).toEqual({ ...old.config, catClosure: 'sliding', tunnelAccess: false }); expect(parsed.views).toEqual(old.views);
    expect(defaultCatioSettings().config).toMatchObject({ catClosure: 'removable', tunnelAccess: true });
  });

  it('migrates old subassembly configs without dropping choices or camera/door state', () => {
    const saved = defaultSubassemblySettings(windowInsertDefinition); saved.variant = 'modular'; saved.config.footDiameter = 40; saved.views.modular.view = 'Top'; saved.views.modular.doors['window-cat'] = true;
    const old = JSON.parse(JSON.stringify(saved)) as { config: Record<string, unknown> }; delete old.config['catClosure'];
    expect(parseSubassemblySettings(windowInsertDefinition, JSON.stringify(old))).toEqual({ ...saved, config: { ...saved.config, catClosure: 'sliding' } });
    const tunnel = { ...TUNNEL_DEFAULT, portHeight: 655 } as Record<string, unknown>; delete tunnel['accessPanels'];
    expect(parseTunnel(tunnel)).toMatchObject({ portHeight: 655, accessPanels: false });
    expect(parseWindowInsert({ ...old.config })).toMatchObject({ catClosure: 'sliding', footDiameter: 40 });
    expect(defaultSubassemblySettings(tunnelDefinition).config.accessPanels).toBe(true);
  });
});
