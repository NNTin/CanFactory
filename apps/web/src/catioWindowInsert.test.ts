import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dimensionOf, findPart, partUsage, WINDOW_INSERT_FOOT, windowInsertConcept } from '@canfactory/contracts';
import type { CatioState } from './catioScene.ts';
import { parseSubassemblySettings, defaultSubassemblySettings } from './catioSubassembly.ts';
import { windowInsertDefinition } from './catioSubassemblies.ts';
import { INSERT, PAD_HEIGHT, validateWindowInsert, WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DEFAULT, windowFor, windowInsertBom, windowInsertFacts, windowInsertLayout, windowInsertSteps, type WindowInsertConfig } from './catioWindowInsert.ts';
import { BENCH_OFFSET, createWindowInsertScene } from './catioWindowInsertScene.ts';

const installed: CatioState = { progress: 6, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);
const variants = ['direct', 'modular'] as const;
/** Every value of every control, one at a time, from the defaults. */
const ganter: WindowInsertConfig = { ...WINDOW_INSERT_DEFAULT, clampPad: 'ganter' };
const configs: WindowInsertConfig[] = [WINDOW_INSERT_DEFAULT, ...WINDOW_INSERT_CONTROLS.flatMap(control => control.options.map(option => ({ ...WINDOW_INSERT_DEFAULT, [control.key]: option.value }))),
  // the Ganter feet in every size, and the printed pads at their lowest and highest
  ...WINDOW_INSERT_FOOT.diameters.map(footDiameter => ({ ...ganter, footDiameter })), { ...WINDOW_INSERT_DEFAULT, padHeight: PAD_HEIGHT.min }, { ...WINDOW_INSERT_DEFAULT, padHeight: PAD_HEIGHT.max, footDiameter: 25 }];
const component = (scene: ReturnType<typeof createWindowInsertScene>, id: string) => {
  const found = scene.components.find(part => part.id === id); if (!found) throw new Error(`missing ${id}`); return found.group;
};

describe('window insert', () => {
  it('sizes the collar from the printed pads’ height', () => {
    const l = windowInsertLayout('direct', WINDOW_INSERT_DEFAULT);
    expect(l.pad).toMatchObject({ height: 24.5, diameter: 32, surface: 'grooved' });
    expect(l.gap).toBe(24.5 + INSERT.travel);
    expect(windowInsertLayout('direct', { ...WINDOW_INSERT_DEFAULT, padHeight: 30 }).W).toBe(1000 - 2 * (30 + INSERT.travel));
    // a spreader screw passes the thrust pad's lip and lock nut, the travel, the member and its own lock nut; a bearing screw fills the insert nut
    expect(l.pad?.spreaderScrew.id).toBe('iso-4017-m8x80');
    expect(dimensionOf(l.pad?.spreaderScrew ?? l.nut, 'l')).toBeGreaterThanOrEqual(3 + 8 + INSERT.travel + INSERT.member + 6.8);
    expect(l.pad?.bearingScrew.id).toBe('iso-4017-m8x30');
    expect(l.pad?.thrustNut.id).toBe('iso-10511-m8');
    expect(windowInsertLayout('direct', { ...WINDOW_INSERT_DEFAULT, attachment: 'folding-wedges' }).pad).toBeNull();
    // too low a pad cannot hold its lock nut; too narrow cannot hold it with a wall round it
    expect(validateWindowInsert('direct', { ...WINDOW_INSERT_DEFAULT, padHeight: 17 })).toEqual([expect.stringContaining('at least 17.5 mm high')]);
  });

  it('sizes the collar from the recess and the chosen Ganter foot', () => {
    const l = windowInsertLayout('direct', ganter);
    expect(l.pad).toBeNull();
    const foot = findPart('ganter-gn-343-2-32-m8-63-kr'); if (!foot) throw new Error('foot');
    expect(l.spreaderFoot.id).toBe(foot.id);
    expect(l.bearingFoot.id).toBe('ganter-gn-343-2-32-m8-40-kr');
    expect(l.gap).toBe(dimensionOf(foot, 'l3') + INSERT.travel);
    expect([l.W, l.H]).toEqual([1000 - 2 * l.gap, 1000 - 2 * l.gap]);
    expect(windowInsertLayout('direct', { ...ganter, attachment: 'folding-wedges' }).W).toBe(1000 - 2 * INSERT.wedgeGap);
    // the spreader stud passes the member, its travel and two nuts
    const nut = findPart('iso-4032-m8'); if (!nut) throw new Error('nut');
    expect(dimensionOf(l.spreaderFoot, 'l1')).toBeGreaterThanOrEqual(INSERT.member + INSERT.travel + 2 * dimensionOf(nut, 'm'));
  });

  it('keeps every installed piece outside the sash sweep and inside the recess, for every choice and variant', () => {
    for (const variant of variants) for (const config of configs) {
      expect(validateWindowInsert(variant, config), `${variant} ${JSON.stringify(config)}`).toEqual([]);
      const scene = createWindowInsertScene(variant, config); scene.update(installed);
      const w = windowFor(variant);
      const pieces = scene.components.filter(part => part.layer !== 'environment' && part.id !== 'fixed-window-frame' && part.id !== 'opening-sash').map(part => ({ id: part.id, box: bounds(part.group) }));
      for (const piece of pieces) {
        if (piece.box.isEmpty()) continue;
        expect(piece.box.min.x, `${variant} ${piece.id}`).toBeGreaterThanOrEqual(-w.openingWidth / 2 - 0.01);
        expect(piece.box.max.x, `${variant} ${piece.id}`).toBeLessThanOrEqual(w.openingWidth / 2 + 0.01);
        expect(piece.box.min.z, `${variant} ${piece.id}`).toBeGreaterThanOrEqual(w.recessFloor - 0.01);
        expect(piece.box.max.z, `${variant} ${piece.id}`).toBeLessThanOrEqual(w.recessFloor + w.openingHeight + 0.01);
        expect(piece.box.min.y, `${variant} ${piece.id}`).toBeGreaterThan(-117.5); // the room-side face of the fixed frame
      }
      for (let angle = 0; angle <= 90; angle += 10) {
        scene.hinge.rotation.z = -THREE.MathUtils.degToRad(angle); scene.root.updateMatrixWorld(true);
        const sash = bounds(scene.hinge);
        for (const piece of pieces) expect(sash.intersectsBox(piece.box), `${piece.id} meets the sash at ${angle}°`).toBe(false);
      }
      scene.dispose();
    }
  });

  it('presses every spreader pad onto the reveal only once tightened, with the sill feet on the recess floor', () => {
    for (const variant of variants) for (const config of [WINDOW_INSERT_DEFAULT, ganter]) {
      const scene = createWindowInsertScene(variant, config); const w = windowFor(variant);
      scene.update(installed);
      const feet = bounds(component(scene, 'spreader-clamps'));
      expect(feet.min.x).toBeCloseTo(-w.openingWidth / 2, 6);
      expect(feet.max.x).toBeCloseTo(w.openingWidth / 2, 6);
      expect(feet.max.z).toBeCloseTo(w.recessFloor + w.openingHeight, 6);
      expect(bounds(component(scene, 'bearing-feet')).min.z).toBeCloseTo(w.recessFloor, 6);
      scene.update({ ...installed, progress: 4 });
      const loose = bounds(component(scene, 'spreader-clamps'));
      expect(loose.min.x).toBeCloseTo(-w.openingWidth / 2 + INSERT.travel, 6);
      expect(loose.max.z).toBeCloseTo(w.recessFloor + w.openingHeight - INSERT.travel, 6);
      scene.dispose();
    }
  });

  it('drives each pair of folding wedges to fill the gap', () => {
    const config = { ...WINDOW_INSERT_DEFAULT, attachment: 'folding-wedges' as const };
    const scene = createWindowInsertScene('direct', config); scene.update(installed);
    const l = scene.layout;
    expect(l.clamps.every(clamp => clamp.kind === 'wedge')).toBe(true);
    const wedges = bounds(component(scene, 'folding-wedges'));
    expect(wedges.min.x).toBeCloseTo(-500, 6); expect(wedges.max.z).toBeCloseTo(l.window.recessFloor + 1000, 6);
    // the pair is complementary: fully overlapped it is INSERT.wedge.thickness thick, the gap is 2 mm more
    expect(l.gap - INSERT.wedge.thickness).toBe(2);
    scene.dispose();
  });

  it('builds on a bench, carries the insert into the recess and keeps the window and wall still', () => {
    const scene = createWindowInsertScene('modular', WINDOW_INSERT_DEFAULT);
    const steps = windowInsertSteps('modular', WINDOW_INSERT_DEFAULT);
    expect(steps).toHaveLength(7);
    scene.update({ ...installed, progress: 0 });
    const context = scene.components.filter(part => part.step === 0);
    const positions = context.map(part => part.group.position.toArray());
    for (let progress = 0; progress <= 6; progress++) {
      scene.update({ ...installed, progress, exploded: progress % 2 === 0 });
      expect(context.map(part => part.group.position.toArray())).toEqual(positions);
      for (const part of scene.components) expect(part.group.visible, `${part.id} at ${progress}`).toBe(part.step <= progress);
      // exploded, the insert is shown on the bench, clear of the wall
      expect(scene.insert.position.y).toBe(progress <= 3 || progress % 2 === 0 ? BENCH_OFFSET : 0);
      expect(scene.focusOffset?.()).toEqual([0, scene.insert.position.y, 0]);
    }
    expect(scene.components.map(part => part.id)).toEqual(expect.arrayContaining(['collar-head', 'collar-left', 'corner-screws', 'insert-nuts', 'spreader-clamps', 'bearing-feet', 'port-frame', 'infill-top', 'staples', 'cover-battens', 'cat-gate']));
    scene.update({ ...installed, cutaway: true, hidden: new Set(['mesh']) });
    expect(component(scene, 'wall').visible).toBe(false);
    expect(scene.components.filter(part => part.layer === 'mesh').every(part => !part.group.visible)).toBe(true);
    scene.dispose();
  });

  it('fits each clamp’s hardware in order: Ganter, insert nut and stud from outside, then the two nuts from inside; printed, the screw from inside, its nut and pad from outside', () => {
    // which way each piece comes in, along the clamp's outward normal: +1 from outside, -1 from inside, 0 sideways
    const way: Record<string, number> = { 'insert-nut': 1, foot: 1, 'own-nut': -1, 'second-nut': -1, 'pad-screw': -1, 'pad-nut': 1, pad: 0 };
    for (const variant of variants) for (const config of [WINDOW_INSERT_DEFAULT, ganter]) {
      const scene = createWindowInsertScene(variant, config); scene.update(installed);
      const printed = config.clampPad === 'printed';
      for (const clamp of scene.layout.clamps) {
        const of = (role: string) => scene.motions.find(motion => motion.of === clamp.id && motion.role === role);
        const spreader = printed ? ['insert-nut', 'pad-screw', 'pad-nut', 'pad'] : ['insert-nut', 'foot', 'own-nut', 'second-nut'];
        const chain = (clamp.kind === 'spreader' ? spreader : ['insert-nut', 'foot']).map(role => {
          const motion = of(role); if (!motion) throw new Error(`${clamp.id} ${role}`); return motion;
        });
        for (const [before, after] of chain.slice(1).map((motion, i) => [chain[i], motion] as const)) expect(before?.window[1], `${clamp.id}: ${before?.role} before ${after.role}`).toBeLessThanOrEqual(after.window[0] + 1e-9);
        // the clamp frame's +Y is the outward normal: nut and foot come from outside, the stud's nuts from inside
        const normal = new THREE.Vector3(...clamp.normal);
        for (const motion of chain) {
          const world = motion.approach.clone().applyQuaternion(motion.object.parent?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion()).normalize();
          expect(world.dot(normal), `${clamp.id} ${motion.role}`).toBeCloseTo(way[motion.role ?? ''] ?? NaN, 6);
          // a thrust pad slides on sideways and never turns; everything else turns on the stud's or screw's axis
          if (motion.role === 'pad') expect(motion.axis).toBeUndefined();
          else expect(motion.axis?.toArray(), `${clamp.id} ${motion.role} turns on the stud axis`).toEqual([0, 1, 0]);
        }
      }
      scene.dispose();
    }
  });

  it('drives every screw and staple along its own axis, point first, and shows each piece at rest once its stage is done', () => {
    for (const variant of variants) for (const config of configs) {
      const scene = createWindowInsertScene(variant, config);
      const fasteners = scene.motions.filter(motion => motion.role === 'screw' || motion.role === 'staple');
      expect(fasteners).toHaveLength(scene.layout.fasteners.length);
      for (const motion of fasteners) {
        const drive = new THREE.Vector3(...(motion.drive ?? [0, 0, 0]));
        expect(motion.approach.clone().normalize().dot(drive), motion.action).toBeCloseTo(-1, 6);
        if (motion.role === 'screw') expect(motion.axis?.dot(drive), motion.action).toBeCloseTo(1, 6);
      }
      // pieces of one kind move together: one caption, one window
      const windows = new Map<string, string>();
      for (const motion of scene.motions) {
        const key = `${motion.stage}:${motion.action}`; const window = motion.window.join();
        expect(windows.get(key) ?? window, `${variant} ${motion.action}`).toBe(window); windows.set(key, window);
      }
      expect(new Set(fasteners.map(motion => `${motion.stage}:${motion.action}`)).size).toBeLessThanOrEqual(new Set(scene.layout.fasteners.map(f => `${f.component}:${f.partId}`)).size);
      for (let stage = 1; stage <= 6; stage++) {
        scene.update({ ...installed, progress: stage });
        for (const motion of scene.motions.filter(m => m.stage <= stage)) expect(motion.object.visible, motion.action).toBe(true);
        for (const motion of scene.motions.filter(m => m.stage === stage)) {
          scene.update({ ...installed, progress: stage - 1 + (motion.window[0] + motion.window[1]) / 2 });
          expect(scene.caption?.(), `caption mid ${motion.action}`).not.toBeNull();
        }
      }
      scene.update({ ...installed, exploded: true });
      for (const motion of scene.motions) expect(motion.object.position.length(), motion.action).toBeGreaterThan(0);
      scene.dispose();
    }
  });

  it('lists every piece with real library parts, and changes the cut list with the joint', () => {
    for (const variant of variants) for (const config of configs) {
      const lines = windowInsertBom(variant, config);
      for (const line of lines) {
        expect(line.quantity, line.id).toBeGreaterThan(0);
        if (line.partId) expect(findPart(line.partId), line.partId).toBeDefined();
      }
      const l = windowInsertLayout(variant, config);
      const count = (id: string) => lines.find(line => line.partId === id)?.quantity ?? 0;
      const printed = lines.filter(line => line.modelId === 'pressure-pad');
      if (config.attachment === 'spreader-feet' && l.pad) {
        expect(printed.map(line => [line.id, line.quantity])).toEqual([['thrust-pads', 3 * config.clampsPerSide], ['foot-pads', config.clampsPerSide]]);
        expect(count(l.pad.spreaderScrew.id)).toBe(3 * config.clampsPerSide);
        expect(count(l.pad.bearingScrew.id)).toBe(config.clampsPerSide);
        expect(count('iso-10511-m8')).toBe(3 * config.clampsPerSide);
        expect(count('iso-4032-m8')).toBe(3 * config.clampsPerSide);
        expect(count('din-7965-m8x18')).toBe(4 * config.clampsPerSide);
        expect(lines.some(line => line.partId?.startsWith('ganter'))).toBe(false);
        expect(printed[0]?.size).toBe(`Ø ${config.footDiameter} × ${config.padHeight} mm · ${config.padSurface} sole · PETG · for an ISO 10511 M8 nut`);
      } else if (config.attachment === 'spreader-feet') {
        expect(printed).toEqual([]);
        expect(count(l.spreaderFoot.id)).toBe(3 * config.clampsPerSide);
        expect(count(l.bearingFoot.id)).toBe(config.clampsPerSide);
        expect(count('din-7965-m8x18')).toBe(4 * config.clampsPerSide);
        expect(count('iso-4032-m8')).toBe(3 * config.clampsPerSide);
      } else expect(lines.find(line => line.id === 'folding-wedges')?.quantity).toBe(8 * config.clampsPerSide);
      // the direct sleeve's threshold edges are always stapled; the modular port's mesh lies only on faces a batten can cover
      expect(count('din-1159-2-5x25') > 0).toBe(variant === 'direct' || config.meshFixing !== 'battens');
      expect(count('din-7997-4x35') > 0).toBe(true);
      expect(lines.some(line => line.name.startsWith('Cover batten'))).toBe(config.meshFixing !== 'staples');
      expect(lines.filter(line => line.group === 'Mesh')).toHaveLength(3);
    }
    const lap = windowInsertLayout('direct', WINDOW_INSERT_DEFAULT); const butt = windowInsertLayout('direct', { ...WINDOW_INSERT_DEFAULT, cornerJoint: 'butt-screwed' });
    expect(lap.timber.find(piece => piece.id === 'collar-head')?.length).toBe(lap.W);
    expect(butt.timber.find(piece => piece.id === 'collar-head')?.length).toBe(butt.W - 2 * INSERT.member);
    expect(lap.fasteners.filter(f => f.component === 'corner-screws').every(f => f.partId === 'din-7997-4x50')).toBe(true);
    expect(butt.fasteners.filter(f => f.component === 'corner-screws').every(f => f.partId === 'din-7997-5x70')).toBe(true);
  });

  it('links every library part it can use back to this page in the parts library', () => {
    expect(INSERT.member).toBe(WINDOW_INSERT_FOOT.member);
    expect(WINDOW_INSERT_CONTROLS.find(control => control.key === 'footDiameter')?.options.map(option => option.value)).toEqual([...WINDOW_INSERT_FOOT.diameters]);
    const used = new Set(variants.flatMap(variant => configs.flatMap(config => windowInsertBom(variant, config).flatMap(line => line.partId ? [line.partId] : []))));
    expect([...used].sort()).toEqual([...new Set(windowInsertConcept.parts.map(link => link.partId))].sort());
    for (const id of used) {
      const part = findPart(id); if (!part) throw new Error(id);
      expect(partUsage(part).filter(use => use.kind === 'concept').map(use => use.modelId), id).toContain('catio/window-insert');
    }
  });

  it('gives the modular port the tunnel’s clear size between real timber edges', () => {
    const l = windowInsertLayout('modular', WINDOW_INSERT_DEFAULT);
    expect(l.port).toMatchObject({ width: 300, height: 300 });
    for (const panel of l.panels) expect(panel.edges.length, panel.id).toBeGreaterThan(0);
    // only infill on the port frame's face: the passage beyond it is the tunnel coupling's docking frame, not insert mesh
    expect(l.panels.map(panel => panel.id)).toEqual(['infill-left', 'infill-right', 'infill-top']);
    // the floor the tunnel and the coupling start from, shown here where the clamps set it
    expect(windowInsertFacts('modular', WINDOW_INSERT_DEFAULT).find(f => f.label === 'Cat port floor · above the grass')?.value).toBe(`${Number((l.floor / 10).toFixed(1))} cm`);
    expect(windowInsertFacts('direct', WINDOW_INSERT_DEFAULT).some(f => f.label.startsWith('Cat port floor'))).toBe(false);
    for (const panel of l.panels) expect(panel.plane, panel.id).toBe('xz');
    const tight = { ...windowFor('modular'), tunnel: { width: 450, height: 450 }, sashWidth: 600, sashHeight: 600, openingWidth: 690, openingHeight: 690 };
    expect(validateWindowInsert('modular', WINDOW_INSERT_DEFAULT, tight).length).toBeGreaterThan(0);
  });

  it('restores valid saved settings and drops invalid ones', () => {
    const saved = JSON.stringify({ version: 1, variant: 'modular', config: { ...WINDOW_INSERT_DEFAULT, footDiameter: 40, cornerJoint: 'nailed' }, views: { modular: { progress: 3, view: 'Mounting', hidden: ['mesh', 'bogus'], windowOpen: false } } });
    const settings = parseSubassemblySettings(windowInsertDefinition, saved);
    expect(settings.variant).toBe('modular');
    expect(settings.config.footDiameter).toBe(40);
    expect(settings.config.cornerJoint).toBe('half-lap');
    expect(settings.views.modular).toMatchObject({ progress: 3, view: 'Mounting', hidden: ['mesh'], windowOpen: false });
    expect(parseSubassemblySettings(windowInsertDefinition, '{oops')).toEqual(defaultSubassemblySettings(windowInsertDefinition));
  });
});

describe('parts library previews of the window insert hardware', () => {
  it('builds every new part to its own size', async () => {
    const { parts } = await import('@canfactory/contracts');
    const { partGeometry } = await import('./partGeometry.ts');
    for (const part of parts.filter(p => ['wood-screw', 'nail', 'insert-nut', 'levelling-foot'].includes(p.family))) {
      const geometry = partGeometry(part); if (!geometry) throw new Error(`${part.id} has no preview`);
      geometry.computeBoundingBox(); const size = geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3();
      const height = part.family === 'levelling-foot' ? dimensionOf(part, 'l3') + dimensionOf(part, 'l1') : dimensionOf(part, 'l');
      expect(size.z, part.id).toBeCloseTo(height, 0);
      geometry.dispose();
    }
  });
});
