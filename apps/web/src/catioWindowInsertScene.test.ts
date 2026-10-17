import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dimensionOf, WINDOW_INSERT_FOOT } from '@canfactory/contracts';
import type { CatioState } from './catioScene.ts';
import { parseSubassemblySettings, defaultSubassemblySettings } from './catioSubassembly.ts';
import { windowInsertDefinition } from './catioSubassemblies.ts';
import { BENCH_OFFSET, buildInsertContext, createWindowInsertScene } from './catioWindowInsertScene.ts';
import { createCatioParts } from './catioParts.ts';
import { HOOK_FIT, INSERT, MODULAR_DEFAULT, PAD_HEIGHT, PORT_CLOSURE_DEFAULT, PORT_CLOSURES, TILT_MAX, validateWindowInsert, WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DEFAULT, windowFor, windowFrame, windowInsertBom, windowInsertFacts, windowInsertLayout, windowInsertSteps, type WindowInsertConfig } from '@canfactory/catio';

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
  { ...hung, frameOverlap: 10, cornerJoint: 'half-lap' }] as WindowInsertConfig[]).filter(besideHooks)
  // staples alone hold welded mesh only: a net needs the battens
  .map(config => config.meshFixing === 'staples' ? { ...config, mesh: 'welded' as const } : config);
const component = (scene: ReturnType<typeof createWindowInsertScene>, id: string) => {
  const found = scene.components.find(part => part.id === id); if (!found) throw new Error(`missing ${id}`); return found.group;
};

describe('window insert', () => {

  it('keeps every installed piece outside the sash sweep and inside the recess, for every choice and variant', () => {
    // with tunnel, for either closure of the cat port: the removable panel (the default) and the sliding gate
    for (const variant of variants) for (const closure of variant === 'modular' ? PORT_CLOSURES : [PORT_CLOSURE_DEFAULT]) for (const config of configs) {
      const w = { ...windowFor(variant, config, MODULAR_DEFAULT), closure }; const frame = windowFrame(w);
      expect(validateWindowInsert(variant, config, w), `${variant} ${closure} ${JSON.stringify(config)}`).toEqual([]);
      const scene = createWindowInsertScene(variant, config, w); scene.update(installed);
      const pieces = scene.components.filter(part => part.layer !== 'environment' && part.id !== 'fixed-window-frame' && part.id !== 'opening-sash').map(part => ({ id: part.id, box: bounds(part.group) }));
      // only the hooks (and their screws' tips) reach past the frame's face, behind its lip, and (hung) what closes the port from its
      // room side, into the window opening (a gate's latch; a removable panel's turn buttons and pull): all clear of the closed sash
      const behind = (id: string) => id === 'screen-hooks' || id === 'hook-screws' || (config.attachment === 'frame-hooks' && (id === 'gate-latch' || id === 'port-panel-hardware'));
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
      const scene = createWindowInsertScene(variant, config, windowFor(variant, config, MODULAR_DEFAULT)); const w = windowFor(variant, WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT);
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
    const scene = createWindowInsertScene('direct', config, windowFor('direct', config, MODULAR_DEFAULT)); scene.update(installed);
    const l = scene.layout;
    expect(l.clamps.every(clamp => clamp.kind === 'wedge')).toBe(true);
    const wedges = bounds(component(scene, 'folding-wedges'));
    expect(wedges.min.x).toBeCloseTo(-500, 6); expect(wedges.max.z).toBeCloseTo(l.window.recessFloor + 1000, 6);
    // the pair is complementary: fully overlapped it is INSERT.wedge.thickness thick, the gap is 2 mm more
    expect(l.gap - INSERT.wedge.thickness).toBe(2);
    scene.dispose();
  });

  it('builds on a bench, carries the insert into the recess and keeps the window and wall still', () => {
    const scene = createWindowInsertScene('modular', WINDOW_INSERT_DEFAULT, windowFor('modular', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT));
    const steps = windowInsertSteps('modular', WINDOW_INSERT_DEFAULT, windowFor('modular', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT));
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
    expect(scene.components.map(part => part.id)).toEqual(expect.arrayContaining(['collar-head', 'collar-left', 'corner-screws', 'insert-nuts', 'screen-hooks', 'hook-screws', 'bearing-feet', 'port-frame', 'infill-top', 'staples', 'cover-battens', 'port-panel', 'port-panel-hardware']));
    // a removable panel is the default closure: nothing of the sliding gate is drawn with it
    expect(scene.components.map(part => part.id).filter(id => /gate/.test(id))).toEqual([]);
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
      const scene = createWindowInsertScene(variant, config, windowFor(variant, config, MODULAR_DEFAULT)); scene.update(installed);
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
      const scene = createWindowInsertScene(variant, config, windowFor(variant, config, MODULAR_DEFAULT));
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
        for (const motion of new Map(scene.motions.filter(m => m.stage === stage).map(m => [m.window.join(), m] as const)).values()) {
          scene.update({ ...installed, progress: stage - 1 + (motion.window[0] + motion.window[1]) / 2 });
          expect(scene.caption?.(), `caption mid ${motion.action}`).not.toBeNull();
        }
      }
      scene.update({ ...installed, exploded: true });
      for (const motion of scene.motions) expect(motion.object.position.length(), motion.action).toBeGreaterThan(0);
      scene.dispose();
    }
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
    const { partGeometry } = await import('@canfactory/part-geometry');
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
  const l = windowInsertLayout('direct', hung, windowFor('direct', hung, MODULAR_DEFAULT));
  const frame = windowFrame(l.window);

  it('models the tilt-and-turn window as it is: the frame’s lip over the sash, the seal gap between them', () => {
    // VEKA Softline 82 MD: 73 mm of frame from outside, so a 1000 mm frame's lip leaves 854 mm and covers the 910 mm sash 28 mm a side
    expect(frame.lip.width).toBe(854);
    expect(frame.overlap).toBe(28);
    expect(frame.face - frame.lipBack).toBe(15.5);
    expect(frame.lipBack - frame.sashFace).toBe(3.5);
    // the context draws it so: the fixed frame's face, and the closed sash's face behind the lip and its seal
    const scene = createWindowInsertScene('direct', hung, windowFor('direct', hung, MODULAR_DEFAULT)); scene.update(installed);
    expect(bounds(component(scene, 'fixed-window-frame')).max.y).toBeCloseTo(frame.face, 6);
    expect(bounds(scene.hinge).max.y).toBeCloseTo(frame.sashFace, 6);
    scene.dispose();
    // a lip too narrow to cover the sash is not a window
    expect(validateWindowInsert('direct', { ...hung, frameFace: 50 }, windowFor('direct', { ...hung, frameFace: 50 }, MODULAR_DEFAULT)).join(' ')).toMatch(/covers the sash by only 5 mm/);
  });

  it('is hung, lifted, on the frame and let down onto its feet, and says how', () => {
    const steps = windowInsertSteps('modular', hung, windowFor('modular', hung, MODULAR_DEFAULT));
    expect(steps.map(s => s.title)).toEqual(['Existing window', 'Join the collar', 'Fit the feet and hooks', 'Cat port and infill mesh', 'Hang it on the window frame', 'Level it and close the window', 'Panel and check']);
    expect(windowInsertSteps('modular', hung, { ...windowFor('modular', hung, MODULAR_DEFAULT), closure: 'sliding-gate' }).at(-1)?.title).toBe('Gate and check');
    expect(steps[2]?.detail).toContain('printed for this window’s 15.5 mm lip and 3.5 mm seal gap');
    expect(steps[2]?.detail).toContain(`turns ${l.hookFit?.fromTop} mm below the collar’s top`);
    expect(windowInsertSteps('modular', bought, windowFor('modular', bought, MODULAR_DEFAULT))[2]?.detail).toMatch(/at 16 mm .* two 3 × 16 screws/);
    // the printed hooks take one screw each, and turn on it until it is tightened
    expect(steps[2]?.detail).toMatch(/with one 3 × 20 screw from the room side.*Each turns on its one screw/);
    expect(steps[4]?.detail).toContain(`lift it ${l.hookFit?.lift} mm`);
    const scene = createWindowInsertScene('modular', hung, windowFor('modular', hung, MODULAR_DEFAULT));
    scene.update({ ...installed, progress: 3.5 });
    expect(scene.insert.position.z).toBeCloseTo(l.hookFit?.lift ?? 0, 6);
    expect(scene.caption?.()).toMatch(/long hooks slipped up behind the frame’s head lip/);
    scene.update({ ...installed, progress: 4 });
    expect(scene.insert.position.z).toBe(0);
    scene.update({ ...installed, progress: 1.75 });
    expect(scene.caption?.()).toMatch(/2 × Printed screen hook, long \(head\), 2 × Printed screen hook, short \(sill\): printed for this window/);
    scene.dispose();
    const boughtScene = createWindowInsertScene('modular', bought, windowFor('modular', bought, MODULAR_DEFAULT));
    boughtScene.update({ ...installed, progress: 1.75 });
    expect(boughtScene.caption?.()).toMatch(/Insect screen hook, long .*: bent at 16 mm/);
    boughtScene.dispose();
    expect(windowInsertFacts('direct', hung, windowFor('direct', hung, MODULAR_DEFAULT)).find(f => f.label === 'Hooks · printed for')?.value).toBe('lip 15.5 mm, seal gap 3.5 mm');
    expect(windowInsertFacts('direct', bought, windowFor('direct', bought, MODULAR_DEFAULT)).find(f => f.label === 'Hooks · bent at')?.value).toBe('16 mm');
  });

  it('shows its hooks and feet where another page draws the installed insert', () => {
    const count = (config: WindowInsertConfig) => {
      const p = createCatioParts(); const layout = windowInsertLayout('modular', config, windowFor('modular', config, MODULAR_DEFAULT));
      const { insert } = buildInsertContext(p, layout); let meshes = 0; insert.traverse(o => { if (o instanceof THREE.Mesh) meshes++; });
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

  it('lists the printed brackets, linked to their model, says how they go in, and stages them after the corner screws', () => {
    const lines = windowInsertBom('direct', WINDOW_INSERT_DEFAULT, windowFor('direct', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT));
    const bracket = lines.find(line => line.modelId === 'printed-corner-bracket');
    expect(bracket).toMatchObject({ name: 'Printed corner bracket', quantity: 4, size: '100 × 100 × 20 mm, 5 mm thick · 6 holes for DIN 7997 4 × 35 · PETG (the model’s defaults)' });
    expect(bracket?.partId).toBeUndefined();
    expect(lines.find(line => line.partId === 'din-7997-4x35')?.use).toContain('Corner bracket');
    expect(windowInsertSteps('direct', WINDOW_INSERT_DEFAULT, windowFor('direct', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT))[1]?.detail).toMatch(/100 × 100 printed corner bracket.*chisel it in 5 mm.*all 6 holes with 4 × 35 screws/);
    const scene = createWindowInsertScene('direct', WINDOW_INSERT_DEFAULT, windowFor('direct', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT));
    const at = (role: string) => scene.motions.filter(m => m.action.includes(role)).map(m => m.window[0]);
    scene.update({ ...installed, progress: 0.8 });
    expect(scene.caption?.()).toMatch(/4 × Printed corner bracket: laid into its recess/);
    expect(Math.min(...at('Printed corner bracket'))).toBeGreaterThan(Math.max(...at('Countersunk wood screw 5 × 70')));
    scene.dispose();
  });

  it('lists the bought brackets and their screws, says how they go in, and stages them after the corner screws', () => {
    const lines = windowInsertBom('direct', bought, windowFor('direct', bought, MODULAR_DEFAULT));
    const bracket = lines.find(line => line.partId === 'gah-alberts-stuhlwinkel-100x100x19');
    expect(bracket?.quantity).toBe(4);
    expect(bracket?.size).toContain('GAH Alberts Stuhlwinkel 100 × 100 × 19 mm');
    expect(lines.find(line => line.partId === 'din-7997-5x35')?.quantity).toBe(24);
    expect(windowInsertSteps('direct', bought, windowFor('direct', bought, MODULAR_DEFAULT))[1]?.detail).toMatch(/chisel it in 2 mm.*all 6 holes with 5 × 35 screws/);
    const scene = createWindowInsertScene('direct', bought, windowFor('direct', bought, MODULAR_DEFAULT));
    const at = (role: string) => scene.motions.filter(m => m.action.includes(role)).map(m => m.window[0]);
    scene.update({ ...installed, progress: 0.8 });
    expect(scene.caption?.()).toMatch(/4 × Flat corner bracket 100 × 100 × 19: laid into its recess/);
    expect(Math.min(...at('Flat corner bracket'))).toBeGreaterThan(Math.max(...at('Countersunk wood screw 5 × 70')));
    expect(Math.min(...at('Countersunk wood screw 5 × 35'))).toBeGreaterThan(Math.max(...at('Flat corner bracket')));
    scene.dispose();
  });
});
});
