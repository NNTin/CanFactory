import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCatioScene, type CatioState } from './catioScene.ts';
import { CATIO, CATIO_DERIVED } from './catioDesign.ts';

const assembled: CatioState = { progress: 6, exploded: false, windowOpen: false, cutaway: false, hidden: new Set() };
const bounds = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object, true);

describe('catio concept geometry', () => {
  it('preserves the measured glass and sash independently of the illustrative fixed frame', () => {
    const scene = createCatioScene(); scene.update(assembled);
    const glass = scene.root.getObjectByName('glass-800');
    if (!glass) throw new Error('Glass geometry missing');
    expect(bounds(glass).getSize(new THREE.Vector3()).toArray()).toEqual([800, 6, 800]);
    const opening = bounds(scene.hinge);
    expect(opening.max.x - opening.min.x).toBe(910);
    expect(opening.max.z - opening.min.z).toBe(910);
    expect(opening.min.z).toBe(200);
    const frame = scene.components.find(part => part.id === 'posts-and-upper-rails');
    if (!frame) throw new Error('Timber frame missing');
    const frameBounds = bounds(frame.group);
    expect(frameBounds.max.x - frameBounds.min.x).toBe(1200);
    expect(frameBounds.max.y - frameBounds.min.y).toBe(1000);
    expect(frameBounds.max.z).toBe(1200);
    scene.dispose();
  });

  it('keeps every installed catio component outside the sash sweep, including its handle', () => {
    const scene = createCatioScene(); scene.update(assembled);
    const installed = scene.components.filter(part => part.step > 0).map(part => ({ id: part.id, box: bounds(part.group) }));
    for (let angle = 0; angle <= 90; angle += 5) {
      scene.hinge.rotation.z = -THREE.MathUtils.degToRad(angle); scene.root.updateMatrixWorld(true);
      const sash = bounds(scene.hinge);
      for (const part of installed) expect(sash.intersectsBox(part.box), `${part.id} intersects sash at ${angle} degrees`).toBe(false);
    }
    scene.dispose();
  });

  it('closes the entire floor perimeter down to grass and links the ramp to the passage', () => {
    const scene = createCatioScene(); scene.update(assembled);
    const floor = scene.panels.find(panel => panel.id === 'continuous-floor');
    expect(floor).toMatchObject({ width: 1200, height: 1000, center: [0, 500, 4], plane: 'xy' });
    const skirts = scene.panels.filter(panel => panel.id.startsWith('floor-skirt'));
    expect(skirts).toHaveLength(4);
    for (const skirt of skirts) expect(skirt.center[2] - skirt.height / 2).toBe(CATIO.floorZ);
    expect(scene.panels.filter(panel => panel.id.startsWith('passage-'))).toHaveLength(3);
    expect(CATIO_DERIVED.rampTop[2]).toBe(CATIO.sill);
    expect(CATIO_DERIVED.rampFoot[2] - CATIO.rampThickness).toBe(CATIO.floorZ);
    const ramp = scene.components.find(part => part.id === 'ramp');
    if (!ramp) throw new Error('Ramp missing');
    const rampBounds = bounds(ramp.group);
    expect(rampBounds.min.z).toBe(CATIO.floorZ);
    expect(rampBounds.max.y - rampBounds.min.y).toBe(CATIO.rampRun);
    scene.dispose();
  });

  it('stages construction while keeping the room, window and grass stationary', () => {
    const scene = createCatioScene(); scene.update(assembled);
    const context = scene.components.filter(part => part.step === 0);
    const positions = context.map(part => part.group.position.toArray());
    for (let progress = 0; progress <= 6; progress++) {
      scene.update({ ...assembled, progress, exploded: true });
      expect(context.map(part => part.group.position.toArray())).toEqual(positions);
      for (const part of scene.components) expect(part.group.visible).toBe(part.step <= progress);
    }
    scene.update({ ...assembled, hidden: new Set(['mesh']), cutaway: true });
    expect(scene.components.filter(part => part.layer === 'mesh').every(part => !part.group.visible)).toBe(true);
    expect(scene.components.find(part => part.id === 'wall')?.group.visible).toBe(false);
    scene.dispose();
  });
});
