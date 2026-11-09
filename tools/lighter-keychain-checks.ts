import assert from 'node:assert/strict';
import { keychainLighterPlanX, LIGHTER_KEYCHAIN, lighterKeychainLayout, type MagneticLighterKeychainParameters } from '@canfactory/contracts';
import { bounds, type Mesh } from './stl-to-scad/stl.ts';

/** The real-render checks of the magnetic lighter keychain's four prints (tools/test-renderer.ts), given its mesh helpers. */
export const LIGHTER_KEYCHAIN_PARTS = ['lighter-fit-check', 'keychain-fit-check', 'keychain-holder', 'lighter-holder'] as const;

/**
 * Each print is one closed solid at the layout's size, the holders with a sealed cavity per magnet (so 3 shells). Inside: the
 * cavities empty between a solid skin and a solid cap; the bore empty, the crush ribs standing in the gap between the lighter's
 * plan and the bore, the bore clear between them; the eyelet's hole open and its bridge solid; the keychain fit check's pockets
 * open at the top, and its eyelet sample's hole open.
 */
export function checkLighterKeychain(mesh: (id: typeof LIGHTER_KEYCHAIN_PARTS[number]) => Mesh, p: MagneticLighterKeychainParameters, name: string,
  shells: (mesh: Mesh) => number, solid: (mesh: Mesh, point: [number, number, number]) => boolean) {
  const l = lighterKeychainLayout(p), k = LIGHTER_KEYCHAIN;
  const near = (actual: number, expected: number, what: string, within = 0.02) => assert.ok(Math.abs(actual - expected) < within, `lighter keychain ${name} ${what}: ${actual} != ${expected}`);
  const size = (m: Mesh) => { const b = bounds(m); return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]] as const; };
  const holder = mesh('lighter-holder'), plate = mesh('keychain-holder'), ring = mesh('lighter-fit-check'), floor = mesh('keychain-fit-check');
  assert.equal(shells(holder), 1 + k.magnets, `lighter keychain ${name}: the lighter holder is one solid with a sealed cavity per magnet`);
  assert.equal(shells(plate), 1 + k.magnets, `lighter keychain ${name}: the keychain holder is one solid with a sealed cavity per magnet`);
  assert.equal(shells(ring), 1, `lighter keychain ${name}: the lighter fit check is one solid`);
  assert.equal(shells(floor), 1, `lighter keychain ${name}: the keychain fit check is one solid (its pockets open)`);
  // the outline is the plan grown by fit + wall (the plan's 96-gon is a hair inside its curve at the ends of Y)
  for (const [id, m, z] of [['lighter holder', holder, l.top], ['keychain holder', plate, l.plateHeight], ['lighter fit check', ring, k.checkHeight]] as const) {
    const [x, y, h] = size(m);
    near(x, 2 * l.outlineX, `${id} width`); near(y, 2 * l.outlineY, `${id} length`); near(h, z, `${id} height`);
  }
  const [fx, fy, fz] = size(floor);
  near(fx, 2 * l.outlineX, 'keychain fit check width'); near(fy, 2 * l.outlineY + l.eyeZ + l.eyeR, 'keychain fit check length'); near(fz, Math.max(l.pause, k.eyeThickness), 'keychain fit check height');
  const midCavity = (l.skin + l.pause) / 2, gap = keychainLighterPlanX(k.ribY) + p.fit / 2;
  for (const s of [1, -1]) {
    for (const [id, m] of [['lighter holder', holder], ['keychain holder', plate]] as const) {
      assert.equal(solid(m, [0, s * l.magnetY, midCavity]), false, `lighter keychain ${name}: ${id}'s cavity at ${s}`);
      assert.equal(solid(m, [0, s * l.magnetY, l.skin / 2]), true, `lighter keychain ${name}: ${id}'s skin under the magnet`);
      assert.equal(solid(m, [0, s * l.magnetY, l.pause + k.cap / 2]), true, `lighter keychain ${name}: ${id}'s cap over the magnet`);
    }
    assert.equal(solid(floor, [0, s * l.magnetY, l.pause - 0.01]), false, `lighter keychain ${name}: keychain fit check's pocket open at the top`);
    assert.equal(solid(floor, [0, s * l.magnetY, l.skin / 2]), true, `lighter keychain ${name}: keychain fit check's skin`);
    // the ribs, on both flat faces, and the bore clear between them
    for (const [m, z] of [[holder, l.floor + p.sleeveDepth / 2], [ring, k.checkHeight / 2]] as const) {
      assert.equal(solid(m, [s * gap, k.ribY, z]), true, `lighter keychain ${name}: crush rib at ${s}`);
      assert.equal(solid(m, [s * gap, 0, z]), false, `lighter keychain ${name}: bore between the ribs at ${s}`);
      assert.equal(solid(m, [s * (l.outlineX - p.wall / 2), 0, z]), true, `lighter keychain ${name}: wall at ${s}`);
    }
  }
  assert.equal(solid(holder, [0, 0, l.floor / 2]), true, `lighter keychain ${name}: the foot between the magnets`);
  assert.equal(solid(holder, [0, 0, l.floor + 1]), false, `lighter keychain ${name}: the bore down to the foot`);
  assert.equal(solid(holder, [0, 0, l.top - 0.1]), false, `lighter keychain ${name}: the sleeve's mouth`);
  assert.equal(solid(ring, [0, 0, k.checkHeight / 2]), false, `lighter keychain ${name}: the fit check's bore`);
  // the eyelet: upright on the plate's back, its hole along X; and its flat sample beyond the fit check's +Y end
  assert.equal(solid(plate, [0, 0, l.floor + l.eyeZ]), false, `lighter keychain ${name}: the eyelet's hole`);
  assert.equal(solid(plate, [0, 0, l.floor + l.eyeZ + l.hole / 2 + k.eyeWall / 2]), true, `lighter keychain ${name}: the eyelet's bridge`);
  assert.equal(solid(plate, [0, 0, l.floor + k.eyeBase / 2]), true, `lighter keychain ${name}: the eyelet's base`);
  assert.equal(solid(floor, [0, l.outlineY + l.eyeZ, k.eyeThickness / 2]), false, `lighter keychain ${name}: the eyelet sample's hole`);
  assert.equal(solid(floor, [0, l.outlineY + l.eyeZ + l.hole / 2 + k.eyeWall / 2, k.eyeThickness / 2]), true, `lighter keychain ${name}: the eyelet sample's bridge`);
}
