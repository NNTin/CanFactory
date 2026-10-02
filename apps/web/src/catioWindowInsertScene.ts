import * as THREE from 'three';
import { dimensionOf, findPart } from '@canfactory/contracts';
import { createCatioParts } from './catioParts.ts';
import type { CatioState } from './catioScene.ts';
import type { CatioMode } from './catioSettings.ts';
import type { SubassemblyModel, V3 } from './catioSubassembly.ts';
import { buildWindowContext } from './catioWindowContext.ts';
import { INSERT, windowFor, windowInsertLayout, type Clamp, type WindowInsertConfig, type WindowSpec } from './catioWindowInsert.ts';

/** Stages 1–3 are built on a bench this far out in the garden; stage 4 carries the insert into the recess. */
export const BENCH_OFFSET = 900;

const along = (progress: number, stage: number) => THREE.MathUtils.clamp(progress - stage + 1, 0, 1);

/** The window insert in its window: every piece of `windowInsertLayout`, staged as `windowInsertSteps` describes. */
export function createWindowInsertScene(variant: CatioMode, config: WindowInsertConfig, window: WindowSpec = windowFor(variant)): SubassemblyModel & { layout: ReturnType<typeof windowInsertLayout>; insert: THREE.Group } {
  const layout = windowInsertLayout(variant, config, window);
  const p = createCatioParts(); const { component, box, rod, panel, materials: m } = p;
  const { hinge } = buildWindowContext(p, window);
  const insert = new THREE.Group(); insert.name = 'window-insert'; p.root.add(insert);
  const first = p.components.length;
  const hexGeometry = new THREE.CylinderGeometry(1, 1, 1, 6);
  const discGeometry = new THREE.CylinderGeometry(1, 1, 1, 24);
  /** A cylinder from `from` to `to` (local Y up), `sides` 6 for a hexagon. */
  const cylinder = (parent: THREE.Object3D, from: V3, to: V3, radius: number, material: THREE.Material, hex = false) => {
    const a = new THREE.Vector3(...from); const b = new THREE.Vector3(...to); const v = b.clone().sub(a);
    const mesh = new THREE.Mesh(hex ? hexGeometry : discGeometry, material);
    mesh.position.copy(a.add(b).multiplyScalar(0.5)); mesh.scale.set(radius, v.length(), radius);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); mesh.castShadow = true; parent.add(mesh); return mesh;
  };

  // Exploded, the pieces fan out of the recess towards the garden in assembly order, the collar members also apart.
  const explode: Record<string, V3> = {
    'collar-head': [0, 220, 200], 'collar-sill': [0, 220, -120], 'collar-left': [-200, 220, 0], 'collar-right': [200, 220, 0], 'corner-screws': [0, 330, 0],
    'insert-nuts': [0, 300, 0], 'spreader-clamps': [0, 420, 0], 'bearing-feet': [0, 420, -60], 'folding-wedges': [0, 420, 0],
    threshold: [0, 260, 40], 'threshold-screws': [0, 260, 180], 'port-frame': [0, 520, 0], 'port-screws': [0, 600, -120],
    staples: [0, 800, 0], 'cover-battens': [0, 900, 0], 'batten-screws': [0, 990, 0],
    'docking-brackets': [0, 1050, 0], 'gate-tracks': [0, 1080, 0], 'cat-gate': [0, 1140, 0], 'gate-latch': [0, 1180, 0],
  };
  const groups = new Map<string, THREE.Group>();
  const group = (id: string, step: number, layer: 'timber' | 'mesh' | 'hardware') => {
    const existing = groups.get(id); if (existing) return existing;
    const created = component(id, step, layer, explode[id] ?? [0, 0, 0]); groups.set(id, created); return created;
  };

  // Stage 1: the collar and its corner joints; 3: threshold, port frame and battens.
  for (const piece of layout.timber) {
    const step = piece.component.startsWith('collar-') ? 1 : 3;
    const parent = group(piece.component, step, 'timber');
    for (const b of piece.boxes) box(parent, b.size, b.center, piece.component === 'threshold' || piece.component === 'cover-battens' ? m.endgrain : m.timber);
  }
  for (const f of layout.fasteners) {
    const parent = group(f.component, f.component === 'corner-screws' ? 1 : 3, 'hardware');
    const part = findPart(f.partId); if (!part) continue;
    if (part.family === 'nail') {
      // the crown over the wire, and the two legs into the timber
      const across = new THREE.Vector3(...(f.across ?? [1, 0, 0])); const into = new THREE.Vector3(...f.direction);
      const r = dimensionOf(part, 'd') / 2; const half = 5; const at = new THREE.Vector3(...f.at).addScaledVector(into, -r * 2);
      const ends = [-1, 1].map(s => at.clone().addScaledVector(across, s * half));
      const [a, b] = ends; if (!a || !b) continue;
      rod(parent, a.toArray(), b.toArray(), r);
      for (const end of ends) rod(parent, end.toArray(), end.clone().addScaledVector(into, 8).toArray(), r);
    } else {
      const l = dimensionOf(part, 'l'); const at = new THREE.Vector3(...f.at); const into = new THREE.Vector3(...f.direction);
      cylinder(parent, at.toArray(), at.clone().addScaledVector(into, 1.5).toArray(), dimensionOf(part, 'dk') / 2, m.hardware);
      rod(parent, at.toArray(), at.clone().addScaledVector(into, l).toArray(), dimensionOf(part, 'd') / 2.4);
    }
  }

  // Stage 2: the clamps, each in its own frame: +X along the member, +Y outwards to the reveal.
  const movers: { slide: THREE.Group; kind: Clamp['kind'] }[] = [];
  const { spreaderFoot, bearingFoot, insertNut, nut, gap } = layout;
  const wedge = INSERT.wedge; const drive = wedge.length * (gap - wedge.thickness) / wedge.thickness;
  const prism = (points: [number, number][], width: number, material: THREE.Material) => {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false }); geometry.translate(0, 0, -width / 2);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; return mesh;
  };
  for (const clamp of layout.clamps) {
    const frame = (parent: THREE.Group) => {
      const g = new THREE.Group(); g.position.set(...clamp.at);
      const x = new THREE.Vector3(...clamp.along); const y = new THREE.Vector3(...clamp.normal);
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)));
      parent.add(g); return g;
    };
    if (clamp.kind === 'wedge') {
      const g = frame(group('folding-wedges', 2, 'timber'));
      const slide = new THREE.Group(); g.add(slide);
      const L = wedge.length / 2;
      g.add(prism([[-L, gap], [L, gap], [L, gap - wedge.thickness]], wedge.width, m.endgrain));
      slide.add(prism([[-L, 0], [L, 0], [-L, wedge.thickness]], wedge.width, m.timber));
      movers.push({ slide, kind: 'wedge' });
      continue;
    }
    const foot = clamp.kind === 'bearing' ? bearingFoot : spreaderFoot;
    const d1 = dimensionOf(foot, 'd1') / 2; const l1 = dimensionOf(foot, 'l1'); const l2 = dimensionOf(foot, 'l2'); const l3 = dimensionOf(foot, 'l3');
    const l5 = dimensionOf(foot, 'l5'); const s = dimensionOf(foot, 's'); const hex = s * 0.45;
    const nuts = frame(group('insert-nuts', 2, 'hardware'));
    cylinder(nuts, [0, 0.5, 0], [0, -dimensionOf(insertNut, 'l'), 0], dimensionOf(insertNut, 'd') / 2, m.hardware);
    const g = frame(group(clamp.kind === 'bearing' ? 'bearing-feet' : 'spreader-clamps', 2, 'hardware'));
    const slide = new THREE.Group(); g.add(slide);
    const base = gap; const hexTop = gap - l3;
    cylinder(slide, [0, base, 0], [0, base - (l3 - l2), 0], d1, m.rubber);
    cylinder(slide, [0, base - (l3 - l2), 0], [0, base - l5, 0], d1, m.hardware);
    cylinder(slide, [0, base - l5, 0], [0, hexTop + hex, 0], d1 * 0.55, m.hardware);
    cylinder(slide, [0, hexTop + hex, 0], [0, hexTop, 0], s / Math.sqrt(3), m.hardware, true);
    rod(slide, [0, hexTop, 0], [0, hexTop - l1, 0], dimensionOf(foot, 'd') / 2);
    if (clamp.kind === 'spreader') {
      const nm = dimensionOf(nut, 'm'); const across = dimensionOf(nut, 's') / Math.sqrt(3);
      // the foot's own nut and a second ISO 4032 nut, jammed on the inner end for a 13 mm spanner
      cylinder(slide, [0, hexTop - l1, 0], [0, hexTop - l1 + nm, 0], across, m.hardware, true);
      cylinder(slide, [0, hexTop - l1 + nm + 0.5, 0], [0, hexTop - l1 + 2 * nm + 0.5, 0], across, m.hardware, true);
    }
    movers.push({ slide, kind: clamp.kind });
  }

  // Stage 3: mesh panels.
  for (const mp of layout.panels) panel(mp.id, 3, mp.width, mp.height, mp.center, mp.plane, [0, 700, 0]);

  // Stage 6: docking brackets (direct) or the cat gate (with tunnel).
  if (layout.port) {
    const { width: w, height: h } = layout.port; const yGate = layout.yIn + 14;
    const tracks = group('gate-tracks', 6, 'hardware');
    for (const sx of [-1, 1]) box(tracks, [12, 12, 2 * h + 45], [sx * (w / 2 + 16), yGate, layout.floor + h + 22.5], m.hardware);
    box(group('cat-gate', 6, 'timber'), [w + 20, 12, h + 20], [0, yGate, layout.floor + (h + 20) / 2], m.endgrain);
    const latch = group('gate-latch', 6, 'hardware');
    box(latch, [42, 20, 12], [0, yGate - 16, layout.floor + h - 35], m.hardware);
  } else {
    const brackets = group('docking-brackets', 6, 'hardware');
    for (const sx of [-1, 1]) for (const f of [0.25, 0.75]) box(brackets, [55, 108, 5], [sx * (layout.W / 2 - 28), layout.yOut + 54, layout.z0 + f * layout.H], m.hardware);
  }

  for (const c of p.components.slice(first)) insert.add(c.group);
  function update(state: CatioState) {
    p.update(state);
    insert.position.y = BENCH_OFFSET * (1 - along(state.progress, 4));
    const tight = along(state.progress, 5);
    for (const mover of movers) {
      if (mover.kind === 'spreader') mover.slide.position.y = -INSERT.travel * (1 - tight);
      if (mover.kind === 'wedge') mover.slide.position.x = drive * tight;
    }
    hinge.rotation.z = state.windowOpen ? -Math.PI / 2 : 0;
    p.root.updateMatrixWorld(true);
  }
  function dispose() { p.dispose(); hexGeometry.dispose(); discGeometry.dispose(); }
  return { root: p.root, hinge, components: p.components, update, dispose, layout, insert };
}
