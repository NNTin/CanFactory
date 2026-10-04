import * as THREE from 'three';
import { CATIO as d, type CatioLayer } from './catioDesign.ts';

type V3 = [number, number, number];
import type { CatioState, MeshPanel } from './catioScene.ts';
interface Component { id: string; group: THREE.Group; step: number; layer?: CatioLayer; offset: V3 }

/** The concept geometry is authored here, independently of the render API and future printable CAD. */
export function createCatioParts() {
  const root = new THREE.Group();
  const components: Component[] = [];
  const panels: MeshPanel[] = [];
  const materials = {
    timber: new THREE.MeshStandardMaterial({ color: '#b98959', roughness: 0.83 }),
    endgrain: new THREE.MeshStandardMaterial({ color: '#cfaa7a', roughness: 0.9 }),
    mesh: new THREE.MeshStandardMaterial({ color: '#535e58', metalness: 0.48, roughness: 0.7 }),
    hardware: new THREE.MeshStandardMaterial({ color: '#66716f', metalness: 0.65, roughness: 0.42 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#363f3b', roughness: 1 }),
    /** Printed parts (PETG), in the parts' green of the model library's drawings. */
    printed: new THREE.MeshStandardMaterial({ color: '#5f7350', roughness: 0.55 }),
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
    parent.add(wires); return parent;
  }

  function update(state: CatioState) {
    for (const part of components) {
      const fraction = part.step === 0 ? 1 : THREE.MathUtils.clamp(state.progress - part.step + 1, 0, 1);
      part.group.visible = fraction > 0 && !(part.layer && state.hidden.has(part.layer)) && !(state.cutaway && part.id === 'wall');
      part.group.position.fromArray(part.offset).multiplyScalar(part.step === 0 ? 0 : state.exploded ? 1 : 1 - fraction);
    }
    root.updateMatrixWorld(true);
  }
  function dispose() {
    const geometries = new Set<THREE.BufferGeometry>();
    root.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add((object as THREE.Mesh).geometry); if (object instanceof THREE.InstancedMesh) object.dispose(); } });
    for (const geometry of geometries) geometry.dispose();
    for (const material of Object.values(materials)) material.dispose();
  }
  return { root, components, panels, materials, component, box, rod, ring, panel, update, dispose };
}
