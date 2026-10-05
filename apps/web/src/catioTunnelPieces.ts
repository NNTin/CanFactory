import * as THREE from 'three';
import { dimensionOf, findPart, type Part } from '@canfactory/contracts';
import type { createCatioParts } from './catioParts.ts';
import { buildPrintedLatches } from './catioPrintedLatchScene.ts';
import type { V3 } from './catioSubassembly.ts';
import { facePoint, TUNNEL, vec, type Coupling, type Face, type Fastener, type Member, type MeshPanel, type Rect, type Support, type SupportBox, type TunnelLayout } from './catioTunnel.ts';

/**
 * The tunnel's pieces as 3D groups, drawn once for every page that shows them: the tunnel page stages all of them, the tunnel–tunnel
 * coupling page two sections, one support and the joint between them, and the insert–tunnel coupling page the first section. Each
 * piece is its own group placed where it is installed (positioned at its own centre, so a scene can move it in along its way), not
 * yet added to a scene.
 */
export function tunnelDrawing(p: ReturnType<typeof createCatioParts>) {
  const { box, rod, materials: m } = p;
  const geometries: THREE.BufferGeometry[] = [];
  const hexGeometry = new THREE.CylinderGeometry(1, 1, 1, 6); const discGeometry = new THREE.CylinderGeometry(1, 1, 1, 20);
  const wire = new THREE.BoxGeometry(1, 1, 1);
  geometries.push(hexGeometry, discGeometry, wire);
  const vector = (v: V3) => new THREE.Vector3(...v);
  const group = (origin: V3 = [0, 0, 0]) => { const g = new THREE.Group(); g.position.set(...origin); return g; };
  const cylinder = (parent: THREE.Object3D, from: V3, to: V3, radius: number, material: THREE.Material, hex = false) => {
    const a = vector(from); const c = vector(to); const v = c.clone().sub(a);
    const mesh = new THREE.Mesh(hex ? hexGeometry : discGeometry, material);
    mesh.position.copy(a.add(c).multiplyScalar(0.5)); mesh.scale.set(radius, v.length(), radius);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); mesh.castShadow = true; parent.add(mesh); return mesh;
  };
  /** A solid between two quadrilaterals (each counter-clockwise seen from outside the first), relative to `origin`. */
  const hexahedron = (parent: THREE.Object3D, corners: V3[], material: THREE.Material, origin: V3) => {
    const c = corners.map(q => vec.sub(q, origin));
    const quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    const positions: number[] = [];
    for (const [a, b2, c2, d] of quads) for (const i of [a, b2, c2, a, c2, d]) positions.push(...(c[i ?? 0] ?? [0, 0, 0]));
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
    (material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; parent.add(mesh); return mesh;
  };
  const corners = (from: Face, fromOffset: number, to: Face, toOffset: number, [u0, u1, v0, v1]: Rect): V3[] => [
    ...([[u0, v0], [u1, v0], [u1, v1], [u0, v1]] as const).map(([u, v]) => facePoint(from, u, v, fromOffset)),
    ...([[u0, v0], [u1, v0], [u1, v1], [u0, v1]] as const).map(([u, v]) => facePoint(to, u, v, toOffset)),
  ];
  const centroid = (points: V3[]): V3 => vec.mul(points.reduce<V3>((s, q) => vec.add(s, q), [0, 0, 0]), 1 / points.length);
  /** A box from `from` to `to`, `width` across (horizontal) and `height` up. */
  const beam = (parent: THREE.Object3D, from: V3, to: V3, width: number, height: number, material: THREE.Material, origin: V3) => {
    const axis = vec.unit(vec.sub(to, from)); const vertical = Math.abs(axis[2]) > 0.99;
    const x = vertical ? new THREE.Vector3(1, 0, 0) : vector(vec.unit(vec.cross(axis, [0, 0, 1]))); const y = vector(axis); const z = x.clone().cross(y);
    const mesh = box(parent as THREE.Group, [width, vec.len(vec.sub(to, from)), height], vec.sub(centroid([from, to]), origin), material);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); return mesh;
  };
  /** Wire mesh over a planar quadrilateral: wires parallel to each pair of its edges. */
  const meshQuad = (parent: THREE.Object3D, c: [V3, V3, V3, V3], origin: V3) => {
    const pitch = TUNNEL.mesh.opening + TUNNEL.mesh.wire; const lines: [V3, V3][] = [];
    const lerp = (a: V3, b2: V3, t: number) => vec.add(a, vec.mul(vec.sub(b2, a), t));
    const [c0, c1, c2, c3] = c;
    const n1 = Math.max(1, Math.round(Math.max(vec.len(vec.sub(c1, c0)), vec.len(vec.sub(c2, c3))) / pitch));
    const n2 = Math.max(1, Math.round(Math.max(vec.len(vec.sub(c3, c0)), vec.len(vec.sub(c2, c1))) / pitch));
    for (let i = 0; i <= n1; i++) lines.push([lerp(c0, c1, i / n1), lerp(c3, c2, i / n1)]);
    for (let i = 0; i <= n2; i++) lines.push([lerp(c0, c3, i / n2), lerp(c1, c2, i / n2)]);
    const wires = new THREE.InstancedMesh(wire, m.mesh, lines.length); const pose = new THREE.Object3D();
    lines.forEach(([a, b2], i) => {
      const length = vec.len(vec.sub(b2, a)) + TUNNEL.mesh.wire;
      pose.position.copy(vector(vec.sub(centroid([a, b2]), origin)));
      pose.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), length > 1e-6 ? vector(vec.unit(vec.sub(b2, a))) : new THREE.Vector3(0, 1, 0));
      pose.scale.set(TUNNEL.mesh.wire, Math.max(length, 0.01), TUNNEL.mesh.wire); pose.updateMatrix(); wires.setMatrixAt(i, pose.matrix);
    });
    parent.add(wires); return wires;
  };
  /** A screw (head and shank, point along its direction) or a staple (across its wire), at the fastener. */
  const fastener = (f: Pick<Fastener, 'partId' | 'at' | 'direction' | 'across'>) => {
    const part = findPart(f.partId); if (!part) return null;
    const g = group(f.at);
    if (part.family === 'nail') { const across = f.across ?? [1, 0, 0]; rod(g, vec.mul(across, -5), vec.mul(across, 5), 1.25); }
    else if (part.family === 'pin') rod(g, [0, 0, 0], vec.mul(f.direction, dimensionOf(part, 'l')), dimensionOf(part, 'd') / 2);
    else { cylinder(g, [0, 0, 0], vec.mul(f.direction, 1.5), dimensionOf(part, 'dk') / 2, m.hardware); rod(g, [0, 0, 0], vec.mul(f.direction, dimensionOf(part, 'l')), dimensionOf(part, 'd') / 2.4); }
    return { group: g, part };
  };
  /** A box in a support's frame (across, along the tunnel, up), relative to `origin`. */
  const supportBox = (parent: THREE.Object3D, b: SupportBox, s: Pick<Support, 'across' | 'along'>, material: THREE.Material, origin: V3) => {
    const mesh = box(parent as THREE.Group, b.size, vec.sub(b.center, origin), material);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(vector(s.across), vector(s.along), new THREE.Vector3(0, 0, 1))); return mesh;
  };
  return { vector, group, cylinder, hexahedron, corners, centroid, beam, meshQuad, fastener, supportBox, dispose: () => { for (const g of geometries) g.dispose(); } };
}
export type TunnelDrawing = ReturnType<typeof tunnelDrawing>;

/**
 * The sections and collars of `pieces` (all when absent): each flange ring, rail and floor board, cleat and mesh panel in its own
 * group at its centre, and the screws and staples built into them, each at its own point.
 */
export function buildSectionPieces(p: ReturnType<typeof createCatioParts>, draw: TunnelDrawing, layout: TunnelLayout, pieces?: string[]) {
  const { materials: m } = p;
  const of = (id: string) => !pieces || pieces.includes(id);
  const members = layout.members.filter(mem => of(mem.piece)).map(member => {
    const pts = draw.corners(member.from, member.fromOffset, member.to, member.toOffset, member.rect); const c = draw.centroid(pts);
    const group = draw.group(c); draw.hexahedron(group, pts, member.kind === 'flange' ? m.endgrain : m.timber, c);
    return { member, group };
  });
  const cleats = layout.cleats.filter(cleat => of(cleat.piece)).map(cleat => {
    const group = draw.group(cleat.center); const half = vec.mul(cleat.frame.x, cleat.length / 2);
    draw.beam(group, vec.sub(cleat.center, half), vec.add(cleat.center, half), TUNNEL.cleat.size, TUNNEL.cleat.size, m.endgrain, cleat.center);
    return { cleat, group };
  });
  const panels = layout.panels.filter(panel => of(panel.piece)).map(panel => {
    const c = draw.centroid(panel.corners); const group = draw.group(c); draw.meshQuad(group, panel.corners, c);
    return { panel, group };
  });
  const built: Fastener['component'][] = ['rail-screws', 'floor-screws', 'cleat-screws', 'staples'];
  const fasteners = layout.fasteners.filter(f => built.includes(f.component) && (!pieces || (f.piece !== undefined && pieces.includes(f.piece))))
    .flatMap(f => { const drawn = draw.fastener(f); return drawn ? [{ fastener: f, ...drawn }] : []; });
  return { members, cleats, panels, fasteners };
}
export type SectionPieces = ReturnType<typeof buildSectionPieces>;
export type { Member, MeshPanel };

/**
 * A support, as built: a slab, insert nut, foot (a printed pad on its screw, or a Ganter foot) and leg at each end, the bearer
 * (or a low bearer) with the screws down into the legs, and on tall trestles the brace with its screws. Every foot stands on its
 * slab; the rest is at its levelled height.
 */
export function buildSupportPieces(p: ReturnType<typeof createCatioParts>, draw: TunnelDrawing, layout: TunnelLayout, s: Support) {
  const { box, rod, materials: m } = p;
  const { foot, pad, insertNut, footHeight: l3, stud: l1 } = layout;
  const d1 = (pad ? pad.diameter : dimensionOf(foot, 'd1')) / 2;
  const soleThickness = s.soles.length ? TUNNEL.sole.thickness : 0;
  const feet = s.feet.map(f => {
    // one slab, leg and sole for each end (its first foot); an insert nut and a foot at every foot
    const slab = f.primary ? draw.group([f.slabAt[0], f.slabAt[1], f.slabTop - TUNNEL.slab.thickness / 2]) : null;
    if (slab) box(slab, [TUNNEL.slab.size, TUNNEL.slab.size, TUNNEL.slab.thickness], [0, 0, 0], m.floor).quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(s.along[0], s.along[1]));
    const bottom = f.slabTop + l3 + f.actualSetting;
    let leg: THREE.Group | null = null;
    if (f.primary && f.leg > 0) { leg = draw.group([f.legAt[0], f.legAt[1], bottom + soleThickness + f.leg / 2]); box(leg, [TUNNEL.leg, TUNNEL.leg, f.leg], [0, 0, 0]); }
    const soleBox = f.primary ? s.soles[f.end] : undefined;
    const sole = soleBox ? draw.group(soleBox.center) : null;
    if (sole && soleBox) draw.supportBox(sole, soleBox, s, m.timber, soleBox.center);
    const nut = draw.group([f.at[0], f.at[1], bottom]);
    draw.cylinder(nut, [0, 0, 0], [0, 0, dimensionOf(insertNut, 'l')], dimensionOf(insertNut, 'd') / 2, m.hardware);
    // the foot: pad on the slab, hexagon, and the stud up into the insert nut; a printed foot holds the screw's head under its lip
    const footPiece = draw.group([f.at[0], f.at[1], f.slabTop]);
    if (pad) {
      draw.cylinder(footPiece, [0, 0, 0], [0, 0, l3], d1, m.printed);
      draw.cylinder(footPiece, [0, 0, l3], [0, 0, l3 + l1], dimensionOf(foot, 'd') / 2, m.hardware);
    } else {
      const af = dimensionOf(foot, 's');
      draw.cylinder(footPiece, [0, 0, 0], [0, 0, l3 - 7], d1, m.rubber);
      draw.cylinder(footPiece, [0, 0, l3 - 7], [0, 0, l3], af / Math.sqrt(3), m.hardware, true);
      draw.cylinder(footPiece, [0, 0, l3], [0, 0, l3 + l1], dimensionOf(foot, 'd') / 2, m.hardware);
    }
    const screws = s.kind === 'trestle' && f.primary ? [-1, 1].map(k => {
      const screw = draw.group(vec.add([f.legAt[0], f.legAt[1], s.top], vec.mul(s.along, k * 11)));
      draw.cylinder(screw, [0, 0, 0], [0, 0, -2], 5.5, m.hardware); rod(screw, [0, 0, 0], [0, 0, -100], 2.5);
      return screw;
    }) : [];
    return { foot: f, slab, leg, sole, nut, footPiece, screws };
  });
  const centre: V3 = [s.at[0], s.at[1], s.top - s.depth / 2];
  const bearer = draw.group(centre);
  draw.beam(bearer, vec.add(centre, vec.mul(s.across, -s.length / 2)), vec.add(centre, vec.mul(s.across, s.length / 2)), s.width, s.depth, s.kind === 'block' ? m.endgrain : m.timber, centre);
  let brace: THREE.Group | null = null;
  if (s.brace) {
    const offset = vec.mul(s.along, -(TUNNEL.leg / 2 + TUNNEL.brace.thickness / 2));
    const from = vec.add(s.brace.from, offset); const to = vec.add(s.brace.to, offset); const c = draw.centroid([from, to]);
    brace = draw.group(c); draw.beam(brace, from, to, TUNNEL.brace.thickness, TUNNEL.brace.width, m.endgrain, c);
  }
  return { support: s, feet, bearer, brace };
}

/** Whether a fastener is one of this support's: a brace screw at its brace, or a screw up through its bearer. */
export function supportOf(layout: TunnelLayout, f: Fastener): Support | undefined {
  if (f.support) return layout.supports.find(s => s.id === f.support);
  if (f.component === 'brace-screws') return layout.supports.find(t => t.brace && Math.min(vec.len(vec.sub(t.brace.from, [f.at[0], f.at[1], t.brace.from[2]])), vec.len(vec.sub(t.brace.to, [f.at[0], f.at[1], t.brace.to[2]]))) < 200);
  if (f.component === 'sole-screws') return layout.supports.find(s => s.feet.some(q => Math.hypot(q.legAt[0] - f.at[0], q.legAt[1] - f.at[1]) < 100));
  return undefined;
}

/**
 * The joint at a coupling, installed. Bolted: each bolt with its head and washer behind the flange before the joint, and each
 * nut with its washer on the far side. Latched: the printed latches (catch plates, and base plates with lever and link, closed;
 * `setOpen` opens each), their screws, and the seal in the gap.
 */
export function buildCouplingJoint(p: ReturnType<typeof createCatioParts>, draw: TunnelDrawing, layout: TunnelLayout, c: Coupling) {
  const { rod, materials: m } = p;
  const T = TUNNEL.flange.thickness;
  const need = (id: string): Part => { const found = findPart(id); if (!found) throw new Error(`The parts library has no ${id}.`); return found; };
  const bolt = need('iso-4017-m8x80'); const washer = need('iso-7093-m8'); const nutPart = need('iso-4032-m8');
  const wh = dimensionOf(washer, 'h'); const wr = dimensionOf(washer, 'd2') / 2; const nm = dimensionOf(nutPart, 'm'); const ns = dimensionOf(nutPart, 's');
  const bolts = c.bolts.map((bt, i) => {
    const n = bt.n; const head = vec.mul(n, -(c.gap + T + wh));
    const g = draw.group(bt.at);
    draw.cylinder(g, head, vec.mul(n, -(c.gap + T + wh + dimensionOf(bolt, 'k'))), dimensionOf(bolt, 's') / Math.sqrt(3), m.hardware, true);
    draw.cylinder(g, vec.mul(n, -(c.gap + T)), head, wr, m.hardware);
    rod(g, head, vec.add(head, vec.mul(n, dimensionOf(bolt, 'l'))), 4);
    const nut = draw.group(bt.at);
    draw.cylinder(nut, vec.mul(n, T), vec.mul(n, T + wh), wr, m.hardware);
    draw.cylinder(nut, vec.mul(n, T + wh), vec.mul(n, T + wh + nm), ns / Math.sqrt(3), m.hardware, true);
    return { id: `${c.id}-${i}`, bolt: bt, group: g, nut };
  });
  const printed = c.latches.length ? buildPrintedLatches(c.latches) : null;
  const screws = layout.fasteners.filter(f => (f.component === 'latch-screws' || f.component === 'catch-screws') && c.latches.some(q => q.id === f.of))
    .flatMap(f => { const drawn = draw.fastener(f); return drawn ? [{ fastener: f, ...drawn }] : []; });
  // the seal: a strip round the middle of the flange ring, squashed in the gap
  let seal: THREE.Group | null = null;
  if (c.seal) {
    const { w, h } = layout; const F = TUNNEL.flange.width; const mid = F / 2;
    const path: [number, number][] = [[-w / 2 - mid, -mid], [-w / 2 - mid, h + mid], [w / 2 + mid, h + mid], [w / 2 + mid, -mid]];
    const centre = facePoint(c.face, 0, h / 2, -c.gap / 2); seal = draw.group(centre);
    const half = 4.5;
    path.forEach(([u, v], i) => {
      const [nu, nv] = path[(i + 1) % path.length] ?? [u, v];
      const rect: Rect = [Math.min(u, nu) - half, Math.max(u, nu) + half, Math.min(v, nv) - half, Math.max(v, nv) + half];
      draw.hexahedron(seal as THREE.Group, draw.corners(c.face, -c.gap, c.face, 0, rect), m.rubber, centre);
    });
  }
  return { coupling: c, bolts, catches: printed?.catches ?? [], latches: printed?.latches ?? [], screws, seal, dispose: () => printed?.dispose() };
}

/**
 * How the tunnel is held on a support (`Support.hold`), drawn: on the support before the tunnel goes on (dowels, strap cleats, the
 * turn buttons' posts, and the buttons, each with `setTurn`), on the flanges (the buttons' keepers), the strap that goes over last,
 * and the screws of each.
 */
export function buildSupportHold(p: ReturnType<typeof createCatioParts>, draw: TunnelDrawing, layout: TunnelLayout, s: Support) {
  const { materials: m } = p; const hold = s.hold; const FX = TUNNEL.fixing;
  const onSupport: { kind: 'dowel' | 'cleat' | 'post'; group: THREE.Group; out: V3 }[] = [];
  const screwsOf = (components: Fastener['component'][]) => layout.fasteners.filter(f => components.includes(f.component) && f.support === s.id)
    .flatMap(f => { const drawn = draw.fastener(f); return drawn ? [{ fastener: f, ...drawn }] : []; });
  for (const { group } of screwsOf(['dowels'])) onSupport.push({ kind: 'dowel', group, out: [0, 0, 1] });
  if (hold.strap) for (const [i, b] of hold.strap.cleats.entries()) {
    const g = draw.group(b.center); draw.supportBox(g, b, s, m.endgrain, b.center);
    onSupport.push({ kind: 'cleat', group: g, out: vec.mul(s.across, i === 0 ? -1 : 1) });
  }
  // the turn buttons: a post on the bearer's end with the button on it, turning flat about its vertical screw; and the keeper on
  // the flange's side it lies over (it goes on with the section)
  for (const b of hold.buttons) {
    const g = draw.group(b.post.center); draw.supportBox(g, b.post, s, m.printed, b.post.center);
    onSupport.push({ kind: 'post', group: g, out: vec.mul(s.across, b.side) });
  }
  const keepers = hold.buttons.map(b => {
    const g = draw.group(b.keeper.center); draw.supportBox(g, b.keeper, s, m.endgrain, b.keeper.center);
    return { button: b, group: g, out: vec.mul(s.across, b.side) };
  });
  // open, a button points straight out from the tunnel: a quarter turn about the vertical, its far end away from the flange
  const buttons = hold.buttons.map(b => {
    const pivot = draw.group(b.pivot); const arm = new THREE.Group(); pivot.add(arm);
    draw.supportBox(arm, b.button, s, m.printed, b.pivot);
    // its end round the pivot is rounded
    draw.cylinder(arm, [0, 0, 0], [0, 0, -TUNNEL.fixing.button.thickness], TUNNEL.fixing.button.width / 2, m.printed);
    const up = new THREE.Vector3(0, 0, 1); const turn = b.turn * Math.PI / 2;
    return { button: b, group: pivot, arm, setTurn: (open: number) => arm.quaternion.setFromAxisAngle(up, open * turn) };
  });
  let strap: THREE.Group | null = null;
  if (hold.strap) {
    const path = hold.strap.path; const centre = draw.centroid(path); strap = draw.group(centre);
    path.slice(1).forEach((q, i) => {
      const a = path[i] ?? q; const dir = vec.unit(vec.sub(q, a)); const x = s.along; const z = vec.cross(x, dir);
      const mesh = p.box(strap as THREE.Group, [FX.strap.width, vec.len(vec.sub(q, a)), 3], vec.sub(draw.centroid([a, q]), centre), m.rubber);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(draw.vector(x), draw.vector(dir), draw.vector(z)));
    });
  }
  const supportScrews = screwsOf(['strap-cleat-screws', 'post-screws', 'button-screws']);
  const pieceScrews = screwsOf(['keeper-screws']);
  return { support: s, onSupport, keepers, buttons, strap, supportScrews, pieceScrews };
}
