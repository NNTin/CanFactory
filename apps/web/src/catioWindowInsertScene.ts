import * as THREE from 'three';
import { dimensionOf, findPart, PRESSURE_PAD, pressurePadSeat, type Part } from '@canfactory/contracts';
import { createCatioParts } from './catioParts.ts';
import type { CatioState } from './catioScene.ts';
import type { CatioMode } from './catioSettings.ts';
import type { SubassemblyModel, V3 } from './catioSubassembly.ts';
import { buildWindowContext } from './catioWindowContext.ts';
import { INSERT, windowFor, windowInsertLayout, type Clamp, type WindowInsertConfig, type WindowInsertLayout, type WindowSpec } from './catioWindowInsert.ts';

/** Stages 1–3 are built on a bench this far out in the garden; stage 4 carries the insert into the recess. */
export const BENCH_OFFSET = 900;

const along = (progress: number, stage: number) => THREE.MathUtils.clamp(progress - stage + 1, 0, 1);
const ease = (t: number) => t * t * (3 - 2 * t);
/** Exploded, each piece waits this many times its way in away from its place. */
const EXPLODE = 1.8;

/**
 * One piece's way in: during `window` (fractions of its stage) it travels `approach` (in its parent's frame) back to where it
 * sits, along the direction it is really fitted, turning `turns` times about `axis` if it is threaded. Exploded, every piece
 * waits at the start of its way in, so the exploded view reads as the same assembly, frozen.
 */
export interface PieceMotion {
  object: THREE.Object3D; stage: number; window: [number, number]; approach: THREE.Vector3; axis?: THREE.Vector3; turns?: number; action: string;
  /** What the piece is, and the clamp or fastener it belongs to, for checking the order. Pieces of one kind move together. */
  role?: 'insert-nut' | 'foot' | 'own-nut' | 'second-nut' | 'pad-screw' | 'pad-nut' | 'pad' | 'screw' | 'staple'; of?: string; drive?: V3;
}

/** The installed insert as fixed context on another page: its timber, corner brackets, hooks and feet when hung, and its mesh on the mesh layer. */
export function buildInsertContext(p: ReturnType<typeof createCatioParts>, layout: WindowInsertLayout) {
  const insert = p.component('window-insert', 0, undefined);
  for (const t of layout.timber) for (const b of t.boxes) p.box(insert, b.size, b.center, t.component === 'threshold' || t.component === 'cover-battens' ? p.materials.endgrain : p.materials.timber);
  for (const b of layout.brackets) for (const plate of b.boxes) p.box(insert, plate.size, plate.center, p.materials.hardware);
  buildHungHardware(p, layout, insert, insert);
  for (const q of layout.panels) p.panel(`insert-${q.id}`, 0, q.width, q.height, q.center, q.plane, [0, 0, 0]);
  return insert;
}

/**
 * A hung insert's hardware, installed: its screen hooks behind the window frame's lip (into `hooks`) and its feet under the sill rail
 * standing on the recess floor (into `feet`), drawn simply. Nothing for an insert pressed into the recess.
 */
export function buildHungHardware(p: ReturnType<typeof createCatioParts>, layout: WindowInsertLayout, hooks: THREE.Group, feet: THREE.Group) {
  if (!layout.hooks.length) return;
  for (const h of layout.hooks) for (const b of h.boxes) p.box(hooks, b.size, b.center, p.materials.hardware);
  const radius = (layout.pad?.diameter ?? dimensionOf(layout.bearingFoot, 'd1')) / 2;
  for (const c of layout.clamps) if (c.kind === 'bearing') {
    p.rod(feet, [c.at[0], c.at[1], c.at[2]], [c.at[0], c.at[1], c.at[2] - layout.gap + INSERT.travel], 4);
    p.rod(feet, [c.at[0], c.at[1], c.at[2] - layout.gap + INSERT.travel], [c.at[0], c.at[1], c.at[2] - layout.gap], radius, layout.pad ? p.materials.printed : p.materials.rubber);
  }
}

/** The window insert in its window: every piece of `windowInsertLayout`, staged as `windowInsertSteps` describes. */
export function createWindowInsertScene(variant: CatioMode, config: WindowInsertConfig, window: WindowSpec = windowFor(variant, config)): SubassemblyModel & {
  layout: ReturnType<typeof windowInsertLayout>; insert: THREE.Group; motions: PieceMotion[]; tilt: THREE.Group;
} {
  const layout = windowInsertLayout(variant, config, window);
  const p = createCatioParts(); const { component, box, rod, panel, materials: m } = p;
  const { hinge, tilt } = buildWindowContext(p, window);
  const hung = layout.hooks.length > 0;
  const insert = new THREE.Group(); insert.name = 'window-insert'; p.root.add(insert);
  const first = p.components.length;
  const hexGeometry = new THREE.CylinderGeometry(1, 1, 1, 6);
  const discGeometry = new THREE.CylinderGeometry(1, 1, 1, 24);
  /** A cylinder from `from` to `to`, a hexagonal prism when `hex`. */
  const cylinder = (parent: THREE.Object3D, from: V3, to: V3, radius: number, material: THREE.Material, hex = false) => {
    const a = new THREE.Vector3(...from); const b = new THREE.Vector3(...to); const v = b.clone().sub(a);
    const mesh = new THREE.Mesh(hex ? hexGeometry : discGeometry, material);
    mesh.position.copy(a.add(b).multiplyScalar(0.5)); mesh.scale.set(radius, v.length(), radius);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); mesh.castShadow = true; parent.add(mesh); return mesh;
  };
  const motions: PieceMotion[] = [];
  const move = (object: THREE.Object3D, stage: number, window: [number, number], approach: V3, action: string, spin?: { axis: V3; turns: number }, meta: Pick<PieceMotion, 'role' | 'of' | 'drive'> = {}) => {
    motions.push({ object, stage, window, approach: new THREE.Vector3(...approach), action, ...(spin ? { axis: new THREE.Vector3(...spin.axis).normalize(), turns: spin.turns } : {}), ...meta });
  };
  /** A piece: a group at `origin` whose children are drawn relative to it, so it turns about its own axis. */
  const piece = (parent: THREE.Object3D, origin: V3 = [0, 0, 0]) => { const g = new THREE.Group(); g.position.set(...origin); parent.add(g); return g; };
  const groups = new Map<string, THREE.Group>();
  // Components stay put; each piece inside moves on its own (see `move`).
  const group = (id: string, step: number, layer: 'timber' | 'mesh' | 'hardware') => {
    const existing = groups.get(id); if (existing) return existing;
    const created = component(id, step, layer, [0, 0, 0]); groups.set(id, created); return created;
  };

  // Stage 1: the collar. Half-laps close across the timber's depth: the rails come first from the room side (their laps face
  // outdoors), then the stiles are pressed onto them from outdoors.
  // Butt joints: the stiles first, then the rails slid in between them from outdoors. Then the corner screws, one by one.
  const lap = config.cornerJoint === 'half-lap';
  const collarApproach: Record<string, V3> = lap
    ? { 'collar-sill': [0, -300, 0], 'collar-head': [0, -300, 0], 'collar-left': [0, 300, 0], 'collar-right': [0, 300, 0] }
    : { 'collar-left': [-260, 0, 0], 'collar-right': [260, 0, 0], 'collar-sill': [0, 300, 0], 'collar-head': [0, 300, 0] };
  const collarWindow = (id: string): [number, number] => {
    const firstPair = lap ? ['collar-sill', 'collar-head'] : ['collar-left', 'collar-right'];
    return firstPair.includes(id) ? [0, 0.25] : [0.25, 0.5];
  };
  // Stage 3 in order, leaving out what this design has none of.
  const present = new Set<string>(['threshold', 'mesh', ...layout.timber.map(t => t.component), ...layout.fasteners.map(f => f.component)]);
  const stage3Order = (['threshold', 'threshold-screws', 'port-frame', 'port-screws', 'mesh', 'staples', 'cover-battens', 'batten-screws'] as const).filter(id => present.has(id));
  const stage3Windows = Object.fromEntries(stage3Order.map((id, i) => [id, [i / stage3Order.length, (i + 1) / stage3Order.length] as [number, number]]));
  const portPieces = layout.timber.filter(t => t.component === 'port-frame');
  const battens = layout.timber.filter(t => t.component === 'cover-battens');
  for (const t of layout.timber) {
    const collar = t.component.startsWith('collar-');
    const g = piece(group(t.component, collar ? 1 : 3, 'timber'));
    for (const b of t.boxes) box(g, b.size, b.center, t.component === 'threshold' || t.component === 'cover-battens' ? m.endgrain : m.timber);
    const rails = t.component === 'collar-sill' || t.component === 'collar-head';
    if (collar) move(g, 1, collarWindow(t.component), collarApproach[t.component] ?? [0, 300, 0], lap
      ? (rails ? 'Collar rails: laid from the room side, laps facing outdoors' : 'Collar stiles: pressed onto the rails’ laps from outdoors')
      : (rails ? 'Collar rails: slid in between the stiles from outdoors' : 'Collar stiles: stood in place'));
    else if (t.component === 'threshold') move(g, 3, stage3Windows['threshold'] ?? [0, 0.1], [0, 0, 220], 'Threshold: lowered onto the sill rail');
    else if (t.component === 'port-frame') {
      // the transom into its housings in the stiles first, then both jambs up into the transom, all from the outdoor side
      const [a, b] = stage3Windows['port-frame'] ?? [0, 1]; const transom = t.id === 'transom';
      move(g, 3, transom ? [a, (a + b) / 2] : [(a + b) / 2, b], [0, 260, 0], transom ? 'Port transom: slid into the stile housings from outdoors' : `${portPieces.length - 1} × Port jamb: slid in from outdoors, up into the transom`);
    } else {
      move(g, 3, stage3Windows['cover-battens'] ?? [0, 1], [0, 200, 0], `${battens.length} × Cover batten: pressed over the mesh edges from outdoors`);
    }
  }

  // Screws and staples: each comes in along the line it is driven, point first, and a screw turns as it goes.
  const byComponent = new Map<string, typeof layout.fasteners>();
  for (const f of layout.fasteners) byComponent.set(f.component, [...(byComponent.get(f.component) ?? []), f]);
  for (const [id, list] of byComponent) {
    // the hooks' screws go in with the hooks, in stage 2
    // the corner brackets' screws go in last in stage 1, after the corner screws and the brackets
    const brackets = layout.brackets.length > 0;
    const stage = id === 'corner-screws' || id === 'bracket-screws' ? 1 : id === 'hook-screws' ? 2 : 3;
    const [from, to]: [number, number] = id === 'corner-screws' ? (brackets ? [0.55, 0.75] : [0.55, 1]) : id === 'bracket-screws' ? [0.88, 1] : id === 'hook-screws' ? [0.85, 1] : stage3Windows[id] ?? [0, 1];
    // all fasteners of a kind go in together; each still along its own axis
    const kinds = new Map<string, { count: number; ways: Set<string> }>();
    for (const f of list) { const k = kinds.get(f.partId) ?? { count: 0, ways: new Set<string>() }; k.count++; k.ways.add(describe(f.direction)); kinds.set(f.partId, k); }
    const caption = (partId: string, title: string, staple: boolean) => {
      const k = kinds.get(partId); const ways = [...(k?.ways ?? [])];
      const way = ways.every(w => w.includes('through the stile')) ? 'through the stiles' : ways.join(' and ');
      return `${k?.count ?? 0} × ${title}: driven ${staple ? 'over the wire ' : ''}${way}`;
    };
    list.forEach(f => {
      const part = findPart(f.partId); if (!part) return;
      const into = new THREE.Vector3(...f.direction);
      const g = piece(group(id, stage, 'hardware'), f.at);
      const window: [number, number] = [from, to];
      if (part.family === 'nail') {
        // the crown over the wire, and the two legs driven into the timber
        const across = new THREE.Vector3(...(f.across ?? [1, 0, 0])); const r = dimensionOf(part, 'd') / 2;
        const at = into.clone().multiplyScalar(-r * 2); const ends = [-1, 1].map(s => at.clone().addScaledVector(across, s * 5));
        const [a, b] = ends; if (!a || !b) return;
        rod(g, a.toArray(), b.toArray(), r);
        for (const end of ends) rod(g, end.toArray(), end.clone().addScaledVector(into, 8).toArray(), r);
        move(g, stage, window, into.clone().multiplyScalar(-60).toArray(), caption(f.partId, part.title, true), undefined, { role: 'staple', drive: f.direction });
      } else {
        const l = dimensionOf(part, 'l');
        cylinder(g, [0, 0, 0], into.clone().multiplyScalar(1.5).toArray(), dimensionOf(part, 'dk') / 2, m.hardware);
        rod(g, [0, 0, 0], into.clone().multiplyScalar(l).toArray(), dimensionOf(part, 'd') / 2.4);
        move(g, stage, window, into.clone().multiplyScalar(-(l + 50)).toArray(), caption(f.partId, part.title, false), { axis: f.direction, turns: 4 }, { role: 'screw', drive: f.direction });
      }
    });
  }

  // Stage 2: the clamps, each in its own frame: +X along the member, +Y outwards to the reveal, the stud's axis.
  // Order: every insert nut is screwed into the outer face; every foot's stud is screwed through it from outside; then on each
  // spreader's inner end the foot's own nut and a second nut are run on from inside, one after the other.
  const movers: { slide: THREE.Group; kind: Clamp['kind']; turns?: boolean }[] = [];
  const { spreaderFoot, bearingFoot, insertNut, nut, gap, pad } = layout;
  const wedge = INSERT.wedge; const drive = wedge.length * (gap - wedge.thickness) / wedge.thickness;
  const prism = (points: [number, number][], width: number, material: THREE.Material) => {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false }); geometry.translate(0, 0, -width / 2);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; return mesh;
  };
  const clamps = layout.clamps; const spreaders = clamps.filter(c => c.kind === 'spreader');
  // one kind at a time, at every clamp together
  const bearings = clamps.length - spreaders.length;
  const padCaption = `${bearings} × Printed foot: a hexagon head screw’s head slid into it, then screwed up into the sill rail’s insert nut by turning the foot`;
  const feetCaption = bearings > 0
    ? `${clamps.length} × Levelling foot: studs screwed in from outside, ${bearings} short under the sill rail, ${spreaders.length} long in the stiles and head`
    : `${clamps.length} × Levelling foot: studs screwed in from outside`;
  clamps.forEach(clamp => {
    const frame = (parent: THREE.Group) => {
      const g = new THREE.Group(); g.position.set(...clamp.at);
      const x = new THREE.Vector3(...clamp.along); const y = new THREE.Vector3(...clamp.normal);
      g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)));
      parent.add(g); return g;
    };
    if (clamp.kind === 'wedge') {
      // both wedges of a pair go into the gap from outside the collar; stage 5 drives the inner one along the member
      const g = frame(group('folding-wedges', 2, 'timber'));
      const slide = new THREE.Group(); g.add(slide);
      const L = wedge.length / 2;
      const outer = piece(g); outer.add(prism([[-L, gap], [L, gap], [L, gap - wedge.thickness]], wedge.width, m.endgrain));
      const inner = piece(slide); inner.add(prism([[-L, 0], [L, 0], [-L, wedge.thickness]], wedge.width, m.timber));
      move(inner, 2, [0, 0.5], [0, 160, 0], `${clamps.length} × Inner folding wedge: set against the collar from outside`);
      move(outer, 2, [0.5, 1], [0, 160, 0], `${clamps.length} × Outer folding wedge: laid on it from outside, loosely`);
      movers.push({ slide, kind: 'wedge' });
      return;
    }
    const nuts = frame(group('insert-nuts', 2, 'hardware'));
    const sleeve = piece(nuts);
    cylinder(sleeve, [0, 0.5, 0], [0, -dimensionOf(insertNut, 'l'), 0], dimensionOf(insertNut, 'd') / 2, m.hardware);
    move(sleeve, 2, [0, 0.3], [0, 90, 0], `${clamps.length} × ${insertNut.title}: screwed into the collar’s outer face`, { axis: [0, 1, 0], turns: 3 }, { role: 'insert-nut', of: clamp.id });
    if (pad) {
      // Printed pads, in the clamp frame (+Y outwards): installed, the pad's back stands the travel off the collar face, its sole on
      // the reveal. A hexagon head screw: its head in a foot under the sill rail; in a spreader, turned from inside, its tip in a lock
      // nut that turns freely in the thrust pad.
      const g = frame(group(clamp.kind === 'bearing' ? 'bearing-feet' : 'spreader-clamps', 2, 'hardware'));
      const slide = new THREE.Group(); g.add(slide);
      const r = pad.diameter / 2; const back = INSERT.travel; const lip = PRESSURE_PAD.lip;
      const screw = clamp.kind === 'bearing' ? pad.bearingScrew : pad.spreaderScrew;
      const l = dimensionOf(screw, 'l'); const k = dimensionOf(screw, 'k'); const head = dimensionOf(screw, 's') / Math.sqrt(3);
      const padBody = (parent: THREE.Object3D) => cylinder(parent, [0, back, 0], [0, gap, 0], r, m.printed);
      if (clamp.kind === 'bearing') {
        // the screw's head bears on the foot's lip; its shank runs up into the insert nut
        const footPiece = piece(slide); padBody(footPiece);
        rod(footPiece, [0, back + lip, 0], [0, back + lip - l, 0], dimensionOf(screw, 'd') / 2);
        move(footPiece, 2, [0.3, 0.65], [0, l + 60, 0], padCaption, { axis: [0, 1, 0], turns: 5 }, { role: 'foot', of: clamp.id });
        movers.push({ slide, kind: clamp.kind });
        return;
      }
      const tip = back + pressurePadSeat('thrust', pad.thrustNut); const lock = dimensionOf(nut, 'm');
      const across = (p: Part) => dimensionOf(p, 's') / Math.sqrt(3);
      // the screw with its lock nut (on the member's inner face once tightened), from inside
      const screwPiece = piece(slide);
      rod(screwPiece, [0, tip, 0], [0, tip - l, 0], dimensionOf(screw, 'd') / 2);
      cylinder(screwPiece, [0, tip - l, 0], [0, tip - l - k, 0], head, m.hardware, true);
      cylinder(screwPiece, [0, -INSERT.member, 0], [0, -INSERT.member - lock, 0], across(nut), m.hardware, true);
      move(screwPiece, 2, [0.3, 0.55], [0, -(l + 60), 0], `${spreaders.length} × ${screw.title}: a lock nut run on, then screwed through the member from inside, out through the insert nut`, { axis: [0, 1, 0], turns: 5 }, { role: 'pad-screw', of: clamp.id });
      // the lock nut on its tip, flush with it, from outside
      const nutPiece = piece(slide);
      cylinder(nutPiece, [0, tip - dimensionOf(pad.thrustNut, 'h'), 0], [0, tip, 0], across(pad.thrustNut), m.hardware, true);
      move(nutPiece, 2, [0.55, 0.75], [0, 70, 0], `${spreaders.length} × ${pad.thrustNut.title}: run onto each spreader screw’s tip from outside, flush with it`, { axis: [0, 1, 0], turns: 3 }, { role: 'pad-nut', of: clamp.id });
      // the thrust pad, slid on sideways over the nut; it moves out with the screw but does not turn
      const padSlide = new THREE.Group(); g.add(padSlide);
      const padPiece = piece(padSlide); padBody(padPiece);
      move(padPiece, 2, [0.75, 1], [-(r + 40), 0, 0], `${spreaders.length} × Printed thrust pad: slid sideways onto the nut and pressed past its bumps`, undefined, { role: 'pad', of: clamp.id });
      movers.push({ slide, kind: clamp.kind, turns: true }, { slide: padSlide, kind: clamp.kind, turns: false });
      return;
    }
    const foot = clamp.kind === 'bearing' ? bearingFoot : spreaderFoot;
    const d1 = dimensionOf(foot, 'd1') / 2; const l1 = dimensionOf(foot, 'l1'); const l2 = dimensionOf(foot, 'l2'); const l3 = dimensionOf(foot, 'l3');
    const l5 = dimensionOf(foot, 'l5'); const s = dimensionOf(foot, 's'); const hex = s * 0.45;
    const g = frame(group(clamp.kind === 'bearing' ? 'bearing-feet' : 'spreader-clamps', 2, 'hardware'));
    const slide = new THREE.Group(); g.add(slide);
    const footPiece = piece(slide);
    const base = gap; const hexTop = gap - l3;
    cylinder(footPiece, [0, base, 0], [0, base - (l3 - l2), 0], d1, m.rubber);
    cylinder(footPiece, [0, base - (l3 - l2), 0], [0, base - l5, 0], d1, m.hardware);
    cylinder(footPiece, [0, base - l5, 0], [0, hexTop + hex, 0], d1 * 0.55, m.hardware);
    cylinder(footPiece, [0, hexTop + hex, 0], [0, hexTop, 0], s / Math.sqrt(3), m.hardware, true);
    rod(footPiece, [0, hexTop, 0], [0, hexTop - l1, 0], dimensionOf(foot, 'd') / 2);
    move(footPiece, 2, [0.3, 0.65], [0, l1 + 60, 0], feetCaption, { axis: [0, 1, 0], turns: 5 }, { role: 'foot', of: clamp.id });
    if (clamp.kind === 'spreader') {
      // the foot's own nut, then a second ISO 4032 nut, run onto the stud's inner end from inside and jammed together
      const nm = dimensionOf(nut, 'm'); const across = dimensionOf(nut, 's') / Math.sqrt(3);
      const own = piece(slide, [0, hexTop - l1, 0]); cylinder(own, [0, 0, 0], [0, nm, 0], across, m.hardware, true);
      const second = piece(slide, [0, hexTop - l1, 0]); cylinder(second, [0, nm + 0.5, 0], [0, 2 * nm + 0.5, 0], across, m.hardware, true);
      move(own, 2, [0.65, 0.82], [0, -70, 0], `${spreaders.length} × The foot’s own nut: run onto the inner end of each long stud from inside`, { axis: [0, 1, 0], turns: 3 }, { role: 'own-nut', of: clamp.id });
      move(second, 2, [0.82, 1], [0, -70, 0], `${spreaders.length} × ${nut.title}: run on behind it from inside and jammed`, { axis: [0, 1, 0], turns: 3 }, { role: 'second-nut', of: clamp.id });
    }
    movers.push({ slide, kind: clamp.kind, turns: true });
  });

  // Stage 1, with flat corner brackets: each laid into its recess on the room-side face, then screwed (above).
  if (layout.brackets.length) {
    const brackets = group('corner-brackets', 1, 'hardware');
    const [first] = layout.brackets;
    const caption = `${layout.brackets.length} × ${first?.part.title ?? 'Flat corner bracket'}: laid into its recess across the corner on the room-side face`;
    for (const b of layout.brackets) {
      const g = piece(brackets); for (const plate of b.boxes) box(g, plate.size, plate.center, m.hardware);
      move(g, 1, [0.75, 0.88], [0, -120, 0], caption);
    }
  }

  // Stage 2, hung on the window frame: the hooks, bent, laid on the stiles' backs from the room side, then screwed (above).
  if (hung) {
    const hooks = group('screen-hooks', 2, 'hardware');
    const kinds = new Map<string, number>(); for (const h of layout.hooks) kinds.set(h.part.title, (kinds.get(h.part.title) ?? 0) + 1);
    const caption = `${[...kinds].map(([title, n]) => `${n} × ${title}`).join(', ')}: bent at ${layout.hookFit?.bend ?? 0} mm, laid on the back of the stiles`;
    for (const h of layout.hooks) {
      const g = piece(hooks); for (const b of h.boxes) box(g, b.size, b.center, m.hardware);
      move(g, 2, [0.65, 0.85], [0, -120, 0], caption);
    }
  }

  // Stage 3: mesh, each panel pressed on from outdoors (the direct variant's sleeve slid along the passage).
  layout.panels.forEach(mp => {
    const parent = panel(mp.id, 3, mp.width, mp.height, mp.center, mp.plane, [0, 0, 0]);
    for (const child of parent.children.slice()) move(child, 3, stage3Windows['mesh'] ?? [0, 1], [0, 320, 0], `${layout.panels.length} × Mesh panel: offered up from outdoors`);
  });

  // Stage 6: docking brackets (direct), or the gate tracks from the room side and the gate dropped into them from above.
  if (layout.port) {
    const { width: w, height: h } = layout.port; const yGate = layout.yIn + INSERT.gate.y; const [lx, ly, lz] = INSERT.gate.latch;
    const tracks = group('gate-tracks', 6, 'hardware');
    for (const sx of [-1, 1]) {
      const g = piece(tracks); box(g, [12, 12, 2 * h + 45], [sx * (w / 2 + 16), yGate, layout.floor + h + 22.5], m.hardware);
      move(g, 6, [0, 0.3], [0, -220, 0], '2 × Gate track: fixed on the room side of the port');
    }
    const gate = piece(group('cat-gate', 6, 'timber')); box(gate, [w + 20, 12, h + 20], [0, yGate, layout.floor + (h + 20) / 2], m.endgrain);
    move(gate, 6, [0.4, 0.7], [0, 0, h + 30], 'Cat gate: lowered into its tracks from above');
    const latch = piece(group('gate-latch', 6, 'hardware')); box(latch, [lx, ly, lz], [0, yGate - INSERT.gate.latchY, layout.floor + h - 35], m.hardware);
    move(latch, 6, [0.75, 0.95], [0, -140, 0], 'Gate latch: fitted from the room side');
  } else {
    const brackets = group('docking-brackets', 6, 'hardware');
    for (const sx of [-1, 1]) for (const f of [0.25, 0.75]) {
      const g = piece(brackets); box(g, [55, 108, 5], [sx * (layout.W / 2 - 28), layout.yOut + 54, layout.z0 + f * layout.H], m.hardware);
      move(g, 6, [0, 0.8], [0, 240, 0], '4 × Docking bracket: offered to the collar face from outdoors');
    }
  }

  for (const c of p.components.slice(first)) insert.add(c.group);
  const bases = motions.map(motion => ({ position: motion.object.position.clone(), quaternion: motion.object.quaternion.clone() }));
  const spin = new THREE.Quaternion();
  let currentAction: string | null = null;
  let focus: V3 = [0, 0, 0];

  function update(state: CatioState) {
    p.update(state);
    const active = new Set<string>();
    for (const [i, motion] of motions.entries()) {
      const base = bases[i]; if (!base) continue;
      const stageT = state.progress - motion.stage + 1;
      const [a, b] = motion.window;
      const t = THREE.MathUtils.clamp((stageT - a) / (b - a), 0, 1);
      if (t > 0 && t < 1) active.add(motion.action);
      const away = state.exploded ? EXPLODE : 1 - ease(t);
      motion.object.visible = stageT >= 1 || t > 0 || (state.exploded && stageT > a);
      motion.object.position.copy(base.position).addScaledVector(motion.approach, away);
      motion.object.quaternion.copy(base.quaternion);
      if (motion.axis && motion.turns) motion.object.quaternion.multiply(spin.setFromAxisAngle(motion.axis, -away * motion.turns * Math.PI * 2));
    }
    // exploded, the insert is shown on the bench, clear of the wall
    // hung on the window frame: carried in lifted, the long hooks slipped up behind the head lip, then let down over the sill lip
    // once it lies against the frame
    const lift = layout.hookFit?.lift ?? 0;
    const carried = hung ? THREE.MathUtils.clamp(along(state.progress, 4) / 0.75, 0, 1) : along(state.progress, 4);
    insert.position.y = state.exploded ? BENCH_OFFSET : BENCH_OFFSET * (1 - ease(carried));
    insert.position.z = state.exploded || !hung ? 0 : lift * (1 - ease(THREE.MathUtils.clamp((along(state.progress, 4) - 0.75) / 0.25, 0, 1))) * (state.progress > 3 ? 1 : 0);
    focus = insert.position.y > BENCH_OFFSET / 2 ? [0, BENCH_OFFSET, 0] : [0, 0, 0];
    const tight = ease(along(state.progress, 5));
    for (const mover of movers) {
      if (mover.kind === 'wedge') mover.slide.position.x = drive * tight;
      else if (mover.kind === 'spreader') {
        // the spreader turns out of its insert nut towards the reveal
        mover.slide.position.y = -INSERT.travel * (1 - tight);
        if (mover.turns) mover.slide.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tight * Math.PI * 2 * INSERT.travel / 1.25);
      }
    }
    let action: string | null = active.size > 0 ? [...active].join('; ') : null;
    const stage = Math.ceil(state.progress);
    if (!action && !hung && state.progress > 3 && state.progress < 4) action = 'The finished insert is carried from the bench to the window';
    if (!action && hung && state.progress > 3 && state.progress < 4) action = along(state.progress, 4) < 0.75
      ? `The insert is carried to the window, lifted ${lift} mm, and its long hooks slipped up behind the frame’s head lip`
      : 'Let down: the short hooks drop behind the sill lip and the feet stand on the recess floor';
    if (!action && hung && stage === 5 && state.progress < 5) action = 'Each foot is turned until the short hooks stand clear of the sill lip; then the sash is closed over the hooks';
    if (!action && stage === 5 && state.progress < 5) action = pad
      ? 'Each spreader screw is turned by its head from inside: the thrust pad moves out, without turning, until it bears on the reveal; then the lock nut is run up to the collar'
      : config.attachment === 'spreader-feet'
      ? 'Each spreader stud is turned by its jammed nuts from inside: the foot moves out until its pad bears on the reveal'
      : 'Each inner wedge is driven along the member until the pair fills the gap';
    currentAction = action;
    hinge.rotation.z = state.windowOpen ? -Math.PI / 2 : 0;
    p.root.updateMatrixWorld(true);
  }
  function dispose() { p.dispose(); hexGeometry.dispose(); discGeometry.dispose(); }
  return { root: p.root, hinge, tilt, components: p.components, update, dispose, layout, insert, motions, caption: () => currentAction, focusOffset: () => focus };
}

/** How a fastener is driven, in words: from which face. */
function describe(direction: V3): string {
  const [x, y, z] = direction;
  if (y < -0.5) return 'from the outdoor face';
  if (y > 0.5) return 'from the room side';
  if (z > 0.5) return 'up from below';
  if (z < -0.5) return 'down from above';
  return x > 0 ? 'from the left, through the stile' : 'from the right, through the stile';
}
