import * as THREE from 'three';
import { toggleLatchMechanism as M } from '@canfactory/contracts';

const G = M.TOGGLE_LATCH_GEOMETRY, P = M.TOGGLE_LATCH_PROFILES;
/** The printed parts' filament colours, as the toggle latch model suggests them. */
const COLOURS = { base: '#5f7350', catch: '#5f7350', lever: '#d98460', link: '#3f6ea6' } as const;
export type ToggleLatchPartId = keyof typeof COLOURS;

const shape = (points: M.Vec2[], holes: [M.Vec2, number][] = []) => {
  const outline = new THREE.Shape(points.map(([a, b]) => new THREE.Vector2(a, b)));
  for (const [[cx, cy], r] of holes) { const hole = new THREE.Path(); hole.absarc(cx, cy, r, 0, Math.PI * 2, true); outline.holes.push(hole); }
  return outline;
};

/**
 * The printed toggle latch's four parts as meshes, each in its own SCAD frame (the frame its STL is in, so that `latchPoses`
 * places it): the same side profiles (`TOGGLE_LATCH_PROFILES`) extruded over the same widths as the SCAD files. Their 0.6 mm
 * edge chamfers and the screw holes are left out. `dispose` frees the geometries and materials.
 */
export function buildToggleLatchMeshes() {
  const geometries: THREE.BufferGeometry[] = [];
  const materials = Object.fromEntries(Object.entries(COLOURS).map(([id, color]) => [id, new THREE.MeshStandardMaterial({ color, roughness: 0.6 })])) as Record<ToggleLatchPartId, THREE.MeshStandardMaterial>;
  const add = (parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material) => {
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  /** A profile extruded from w0 to w1 along the part's width axis: x for the plates (profile in y, z), y for the lever and link (x, z). */
  const slab = (parent: THREE.Group, profile: THREE.Shape, w0: number, w1: number, axis: 'x' | 'y', material: THREE.Material) => {
    const geometry = new THREE.ExtrudeGeometry(profile, { depth: w1 - w0, bevelEnabled: false, curveSegments: 18 });
    // shape (s, t) extruded along e: x = w0 + e, y = s, z = t; or x = s, y = w1 - e, z = t (both rotations, not mirrors)
    geometry.applyMatrix4(axis === 'x' ? new THREE.Matrix4().set(0, 0, 1, w0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1)
      : new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, w1, 0, 1, 0, 0, 0, 0, 0, 1));
    return add(parent, geometry, material);
  };
  const pin = (parent: THREE.Group, centre: [number, number, number], axis: 'x' | 'y', length: number, diameter: number, material: THREE.Material) => {
    const geometry = new THREE.CylinderGeometry(diameter / 2, diameter / 2, length, 24);
    if (axis === 'x') geometry.rotateZ(Math.PI / 2);
    geometry.translate(...centre);
    return add(parent, geometry, material);
  };

  const base = new THREE.Group(); base.name = 'toggle-latch-base';
  slab(base, shape(M.BASE_PLATE_SECTION), 0, G.base.length, 'x', materials.base);
  slab(base, shape(P.baseKnuckle), G.base.knuckle[0], G.base.knuckle[1], 'x', materials.base);
  const [p0, p1] = G.base.pins;
  pin(base, [(p0 + p1) / 2, G.base.pivot[0], G.base.pivot[1]], 'x', p1 - p0, G.base.pinDiameter, materials.base);

  const catchPart = new THREE.Group(); catchPart.name = 'toggle-latch-catch';
  slab(catchPart, shape(M.CATCH_PLATE_SECTION), 0, G.catch.length, 'x', materials.catch);
  slab(catchPart, shape(P.catchHook), G.catch.hook[0], G.catch.hook[1], 'x', materials.catch);

  const L = G.lever;
  const lever = new THREE.Group(); lever.name = 'toggle-latch-lever';
  const leverSide = shape(P.leverSide, [[L.pivot, L.pivotDiameter / 2]]);
  for (const y0 of [L.pinLength, L.width - L.pinLength - L.side]) slab(lever, leverSide, y0, y0 + L.side, 'y', materials.lever);
  slab(lever, shape(P.leverBridge), L.pinLength + L.side, L.width - L.pinLength - L.side, 'y', materials.lever);
  for (const y of [L.pinLength / 2, L.width - L.pinLength / 2]) pin(lever, [L.pin[0], y, L.pin[1]], 'y', L.pinLength, L.pinDiameter, materials.lever);

  const K = G.link;
  const link = new THREE.Group(); link.name = 'toggle-latch-link';
  const linkSide = shape(P.linkSide, [[K.hole, K.holeDiameter / 2]]);
  for (const y0 of [0, K.width - K.side]) slab(link, linkSide, y0, y0 + K.side, 'y', materials.link);
  slab(link, shape(P.linkBar), K.side, K.width - K.side, 'y', materials.link);

  return {
    base, catch: catchPart, lever, link,
    dispose() { for (const geometry of geometries) geometry.dispose(); for (const material of Object.values(materials)) material.dispose(); },
  };
}

/** Places a part's mesh at its pose in the latch's own frame (`latchPoses`: x across the latch, y along the pull, z off the face). */
export function placeLatchPart(object: THREE.Object3D, pose: M.LatchPose) {
  object.position.set(...pose.position);
  const [rx, ry, rz] = pose.rotation.map(THREE.MathUtils.degToRad) as [number, number, number];
  object.rotation.set(rx, ry, rz, 'ZYX');
}
