import * as THREE from 'three';
import type { createCatioParts } from './catioParts.ts';
import { windowFrame, type WindowShape } from './catioWindow.ts';

/** The existing surroundings every catio sub-assembly is fitted to: wall with its window opening, the tilt-and-turn window's fixed frame and sash (catioWindow.ts), grass and room floor. */
export interface WindowContextSpec extends WindowShape { glassWidth: number; glassHeight: number }

/**
 * Builds the stationary context (step 0) and returns the sash's hinge, which `windowOpen` turns, and its tilt. Without `terrain`, the caller
 * draws its own ground outside (e.g. uneven ground under a tunnel); the room floor is still drawn.
 */
export function buildWindowContext(parts: ReturnType<typeof createCatioParts>, w: WindowContextSpec, ground = { width: 2600, depth: 1500 }, terrainOutside = true) {
  const { component, box, ring, materials: m } = parts;
  const wallTop = w.recessFloor + w.openingHeight + 500; const wallBottom = -650; const side = (ground.width - w.openingWidth) / 2;
  const wall = component('wall', 0, 'environment');
  for (const s of [-1, 1]) box(wall, [side, 300, wallTop - wallBottom], [s * (w.openingWidth + side) / 2, -150, (wallTop + wallBottom) / 2], m.wall);
  box(wall, [w.openingWidth, 300, w.recessFloor - wallBottom], [0, -150, (w.recessFloor + wallBottom) / 2], m.wall);
  box(wall, [w.openingWidth, 300, wallTop - w.recessFloor - w.openingHeight], [0, -150, (wallTop + w.recessFloor + w.openingHeight) / 2], m.wall);
  const terrain = component(terrainOutside ? 'terrain' : 'room-floor', 0, 'environment');
  box(terrain, [ground.width, 900, 35], [0, -750, wallBottom + 182.5], m.floor);
  if (terrainOutside) {
    box(terrain, [ground.width, ground.depth, 35], [0, ground.depth / 2, -17.5], m.soil);
    box(terrain, [ground.width, ground.depth, 6], [0, ground.depth / 2, -3], m.grass);
    const blades = new THREE.InstancedMesh(new THREE.ConeGeometry(3, 18, 3), m.blade, 700);
    const pose = new THREE.Object3D();
    for (let i = 0; i < blades.count; i++) {
      pose.position.set(((i * 743) % (ground.width - 40)) - ground.width / 2 + 20, ((i * 431) % (ground.depth - 40)) + 20, 7);
      pose.rotation.set(Math.PI / 2, 0, i); pose.updateMatrix(); blades.setMatrixAt(i, pose.matrix);
    }
    terrain.add(blades);
  }
  // The fixed frame in section: its outer lip (frameFace wide, frameLip thick) overlaps the sash; its body behind stops the Falzluft
  // short of the sash's edge; the outer seal fills the gap between the lip's back and the closed sash, just outside the lip's tips.
  const f = windowFrame(w); const { sealGap, frameDepth } = w.profile;
  const fixed = component('fixed-window-frame', 0, undefined);
  const frameBox = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: THREE.Material) =>
    box(fixed, [x1 - x0, y1 - y0, z1 - z0], [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], material);
  const ow = w.openingWidth / 2; const lw = f.lip.width / 2; const fz = w.recessFloor;
  for (const [x0, x1] of [[-ow, -lw], [lw, ow]] as const) frameBox(x0, x1, f.lipBack, f.face, fz, f.top, m.window);
  for (const [z0, z1] of [[fz, f.lip.bottom], [f.lip.top, f.top]] as const) frameBox(-lw, lw, f.lipBack, f.face, z0, z1, m.window);
  const bw = f.body.width;
  for (const s of [-1, 1]) frameBox(s < 0 ? -ow : ow - bw, s < 0 ? -ow + bw : ow, f.back, f.lipBack, fz, f.top, m.window);
  frameBox(-ow + bw, ow - bw, f.back, f.lipBack, fz, fz + f.body.bottom, m.window);
  frameBox(-ow + bw, ow - bw, f.back, f.lipBack, f.top - f.body.top, f.top, m.window);
  const seal = 5;
  ring(fixed, f.lip.width + 2 * seal, f.lip.top - f.lip.bottom + 2 * seal, seal, sealGap, f.lipBack - sealGap / 2, f.lip.bottom - seal, m.rubber);
  // The sash turns on its hinge side about a vertical axis at its room-side face, and tilts about its sill edge there (Dreh-Kipp).
  const sash = component('opening-sash', 0, undefined);
  const hinge = new THREE.Group(); hinge.position.set(-w.sashWidth / 2, f.sash.room, w.sill); sash.add(hinge);
  const tilt = new THREE.Group(); hinge.add(tilt);
  const leaf = new THREE.Group(); leaf.position.set(w.sashWidth / 2, frameDepth / 2, 0); tilt.add(leaf);
  const bx = (w.sashWidth - w.glassWidth) / 2; const bz = (w.sashHeight - w.glassHeight) / 2;
  for (const s of [-1, 1]) box(leaf, [bx, frameDepth, w.sashHeight], [s * (w.sashWidth - bx) / 2, 0, w.sashHeight / 2], m.window);
  for (const z of [bz / 2, w.sashHeight - bz / 2]) box(leaf, [w.glassWidth, frameDepth, bz], [0, 0, z], m.window);
  box(leaf, [w.glassWidth, 6, w.glassHeight], [0, 0, w.sashHeight / 2], m.glass).name = 'context-glass';
  box(leaf, [14, 24, 85], [w.sashWidth / 2 - bx / 2, -frameDepth / 2 - 12, w.sashHeight / 2], m.hardware);
  return { hinge, tilt };
}
