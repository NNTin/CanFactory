import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dimensionOf, findPart, modelUsage, partUsage, printedCornerBracket, printedCornerBracketFor, printedScreenHook, validateParameters, WINDOW_INSERT_BRACKETS, WINDOW_INSERT_FOOT, WINDOW_INSERT_MEMBER, windowInsertConcept } from '@canfactory/contracts';
import { fastenerClashes } from './catioSubassembly.ts';
import type { CatioState } from './catioScene.ts';
import { parseSubassemblySettings, defaultSubassemblySettings } from './catioSubassembly.ts';
import { windowInsertDefinition } from './catioSubassemblies.ts';
import { TILT_MAX, windowFrame } from './catioWindow.ts';
import { HOOK_FIT, INSERT, PAD_HEIGHT, validateWindowInsert, WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DEFAULT, windowFor, windowInsertBom, windowInsertFacts, windowInsertLayout, windowInsertSteps, type WindowInsertConfig } from './catioWindowInsert.ts';
import { BENCH_OFFSET, buildInsertContext, createWindowInsertScene } from './catioWindowInsertScene.ts';
import { createCatioParts } from './catioParts.ts';

const installed: CatioState = { progress: 6, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);
const variants = ['direct', 'modular'] as const;
/** Every value of every control, one at a time, from the defaults. */
/** Pressed into the recess by spreader feet, and hung on the window frame (the default). */
const pressed: WindowInsertConfig = { ...WINDOW_INSERT_DEFAULT, attachment: 'spreader-feet' };
const ganter: WindowInsertConfig = { ...pressed, clampPad: 'ganter' };
const hung: WindowInsertConfig = { ...WINDOW_INSERT_DEFAULT, attachment: 'frame-hooks' };
/** Hung on Windhager 03651's bought hooks, bent to the window, and with GAH Alberts' bought steel corner brackets. */
const bought: WindowInsertConfig = { ...hung, screenHook: 'windhager-03651', cornerBracket: 'gah-alberts-stuhlwinkel-100x100x19' };
/** Brackets that would cover a hung insert's screen hooks (too wide, or the head hooks too near the top with 10 mm of overlap): checked on their own. */
const besideHooks = (config: WindowInsertConfig) => config.attachment !== 'frame-hooks' || config.cornerJoint !== 'corner-bracket' || (!/125x125|150x150/.test(config.cornerBracket) && config.frameOverlap > 10);
const configs: WindowInsertConfig[] = ([WINDOW_INSERT_DEFAULT, pressed, ...[WINDOW_INSERT_DEFAULT, pressed].flatMap(base => WINDOW_INSERT_CONTROLS.flatMap(control => control.options.map(option => ({ ...base, [control.key]: option.value })))),
  // the Ganter feet in every size, and the printed pads at their lowest and highest
  ...WINDOW_INSERT_FOOT.diameters.map(footDiameter => ({ ...ganter, footDiameter })), { ...pressed, padHeight: PAD_HEIGHT.min }, { ...pressed, padHeight: PAD_HEIGHT.max, footDiameter: 25 },
  // hung on the window frame: every overlap, the Ganter feet, three feet, the tallest pads, and thin and thick frame lips
  ...[10, 15, 20, 25].map(frameOverlap => ({ ...hung, frameOverlap }) as WindowInsertConfig), { ...hung, clampPad: 'ganter' }, { ...hung, clampsPerSide: 3 },
  { ...hung, padHeight: PAD_HEIGHT.max }, { ...hung, frameLip: 8, sealGap: 4.5 }, { ...hung, frameLip: 35, frameFace: 90, frameDepth: 120 },
  { ...bought, frameLip: 8, sealGap: 4.5 }, { ...bought, frameLip: 12, sealGap: 2.5 }, { ...bought, clampPad: 'ganter' }, { ...hung, frameLip: 12, sealGap: 3 },
  { ...hung, frameOverlap: 10, cornerJoint: 'half-lap' }] as WindowInsertConfig[]).filter(besideHooks);
const component = (scene: ReturnType<typeof createWindowInsertScene>, id: string) => {
  const found = scene.components.find(part => part.id === id); if (!found) throw new Error(`missing ${id}`); return found.group;
};

describe('window insert', () => {
  it('sizes the collar from the printed pads’ height', () => {
    const l = windowInsertLayout('direct', pressed);
    expect(l.pad).toMatchObject({ height: 24.5, diameter: 32, surface: 'grooved' });
    expect(l.gap).toBe(24.5 + INSERT.travel);
    expect(windowInsertLayout('direct', { ...pressed, padHeight: 30 }).W).toBe(1000 - 2 * (30 + INSERT.travel));
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
      const w = windowFor(variant, config); const frame = windowFrame(w);
      const pieces = scene.components.filter(part => part.layer !== 'environment' && part.id !== 'fixed-window-frame' && part.id !== 'opening-sash').map(part => ({ id: part.id, box: bounds(part.group) }));
      // only the hooks (and their screws' tips) reach past the frame's face, behind its lip, and (hung) the gate latch on the port's
      // room side into the window opening: all clear of the closed sash
      const behind = (id: string) => id === 'screen-hooks' || id === 'hook-screws' || (config.attachment === 'frame-hooks' && id === 'gate-latch');
      for (const piece of pieces) {
        if (piece.box.isEmpty()) continue;
        expect(piece.box.min.x, `${variant} ${piece.id}`).toBeGreaterThanOrEqual(-w.openingWidth / 2 - 0.01);
        expect(piece.box.max.x, `${variant} ${piece.id}`).toBeLessThanOrEqual(w.openingWidth / 2 + 0.01);
        expect(piece.box.min.z, `${variant} ${piece.id}`).toBeGreaterThanOrEqual(w.recessFloor - 0.01);
        expect(piece.box.max.z, `${variant} ${piece.id}`).toBeLessThanOrEqual(w.recessFloor + w.openingHeight + 0.01);
        if (behind(piece.id)) expect(piece.box.min.y, `${variant} ${piece.id}`).toBeGreaterThanOrEqual(frame.sashFace + HOOK_FIT.gap - 0.01);
        else expect(piece.box.min.y, `${variant} ${piece.id}`).toBeGreaterThanOrEqual(frame.face - 0.01); // the fixed frame's outer face
      }
      for (let angle = 0; angle <= 90; angle += 10) {
        scene.hinge.rotation.z = -THREE.MathUtils.degToRad(angle); scene.root.updateMatrixWorld(true);
        const sash = bounds(scene.hinge);
        for (const piece of pieces) expect(sash.intersectsBox(piece.box), `${piece.id} meets the sash at ${angle}°`).toBe(false);
      }
      // and tilted (Kipp) as far as its stays let it
      scene.hinge.rotation.z = 0;
      for (let angle = 0; angle <= TILT_MAX; angle += 2) {
        scene.tilt.rotation.x = THREE.MathUtils.degToRad(angle); scene.root.updateMatrixWorld(true);
        const sash = bounds(scene.hinge);
        for (const piece of pieces) expect(sash.intersectsBox(piece.box), `${piece.id} meets the sash tilted ${angle}°`).toBe(false);
      }
      scene.dispose();
    }
  });

  it('presses every spreader pad onto the reveal only once tightened, with the sill feet on the recess floor', () => {
    for (const variant of variants) for (const config of [pressed, ganter]) {
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
    // hung on the window frame, by default: the hooks and their screws, and only the bearing feet
    expect(scene.components.map(part => part.id)).toEqual(expect.arrayContaining(['collar-head', 'collar-left', 'corner-screws', 'insert-nuts', 'screen-hooks', 'hook-screws', 'bearing-feet', 'port-frame', 'infill-top', 'staples', 'cover-battens', 'cat-gate']));
    expect(scene.components.map(part => part.id)).not.toContain('spreader-clamps');
    scene.update({ ...installed, cutaway: true, hidden: new Set(['mesh']) });
    expect(component(scene, 'wall').visible).toBe(false);
    expect(scene.components.filter(part => part.layer === 'mesh').every(part => !part.group.visible)).toBe(true);
    scene.dispose();
  });

  it('fits each clamp’s hardware in order: Ganter, insert nut and stud from outside, then the two nuts from inside; printed, the screw from inside, its nut and pad from outside', () => {
    // which way each piece comes in, along the clamp's outward normal: +1 from outside, -1 from inside, 0 sideways
    const way: Record<string, number> = { 'insert-nut': 1, foot: 1, 'own-nut': -1, 'second-nut': -1, 'pad-screw': -1, 'pad-nut': 1, pad: 0 };
    for (const variant of variants) for (const config of [pressed, ganter]) {
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
      } else if (config.attachment === 'frame-hooks') {
        // feet under the sill rail only, and two long and two short hooks with two screws each
        expect(count('din-7965-m8x18')).toBe(config.clampsPerSide);
        if (l.pad) expect(printed.map(line => [line.id, line.quantity])).toEqual([['foot-pads', config.clampsPerSide]]);
        else expect(count(l.bearingFoot.id)).toBe(config.clampsPerSide);
        const hooks = lines.filter(line => line.modelId === 'printed-screen-hook');
        if (config.screenHook === 'printed') {
          // printed for this window: two long and two short, linked to the model, with their screws from the library
          expect(hooks.map(line => [line.name, line.quantity])).toEqual([['Printed screen hook, long (head)', 2], ['Printed screen hook, short (sill)', 2]]);
          expect(hooks[0]?.size).toContain(`For a ${config.frameLip} mm frame lip and a ${config.sealGap} mm seal gap`);
          expect(count('din-7997-3x20')).toBe(8);
          expect(lines.some(line => line.partId?.startsWith('windhager'))).toBe(false);
        } else {
          expect(hooks).toEqual([]);
          expect([count('windhager-03651-5a'), count('windhager-03651-5b'), count('din-7997-3x16')]).toEqual([2, 2, 8]);
        }
        expect(lines.some(line => line.name === 'Pressure pad, thrust pad' || line.partId === 'iso-10511-m8')).toBe(false);
      } else expect(lines.find(line => line.id === 'folding-wedges')?.quantity).toBe(8 * config.clampsPerSide);
      if (config.attachment !== 'frame-hooks') expect(lines.some(line => line.partId?.startsWith('windhager'))).toBe(false);
      // the direct sleeve's threshold edges are always stapled; the modular port's mesh lies only on faces a batten can cover
      expect(count('din-1159-2-5x25') > 0).toBe(variant === 'direct' || config.meshFixing !== 'battens');
      expect(count('din-7997-4x35') > 0).toBe(true);
      expect(lines.some(line => line.name.startsWith('Cover batten'))).toBe(config.meshFixing !== 'staples');
      expect(lines.filter(line => line.group === 'Mesh')).toHaveLength(3);
      // the corner brackets: printed (linked to the model) or bought (from the library), four either way
      const brackets = lines.filter(line => line.modelId === 'printed-corner-bracket');
      if (config.cornerJoint !== 'corner-bracket') expect(brackets).toEqual([]);
      else if (config.cornerBracket === 'printed') {
        expect(brackets.map(line => line.quantity)).toEqual([4]);
        expect(lines.some(line => line.partId?.startsWith('gah-alberts'))).toBe(false);
      } else expect([brackets.length, count(config.cornerBracket)]).toEqual([0, 4]);
      // every model it prints names this page under “Used by”
      for (const line of lines) if (line.modelId) expect(modelUsage(line.modelId).map(use => use.pageId), line.modelId).toContain('catio/window-insert');
    }
    const lap = windowInsertLayout('direct', { ...WINDOW_INSERT_DEFAULT, cornerJoint: 'half-lap' }); const butt = windowInsertLayout('direct', { ...WINDOW_INSERT_DEFAULT, cornerJoint: 'butt-screwed' });
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
    expect(settings.config.cornerJoint).toBe('corner-bracket');
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

describe('window insert hung on the window frame', () => {
  const l = windowInsertLayout('direct', hung);
  const frame = windowFrame(l.window);

  it('models the tilt-and-turn window as it is: the frame’s lip over the sash, the seal gap between them', () => {
    // VEKA Softline 82 MD: 73 mm of frame from outside, so a 1000 mm frame's lip leaves 854 mm and covers the 910 mm sash 28 mm a side
    expect(frame.lip.width).toBe(854);
    expect(frame.overlap).toBe(28);
    expect(frame.face - frame.lipBack).toBe(15.5);
    expect(frame.lipBack - frame.sashFace).toBe(3.5);
    // the context draws it so: the fixed frame's face, and the closed sash's face behind the lip and its seal
    const scene = createWindowInsertScene('direct', hung); scene.update(installed);
    expect(bounds(component(scene, 'fixed-window-frame')).max.y).toBeCloseTo(frame.face, 6);
    expect(bounds(scene.hinge).max.y).toBeCloseTo(frame.sashFace, 6);
    scene.dispose();
    // a lip too narrow to cover the sash is not a window
    expect(validateWindowInsert('direct', { ...hung, frameFace: 50 }).join(' ')).toMatch(/covers the sash by only 5 mm/);
  });

  it('lies on the frame’s face, overlapping it beyond the lip, and stands on its feet under the sill rail', () => {
    expect(validateWindowInsert('direct', hung)).toEqual([]);
    expect(l.yIn).toBe(frame.face);
    expect(l.W).toBe(854 + 2 * hung.frameOverlap);
    expect(l.z0 + l.H).toBe(frame.lip.top + hung.frameOverlap);
    expect(l.z0).toBe(l.window.recessFloor + 24.5 + INSERT.travel);
    expect(l.clamps.map(c => `${c.side} ${c.kind}`)).toEqual(['sill bearing', 'sill bearing']);
    // the floor the tunnel starts from does not change: the same feet set it
    expect(l.floor).toBe(windowInsertLayout('direct', WINDOW_INSERT_DEFAULT).floor);
  });

  it('reaches behind the lip at the head and the sill, its barbs in the seal gap so that the sash closes over them', () => {
    for (const config of [hung, bought, { ...hung, frameLip: 8, sealGap: 4.5 }, { ...bought, frameLip: 8, sealGap: 4.5 }]) {
    const l = windowInsertLayout('direct', config); const frame = windowFrame(l.window);
    const fit = l.hookFit; if (!fit) throw new Error('no hooks');
    if (config.screenHook === 'printed') {
      expect(l.hooks.map(h => `${h.side} ${h.end} ${h.title}`).sort()).toEqual(['left head Printed screen hook, long (head)', 'left sill Printed screen hook, short (sill)', 'right head Printed screen hook, long (head)', 'right sill Printed screen hook, short (sill)']);
      // made for the window: the barb in the middle of the seal gap, nothing to bend; the model's own default reach behind the lip
      expect(fit.bend).toBeNull();
      for (const h of l.hooks) expect((frame.lipBack - h.barb.outer) - (h.barb.inner - frame.sashFace)).toBeCloseTo(0, 9);
      expect(fit.engage).toEqual({ head: printedScreenHook.defaults['engage'], sill: printedScreenHook.defaults['engage'] });
    } else {
      expect(l.hooks.map(h => `${h.side} ${h.end} ${h.part?.id}`).sort()).toEqual(['left head windhager-03651-5a', 'left sill windhager-03651-5b', 'right head windhager-03651-5a', 'right sill windhager-03651-5b']);
      // bent at the lip plus half the spare seal gap, to 0.5 mm: 15.5 + (3.5 - 0.8) / 2 - 0.8 = 16.05, so 16
      if (config.frameLip === 15.5) expect(fit.bend).toBe(16);
    }
    for (const h of l.hooks) {
      expect(h.barb.outer).toBeLessThanOrEqual(frame.lipBack - HOOK_FIT.gap);
      expect(h.barb.inner).toBeGreaterThanOrEqual(frame.sashFace + HOOK_FIT.gap);
      expect(h.barb.engage).toBeGreaterThanOrEqual(HOOK_FIT.engage);
      // over the lip's opening, in front of the sash, on the stile's part beside it
      expect(Math.abs(h.x)).toBeLessThan(frame.lip.width / 2);
      expect(Math.abs(h.x)).toBeGreaterThan(l.Wi / 2);
      const barb = h.boxes[2]; if (!barb) throw new Error('barb');
      const [bottom, top] = [barb.center[2] - barb.size[2] / 2, barb.center[2] + barb.size[2] / 2];
      if (h.end === 'head') expect(top - frame.lip.top).toBeCloseTo(h.barb.engage, 6);
      else expect(frame.lip.bottom - bottom).toBeCloseTo(h.barb.engage, 6);
    }
    // lifted to hang it, the short hooks clear the sill lip while the long ones stay below the head lip's tip
    expect(fit.lift).toBeCloseTo(fit.engage.sill + HOOK_FIT.clearance, 6);
    expect(fit.headClear).toBeGreaterThan(fit.lift);
    // two screws in each hook, from the room side into the stile
    expect(l.fasteners.filter(f => f.component === 'hook-screws').map(f => f.direction)).toEqual(Array(8).fill([0, 1, 0]));
    expect(validateWindowInsert('direct', config)).toEqual([]);
    }
  });

  it('places the printed hooks as the model makes them for this window, and lists them with the window’s settings', () => {
    for (const config of [hung, { ...hung, frameLip: 8, sealGap: 4.5 }, { ...hung, frameLip: 35, frameFace: 90 }]) {
      const l = windowInsertLayout('direct', config); const fit = l.hookFit; if (!fit) throw new Error('no hooks');
      const parameters = fit.spec.parameters; if (!parameters) throw new Error('printed');
      // the model, set to this window, is valid, and its barbs are where the layout draws them
      expect(parameters).toMatchObject({ ...printedScreenHook.defaults, frameLip: config.frameLip, sealGap: config.sealGap });
      expect(validateParameters(printedScreenHook, parameters)).toEqual([]);
      const head = l.hooks.find(h => h.end === 'head'); const sill = l.hooks.find(h => h.end === 'sill'); if (!head || !sill) throw new Error('hooks');
      const height = (h: typeof head, k: number) => h.boxes[k]?.size[2] ?? 0;
      expect(height(head, 2) - Number(parameters['turnThickness'])).toBeCloseTo(fit.spec.rise.head, 9);
      expect(height(sill, 2) - Number(parameters['turnThickness'])).toBeCloseTo(fit.spec.rise.sill, 9);
      expect(fit.spec.rise.head).toBeCloseTo(2 * (Number(parameters['engage']) + Number(parameters['clearance'])), 9);
      expect(head.boxes[0]?.size).toEqual([parameters['width'], parameters['legThickness'], parameters['legLength']]);
      expect(l.yIn - head.barb.outer).toBeCloseTo(config.frameLip + (config.sealGap - Number(parameters['barbThickness'])) / 2, 9);
      expect(new Set(l.fasteners.filter(f => f.component === 'hook-screws').map(f => f.partId))).toEqual(new Set([parameters['woodScrew']]));
    }
  });

  it('refuses a window the hooks cannot fit, or whose sash would not close over them', () => {
    expect(validateWindowInsert('direct', { ...bought, sealGap: 1.5 }).join(' ')).toMatch(/seal gap \(1.5 mm\) is too narrow for the hooks’ 0.8 mm strip/);
    expect(validateWindowInsert('direct', { ...bought, frameLip: 4 }).join(' ')).toMatch(/hooks bend for a frame lip 5–35 mm thick, not 4 mm/);
    expect(validateWindowInsert('direct', { ...hung, frameLip: 4 }).join(' ')).toMatch(/hooks are made for a frame lip 5–35 mm thick, not 4 mm/);
    // the printed barb is 2 mm: a seal gap under 3 mm is too narrow for it, but not for the bought strip
    expect(validateWindowInsert('direct', { ...hung, sealGap: 2.5 }).join(' ')).toMatch(/seal gap \(2.5 mm\) is too narrow for the printed hooks’ 2 mm barb.*Choose the bought hooks/);
    expect(validateWindowInsert('direct', { ...bought, sealGap: 2.5 })).toEqual([]);
    // the modular cat gate's latch stands behind the collar's back, in front of the sash: a thin lip leaves too little room
    expect(validateWindowInsert('modular', { ...bought, frameLip: 5, sealGap: 2.5 }).join(' ')).toMatch(/gate’s latch needs 13 mm/);
    expect(validateWindowInsert('direct', { ...bought, frameLip: 5, sealGap: 2.5 })).toEqual([]);
    expect(validateWindowInsert('direct', { ...hung, frameLip: 5, sealGap: 3 })).toEqual([]);
  });

  it('is hung, lifted, on the frame and let down onto its feet, and says how', () => {
    const steps = windowInsertSteps('modular', hung);
    expect(steps.map(s => s.title)).toEqual(['Existing window', 'Join the collar', 'Fit the feet and hooks', 'Cat port and infill mesh', 'Hang it on the window frame', 'Level it and close the window', 'Gate and check']);
    expect(steps[2]?.detail).toContain('printed for this window’s 15.5 mm lip and 3.5 mm seal gap');
    expect(steps[2]?.detail).toContain(`turns ${l.hookFit?.fromTop} mm below the collar’s top`);
    expect(windowInsertSteps('modular', bought)[2]?.detail).toMatch(/at 16 mm .* two 3 × 16 screws/);
    expect(steps[4]?.detail).toContain(`lift it ${l.hookFit?.lift} mm`);
    const scene = createWindowInsertScene('modular', hung);
    scene.update({ ...installed, progress: 3.5 });
    expect(scene.insert.position.z).toBeCloseTo(l.hookFit?.lift ?? 0, 6);
    expect(scene.caption?.()).toMatch(/long hooks slipped up behind the frame’s head lip/);
    scene.update({ ...installed, progress: 4 });
    expect(scene.insert.position.z).toBe(0);
    scene.update({ ...installed, progress: 1.75 });
    expect(scene.caption?.()).toMatch(/2 × Printed screen hook, long \(head\), 2 × Printed screen hook, short \(sill\): printed for this window/);
    scene.dispose();
    const boughtScene = createWindowInsertScene('modular', bought);
    boughtScene.update({ ...installed, progress: 1.75 });
    expect(boughtScene.caption?.()).toMatch(/Insect screen hook, long .*: bent at 16 mm/);
    boughtScene.dispose();
    expect(windowInsertFacts('direct', hung).find(f => f.label === 'Hooks · printed for')?.value).toBe('lip 15.5 mm, seal gap 3.5 mm');
    expect(windowInsertFacts('direct', bought).find(f => f.label === 'Hooks · bent at')?.value).toBe('16 mm');
  });

  it('shows its hooks and feet where another page draws the installed insert', () => {
    const count = (config: WindowInsertConfig) => {
      const p = createCatioParts(); const layout = windowInsertLayout('modular', config);
      const insert = buildInsertContext(p, layout); let meshes = 0; insert.traverse(o => { if (o instanceof THREE.Mesh) meshes++; });
      const timber = layout.timber.reduce((n, t) => n + t.boxes.length, 0); p.dispose();
      return meshes - timber;
    };
    // three strips a hook, a stem and a pad a foot; nothing pressed into the recess
    // two plates a corner bracket, three strips a hook, a stem and a pad a foot; only the brackets pressed into the recess
    expect(count(hung)).toBe(2 * 4 + 3 * 4 + 2 * hung.clampsPerSide);
    expect(count(pressed)).toBe(2 * 4);
    expect(count({ ...pressed, cornerJoint: 'half-lap' })).toBe(0);
  });

describe('window insert collar corners with flat corner brackets', () => {
  it('sizes the printed bracket, the default, from the collar’s member, as the model’s defaults are', () => {
    expect(WINDOW_INSERT_DEFAULT.cornerBracket).toBe('printed');
    expect(WINDOW_INSERT_MEMBER).toBe(INSERT.member);
    const size = printedCornerBracketFor(INSERT.member);
    expect(Object.fromEntries(Object.keys(size).map(key => [key, printedCornerBracket.defaults[key]]))).toEqual(size);
    const [bracket] = windowInsertLayout('direct', WINDOW_INSERT_DEFAULT).brackets; if (!bracket) throw new Error('bracket');
    expect(bracket.spec).toMatchObject({ part: null, a: size.legA, b: size.legB, c: size.width, t: size.thickness });
    expect(bracket.spec.screw.id).toBe(printedCornerBracket.defaults['woodScrew']);
    expect(validateParameters(printedCornerBracket, printedCornerBracket.defaults)).toEqual([]);
    // every hole lies past the joint, on the member its leg runs along
    for (const hole of bracket.spec.holes) expect(hole.along).toBeGreaterThan(INSERT.member);
  });

  it('lets a flat corner bracket, printed or bought, into the room-side face of each butt joint, screwed through every hole', () => {
    for (const variant of variants) for (const [config, id, screw, holes] of [[WINDOW_INSERT_DEFAULT, null, 'din-7997-4x35', 6], [pressed, null, 'din-7997-4x35', 6], [bought, 'gah-alberts-stuhlwinkel-100x100x19', 'din-7997-5x35', 6], [{ ...pressed, cornerBracket: 'gah-alberts-stuhlwinkel-100x100x19' }, 'gah-alberts-stuhlwinkel-100x100x19', 'din-7997-5x35', 6]] as const) {
      const l = windowInsertLayout(variant, config);
      expect(l.brackets.map(b => b.spec.part?.id ?? null)).toEqual(Array(4).fill(id));
      for (const b of l.brackets) for (const plate of b.boxes) {
        // flush in the room-side face, within the collar's outline, at most the 40 mm member wide across it
        expect(plate.center[1] - plate.size[1] / 2).toBe(l.yIn);
        expect(Math.abs(plate.center[0]) + plate.size[0] / 2).toBeLessThanOrEqual(l.W / 2 + 1e-9);
        expect(Math.min(plate.size[0], plate.size[2])).toBeLessThanOrEqual(INSERT.member);
      }
      const screws = l.fasteners.filter(f => f.component === 'bracket-screws');
      expect(screws).toHaveLength(4 * holes);
      expect(new Set(screws.map(f => f.partId))).toEqual(new Set([screw]));
      // the corner screws stay, through the stiles into the rails' end grain, and nothing runs into another
      expect(l.fasteners.filter(f => f.component === 'corner-screws').every(f => f.partId === 'din-7997-5x70')).toBe(true);
      expect(fastenerClashes(screws, l.fasteners.filter(f => f.component !== 'bracket-screws'), 6)).toEqual([]);
      expect(validateWindowInsert(variant, config)).toEqual([]);
    }
  });

  it('keeps the brackets clear of a hung insert’s hooks, and offers the larger ones pressed into the recess', () => {
    for (const cornerBracket of WINDOW_INSERT_BRACKETS) {
      expect(validateWindowInsert('direct', { ...pressed, cornerBracket })).toEqual([]);
      const errors = validateWindowInsert('direct', { ...hung, cornerBracket });
      if (/125x125|150x150/.test(cornerBracket)) expect(errors.join(' ')).toMatch(/would lie over the screen hooks/);
      else expect(errors).toEqual([]);
    }
    // with only 10 mm on the frame, the head hooks turn in 17 mm (printed: 18 mm) below the collar's top, under any bracket's rail leg
    expect(validateWindowInsert('direct', { ...hung, frameOverlap: 10 }).join(' ')).toMatch(/more overlap on the frame/);
    expect(validateWindowInsert('direct', { ...bought, frameOverlap: 10 }).join(' ')).toMatch(/more overlap on the frame/);
    expect(validateWindowInsert('direct', { ...hung, frameOverlap: 10, cornerJoint: 'half-lap' })).toEqual([]);
  });

  it('lists the printed brackets, linked to their model, says how they go in, and stages them after the corner screws', () => {
    const lines = windowInsertBom('direct', WINDOW_INSERT_DEFAULT);
    const bracket = lines.find(line => line.modelId === 'printed-corner-bracket');
    expect(bracket).toMatchObject({ name: 'Printed corner bracket', quantity: 4, size: '100 × 100 × 20 mm, 5 mm thick · 6 holes for DIN 7997 4 × 35 · PETG (the model’s defaults)' });
    expect(bracket?.partId).toBeUndefined();
    expect(lines.find(line => line.partId === 'din-7997-4x35')?.use).toContain('Corner bracket');
    expect(windowInsertSteps('direct', WINDOW_INSERT_DEFAULT)[1]?.detail).toMatch(/100 × 100 printed corner bracket.*chisel it in 5 mm.*all 6 holes with 4 × 35 screws/);
    const scene = createWindowInsertScene('direct', WINDOW_INSERT_DEFAULT);
    const at = (role: string) => scene.motions.filter(m => m.action.includes(role)).map(m => m.window[0]);
    scene.update({ ...installed, progress: 0.8 });
    expect(scene.caption?.()).toMatch(/4 × Printed corner bracket: laid into its recess/);
    expect(Math.min(...at('Printed corner bracket'))).toBeGreaterThan(Math.max(...at('Countersunk wood screw 5 × 70')));
    scene.dispose();
  });

  it('lists the bought brackets and their screws, says how they go in, and stages them after the corner screws', () => {
    const lines = windowInsertBom('direct', bought);
    const bracket = lines.find(line => line.partId === 'gah-alberts-stuhlwinkel-100x100x19');
    expect(bracket?.quantity).toBe(4);
    expect(bracket?.size).toContain('GAH Alberts Stuhlwinkel 100 × 100 × 19 mm');
    expect(lines.find(line => line.partId === 'din-7997-5x35')?.quantity).toBe(24);
    expect(windowInsertSteps('direct', bought)[1]?.detail).toMatch(/chisel it in 2 mm.*all 6 holes with 5 × 35 screws/);
    const scene = createWindowInsertScene('direct', bought);
    const at = (role: string) => scene.motions.filter(m => m.action.includes(role)).map(m => m.window[0]);
    scene.update({ ...installed, progress: 0.8 });
    expect(scene.caption?.()).toMatch(/4 × Flat corner bracket 100 × 100 × 19: laid into its recess/);
    expect(Math.min(...at('Flat corner bracket'))).toBeGreaterThan(Math.max(...at('Countersunk wood screw 5 × 70')));
    expect(Math.min(...at('Countersunk wood screw 5 × 35'))).toBeGreaterThan(Math.max(...at('Flat corner bracket')));
    scene.dispose();
  });
});
});
