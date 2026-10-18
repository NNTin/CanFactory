import * as THREE from 'three';
import { catioMesh } from '@canfactory/contracts';
import {
  couplingLayout, type EvaluatedEnclosure, type EvaluatedInstance, type EvaluatedPlatform, type EvaluatedTunnel, type EvaluatedWindow, type Project,
  type ProjectEvaluation, type Transform, type TunnelConfig, type TunnelFastener, type TunnelLayout,
} from '@canfactory/catio';
import { createCatioParts } from './catioParts.ts';
import { facePoint, sizeFaces, type Box, type SizeFace, type Sized } from './catioPlannerHandles.ts';
import { buildEnclosure } from './catioEnclosureScene.ts';
import { catPorts, type CatioDoor } from './catioModularScene.ts';
import { buildCouplingPieces } from './catioCouplingScene.ts';
import { buildCouplingJoint, buildSectionPieces, buildSupportHold, buildSupportPieces, buildTunnelDoors, tunnelDrawing } from './catioTunnelPieces.ts';
import { buildWindowContext } from './catioWindowContext.ts';
import { buildInsertContext } from './catioWindowInsertScene.ts';

/**
 * The planner's scene, drawn from an evaluated project (catioProjectEvaluate.ts) with the catio's own builders: the window with its
 * insert, each tunnel as built (with its doors, couplings, supports and fixings), each enclosure, each platform. It is transient: rebuilt from the evaluation after
 * every committed edit, and never part of the document. Every instance is a group (`userData.instanceId`) placed at its transform
 * in its parent's group, so that an enclosure carries what stands in it; picking walks up from a mesh to its instance.
 * Millimetres, in the site's frame (Z up); the stage turns it to the scene's Y up.
 */
const RAD = Math.PI / 180;
const SELECTED = 0xe8890c; const FLAGGED = 0xc8352b; const HANDLE = 0x2c6e8f;
/** The site context the selection outline leaves out: what a window stands in, not the window. */
const CONTEXT = new Set(['wall', 'room-floor', 'terrain']);

/** What the pointer is over: an instance, or a handle of the selected one. */
export type PlannerPick = { kind: 'instance'; id: string } | { kind: 'rotate' | 'elevate'; id: string } | { kind: 'resize'; id: string; face: SizeFace };
/**
 * The selection tool (FR-02.4): which handles the selection shows. Move: the body moves it, the ring turns it, a platform's arrow
 * raises it. Rotate: the body and the ring turn it. Resize: a handle on each face changes its size.
 */
export const PLANNER_TOOLS = ['move', 'rotate', 'resize'] as const;
export type PlannerTool = typeof PLANNER_TOOLS[number];

interface Drawn {
  id: string; kind: EvaluatedInstance['kind'];
  /** Placed at the instance's transform in its parent's group. */
  group: THREE.Group;
  /** A point on it (in its group) that a click always hits: where tests and readouts aim. */
  anchor: THREE.Vector3;
  /** Shows it at `t` (in its parent's frame) while a drag is in progress. */
  pose: (t: Transform) => void;
  /** A tunnel's: draws it along another route's config and layout, for a drag's preview. */
  redraw?: (layout: TunnelLayout | null, config: TunnelConfig | null) => void;
  dispose: () => void;
}

const place = (object: THREE.Object3D, t: Transform) => { object.position.set(t.x, t.y, t.z); object.rotation.set(0, 0, t.yaw * RAD); };
/** An invisible solid that a click on the instance's volume hits, even between its mesh's wires. */
const proxyMaterial = new THREE.MeshBasicMaterial({ visible: false });

export function createPlannerScene(project: Project, evaluation: ProjectEvaluation) {
  const root = new THREE.Group(); root.name = 'catio-planner';
  const drawn = new Map<string, Drawn>();
  const disposers: (() => void)[] = [];
  const mesh = catioMesh(project.settings.mesh);
  const byId = new Map(project.instances.map(i => [i.id, i]));
  const window0 = evaluation.instances.find((e): e is EvaluatedWindow => e.kind === 'window');
  const portSettings = { tunnelSize: window0?.site.w ?? 0, portClosure: project.settings.portClosure, doorSeat: project.settings.doorSeat };

  // The garden: its lawn, its boundary, and a metre grid; the ground beyond it.
  const { width: gw, depth: gd } = project.garden;
  const site = new THREE.Group(); site.name = 'garden'; root.add(site);
  const groundMaterials = [new THREE.MeshStandardMaterial({ color: '#c9c8bb', roughness: 1 }), new THREE.MeshStandardMaterial({ color: '#97a77e', roughness: 1 })];
  const beyond = new THREE.Mesh(new THREE.PlaneGeometry(gw + 8000, gd + 8000), groundMaterials[0]);
  beyond.position.set(gw / 2, gd / 2, -4); beyond.receiveShadow = true; site.add(beyond);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd), groundMaterials[1]);
  lawn.position.set(gw / 2, gd / 2, -2); lawn.receiveShadow = true; site.add(lawn);
  const gridPoints: number[] = [];
  for (let x = 1000; x < gw; x += 1000) gridPoints.push(x, 0, 0, x, gd, 0);
  for (let y = 1000; y < gd; y += 1000) gridPoints.push(0, y, 0, gw, y, 0);
  const lineGeometry = (points: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); return g; };
  const gridMaterial = new THREE.LineBasicMaterial({ color: 0x7f8f69, transparent: true, opacity: 0.45 });
  site.add(new THREE.LineSegments(lineGeometry(gridPoints), gridMaterial));
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x3f4a33 });
  const edge = new THREE.LineLoop(lineGeometry([0, 0, 1, gw, 0, 1, gw, gd, 1, 0, gd, 1]), edgeMaterial); site.add(edge);
  disposers.push(() => {
    for (const m of [beyond, lawn]) m.geometry.dispose();
    for (const m of [...groundMaterials, gridMaterial, edgeMaterial]) m.dispose();
    site.traverse(o => { if (o instanceof THREE.Line) (o as THREE.Line).geometry.dispose(); });
  });

  const instanceGroup = (e: EvaluatedInstance) => {
    const group = new THREE.Group(); group.name = e.id; group.userData['instanceId'] = e.id;
    place(group, byId.get(e.id)?.transform ?? e.world);
    return group;
  };
  /** A drawing of `createCatioParts` in `into`, disposed with the scene (or when `into` is redrawn). */
  const parts = (into: THREE.Group, spec = mesh) => { const p = createCatioParts(spec); into.add(p.root); return p; };

  function drawWindow(e: EvaluatedWindow): Drawn {
    const group = instanceGroup(e);
    const p = parts(group);
    // the house wall along the whole rear boundary, its window in it
    const reach = 2 * Math.max(e.world.x, gw - e.world.x, e.site.window.openingWidth);
    buildWindowContext(p, e.site.window, { width: reach, depth: 1 }, false);
    buildInsertContext(p, e.insert);
    return { id: e.id, kind: e.kind, group, anchor: new THREE.Vector3(0, -150, e.site.window.recessFloor + e.site.window.openingHeight + 300), pose: t => place(group, t), dispose: p.dispose };
  }

  function drawTunnel(e: EvaluatedTunnel): Drawn {
    const group = instanceGroup(e);
    const window = e.parent ? evaluation.instances.find((w): w is EvaluatedWindow => w.kind === 'window' && w.id === e.parent) : undefined;
    let dispose = () => {};
    /**
     * The tunnel as built, everything its parts list counts (tunnelBom, couplingBom): the sections with their screws and staples,
     * the doors on every opening not coupled, the couplings between pieces and at the enclosure, the supports with their fixings,
     * and the coupling's docking frame and latches on the window insert's port. `config` is the route's (null: no dock to draw).
     */
    const draw = (layout: TunnelLayout | null, config: TunnelConfig | null) => {
      dispose(); group.clear();
      if (!layout) { dispose = () => {}; return; }
      const p = parts(group, layout.mesh); const drawing = tunnelDrawing(p);
      const components = new Map<string, THREE.Group>();
      const add = (id: string, layer: 'timber' | 'mesh' | 'hardware', objects: (THREE.Object3D | null | undefined)[]) => {
        let into = components.get(id); if (!into) { into = p.component(`${e.id}-${id}`, 0, layer); components.set(id, into); }
        for (const o of objects) if (o) into.add(o);
      };
      const fastenersOf = (components: TunnelFastener['component'][]) => layout.fasteners.filter(f => components.includes(f.component)).flatMap(f => drawing.fastener(f)?.group ?? []);
      const sections = buildSectionPieces(p, drawing, layout);
      add('sections', 'timber', [...sections.members, ...sections.cleats].map(q => q.group));
      add('mesh', 'mesh', sections.panels.map(q => q.group));
      add('section-fasteners', 'hardware', [...sections.fasteners.map(f => f.group), ...fastenersOf(['flange-screws'])]);
      const doorLayers = { timber: p.component(`${e.id}-doors`, 0, 'timber'), mesh: p.component(`${e.id}-door-mesh`, 0, 'mesh'), hardware: p.component(`${e.id}-door-hardware`, 0, 'hardware') };
      const doors = buildTunnelDoors(p, layout, () => doorLayers);
      const joints = layout.couplings.map(c => buildCouplingJoint(p, drawing, layout, c));
      for (const j of joints) {
        for (const latch of j.latches) latch.setOpen(0);
        add('couplings', 'hardware', [...j.bolts.flatMap(b => [b.group, b.nut]), ...j.catches.map(q => q.group), ...j.latches.map(q => q.group), ...j.screws.map(q => q.group), j.seal]);
      }
      for (const s of layout.supports) {
        const built = buildSupportPieces(p, drawing, layout, s);
        add('supports', 'timber', [built.bearer, built.brace, ...built.feet.flatMap(f => [f.slab, f.leg, f.sole])]);
        add('support-hardware', 'hardware', built.feet.flatMap(f => [f.nut, f.footPiece, ...f.screws]));
        const hold = buildSupportHold(p, drawing, layout, s);
        for (const b of hold.buttons) b.setTurn(0);
        add('support-fixings', 'hardware', [...hold.onSupport, ...hold.keepers, ...hold.buttons].map(q => q.group).concat(hold.strap ? [hold.strap] : [], [...hold.supportScrews, ...hold.pieceScrews].map(q => q.group)));
      }
      add('support-hardware', 'hardware', fastenersOf(['sole-screws', 'brace-screws']));
      // the coupling to the window insert's port: its docking frame, seal and latches, closed
      const dock = window && config ? buildCouplingPieces(p, couplingLayout(project.settings.insertCoupling, { tunnel: config, site: window.site, joint: e.joint }), project.settings.insertCoupling.latchType) : null;
      if (dock) {
        for (const q of dock.latches) q.setOpen(0);
        add('docking-frame', 'timber', dock.frame.map(f => f.group));
        add('docking-hardware', 'hardware', [dock.seal, ...dock.catches.map(q => q.group), ...dock.latches.map(q => q.group), dock.lip]);
      }
      dispose = () => { for (const j of joints) j.dispose(); for (const d of doors) d.dispose(); dock?.dispose(); drawing.dispose(); p.dispose(); };
    };
    draw(e.layout, e.config);
    const middle = e.layout?.pieces[Math.floor((e.layout.pieces.length - 1) / 2)];
    const anchor = middle ? new THREE.Vector3(...middle.end.at).setZ(middle.end.at[2] + (e.layout?.h ?? 0)) : new THREE.Vector3();
    return { id: e.id, kind: e.kind, group, anchor, pose: t => place(group, t), dispose: () => dispose(), redraw: draw };
  }

  function drawEnclosure(e: EvaluatedEnclosure): Drawn {
    const group = instanceGroup(e);
    const p = parts(group);
    const doors: CatioDoor[] = [];
    const { closureName, port } = catPorts(p, portSettings, doors);
    buildEnclosure(p, e.layout, closureName, { placed: p.placed, doors, port: (q, label) => port(q.id, label, 3, q.connected, 'enclosure') });
    const { width, depth, height } = e.layout.size;
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(width, depth, height), proxyMaterial);
    proxy.position.set(0, depth / 2, height / 2); group.add(proxy);
    return { id: e.id, kind: e.kind, group, anchor: new THREE.Vector3(0, depth / 2, height), pose: t => place(group, t), dispose: () => { proxy.geometry.dispose(); p.dispose(); } };
  }

  function drawPlatform(e: EvaluatedPlatform): Drawn {
    // the board at its transform; its supports (battens along the side frames, North–South bearers across them), in the enclosure's frame, under the board
    const group = new THREE.Group(); group.name = e.id; group.userData['instanceId'] = e.id;
    const own = byId.get(e.id);
    const board = new THREE.Group(); group.add(board);
    const supports = new THREE.Group(); group.add(supports);
    const p = parts(board);
    const params = own?.kind === 'platform' ? own.params : { width: 0, depth: 0, thickness: 0 };
    p.box(p.root, [params.width, params.depth, params.thickness], [0, 0, -params.thickness / 2], p.materials.endgrain);
    for (const b of e.layout?.supports ?? []) p.box(supports, b.size, b.center, p.materials.timber);
    const start = own?.transform ?? { x: 0, y: 0, z: 0, yaw: 0 };
    place(board, start);
    const pose = (t: Transform) => { place(board, t); supports.position.z = t.z - start.z; };
    return { id: e.id, kind: e.kind, group, anchor: new THREE.Vector3(start.x, start.y, start.z), pose, dispose: p.dispose };
  }

  for (const e of evaluation.instances) {
    const d = e.kind === 'window' ? drawWindow(e) : e.kind === 'tunnel' ? drawTunnel(e) : e.kind === 'enclosure' ? drawEnclosure(e) : drawPlatform(e);
    drawn.set(e.id, d);
  }
  // each in its parent's group, so that moving a parent carries it
  for (const d of drawn.values()) {
    const parent = byId.get(d.id)?.parent;
    (parent && drawn.get(parent)?.group || root).add(d.group);
  }
  for (const d of drawn.values()) d.group.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });

  // The selection's outline, the flagged instances' outlines, the selection's handles, and a resize's preview box.
  const outlines: THREE.Object3D[] = [];
  const outlineMaterials = [SELECTED, FLAGGED].map(color => new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
  const handleMaterial = new THREE.MeshBasicMaterial({ color: HANDLE, depthTest: false, transparent: true, opacity: 0.85 });
  const ghostMaterial = new THREE.LineBasicMaterial({ color: HANDLE, depthTest: false, transparent: true });
  /** Each handle with the point on it that tests and readouts aim at, in its own frame. */
  const handles: { mesh: THREE.Object3D; name: string; aim: THREE.Vector3 }[] = [];
  let ghost: THREE.Box3Helper | null = null;
  const clearOverlays = () => {
    for (const o of outlines) { o.removeFromParent(); (o as THREE.LineSegments).geometry.dispose(); }
    outlines.length = 0;
    for (const { mesh } of handles) { mesh.removeFromParent(); mesh.traverse(o => { if (o instanceof THREE.Mesh) (o as THREE.Mesh).geometry.dispose(); }); }
    handles.length = 0;
    showGhost(null, null);
  };
  /** Shows the box a resize drag would give `id` (in its own frame), or nothing. */
  function showGhost(id: string | null, box: Box | null) {
    if (ghost) { ghost.removeFromParent(); ghost.geometry.dispose(); ghost = null; }
    const d = id ? drawn.get(id) : undefined; if (!d || !box) return;
    ghost = new THREE.Box3Helper(new THREE.Box3(new THREE.Vector3(...box.min), new THREE.Vector3(...box.max))); ghost.material = ghostMaterial; ghost.renderOrder = 12;
    frameOf(d).add(ghost);
  }
  /** The group an instance's handles go in: its own frame (a platform's board, which its pose moves). */
  const frameOf = (d: Drawn) => d.kind === 'platform' ? d.group.children[0] ?? d.group : d.group;
  const sizedOf = (id: string): Sized | null => {
    const i = byId.get(id);
    return i?.kind === 'enclosure' ? { kind: 'enclosure', params: i.params } : i?.kind === 'platform' ? { kind: 'platform', params: i.params } : null;
  };
  function addHandle(d: Drawn, mesh: THREE.Object3D, name: string, data: Record<string, string>, aim = new THREE.Vector3()) {
    mesh.traverse(o => { o.renderOrder = 11; });
    Object.assign(mesh.userData, { handleOf: d.id, ...data });
    frameOf(d).add(mesh); handles.push({ mesh, name, aim });
  }

  /** The bounds of an instance's own meshes (not its children's, nor its site context), in its group's frame. */
  function localBounds(d: Drawn): THREE.Box3 {
    d.group.updateWorldMatrix(true, true);
    const inverse = d.group.matrixWorld.clone().invert();
    const box = new THREE.Box3(); const part = new THREE.Box3(); const matrix = new THREE.Matrix4();
    const visit = (o: THREE.Object3D) => {
      if (o !== d.group && (o.userData['instanceId'] || CONTEXT.has(o.name))) return;
      if (o instanceof THREE.InstancedMesh) {
        const instanced = o as THREE.InstancedMesh; if (!instanced.boundingBox) instanced.computeBoundingBox();
        if (instanced.boundingBox) box.union(part.copy(instanced.boundingBox).applyMatrix4(matrix.multiplyMatrices(inverse, o.matrixWorld)));
      } else if (o instanceof THREE.Mesh && (o as THREE.Mesh).material !== proxyMaterial) {
        const geometry = (o as THREE.Mesh).geometry; if (!geometry.boundingBox) geometry.computeBoundingBox();
        if (geometry.boundingBox) box.union(part.copy(geometry.boundingBox).applyMatrix4(matrix.multiplyMatrices(inverse, o.matrixWorld)));
      }
      for (const child of o.children) visit(child);
    };
    visit(d.group);
    return box;
  }
  function outline(d: Drawn, material: THREE.LineBasicMaterial, grow: number) {
    const box = localBounds(d); if (box.isEmpty()) return;
    box.expandByScalar(grow);
    const helper = new THREE.Box3Helper(box); helper.material = material; helper.renderOrder = 10;
    d.group.add(helper); outlines.push(helper);
  }

  /** Outlines the selection, and the instances with problems; puts the `tool`'s handles on a single movable selection. */
  function mark(selection: string[], flagged: string[], tool: PlannerTool = 'move') {
    clearOverlays();
    for (const id of flagged) { const d = drawn.get(id); if (d) outline(d, outlineMaterials[1] as THREE.LineBasicMaterial, 30); }
    for (const id of selection) { const d = drawn.get(id); if (d) outline(d, outlineMaterials[0] as THREE.LineBasicMaterial, 15); }
    const [only] = selection; const d = only && selection.length === 1 ? drawn.get(only) : undefined;
    const sized = d && sizedOf(d.id);
    if (!d || !sized) return;
    if (tool !== 'resize') {
      // the ring turns it about its origin, round its outline
      const box = localBounds(d);
      const radius = d.kind === 'platform' ? Math.max(box.max.x - box.min.x, box.max.y - box.min.y) / 2 + 150
        : Math.max(Math.hypot(box.min.x, box.min.y), Math.hypot(box.max.x, box.max.y), Math.hypot(box.min.x, box.max.y), Math.hypot(box.max.x, box.min.y)) + 150;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 22, 8, 96), handleMaterial);
      ring.position.z = d.kind === 'platform' ? 0 : 15;
      addHandle(d, ring, 'rotate', { handle: 'rotate' }, new THREE.Vector3(radius, 0, 0));
    }
    if (tool === 'move' && d.kind === 'platform') {
      // the arrow raises or lowers the platform: off its front edge, so that seen from above it is not on the board
      const arrow = new THREE.Group(); arrow.position.set(0, sized.params.depth / 2 + 160, 120);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 160, 12), handleMaterial); shaft.rotation.x = Math.PI / 2; shaft.position.z = 80;
      const head = new THREE.Mesh(new THREE.ConeGeometry(45, 110, 16), handleMaterial); head.rotation.x = Math.PI / 2; head.position.z = 215;
      const tail = new THREE.Mesh(new THREE.ConeGeometry(45, 110, 16), handleMaterial); tail.rotation.x = -Math.PI / 2; tail.position.z = -55;
      arrow.add(shaft, head, tail);
      addHandle(d, arrow, 'elevate', { handle: 'elevate' }, new THREE.Vector3(0, 0, 80));
    }
    if (tool === 'resize') {
      for (const face of sizeFaces(sized)) {
        const [x, y, z] = facePoint(sized, face);
        const out = new THREE.Vector3(face[1] === 'x' ? 1 : 0, face[1] === 'y' ? 1 : 0, face[1] === 'z' ? 1 : 0).multiplyScalar(face[0] === '+' ? 70 : -70);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(110, 110, 110), handleMaterial); grip.position.set(x + out.x, y + out.y, z + out.z);
        addHandle(d, grip, `resize${face}`, { handle: 'resize', face });
      }
    }
  }

  /** The instance or handle a mesh belongs to. */
  function pickOf(hits: THREE.Intersection[]): PlannerPick | null {
    const ids: string[] = [];
    for (const hit of hits) {
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
        const handleOf = o.userData['handleOf'] as string | undefined;
        const handle = o.userData['handle'] as string | undefined;
        if (handleOf && handle === 'resize') return { kind: 'resize', id: handleOf, face: o.userData['face'] as SizeFace };
        if (handleOf && (handle === 'rotate' || handle === 'elevate')) return { kind: handle, id: handleOf };
        const id = o.userData['instanceId'] as string | undefined;
        if (id) { if (!ids.includes(id)) ids.push(id); break; }
      }
    }
    // a click through an enclosure's walls picks what stands in it
    let id = ids[0]; if (!id) return null;
    for (const other of ids) if (isInside(other, id)) id = other;
    return { kind: 'instance', id };
  }
  const isInside = (id: string, ancestor: string) => {
    for (let at = byId.get(id)?.parent ?? null, n = 0; at && n < 50; at = byId.get(at)?.parent ?? null, n++) if (at === ancestor) return true;
    return false;
  };

  /** Where each instance's anchor (and each handle: `rotate`, `elevate`, `resize+x`…) is on the screen, for tests and readouts. */
  function anchors(camera: THREE.Camera, size: { width: number; height: number }) {
    root.updateWorldMatrix(true, true); camera.updateMatrixWorld();
    const screen = (v: THREE.Vector3) => { const q = v.clone().project(camera); return [Math.round((q.x + 1) / 2 * size.width), Math.round((1 - q.y) / 2 * size.height)]; };
    const result: Record<string, number[]> = {};
    for (const d of drawn.values()) result[d.id] = screen(d.anchor.clone().applyMatrix4(d.group.matrixWorld));
    for (const { mesh, name, aim } of handles) {
      result[name] = screen(aim.clone().applyMatrix4(mesh.matrixWorld));
      if (name === 'rotate') result['rotate-centre'] = screen(new THREE.Vector3().applyMatrix4(mesh.matrixWorld));
    }
    return result;
  }

  return {
    root, drawn, mark, pickOf, anchors, localBounds, showGhost,
    /** Shows `id` at `t` (in its parent's frame) during a drag. */
    pose(id: string, t: Transform) { drawn.get(id)?.pose(t); },
    /** Redraws a tunnel along a route (its config and layout), for a drag's preview or to put it back. */
    redrawTunnel(id: string, layout: TunnelLayout | null, config: TunnelConfig | null) { drawn.get(id)?.redraw?.(layout, config); },
    dispose() {
      clearOverlays();
      for (const m of [...outlineMaterials, handleMaterial, ghostMaterial]) m.dispose();
      for (const d of drawn.values()) d.dispose();
      for (const f of disposers) f();
      root.removeFromParent();
    },
  };
}
export type PlannerScene = ReturnType<typeof createPlannerScene>;
