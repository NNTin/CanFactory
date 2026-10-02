import * as THREE from 'three';
import { CATIO as d, CATIO_DERIVED as g, type CatioLayer } from './catioDesign.ts';

type V3 = [number, number, number];
export interface CatioState { progress: number; exploded: boolean; windowOpen: boolean; cutaway: boolean; hidden: ReadonlySet<CatioLayer> }
interface Component { id: string; group: THREE.Group; step: number; layer?: CatioLayer; offset: V3 }
export interface MeshPanel { id: string; width: number; height: number; center: V3; plane: 'xy' | 'xz' | 'yz' }

/** The concept geometry is authored here, independently of the render API and future printable CAD. */
export function createCatioScene() {
  const root = new THREE.Group();
  const components: Component[] = [];
  const panels: MeshPanel[] = [];
  const materials = {
    timber: new THREE.MeshStandardMaterial({ color: '#b98959', roughness: 0.83 }),
    endgrain: new THREE.MeshStandardMaterial({ color: '#cfaa7a', roughness: 0.9 }),
    mesh: new THREE.MeshStandardMaterial({ color: '#535e58', metalness: 0.48, roughness: 0.7 }),
    hardware: new THREE.MeshStandardMaterial({ color: '#66716f', metalness: 0.65, roughness: 0.42 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#363f3b', roughness: 1 }),
    window: new THREE.MeshStandardMaterial({ color: '#f4f1e7', roughness: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: '#b8d9df', transparent: true, opacity: 0.24, roughness: 0.15, depthWrite: false }),
    wall: new THREE.MeshStandardMaterial({ color: '#d5d0c4', roughness: 1 }),
    soil: new THREE.MeshStandardMaterial({ color: '#716958', roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ color: '#889775', roughness: 1 }),
    blade: new THREE.MeshStandardMaterial({ color: '#697e54', side: THREE.DoubleSide, roughness: 1 }),
    floor: new THREE.MeshStandardMaterial({ color: '#bfb6a5', roughness: 1 }),
  };
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
  function component(id: string, step: number, layer: CatioLayer | undefined, offset: V3 = [0, 0, 0]) {
    const group = new THREE.Group(); group.name = id; root.add(group);
    components.push({ id, group, step, ...(layer ? { layer } : {}), offset });
    return group;
  }
  function box(parent: THREE.Group, size: V3, center: V3, material: THREE.Material = materials.timber) {
    const mesh = new THREE.Mesh(boxGeometry, material);
    mesh.position.fromArray(center); mesh.scale.fromArray(size); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  function rod(parent: THREE.Group, from: V3, to: V3, radius: number, material: THREE.Material = materials.hardware) {
    const a = new THREE.Vector3(...from); const b = new THREE.Vector3(...to); const vector = b.clone().sub(a);
    const mesh = new THREE.Mesh(cylinderGeometry, material);
    mesh.position.copy(a.add(b).multiplyScalar(0.5)); mesh.scale.set(radius, vector.length(), radius);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize()); parent.add(mesh); return mesh;
  }
  function ring(parent: THREE.Group, width: number, height: number, member: number, depth: number, y: number, bottom: number, material: THREE.Material) {
    for (const side of [-1, 1]) box(parent, [member, depth, height], [side * (width - member) / 2, y, bottom + height / 2], material);
    for (const z of [bottom + member / 2, bottom + height - member / 2]) box(parent, [width - 2 * member, depth, member], [0, y, z], material);
  }
  function panel(id: string, step: number, width: number, height: number, center: V3, plane: MeshPanel['plane'], offset: V3) {
    panels.push({ id, width, height, center, plane });
    const parent = component(id, step, 'mesh', offset);
    const positions = (size: number) => {
      const values: number[] = [];
      for (let n = -size / 2; n < size / 2; n += d.meshOpening + d.wire) values.push(n);
      values.push(size / 2); return values;
    };
    const xs = positions(width); const ys = positions(height);
    const wires = new THREE.InstancedMesh(boxGeometry, materials.mesh, xs.length + ys.length);
    const dummy = new THREE.Object3D(); let at = 0;
    for (const x of xs) { dummy.position.set(x, 0, 0); dummy.scale.set(d.wire, height + d.wire, d.wire); dummy.updateMatrix(); wires.setMatrixAt(at++, dummy.matrix); }
    for (const y of ys) { dummy.position.set(0, y, 0); dummy.scale.set(width + d.wire, d.wire, d.wire); dummy.updateMatrix(); wires.setMatrixAt(at++, dummy.matrix); }
    wires.position.fromArray(center);
    if (plane === 'xz') wires.rotation.x = Math.PI / 2;
    if (plane === 'yz') wires.rotation.set(Math.PI / 2, Math.PI / 2, 0);
    parent.add(wires);
  }

  const wall = component('wall', 0, 'environment');
  const opening = d.fixedFrame;
  for (const side of [-1, 1]) box(wall, [550, d.wall, 2000], [side * (opening / 2 + 275), -d.wall / 2, 500], materials.wall);
  box(wall, [opening, d.wall, 345], [0, -d.wall / 2, 1327.5], materials.wall);
  box(wall, [opening, d.wall, 655], [0, -d.wall / 2, -172.5], materials.wall);
  const terrain = component('terrain', 0, 'environment');
  box(terrain, [2200, 1550, 35], [0, 775, -17.5], materials.soil);
  box(terrain, [2200, 1550, 6], [0, 775, -3], materials.grass);
  box(terrain, [2200, 750, 35], [0, -675, -467.5], materials.floor);
  // Deterministic small tufts let the grid and grass remain individually visible.
  const blades = new THREE.InstancedMesh(new THREE.ConeGeometry(3, 18, 3), materials.blade, 1000);
  const bladePose = new THREE.Object3D();
  for (let i = 0; i < 1000; i++) {
    bladePose.position.set(((i * 743) % 2160) - 1080, ((i * 431) % 1510) + 20, 7);
    bladePose.rotation.set(Math.PI / 2, 0, i); bladePose.updateMatrix(); blades.setMatrixAt(i, bladePose.matrix);
  }
  terrain.add(blades);

  const fixed = component('fixed-window-frame', 0, undefined);
  ring(fixed, d.fixedFrame, d.fixedFrame, (d.fixedFrame - d.sash) / 2, 65, -d.recess, g.fixedBottom, materials.window);
  const sash = component('opening-sash', 0, undefined);
  const hinge = new THREE.Group(); hinge.position.set(-d.sash / 2, g.sashY, d.sill); sash.add(hinge);
  const leaf = new THREE.Group(); leaf.position.x = d.sash / 2; hinge.add(leaf);
  ring(leaf, d.sash, d.sash, g.sashBorder, d.sashThickness, 0, 0, materials.window);
  box(leaf, [d.glass, 6, d.glass], [0, 0, d.sash / 2], materials.glass).name = 'glass-800';
  box(leaf, [16, 40, 16], [d.sash / 2 - 30, -45, d.sash / 2], materials.hardware);
  box(leaf, [14, 14, 90], [d.sash / 2 - 30, -65, d.sash / 2 - 35], materials.hardware);
  for (const z of [d.sill + 150, d.sill + d.sash - 150]) rod(fixed, [-d.sash / 2, g.sashY, z - 25], [-d.sash / 2, g.sashY, z + 25], 8);

  const collar = component('recess-collar', 1, 'timber', [0, -420, 160]);
  ring(collar, d.collarOuter, d.collarOuter, d.collarMember, d.collarDepth, d.collarY, d.sill - d.collarMember, materials.timber);
  const clamps = component('padded-clamps', 1, 'hardware', [0, -420, 160]);
  for (const side of [-1, 1]) for (const z of [350, 950]) {
    rod(clamps, [side * 425, d.collarY, z], [side * 496, d.collarY, z], 5);
    box(clamps, [8, 55, 65], [side * 496, d.collarY, z], materials.rubber);
    box(clamps, [10, 24, 50], [side * 425, d.collarY, z], materials.hardware);
  }
  const base = component('base-rails', 2, 'timber', [0, 350, 0]);
  const feet = component('four-legs-and-pads', 2, 'hardware', [0, 350, 0]);
  const t = d.timber; const half = d.width / 2;
  for (const x of [-half + t / 2, half - t / 2]) {
    box(base, [t, d.depth, t], [x, d.depth / 2, 90]);
    for (const y of [t / 2, d.depth - t / 2]) {
      box(feet, [55, 55, 8], [x, y, 4], materials.rubber);
      rod(feet, [x, y, 8], [x, y, 82], 9);
      box(feet, [27, 27, 12], [x, y, 55], materials.hardware);
    }
  }
  for (const y of [t / 2, d.depth - t / 2]) box(base, [d.width - 2 * t, t, t], [0, y, 90]);
  panel('continuous-floor', 2, d.width, d.depth, [0, d.depth / 2, d.floorZ], 'xy', [0, 350, 0]);
  for (const x of [-half, half]) panel(`floor-skirt-side-${x}`, 2, d.depth, 86, [x, d.depth / 2, 47], 'yz', [0, 350, 0]);
  for (const y of [0, d.depth]) panel(`floor-skirt-end-${y}`, 2, d.width, 86, [0, y, 47], 'xz', [0, 350, 0]);
  // Edge covers bridge the mesh floor and its upturned skirt; no raised open perimeter.
  for (const x of [-half + 7, half - 7]) box(base, [14, d.depth, 14], [x, d.depth / 2, 11], materials.endgrain);
  for (const y of [7, d.depth - 7]) box(base, [d.width - 28, 14, 14], [0, y, 11], materials.endgrain);

  const frame = component('posts-and-upper-rails', 3, 'timber', [0, 120, 360]);
  for (const x of [-half + t / 2, half - t / 2]) {
    for (const y of [t / 2, d.depth - t / 2]) box(frame, [t, t, d.height - 112.5], [x, y, (d.height + 112.5) / 2]);
    box(frame, [t, d.depth - 2 * t, t], [x, d.depth / 2, d.height - t / 2]);
    box(frame, [20, d.depth - 2 * t, 35], [x, d.depth / 2, 610], materials.endgrain);
  }
  for (const y of [t / 2, d.depth - t / 2]) box(frame, [d.width - 2 * t, t, t], [0, y, d.height - t / 2]);
  for (const x of [-half + 10, half - 10]) panel(`side-mesh-${x}`, 3, d.depth - t, d.height - 90, [x, d.depth / 2, (d.height + 90) / 2], 'yz', [Math.sign(x) * 320, 0, 180]);

  const back = component('rear-portal-frame', 4, 'timber', [0, 230, 60]);
  for (const x of [-(g.portalWidth + t) / 2, (g.portalWidth + t) / 2]) box(back, [t, t, d.height - 112.5], [x, t / 2, (d.height + 112.5) / 2]);
  for (const z of [d.sill - t / 2, g.portalTop + t / 2]) box(back, [g.portalWidth, t, t], [0, t / 2, z]);
  const sideWidth = (d.width - g.portalWidth) / 2;
  for (const side of [-1, 1]) panel(`rear-side-mesh-${side}`, 4, sideWidth, d.height - 90, [side * (half - sideWidth / 2), 10, (d.height + 90) / 2], 'xz', [0, 230, 60]);
  panel('rear-bottom-mesh', 4, g.portalWidth, d.sill - 90, [0, 10, (d.sill + 90) / 2], 'xz', [0, 230, 60]);
  panel('rear-top-mesh', 4, g.portalWidth, d.height - g.portalTop, [0, 10, (g.portalTop + d.height) / 2], 'xz', [0, 230, 60]);
  const passageStart = d.collarY - d.collarDepth / 2;
  const passageEnd = t;
  const passageDepth = passageEnd - passageStart;
  const passageY = (passageStart + passageEnd) / 2;
  for (const side of [-1, 1]) panel(`passage-side-${side}`, 4, passageDepth, g.portalWidth, [side * g.portalWidth / 2, passageY, d.sill + g.portalWidth / 2], 'yz', [0, 230, 60]);
  panel('passage-roof', 4, g.portalWidth, passageDepth, [0, passageY, g.portalTop], 'xy', [0, 230, 60]);
  box(back, [g.portalWidth, d.rampStartY - passageStart, 18], [0, (passageStart + d.rampStartY) / 2, d.sill - 9], materials.endgrain);
  const brackets = component('exterior-brackets', 4, 'hardware', [0, 230, 60]);
  for (const side of [-1, 1]) for (const z of [350, 950]) {
    box(brackets, [55, 108, 5], [side * 470, -14, z], materials.hardware);
    for (const y of [-60, 27]) rod(brackets, [side * 470, y, z - 5], [side * 470, y, z + 14], 6);
  }

  const ramp = component('ramp', 5, 'timber', [0, 280, 230]);
  const top = new THREE.Vector3(...g.rampTop); const foot = new THREE.Vector3(...g.rampFoot);
  const rampSlope = (foot.z - top.z) / d.rampRun;
  const vertices: number[] = [];
  for (const zOffset of [-d.rampThickness, 0]) for (const point of [top, foot]) for (const x of [-d.rampWidth / 2, d.rampWidth / 2]) vertices.push(x, point.y, point.z + zOffset);
  const rampGeometry = new THREE.BufferGeometry();
  rampGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  rampGeometry.setIndex([0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3, 5, 3, 7, 5]);
  rampGeometry.computeVertexNormals(); const rampMesh = new THREE.Mesh(rampGeometry, materials.endgrain); rampMesh.castShadow = true; ramp.add(rampMesh);
  for (let run = 90; run < d.rampRun; run += 100) {
    const cleat = box(ramp, [d.rampWidth, 18, 8], [0, top.y + run, top.z + run * rampSlope + 4]);
    cleat.rotation.x = Math.atan(rampSlope);
  }
  panel('mesh-roof', 5, d.width - t, d.depth - t, [0, d.depth / 2, d.height - 10], 'xy', [0, 0, 430]);
  const roof = component('roof-edge-battens', 5, 'timber', [0, 0, 430]);
  for (const x of [-half + 15, half - 15]) box(roof, [30, d.depth, 15], [x, d.depth / 2, d.height - 7.5], materials.endgrain);
  for (const y of [15, d.depth - 15]) box(roof, [d.width - 60, 30, 15], [0, y, d.height - 7.5], materials.endgrain);
  const door = component('maintenance-door', 5, 'timber', [0, 420, 0]);
  ring(door, d.width - 2 * t - 6, d.height - 112.5 - t - 6, 40, 30, d.depth - 22.5, 115.5, materials.timber);
  panel('door-mesh', 5, d.width - 2 * t, d.height - 112.5 - t, [0, d.depth - 21, (d.height - t + 112.5) / 2], 'xz', [0, 420, 0]);
  const doorHardware = component('door-hinges-and-latch', 5, 'hardware', [0, 420, 0]);
  for (const z of [280, 1000]) box(doorHardware, [80, 8, 32], [-half + t, d.depth - 2, z], materials.hardware);
  box(doorHardware, [90, 12, 24], [half - t, d.depth - 2, 630], materials.hardware);
  rod(doorHardware, [half - t, d.depth + 2, 615], [half - t, d.depth + 2, 645], 7, materials.rubber);

  function update(state: CatioState) {
    for (const part of components) {
      const fraction = part.step === 0 ? 1 : THREE.MathUtils.clamp(state.progress - part.step + 1, 0, 1);
      part.group.visible = fraction > 0 && !(part.layer && state.hidden.has(part.layer)) && !(state.cutaway && part.id === 'wall');
      part.group.position.fromArray(part.offset).multiplyScalar(part.step === 0 ? 0 : state.exploded ? 1 : 1 - fraction);
    }
    hinge.rotation.z = state.windowOpen ? -Math.PI / 2 : 0;
    root.updateMatrixWorld(true);
  }
  function dispose() {
    const geometries = new Set<THREE.BufferGeometry>();
    root.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add((object as THREE.Mesh).geometry); if (object instanceof THREE.InstancedMesh) object.dispose(); } });
    for (const geometry of geometries) geometry.dispose();
    for (const material of Object.values(materials)) material.dispose();
  }
  return { root, hinge, components, panels, update, dispose };
}
