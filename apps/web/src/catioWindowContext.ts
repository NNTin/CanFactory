import * as THREE from 'three';
import type { createCatioParts } from './catioParts.ts';

/** The existing surroundings every catio sub-assembly is fitted to: wall with its window opening, fixed frame, inward sash, grass and room floor. */
export interface WindowContextSpec {
  glassWidth: number; glassHeight: number; sashWidth: number; sashHeight: number;
  openingWidth: number; openingHeight: number; recessFloor: number; sill: number; sashY: number;
}

/** Builds the stationary context (step 0) and returns the sash's hinge, which `windowOpen` turns. */
export function buildWindowContext(parts: ReturnType<typeof createCatioParts>, w: WindowContextSpec, ground = { width: 2600, depth: 1500 }) {
  const { component, box, ring, materials: m } = parts;
  const wallTop = w.recessFloor + w.openingHeight + 500; const wallBottom = -650; const side = (ground.width - w.openingWidth) / 2;
  const wall = component('wall', 0, 'environment');
  for (const s of [-1, 1]) box(wall, [side, 300, wallTop - wallBottom], [s * (w.openingWidth + side) / 2, -150, (wallTop + wallBottom) / 2], m.wall);
  box(wall, [w.openingWidth, 300, w.recessFloor - wallBottom], [0, -150, (w.recessFloor + wallBottom) / 2], m.wall);
  box(wall, [w.openingWidth, 300, wallTop - w.recessFloor - w.openingHeight], [0, -150, (wallTop + w.recessFloor + w.openingHeight) / 2], m.wall);
  const terrain = component('terrain', 0, 'environment');
  box(terrain, [ground.width, ground.depth, 35], [0, ground.depth / 2, -17.5], m.soil);
  box(terrain, [ground.width, ground.depth, 6], [0, ground.depth / 2, -3], m.grass);
  box(terrain, [ground.width, 900, 35], [0, -750, wallBottom + 182.5], m.floor);
  const blades = new THREE.InstancedMesh(new THREE.ConeGeometry(3, 18, 3), m.blade, 700);
  const pose = new THREE.Object3D();
  for (let i = 0; i < blades.count; i++) {
    pose.position.set(((i * 743) % (ground.width - 40)) - ground.width / 2 + 20, ((i * 431) % (ground.depth - 40)) + 20, 7);
    pose.rotation.set(Math.PI / 2, 0, i); pose.updateMatrix(); blades.setMatrixAt(i, pose.matrix);
  }
  terrain.add(blades);
  const fixed = component('fixed-window-frame', 0, undefined);
  const frame = (w.openingWidth - w.sashWidth) / 2;
  ring(fixed, w.openingWidth, w.openingHeight, frame, 65, -150, w.recessFloor, m.window);
  const sash = component('opening-sash', 0, undefined);
  const hinge = new THREE.Group(); hinge.position.set(-w.sashWidth / 2, w.sashY, w.sill); sash.add(hinge);
  const leaf = new THREE.Group(); leaf.position.x = w.sashWidth / 2; hinge.add(leaf);
  const bx = (w.sashWidth - w.glassWidth) / 2; const bz = (w.sashHeight - w.glassHeight) / 2;
  for (const s of [-1, 1]) box(leaf, [bx, 60, w.sashHeight], [s * (w.sashWidth - bx) / 2, 0, w.sashHeight / 2], m.window);
  for (const z of [bz / 2, w.sashHeight - bz / 2]) box(leaf, [w.glassWidth, 60, bz], [0, 0, z], m.window);
  box(leaf, [w.glassWidth, 6, w.glassHeight], [0, 0, w.sashHeight / 2], m.glass).name = 'context-glass';
  box(leaf, [14, 24, 85], [w.sashWidth / 2 - bx / 2, -42, w.sashHeight / 2], m.hardware);
  return { hinge };
}
