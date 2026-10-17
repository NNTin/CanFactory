import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createModularCatio, type ModularState } from './catioModularScene.ts';
import { defaultCatioSettings, parseCatioSettings } from './catioSettings.ts';
import { CATIO, DOOR, MODULAR_DEFAULT as defaults, modularCamera, modularLayout, modularPitch, roofBearers, TUNNEL_COUPLING_DEFAULT, validateModular, WINDOW_INSERT_DEFAULT, type ModularConfig } from '@canfactory/catio';

/** The design as it was before the cat ports' closure could be chosen: every port has a sliding gate. */
const sliding: ModularConfig = { ...defaults, portClosure: 'sliding-gate' };
const assembled: ModularState = { progress: 6, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);
const part = (scene: ReturnType<typeof createModularCatio>, id: string) => {
  const found = scene.components.find(p => p.id === id); if (!found) throw new Error(`Missing ${id}`); return found.group;
};
describe('modular catio layout and validation', () => {
  it('rejects impossible sash, gate, ramp and module combinations without clamping', () => {
    expect(validateModular(defaults)).toEqual([]);
    for (const patch of [{ glassWidth: 910 }, { second: { width: NaN, depth: 1000, height: 1200 } }, { tunnelSize: NaN }, { approach: 0 }, { lateral: 1.5 }, { tunnelSize: 450, enclosure: { width: 800, depth: 800, height: 1200 } }]) for (const base of [defaults, sliding]) {
      const config = { ...base, ...patch }; const before = structuredClone(config);
      expect(validateModular(config).length).toBeGreaterThan(0); expect(config).toEqual(before);
      expect(() => createModularCatio(config, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing })).toThrow();
    }
    // a sliding gate needs its own height again above its port, in the window collar and in an enclosure; a removable panel does not
    for (const [patch, message] of [[{ sashHeight: 600, glassHeight: 500 }, /sliding gate needs room for its full upward travel/], [{ tunnelSize: 450, enclosure: { width: 1200, depth: 1000, height: 900 } }, /too low for the raised cat gate/]] as const) {
      expect(validateModular({ ...sliding, ...patch }).join(' ')).toMatch(message);
      expect(() => createModularCatio({ ...sliding, ...patch }, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing })).toThrow();
      expect(validateModular({ ...defaults, ...patch })).toEqual([]);
    }
  });
  it('snaps a saved design’s tunnel to the square standard port, its larger size both ways, and keeps everything else', () => {
    const views = defaultCatioSettings().views;
    for (const [w, h] of [[350, 300], [300, 400], [300, 300]] as const) {
      const rest = Object.fromEntries(Object.entries(defaults).filter(([key]) => key !== 'tunnelSize'));
      const saved = { version: 2, mode: 'modular', config: { ...rest, route: 'left' as const, approach: 3, tunnelWidth: w, tunnelHeight: h }, views };
      const settings = parseCatioSettings(JSON.stringify(saved));
      expect(settings.version).toBe(3);
      expect(settings.config).toEqual({ ...rest, route: 'left', approach: 3, tunnelSize: Math.max(w, h) });
      expect(settings.views).toEqual(views);
    }
  });
  it('frames maximum layouts, open maintenance doors and explosion offsets with finite camera positions', () => {
    const c = { ...defaults, route: 'right' as const, approach: 6, lateral: 6, final: 6, secondEnabled: true, link: 6, enclosure: { width: 2400, depth: 2400, height: 2200 }, second: { width: 2400, depth: 2400, height: 2200 } };
    const b = modularLayout(c).bounds;
    for (const view of ['Exterior', 'Front', 'Side', 'Top'] as const) {
      const camera = modularCamera(c, view, true); expect(camera.position.every(Number.isFinite)).toBe(true);
      expect(new THREE.Vector3(...camera.position).distanceTo(new THREE.Vector3(...camera.target))).toBeGreaterThan(Math.max(b.maxY, b.maxX - b.minX));
    }
  });
});

describe('modular scene geometry', () => {
  it('models rectangular glass and sash independently, with all fittings outside the inward sweep', () => {
    for (const base of [sliding, defaults]) {
      const scene = createModularCatio({ ...base, glassWidth: 700, glassHeight: 900, sashWidth: 830, sashHeight: 1050 }, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing });
      // a sliding gate raised; a removable panel seated and retained, as it is whenever the sash is closed over it
      scene.update(base.portClosure === 'sliding-gate' ? assembled : { ...assembled, doors: { 'window-cat': false } });
      const glass = scene.root.getObjectByName('context-glass'); if (!glass) throw new Error('Missing glass');
      expect(bounds(glass).getSize(new THREE.Vector3()).toArray()).toEqual([700, 6, 900]);
      expect(bounds(scene.hinge).getSize(new THREE.Vector3()).x).toBe(830);
      expect(bounds(scene.hinge).getSize(new THREE.Vector3()).z).toBe(1050);
      const installed = scene.components.filter(p => p.step > 0).map(p => ({ id: p.id, box: bounds(p.group) }));
      // removed, the window's panel is stowed on the wall beside the window: clear of the sash's swing too
      scene.update(assembled);
      const stowed = scene.doors.find(d => d.id === 'window-cat')?.moving.map(g => ({ id: 'stowed window panel', box: bounds(g) })).filter(p => !p.box.isEmpty()) ?? [];
      if (base.portClosure === 'removable-panel') expect(stowed.length).toBeGreaterThan(0);
      for (let angle = 0; angle <= 90; angle += 5) {
        scene.hinge.rotation.z = -THREE.MathUtils.degToRad(angle); scene.root.updateMatrixWorld(true);
        for (const p of [...installed, ...(base.portClosure === 'removable-panel' ? stowed : [])]) expect(bounds(scene.hinge).intersectsBox(p.box), `${base.portClosure}: ${p.id} at ${angle}`).toBe(false);
      }
      scene.dispose();
    }
  });
  it('hangs the window insert on the window frame with its screen hooks by default, or clamps it into the recess', () => {
    const hung = createModularCatio(defaults, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing });
    expect(hung.components.map(p => p.id)).toContain('screen-hooks');
    expect(hung.components.map(p => p.id)).not.toContain('padded-clamps');
    hung.dispose();
    const pressed = createModularCatio(defaults, { ...WINDOW_INSERT_DEFAULT, attachment: 'spreader-feet' }, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing });
    expect(pressed.components.map(p => p.id)).toContain('padded-clamps');
    expect(pressed.components.map(p => p.id)).not.toContain('screen-hooks');
    pressed.dispose();
  });
  it('docks the tunnel to the window port with a docking frame, as the coupling page does, not a mesh throat', () => {
    const scene = createModularCatio(defaults, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing });
    const ids = scene.components.map(p => p.id);
    expect(ids.filter(id => id.includes('throat'))).toEqual([]);
    expect(ids).toEqual(expect.arrayContaining(['window-threshold', 'window-docking-frame']));
    // the frame surrounds the port: its opening is the tunnel's clear size
    const frame = bounds(part(scene, 'window-docking-frame'));
    expect(frame.max.x - frame.min.x).toBeCloseTo(defaults.tunnelSize + 140, 6);
  });

  it('keeps all cat apertures free of fixed mesh and each small gate independently closable', () => {
    const scene = createModularCatio({ ...sliding, secondEnabled: true }, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing }); scene.update(assembled);
    for (const door of scene.doors.filter(d => d.kind === 'cat')) {
      const gate = bounds(part(scene, `${door.id}-gate`));
      expect(gate.min.z).toBeCloseTo(door.connected ? 520 : 190);
      const ray = new THREE.Raycaster();
      const center = gate.getCenter(new THREE.Vector3()); center.z = 350;
      const direction = door.id.endsWith('left') || door.id.endsWith('right') ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      ray.set(center.clone().addScaledVector(direction, -80), direction); ray.far = 160;
      const meshParts = scene.components.filter(p => p.layer === 'mesh').map(p => p.group);
      expect(ray.intersectObjects(meshParts, true), `${door.id} blocked by mesh`).toHaveLength(0);
    }
    scene.update({ ...assembled, doors: { 'window-cat': false, 'a-rear': true, 'a-human': true } });
    expect(bounds(part(scene, 'window-cat-gate')).min.z).toBeCloseTo(190);
    expect(bounds(part(scene, 'a-rear-gate')).min.z).toBeCloseTo(520);
    const door = bounds(part(scene, 'a-human-door'));
    expect(door.max.y).toBeCloseTo(2 * modularPitch(defaults) + 1000 + 1114);
    expect(door.min.y).toBeGreaterThanOrEqual(2 * modularPitch(defaults) + 898);
    // The right-side tunnel and B remain outside A's outward door sweep.
    expect(door.intersectsBox(bounds(part(scene, 'b-frame')))).toBe(false);
    scene.dispose();
  });
  it('follows the tunnel pages: every module’s end-bay side doors and the corners’ start doors, held as set there', () => {
    for (const doorFixing of ['latches', 'turn-buttons'] as const) {
      const c = { ...defaults, route: 'right' as const, approach: 2, lateral: 1, final: 1 };
      const scene = createModularCatio(c, WINDOW_INSERT_DEFAULT, { doorFixing });
      // both sides of every module's end bay, but the side a corner's run before butts into
      const sides = scene.doors.filter(d => /-door-(left|right)$/.test(d.id));
      expect(sides).toHaveLength(2 * scene.layout.sections.length - scene.layout.sections.filter(q => q.kind === 'corner').length);
      for (const d of sides) expect(d.mechanism).toBe(doorFixing === 'latches' ? 'latched' : 'removable-panel');
      const ends = scene.doors.filter(d => d.id.endsWith('-end-door'));
      expect(ends).toHaveLength(2);
      for (const d of ends) expect(d.mechanism).toBe(doorFixing === 'latches' ? 'latched' : 'removable-panel');
      // shut unless asked; asked, it comes off
      scene.update(assembled);
      const first = ends[0]; if (!first) throw new Error('end door');
      const shut = first.moving.map(g => g.position.clone());
      scene.update({ ...assembled, doors: { [first.id]: true } });
      expect(first.moving.some((g, i) => g.position.distanceTo(shut[i] ?? g.position) > 1)).toBe(true);
      scene.dispose();
    }
  });
  it('joins solid walkways across straight and corner modules with mesh containment and ground floors', () => {
    const scene = createModularCatio({ ...defaults, route: 'right', approach: 1, lateral: 1, final: 1, secondEnabled: true }, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing }); scene.update(assembled);
    const ids = scene.components.map(p => p.id); expect(new Set(ids).size).toBe(ids.length);
    for (const section of scene.layout.sections) {
      const corner = section.kind === 'corner';
      // every module's floor is at the sill, a corner's too
      const ray = new THREE.Raycaster(new THREE.Vector3(...section.center, 250), new THREE.Vector3(0, 0, -1));
      const hits = ray.intersectObject(part(scene, `${section.id}-frame`), true);
      expect(hits[0]?.point.z).toBeCloseTo(200);
      expect(bounds(part(scene, `${section.id}-feet`)).min.z).toBe(0);
      for (const side of ['back', 'front', 'left', 'right'] as const) {
        // (a module's sides are its end bay's doors, and mesh beyond the bay; a corner's start is shut by a door)
        const lateral = side === 'left' || side === 'right';
        if (!section.openings.includes(side)) expect(ids).toEqual(expect.arrayContaining([corner && side === 'back' ? `${section.id}-end-door` : lateral ? `${section.id}-door-${side}` : `${section.id}-${side}`]));
        else expect(ids).toContain(`${section.id}-${side}-coupling`);
      }
      // a corner's stub door opens from the door controls; its roof is mesh like any module's
      if (corner) {
        expect(ids).toContain(`${section.id}-roof`);
        expect(scene.doors.find(d => d.id === `${section.id}-end-door`)).toMatchObject({ kind: 'tunnel', connected: true });
      }
    }
    for (const e of scene.layout.enclosures) {
      expect(bounds(part(scene, `${e.id}-frame`)).max.z).toBe(e.size.height);
      expect(bounds(part(scene, `${e.id}-continuous-floor`)).min.z).toBe(CATIO.floorZ - CATIO.wire / 2);
      expect(scene.panels.filter(p => p.id.startsWith(`${e.id}-floor-skirt`))).toHaveLength(4);
      // the net roof lies on cross rails, none farther than a net may span from the next
      let rails = 0; part(scene, `${e.id}-roof-net-bearers`).traverse(object => { if (object instanceof THREE.Mesh) rails++; });
      expect(rails).toBe(roofBearers(e.size.depth - 80).length); expect(rails).toBeGreaterThan(0);
      expect(bounds(part(scene, `${e.id}-roof-net-bearers`)).max.z).toBeCloseTo(bounds(part(scene, `${e.id}-roof`)).min.z, 6);
      const ramp = bounds(part(scene, `${e.id}-landing-and-ramp`));
      expect(ramp.max.y).toBeLessThan(e.rearY + e.size.depth); expect(ramp.min.z).toBeGreaterThanOrEqual(4);
    }
    scene.dispose();
  });
  it('provides a continuous level walking surface from each landing through the side link', () => {
    for (const base of [sliding, defaults]) {
      const scene = createModularCatio({ ...base, secondEnabled: true, second: { width: 1600, depth: 1500, height: 1400 } }, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing }); scene.update(assembled);
      const [a, b] = scene.layout.enclosures; if (!a || !b) throw new Error('Missing enclosures');
      const timber = scene.components.filter(p => p.layer === 'timber').map(p => p.group);
      let stops = 0;
      for (let x = a.centerX + a.size.width / 2 - 80; x <= b.centerX - b.size.width / 2 + 80; x += 10) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, a.rearY + 200, 250), new THREE.Vector3(0, 0, -1));
        const z = ray.intersectObjects(timber, true)[0]?.point.z ?? NaN;
        // level throughout; a removable panel's seat crosses the floor of each of the two ports as a low stop strip, the only step
        if (base.portClosure === 'removable-panel' && Math.abs(z - (200 + DOOR.stop.lap)) < 1e-6) stops++;
        else expect(z, `${base.portClosure}: side threshold at X=${x}`).toBeCloseTo(200);
      }
      expect(stops).toBe(base.portClosure === 'removable-panel' ? 2 : 0);
      scene.dispose();
    }
  });

  it('has six assembly stages, keeps gates closed before connection, and preserves stationary context', () => {
    const scene = createModularCatio(sliding, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing });
    for (let progress = 0; progress <= 6; progress++) {
      scene.update({ ...assembled, progress, exploded: true });
      for (const p of scene.components) {
        expect(p.group.visible).toBe(p.step <= progress);
        if (p.step === 0) expect(p.group.position.toArray()).toEqual([0, 0, 0]);
      }
      const gate = scene.doors.find(d => d.id === 'window-cat'); expect(gate?.moving[0]?.position.z).toBe(progress === 6 ? 330 : 0);
    }
    scene.update({ ...assembled, cutaway: true, hidden: new Set(['mesh']) });
    expect(part(scene, 'wall').visible).toBe(false);
    expect(scene.components.filter(p => p.layer === 'mesh').every(p => !p.group.visible)).toBe(true); scene.dispose();
  });
  it('builds boundary dimensions without nonfinite geometry or gates exceeding frames', () => {
    for (const config of [
      { ...sliding, glassWidth: 400, glassHeight: 400, sashWidth: 500, sashHeight: 500, tunnelSize: 200, enclosure: { width: 800, depth: 800, height: 900 } },
      { ...sliding, glassWidth: 1400, glassHeight: 1400, sashWidth: 1600, sashHeight: 1600, tunnelSize: 450, enclosure: { width: 2400, depth: 2400, height: 2200 } },
    ] satisfies ModularConfig[]) {
      const scene = createModularCatio(config, WINDOW_INSERT_DEFAULT, { doorFixing: TUNNEL_COUPLING_DEFAULT.doorFixing }); scene.update(assembled);
      for (const p of scene.components) expect([...bounds(p.group).min.toArray(), ...bounds(p.group).max.toArray()].every(Number.isFinite), p.id).toBe(true);
      expect(bounds(part(scene, 'window-cat-gate')).max.z).toBeLessThan(config.sashHeight + 190);
      expect(bounds(part(scene, 'a-rear-gate')).max.z).toBeLessThan(config.enclosure.height); scene.dispose();
    }
  });
});

describe('saved catio settings', () => {
  it('round-trips valid dimensions and independent view states, and rejects corrupt storage', () => {
    const settings = defaultCatioSettings(); settings.mode = 'modular'; settings.config.route = 'left'; settings.config.secondEnabled = true;
    settings.views.modular.view = 'Top'; settings.views.modular.doors['window-cat'] = false; settings.views.direct.exploded = true;
    expect(parseCatioSettings(JSON.stringify(settings))).toEqual(settings);
    for (const raw of [null, 'invalid', '{}', '{"version":2}', '{"version":3}', JSON.stringify({ ...settings, config: { ...settings.config, sashWidth: 2 } })]) expect(parseCatioSettings(raw)).toEqual(defaultCatioSettings());
  });
});
