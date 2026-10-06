import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MODULAR_DEFAULT as defaults, modularLayout, modularCamera, validateModular, type ModularConfig } from './catioModularDesign.ts';
import { WINDOW_INSERT_DEFAULT } from './catioWindowInsert.ts';
import { createModularCatio, type ModularState } from './catioModularScene.ts';
import { defaultCatioSettings, parseCatioSettings } from './catioSettings.ts';

const assembled: ModularState = { progress: 6, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);
const part = (scene: ReturnType<typeof createModularCatio>, id: string) => {
  const found = scene.components.find(p => p.id === id); if (!found) throw new Error(`Missing ${id}`); return found.group;
};
describe('modular catio layout and validation', () => {
  it('derives straight and mirrored offset endpoints from the complete corner widths', () => {
    expect(modularLayout(defaults).end).toEqual([0, 1000]);
    for (const sign of [-1, 1]) {
      const layout = modularLayout({ ...defaults, route: sign < 0 ? 'left' : 'right', approach: 1, lateral: 2, final: 3 });
      expect(layout.end[0]).toBeCloseTo(sign * 1380); expect(layout.end[1]).toBeCloseTo(2380);
      expect(layout.sections.filter(s => s.kind === 'corner')).toHaveLength(2);
      expect(layout.sections).toHaveLength(8);
    }
  });
  it('aligns independent enclosures at their rear landings with a measured link', () => {
    const c = { ...defaults, route: 'left' as const, secondEnabled: true, second: { width: 1800, depth: 1600, height: 1900 }, link: 3 };
    const { enclosures } = modularLayout(c); const [a, b] = enclosures;
    if (!a || !b) throw new Error('Missing enclosures');
    expect(b.rearY).toBe(a.rearY); expect(b.centerX - b.size.width / 2 - (a.centerX + a.size.width / 2)).toBe(1500);
    expect(validateModular(c)).toEqual([]);
  });
  it('rejects impossible sash, gate, ramp and module combinations without clamping', () => {
    expect(validateModular(defaults)).toEqual([]);
    for (const patch of [{ glassWidth: 910 }, { second: { width: NaN, depth: 1000, height: 1200 } }, { sashHeight: 600, glassHeight: 500 }, { tunnelHeight: NaN }, { approach: 0 }, { lateral: 1.5 }, { tunnelWidth: 450, enclosure: { width: 800, depth: 800, height: 1200 } }, { tunnelHeight: 450, enclosure: { width: 1200, depth: 1000, height: 900 } }]) {
      const config = { ...defaults, ...patch }; const before = structuredClone(config);
      expect(validateModular(config).length).toBeGreaterThan(0); expect(config).toEqual(before);
      expect(() => createModularCatio(config)).toThrow();
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
    const scene = createModularCatio({ ...defaults, glassWidth: 700, glassHeight: 900, sashWidth: 830, sashHeight: 1050 }); scene.update(assembled);
    const glass = scene.root.getObjectByName('context-glass'); if (!glass) throw new Error('Missing glass');
    expect(bounds(glass).getSize(new THREE.Vector3()).toArray()).toEqual([700, 6, 900]);
    expect(bounds(scene.hinge).getSize(new THREE.Vector3()).x).toBe(830);
    expect(bounds(scene.hinge).getSize(new THREE.Vector3()).z).toBe(1050);
    const installed = scene.components.filter(p => p.step > 0).map(p => ({ id: p.id, box: bounds(p.group) }));
    for (let angle = 0; angle <= 90; angle += 5) {
      scene.hinge.rotation.z = -THREE.MathUtils.degToRad(angle); scene.root.updateMatrixWorld(true);
      for (const p of installed) expect(bounds(scene.hinge).intersectsBox(p.box), `${p.id} at ${angle}`).toBe(false);
    }
    scene.dispose();
  });
  it('hangs the window insert on the window frame with its screen hooks by default, or clamps it into the recess', () => {
    const hung = createModularCatio(defaults, WINDOW_INSERT_DEFAULT);
    expect(hung.components.map(p => p.id)).toContain('screen-hooks');
    expect(hung.components.map(p => p.id)).not.toContain('padded-clamps');
    hung.dispose();
    const pressed = createModularCatio(defaults, { ...WINDOW_INSERT_DEFAULT, attachment: 'spreader-feet' });
    expect(pressed.components.map(p => p.id)).toContain('padded-clamps');
    expect(pressed.components.map(p => p.id)).not.toContain('screen-hooks');
    pressed.dispose();
  });
  it('docks the tunnel to the window port with a docking frame, as the coupling page does, not a mesh throat', () => {
    const scene = createModularCatio(defaults);
    const ids = scene.components.map(p => p.id);
    expect(ids.filter(id => id.includes('throat'))).toEqual([]);
    expect(ids).toEqual(expect.arrayContaining(['window-threshold', 'window-docking-frame']));
    // the frame surrounds the port: its opening is the tunnel's clear size
    const frame = bounds(part(scene, 'window-docking-frame'));
    expect(frame.max.x - frame.min.x).toBeCloseTo(defaults.tunnelWidth + 140, 6);
  });

  it('keeps all cat apertures free of fixed mesh and each small gate independently closable', () => {
    const scene = createModularCatio({ ...defaults, secondEnabled: true }); scene.update(assembled);
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
    expect(door.max.y).toBeCloseTo(2000 + 1114);
    expect(door.min.y).toBeGreaterThanOrEqual(1980);
    // The right-side tunnel and B remain outside A's outward door sweep.
    expect(door.intersectsBox(bounds(part(scene, 'b-frame')))).toBe(false);
    scene.dispose();
  });
  it('joins solid walkways across straight and corner modules with mesh containment and ground floors', () => {
    const scene = createModularCatio({ ...defaults, route: 'right', approach: 1, lateral: 1, final: 1, secondEnabled: true }); scene.update(assembled);
    const ids = scene.components.map(p => p.id); expect(new Set(ids).size).toBe(ids.length);
    for (const section of scene.layout.sections) {
      const ray = new THREE.Raycaster(new THREE.Vector3(...section.center, 250), new THREE.Vector3(0, 0, -1));
      const hits = ray.intersectObject(part(scene, `${section.id}-frame`), true);
      expect(hits[0]?.point.z).toBeCloseTo(200);
      expect(bounds(part(scene, `${section.id}-feet`)).min.z).toBe(0);
      for (const side of ['back', 'front', 'left', 'right'] as const) {
        if (!section.openings.includes(side)) expect(ids).toContain(`${section.id}-${side}`);
        else expect(ids).toContain(`${section.id}-${side}-coupling`);
      }
    }
    for (const e of scene.layout.enclosures) {
      expect(bounds(part(scene, `${e.id}-frame`)).max.z).toBe(e.size.height);
      expect(bounds(part(scene, `${e.id}-continuous-floor`)).min.z).toBe(3);
      expect(scene.panels.filter(p => p.id.startsWith(`${e.id}-floor-skirt`))).toHaveLength(4);
      const ramp = bounds(part(scene, `${e.id}-landing-and-ramp`));
      expect(ramp.max.y).toBeLessThan(e.rearY + e.size.depth); expect(ramp.min.z).toBeGreaterThanOrEqual(4);
    }
    scene.dispose();
  });
  it('provides a continuous level walking surface from each landing through the side link', () => {
    const scene = createModularCatio({ ...defaults, secondEnabled: true, second: { width: 1600, depth: 1500, height: 1400 } }); scene.update(assembled);
    const [a, b] = scene.layout.enclosures; if (!a || !b) throw new Error('Missing enclosures');
    const timber = scene.components.filter(p => p.layer === 'timber').map(p => p.group);
    for (let x = a.centerX + a.size.width / 2 - 80; x <= b.centerX - b.size.width / 2 + 80; x += 10) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, a.rearY + 200, 250), new THREE.Vector3(0, 0, -1));
      const hits = ray.intersectObjects(timber, true); expect(hits[0]?.point.z, `Side threshold at X=${x}`).toBeCloseTo(200);
    }
    scene.dispose();
  });

  it('has six assembly stages, keeps gates closed before connection, and preserves stationary context', () => {
    const scene = createModularCatio(defaults);
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
      { ...defaults, glassWidth: 400, glassHeight: 400, sashWidth: 500, sashHeight: 500, tunnelWidth: 200, tunnelHeight: 200, enclosure: { width: 800, depth: 800, height: 900 } },
      { ...defaults, glassWidth: 1400, glassHeight: 1400, sashWidth: 1600, sashHeight: 1600, tunnelWidth: 450, tunnelHeight: 450, enclosure: { width: 2400, depth: 2400, height: 2200 } },
    ] satisfies ModularConfig[]) {
      const scene = createModularCatio(config); scene.update(assembled);
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
    for (const raw of [null, 'invalid', '{}', '{"version":2}', JSON.stringify({ ...settings, config: { ...settings.config, sashWidth: 2 } })]) expect(parseCatioSettings(raw)).toEqual(defaultCatioSettings());
  });
});
