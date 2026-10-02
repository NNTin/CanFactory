import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dimensionOf, findPart, partUsage, WINDOW_INSERT_FOOT, windowInsertConcept } from '@canfactory/contracts';
import type { CatioState } from './catioScene.ts';
import { parseSubassemblySettings, defaultSubassemblySettings } from './catioSubassembly.ts';
import { windowInsertDefinition } from './catioSubassemblies.ts';
import { INSERT, validateWindowInsert, WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DEFAULT, windowFor, windowInsertBom, windowInsertLayout, windowInsertSteps, type WindowInsertConfig } from './catioWindowInsert.ts';
import { BENCH_OFFSET, createWindowInsertScene } from './catioWindowInsertScene.ts';

const installed: CatioState = { progress: 6, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);
const variants = ['direct', 'modular'] as const;
/** Every value of every control, one at a time, from the defaults. */
const configs: WindowInsertConfig[] = [WINDOW_INSERT_DEFAULT, ...WINDOW_INSERT_CONTROLS.flatMap(control => control.options.map(option => ({ ...WINDOW_INSERT_DEFAULT, [control.key]: option.value })))];
const component = (scene: ReturnType<typeof createWindowInsertScene>, id: string) => {
  const found = scene.components.find(part => part.id === id); if (!found) throw new Error(`missing ${id}`); return found.group;
};

describe('window insert', () => {
  it('sizes the collar from the recess and the chosen clamp', () => {
    const l = windowInsertLayout('direct', WINDOW_INSERT_DEFAULT);
    const foot = findPart('ganter-gn-343-2-32-m8-63-kr'); if (!foot) throw new Error('foot');
    expect(l.spreaderFoot.id).toBe(foot.id);
    expect(l.bearingFoot.id).toBe('ganter-gn-343-2-32-m8-40-kr');
    expect(l.gap).toBe(dimensionOf(foot, 'l3') + INSERT.travel);
    expect([l.W, l.H]).toEqual([1000 - 2 * l.gap, 1000 - 2 * l.gap]);
    expect(windowInsertLayout('direct', { ...WINDOW_INSERT_DEFAULT, attachment: 'folding-wedges' }).W).toBe(1000 - 2 * INSERT.wedgeGap);
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
    for (const variant of variants) {
      const scene = createWindowInsertScene(variant, WINDOW_INSERT_DEFAULT); const w = windowFor(variant);
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
      expect(scene.insert.position.y).toBe(progress <= 3 ? BENCH_OFFSET : 0);
    }
    expect(scene.components.map(part => part.id)).toEqual(expect.arrayContaining(['collar-head', 'collar-left', 'corner-screws', 'insert-nuts', 'spreader-clamps', 'bearing-feet', 'port-frame', 'infill-top', 'staples', 'cover-battens', 'cat-gate']));
    scene.update({ ...installed, cutaway: true, hidden: new Set(['mesh']) });
    expect(component(scene, 'wall').visible).toBe(false);
    expect(scene.components.filter(part => part.layer === 'mesh').every(part => !part.group.visible)).toBe(true);
    scene.dispose();
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
      if (config.attachment === 'spreader-feet') {
        expect(count(l.spreaderFoot.id)).toBe(3 * config.clampsPerSide);
        expect(count(l.bearingFoot.id)).toBe(config.clampsPerSide);
        expect(count('din-7965-m8x18')).toBe(4 * config.clampsPerSide);
        expect(count('iso-4032-m8')).toBe(3 * config.clampsPerSide);
      } else expect(lines.find(line => line.id === 'folding-wedges')?.quantity).toBe(8 * config.clampsPerSide);
      expect(count('din-1159-2-5x25') > 0).toBe(true); // threshold edges are always stapled
      expect(count('din-7997-4x35') > 0).toBe(true);
      expect(lines.some(line => line.name.startsWith('Cover batten'))).toBe(config.meshFixing !== 'staples');
      expect(lines.filter(line => line.group === 'Mesh')).toHaveLength(variant === 'direct' ? 3 : 6);
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
