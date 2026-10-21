import * as THREE from 'three';
import {
  addTunnel, applyTransform, clampPlatform, CONNECT_REACH, connectTargets, elementTitle, evaluateProject, extendTunnel, platformOrientation, platformRangeOf, platformYaw, PLATFORM_RECIPES,
  portTitle, previewTunnels, raiseElements, rangeText, routeElements, snapToModules, tunnelPitch, worldTransforms, yawDirection,
  type EnclosureParams, type EvaluatedTunnel, type PlatformParams, type PlatformRange, type Project, type ProjectEvaluation, type Transform, type TunnelLayout,
} from '@canfactory/catio';
import { createStage, type Stage } from './stage.ts';
import { createPlannerScene, type PlannerScene, type PlannerTool } from './catioPlannerScene.ts';
import { facePoint, resizeFrom, type SizeFace, type Sized } from './catioPlannerHandles.ts';

/**
 * The planner's viewport: the stage, the scene drawn from the evaluated project, and direct manipulation. A click picks an instance
 * (or a handle of the selected one); dragging an enclosure moves it on the ground, the ring turns it in 15° steps, and in the Resize
 * tool a handle on a face drags that face. A platform is locked in its enclosure where its recipe holds (`platformRange`, the same
 * clamp its move command applies): its body or its double arrow slides it along its one free direction, its upright arrow raises or
 * lowers it, and its ring turns it West–East or North–South in quarter turns. A
 * drag on an instance or handle never orbits: the viewport takes the pointer before the camera's controls see it. In 3D empty space
 * orbits; the Top, Front and Side views are orthographic, and there it pans (FR-02.3). The middle (or right) button pans, the wheel
 * zooms.
 *
 * During a drag only the dragged instance's pose and the tunnels coupled to it (`previewTunnels`) are updated; nothing is evaluated
 * and the document is untouched until the drag ends, when `commit` makes it one edit. Esc (`cancel`) puts everything back. Raising
 * elements and growing or extending a tunnel preview the very edit they commit, evaluated: the evaluation lays out again only what a
 * step changes, and the scene builds again only the tunnels whose layout changed.
 *
 * A click on a tunnel picks the route element under the pointer; Shift- or Ctrl-click adds an object or element to the selection, or
 * takes it out. Selected elements rise and fall by their upright arrow, in 10 mm steps (snapping), as `raiseElements` would raise
 * them: the tunnels and the enclosure that follows are previewed, and `raise` makes it one edit.
 *
 * Tunnels grow in whole standard modules (FR-04.1–3): a click on a free cat port's marker selects it, and a drag from it out into the
 * garden previews a new tunnel (`addTunnel`) as long as the pointer has gone, `grow` making it one edit. A free end's arrow drags it
 * longer or shorter (`extendTunnel`), previewing the exact length and where the end lands; its buttons turn it left or right. The
 * readout says when the end is near a port it can be connected to (`connectTargets`).
 */
export const CAMERA_VIEWS = ['3D', 'Top', 'Front', 'Side'] as const;
export type CameraView = typeof CAMERA_VIEWS[number];
/** The garden grid's snap, and the yaw's steps (FR-02.5). Without snapping, whole millimetres and degrees. */
export const SNAP = { grid: 10, yaw: 15 } as const;
const MOVABLE = ['enclosure', 'platform'];
const RAD = Math.PI / 180;

/** What a drag shows while it is in progress, next to the pointer. */
export interface Readout { x: number; y: number; title: string; lines: string[]; ok: boolean }
export interface ViewportInput { project: Project; evaluation: ProjectEvaluation; selection: string[]; flagged: string[]; snap: boolean; tool: PlannerTool }
/** What a drag made of an instance: where it stands (in its parent's frame) and, a resize, its new size. */
export interface DragResult { how: Drag['how']; to: Transform; size?: Partial<EnclosureParams> | Partial<PlatformParams> }
export interface ViewportCallbacks {
  select: (ids: string[]) => void;
  readout: (readout: Readout | null) => void;
  /** Ends a drag as one edit. */
  commit: (id: string, result: DragResult) => void;
  /** Ends a drag of tunnel elements' arrow as one edit: raised by `delta` mm (lowered, negative). */
  raise: (ids: string[], delta: number) => void;
  /** Ends a drag from the free cat port `port` as one edit: a new tunnel of `modules` modules from it. */
  grow: (port: string, modules: number) => void;
  /** Ends a drag of a free tunnel end's arrow as one edit: `modules` more (fewer, negative). */
  extend: (end: string, modules: number) => void;
  /** A free tunnel end's turn button: one edit. */
  turn: (end: string, side: 'left' | 'right') => void;
}

interface Drag {
  id: string; how: 'move' | 'rotate' | 'elevate' | 'resize' | 'raise' | 'grow' | 'extend'; pointer: number; start: Transform; current: Transform;
  /**
   * Growing a tunnel from a port (`id` the port) or extending one at its free end (`id` the end's port): the way it runs out and where
   * from, in the site's frame, its module pitch, and its modules so far (a new tunnel's), or modules added (an extension's).
   */
  run?: { dir: THREE.Vector3; origin: THREE.Vector3; pitch: number; modules: number; least: number; tunnel: string | null };
  /** Raising tunnel elements: which, how far so far, and the instances the preview has posed elsewhere. */
  ids?: string[]; delta?: number; posed?: Set<string>;
  /** A resize's face, the instance's size and frame in the site's as it began, and its size so far. */
  face?: SizeFace; sized?: Sized; own: Transform; size?: DragResult['size'];
  /** The plane it is dragged on (z = const), and where the pointer took hold, in the site's frame. */
  plane: THREE.Plane; grab: THREE.Vector3;
  /** Its parent's frame in the site's. */
  parent: Transform;
  /** A platform's: where it can stand in its enclosure, as the move command clamps it. */
  range: PlatformRange | null;
  /** The pointer went down here; a drag starts once it has moved a few pixels. */
  down: [number, number]; moved: boolean;
  /** The tunnels it has redrawn. */
  tunnels: Set<string>;
}

/** Whole standard modules in a tunnel's sections. */
export const tunnelModules = (layout: TunnelLayout) =>
  Math.round(layout.pieces.filter(p => p.kind === 'section').reduce((n, p) => n + p.length + layout.pitch - layout.unitLength, 0) / layout.pitch);
const metres = (mm: number) => `${(mm / 1000).toFixed(2)} m`;
const cm = (mm: number) => (Math.round(mm) / 10).toLocaleString('en', { maximumFractionDigits: 1 });
const signed = (mm: number) => `${mm >= 0 ? '+' : '−'}${Math.abs(Math.round(mm))} mm`;
const snapTo = (value: number, step: number) => Math.round(value / step) * step;
const normalYaw = (yaw: number) => { const a = ((yaw % 360) + 360) % 360; return a > 180 ? a - 360 : a; };
const AXIS_TITLES = { x: 'West–East', y: 'North–South' } as const;

export function createPlannerViewport(element: HTMLElement, callbacks: ViewportCallbacks) {
  const stage: Stage | null = createStage(element, 'Catio planner. Drag an object to move it, the ring to turn it; drag empty space to orbit, the middle button to pan, scroll to zoom.', { scale: 25, workshopFloor: false });
  if (!stage) return null;
  const { camera, controls, group, renderer } = stage;
  /** The camera in use: perspective in 3D, orthographic in the Top, Front and Side views. */
  const view3d = () => stage.activeCamera();
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  let input: ViewportInput | null = null;
  let scene: PlannerScene | null = null;
  let drag: Drag | null = null;
  let emptyDown: [number, number] | null = null;
  const raycaster = new THREE.Raycaster();

  const canvasPoint = (event: PointerEvent): [number, number] => { const r = renderer.domElement.getBoundingClientRect(); return [event.clientX - r.left, event.clientY - r.top]; };
  /** The pointer's ray in the site's frame. */
  function rayAt([x, y]: [number, number]) {
    const r = renderer.domElement;
    raycaster.setFromCamera(new THREE.Vector2(x / r.clientWidth * 2 - 1, -(y / r.clientHeight) * 2 + 1), view3d());
    return raycaster;
  }
  const siteRay = (point: [number, number]) => rayAt(point).ray.clone().applyMatrix4(group.matrixWorld.clone().invert());

  function publishAnchors() {
    if (!scene) return;
    element.dataset['anchors'] = JSON.stringify(scene.anchors(view3d(), { width: renderer.domElement.clientWidth, height: renderer.domElement.clientHeight }));
  }
  controls.addEventListener('change', publishAnchors);
  // the stage sizes its canvas when the element is laid out: frame the site once it has a size, and keep the anchors true
  let framed = false;
  const resized = new ResizeObserver(() => {
    if (!renderer.domElement.clientWidth || !renderer.domElement.clientHeight) return;
    camera.aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight; camera.updateProjectionMatrix();
    if (!framed && input) { framed = true; view('3D'); }
    publishAnchors();
  });
  resized.observe(element);

  function update(next: ViewportInput) {
    const previous = input; input = next;
    const design = (p: Project | undefined) => p && [p.garden, p.settings, p.instances, p.ports, p.connections, p.attachments];
    const same = previous && design(previous.project)?.every((v, i) => v === design(next.project)?.[i]);
    if (!same || !scene) {
      if (drag) endDrag(false);
      scene?.dispose();
      scene = createPlannerScene(next.project, next.evaluation);
      group.add(scene.root);
      if (!framed && renderer.domElement.clientWidth) { framed = true; view('3D'); }
    }
    if (!drag) scene.mark(next.selection, next.flagged, next.tool);
    stage?.invalidate();
    publishAnchors();
    element.dataset['ready'] = 'true';
  }

  // Cameras: the presets and Fit all look at the whole site (the garden and everything in the design, inside it or not); Fit all and
  // Fit selection keep the way the camera looks.
  /** The bounds of the instances `ids` as drawn, in the site's frame. */
  function instanceBounds(ids: Iterable<string>): THREE.Box3 {
    const box = new THREE.Box3(); if (!scene) return box;
    const inverse = group.matrixWorld.clone().invert();
    for (const id of ids) {
      const d = scene.drawn.get(id); if (!d) continue;
      box.union(scene.localBounds(d).applyMatrix4(inverse.clone().multiply(d.group.matrixWorld)));
    }
    return box;
  }
  const siteBounds = () => input ? instanceBounds(input.project.instances.map(i => i.id)).union(new THREE.Box3(new THREE.Vector3(0, -300, 0), new THREE.Vector3(input.project.garden.width, input.project.garden.depth, 0))) : new THREE.Box3();
  let projection: 'perspective' | 'orthographic' = 'perspective';
  function frame(box: THREE.Box3, direction: THREE.Vector3) {
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere()); const radius = Math.max(sphere.radius, 300);
    let distance: number;
    if (projection === 'orthographic') {
      // as much above and below as the sphere needs, and across too on a narrow viewport; from far enough to see it all
      stage?.setProjection('orthographic', radius * 1.05 / Math.min(1, camera.aspect));
      distance = radius * 3 + 2000;
    } else {
      stage?.setProjection('perspective');
      const fov = camera.fov * RAD; const fit = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * camera.aspect));
      distance = radius / Math.sin(fit / 2) * 1.05;
    }
    stage?.lookAt(sphere.center.clone().addScaledVector(direction.clone().normalize(), distance), sphere.center);
    stage?.invalidate(); publishAnchors();
  }
  const DIRECTIONS: Record<CameraView, THREE.Vector3> = {
    '3D': new THREE.Vector3(1, 0.8, 0.75), Top: new THREE.Vector3(0, 0.002, 1), Front: new THREE.Vector3(0, 1, 0.12), Side: new THREE.Vector3(1, 0, 0.12),
  };
  const looking = () => group.worldToLocal(view3d().position.clone()).sub(group.worldToLocal(controls.target.clone()));
  /** A camera preset: 3D orbits in perspective; Top, Front and Side look along an axis, orthographically, and a drag pans them. */
  function view(name: CameraView) {
    projection = name === '3D' ? 'perspective' : 'orthographic';
    const orbit = projection === 'perspective';
    controls.enableRotate = orbit;
    controls.mouseButtons = { LEFT: orbit ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    element.dataset['projection'] = projection; element.dataset['view'] = name;
    frame(siteBounds(), DIRECTIONS[name]);
  }
  function fitAll() { frame(siteBounds(), looking()); }
  function fitSelection() { if (input?.selection.length) frame(instanceBounds(input.selection), looking()); }

  // Picking and dragging.
  function pickAt(point: [number, number]) {
    if (!scene) return null;
    return scene.pickOf(rayAt(point).intersectObject(scene.root, true));
  }
  function beginDrag(id: string, how: Drag['how'], point: [number, number], pointer: number, face?: SizeFace): Drag | null {
    if (!input || !scene) return null;
    const instance = input.project.instances.find(i => i.id === id);
    if (!instance || !MOVABLE.includes(instance.kind)) return null;
    const world = worldTransforms(input.project);
    const parent = instance.parent ? world.get(instance.parent) ?? { x: 0, y: 0, z: 0, yaw: 0 } : { x: 0, y: 0, z: 0, yaw: 0 };
    const own = world.get(id) ?? instance.transform;
    const sized: Sized | undefined = instance.kind === 'enclosure' ? { kind: 'enclosure', params: instance.params } : instance.kind === 'platform' ? { kind: 'platform', params: instance.params } : undefined;
    // the point it is held by: its face's handle, or its arrow above the board
    const held = face && sized ? applyTransform(own, (([x, y, z]) => ({ x, y, z }))(facePoint(sized, face))) : { x: own.x, y: own.y, z: own.z + 200 };
    let plane: THREE.Plane;
    if (how === 'elevate' || face === '+z') {
      // up and down: on the upright plane through the handle that faces the camera
      const toward = looking().setZ(0); if (toward.lengthSq() < 1e-6) toward.set(0, 1, 0);
      plane = new THREE.Plane().setFromNormalAndCoplanarPoint(toward.normalize(), new THREE.Vector3(held.x, held.y, held.z));
    } else {
      // an enclosure slides on the ground; a platform, the ring and a side's handle at their own height
      plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(face ? held.z : instance.kind === 'platform' ? own.z : 0));
    }
    const grab = siteRay(point).intersectPlane(plane, new THREE.Vector3());
    if (!grab) return null;
    return {
      id, how, pointer, start: { ...instance.transform }, current: { ...instance.transform }, plane, grab, parent, own, down: point, moved: false, tunnels: new Set(),
      range: platformRangeOf(input.project, id),
      ...(face ? { face } : {}), ...(sized ? { sized } : {}),
    };
  }
  /** Takes hold of the selected tunnel elements' arrow: they rise and fall on an upright plane through it, facing the camera. */
  function beginRaise(ids: string[], point: [number, number], pointer: number): Drag | null {
    if (!input || !scene) return null;
    const at = new THREE.Vector3(); const hitPoint = rayAt(point).intersectObject(scene.root, true)[0]?.point;
    if (hitPoint) at.copy(group.worldToLocal(hitPoint.clone())); else return null;
    const toward = looking().setZ(0); if (toward.lengthSq() < 1e-6) toward.set(0, 1, 0);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(toward.normalize(), at);
    const grab = siteRay(point).intersectPlane(plane, new THREE.Vector3()); if (!grab) return null;
    const none = { x: 0, y: 0, z: 0, yaw: 0 };
    return { id: ids[0] ?? '', how: 'raise', ids, delta: 0, posed: new Set(), pointer, start: none, current: none, plane, grab, parent: none, own: none, down: point, moved: false, tunnels: new Set(), range: null };
  }
  /** Takes hold of a free cat port's marker (a new tunnel from it) or a free tunnel end's arrow: the run goes on along the ground. */
  function beginRun(id: string, how: 'grow' | 'extend', point: [number, number], pointer: number): Drag | null {
    if (!input) return null;
    const none = { x: 0, y: 0, z: 0, yaw: 0 };
    let run: NonNullable<Drag['run']>;
    if (how === 'grow') {
      const port = input.evaluation.ports.find(p => p.id === id); if (!port) return null;
      const [dx, dy] = yawDirection(port.world.yaw);
      run = { dir: new THREE.Vector3(dx, dy, 0), origin: new THREE.Vector3(port.world.x, port.world.y, port.world.z), pitch: tunnelPitch({ w: port.size }, input.project.settings.tunnelCoupling), modules: 0, least: 1, tunnel: null };
    } else {
      const e = input.evaluation.instances.find((t): t is EvaluatedTunnel => t.kind === 'tunnel' && t.ends.end.port === id);
      const tunnel = e && input.project.instances.find(i => i.id === e.id);
      if (!e?.layout || tunnel?.kind !== 'tunnel') return null;
      const yaw = e.world.yaw * RAD; const [ex, ey] = e.layout.dE;
      const end = applyTransform(e.world, { x: e.layout.E[0], y: e.layout.E[1], z: e.layout.E[2] });
      const total = tunnel.params.route.reduce((n, x) => n + x.modules, 0);
      run = { dir: new THREE.Vector3(Math.cos(yaw) * ex - Math.sin(yaw) * ey, Math.sin(yaw) * ex + Math.cos(yaw) * ey, 0).normalize(), origin: new THREE.Vector3(end.x, end.y, end.z), pitch: e.layout.pitch, modules: 0, least: 1 - total, tunnel: e.id };
    }
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -run.origin.z);
    const grab = siteRay(point).intersectPlane(plane, new THREE.Vector3()); if (!grab) return null;
    return { id, how, run, pointer, start: none, current: none, plane, grab, parent: none, own: none, down: point, moved: false, tunnels: new Set(), range: null };
  }
  /** Shows the run the pointer has dragged out: a new tunnel drawn, or the tunnel extended; the readout says how long and what is near. */
  function previewRun(d: Drag, point: [number, number]) {
    if (!input || !scene || !d.run) return;
    const { modules, tunnel } = d.run;
    const result = d.how === 'grow' ? addTunnel(input.project, d.id, modules) : extendTunnel(input.project, d.id, modules);
    const title = d.how === 'grow' ? `New tunnel from ${portTitle(input.project, d.id)}` : `${modules >= 0 ? 'Extending' : 'Shortening'} ${input.project.instances.find(i => i.id === tunnel)?.name ?? tunnel ?? ''}`;
    if (d.how === 'extend' && modules === 0) {
      const e = input.evaluation.instances.find(t => t.id === tunnel);
      if (e?.kind === 'tunnel') scene.redrawTunnel(e.id, e.layout, e.config);
      callbacks.readout({ x: point[0], y: point[1], title, lines: ['As it is'], ok: true });
      stage?.invalidate(); publishAnchors(); return;
    }
    if (result.errors.length) { callbacks.readout({ x: point[0], y: point[1], title, lines: result.errors, ok: false }); return; }
    const evaluation = evaluateProject(result.project);
    const id = 'id' in result ? result.id : tunnel;
    const e = evaluation.instances.find((t): t is EvaluatedTunnel => t.kind === 'tunnel' && t.id === id);
    if (!e?.layout) return;
    if (d.how === 'grow') scene.ghostTunnel(e); else { scene.redrawTunnel(e.id, e.layout, e.config); d.tunnels.add(e.id); }
    stage?.invalidate(); publishAnchors();
    const near = e.ends.end.port ? connectTargets(result.project, e.ends.end.port, evaluation).find(t => t.distance <= CONNECT_REACH) : undefined;
    callbacks.readout({ x: point[0], y: point[1], title, ok: true, lines: [
      `${tunnelModules(e.layout)} modules · ${metres(e.layout.totalLength)}${d.how === 'extend' ? ` (${modules > 0 ? '+' : '−'}${Math.abs(modules)})` : ''}`,
      ...(near ? [`Near ${portTitle(result.project, near.port)} (${Math.round(near.distance)} mm): connect it there`] : []),
    ] });
  }
  /** Shows the selected elements raised by `delta`: their tunnels laid out again, an enclosure that follows moved; the readout says how. */
  function previewRaise(d: Drag, delta: number, point: [number, number]) {
    if (!input || !scene) return;
    const ids = d.ids ?? [];
    const result = raiseElements(input.project, ids, delta);
    const title = `${delta >= 0 ? 'Raising' : 'Lowering'} ${ids.length === 1 ? elementTitle(input.project, ids[0] ?? '') ?? 'the element' : `${ids.length} elements`}`;
    if (result.errors.length) { callbacks.readout({ x: point[0], y: point[1], title, lines: result.errors, ok: false }); return; }
    const evaluation = evaluateProject(result.project);
    // (a tunnel the step leaves as it is keeps its layout, and is not built again)
    for (const e of evaluation.instances) if (e.kind === 'tunnel') { scene.redrawTunnel(e.id, e.layout, e.config); d.tunnels.add(e.id); }
    for (const i of result.project.instances) {
      const was = input.project.instances.find(q => q.id === i.id);
      if (was && JSON.stringify(was.transform) !== JSON.stringify(i.transform)) { scene.pose(i.id, i.transform); d.posed?.add(i.id); }
    }
    stage?.invalidate(); publishAnchors();
    const elements = routeElements(result.project);
    const laid = new Map(evaluation.instances.flatMap(e => e.kind === 'tunnel' ? e.elements.map(x => [x.id, x] as const) : []));
    const lines = [signed(delta), ...ids.slice(0, 4).map(id => {
      const x = laid.get(id); const found = elements.get(id);
      return x && found ? `${elementTitle(result.project, id) ?? id}: floor ${cm(x.floor[0])}${Math.abs(x.floor[1] - x.floor[0]) > 0.5 ? `–${cm(x.floor[1])}` : ''} cm` : id;
    }), ...(result.notes ?? [])];
    const steep = evaluation.issues.filter(i => i.severity === 'error' && i.instanceIds.some(id => elements.has(id)));
    callbacks.readout({ x: point[0], y: point[1], title, lines: [...lines, ...steep.slice(0, 2).map(i => i.message)], ok: steep.length === 0 });
  }
  function dragTo(point: [number, number]) {
    if (!drag || !input || !scene) return;
    if (!drag.moved && Math.hypot(point[0] - drag.down[0], point[1] - drag.down[1]) < 4) return;
    drag.moved = true;
    const hit = siteRay(point).intersectPlane(drag.plane, new THREE.Vector3()); if (!hit) return;
    if (drag.how === 'raise') {
      const delta = snapTo(hit.z - drag.grab.z, input.snap ? SNAP.grid : 1);
      if (delta === drag.delta) return;
      drag.delta = delta;
      previewRaise(drag, delta, point);
      return;
    }
    if (drag.run) {
      // whole modules, the pitch the standard element makes (FR-02.5): as far out as the pointer has gone
      const along = (drag.how === 'grow' ? hit.clone().sub(drag.run.origin) : hit.clone().sub(drag.grab)).dot(drag.run.dir);
      const modules = Math.max(drag.run.least, Math.round(along / drag.run.pitch));
      if (modules === drag.run.modules) return;
      drag.run.modules = modules;
      previewRun(drag, point);
      return;
    }
    const { start, parent } = drag; const snap = input.snap;
    let to: Transform;
    const name = input.project.instances.find(i => i.id === drag?.id)?.name ?? drag.id;
    const { range } = drag;
    if (drag.how === 'elevate') {
      const wanted = snapTo(start.z + hit.z - drag.grab.z, snap ? SNAP.grid : 1);
      to = range ? clampPlatform(range, { ...start, z: wanted }, drag.current.z) : { ...start, z: wanted };
      if (to.z === drag.current.z) return;
      drag.current = to; scene.pose(drag.id, to); stage?.invalidate(); publishAnchors();
      callbacks.readout({ x: point[0], y: point[1], title: `Raising ${name}`, ok: true, lines: [
        `Elevation ${cm(to.z)} cm (${signed(to.z - start.z)})`, ...(range ? [`Range ${rangeText(range.heights)}${to.z !== wanted ? ' · at its limit' : ''}`] : []),
      ] });
      return;
    }
    if (drag.how === 'resize' && drag.face && drag.sized) {
      // how far the pointer pulled the face out, along its own axis
      const axis = drag.face[1]; const sign = drag.face[0] === '+' ? 1 : -1; const yaw = drag.own.yaw * RAD;
      const out = axis === 'x' ? [Math.cos(yaw), Math.sin(yaw)] : [-Math.sin(yaw), Math.cos(yaw)];
      const delta = axis === 'z' ? hit.z - drag.grab.z : sign * ((hit.x - drag.grab.x) * (out[0] ?? 0) + (hit.y - drag.grab.y) * (out[1] ?? 0));
      // a platform's board spans its frames and fits between the inside faces, as its resize command keeps it
      const max = range ? (axis === 'x' ? range.span : axis === 'y' ? range.room : undefined) : undefined;
      const r = resizeFrom(drag.sized, start, drag.face, delta, snap ? SNAP.grid : 1, max);
      if (drag.size ? JSON.stringify(r.size) === JSON.stringify(drag.size) : r.change === 0) return;
      drag.current = r.transform; drag.size = r.size;
      scene.showGhost(drag.id, r.box); stage?.invalidate();
      const label = { width: 'Width', depth: 'Depth', height: 'Height' }[r.key];
      callbacks.readout({ x: point[0], y: point[1], title: `Resizing ${name}`, lines: [`${label} ${cm(r.value)} cm (${signed(r.change)})`], ok: true });
      return;
    }
    if (drag.how === 'move') {
      // the pointer's travel, turned into the parent's frame
      const dx = hit.x - drag.grab.x; const dy = hit.y - drag.grab.y; const c = Math.cos(-parent.yaw * RAD); const s = Math.sin(-parent.yaw * RAD);
      const step = snap ? SNAP.grid : 1;
      const travel = { x: c * dx - s * dy, y: s * dx + c * dy };
      if (range) {
        // a platform slides along its free direction only, and stops at the inside faces
        to = clampPlatform(range, { ...start, [range.free]: snapTo(start[range.free] + travel[range.free], step) });
      } else {
        to = { ...start, x: snapTo(start.x + travel.x, step), y: snapTo(start.y + travel.y, step) };
        if (snap) to = snapToModules(input.project, input.evaluation, drag.id, to);
      }
    } else {
      const origin = new THREE.Vector3(parent.x + Math.cos(parent.yaw * RAD) * start.x - Math.sin(parent.yaw * RAD) * start.y, parent.y + Math.sin(parent.yaw * RAD) * start.x + Math.cos(parent.yaw * RAD) * start.y, 0);
      const angle = (v: THREE.Vector3) => Math.atan2(v.y - origin.y, v.x - origin.x) / RAD;
      const yaw = start.yaw + angle(hit) - angle(drag.grab);
      // a platform runs West–East or North–South: quarter turns, snapping or not
      to = { ...start, yaw: normalYaw(range ? platformYaw(yaw) : snapTo(yaw, snap ? SNAP.yaw : 1)) };
    }
    if (JSON.stringify(to) === JSON.stringify(drag.current)) return;
    drag.current = to;
    scene.pose(drag.id, to);
    // only the tunnels this moves are solved again
    const tunnels = previewTunnels(input.project, input.evaluation, new Map([[drag.id, to]]));
    for (const t of tunnels) { scene.redrawTunnel(t.id, t.layout, t.config); scene.pose(t.id, t.world); drag.tunnels.add(t.id); }
    stage?.invalidate();
    const turn = `Yaw ${Math.round(to.yaw)}° (${to.yaw - start.yaw >= 0 ? '+' : '−'}${Math.abs(Math.round(normalYaw(to.yaw - start.yaw)))}°)`;
    const lines = drag.how === 'move'
      ? range ? [`${AXIS_TITLES[range.free]} ${cm(to[range.free])} cm (${signed(to[range.free] - start[range.free])})`, `Range ${rangeText([range.along])}`]
        : [`x ${metres(to.x)} (${signed(to.x - start.x)})`, `y ${metres(to.y)} (${signed(to.y - start.y)})`]
      : range ? [`${turn} · ${PLATFORM_RECIPES[platformOrientation(platformYaw(to.yaw)) ?? 'west-east'].title}`] : [turn];
    for (const t of tunnels) lines.push(t.layout ? `Tunnel: ${tunnelModules(t.layout)} modules${t.reaches ? '' : ' · does not reach'}` : 'Tunnel: no route');
    callbacks.readout({ x: point[0], y: point[1], title: `${drag.how === 'move' ? 'Moving' : 'Turning'} ${name}`, lines, ok: tunnels.every(t => t.reaches) });
  }
  /** Ends the drag: committed as one edit, or (Esc) put back. */
  function endDrag(commit: boolean) {
    const d = drag; drag = null; controls.enabled = true;
    callbacks.readout(null);
    if (!d) return;
    scene?.ghostTunnel(null);
    if (commit && d.how === 'raise') { if (d.moved && d.delta) { callbacks.raise(d.ids ?? [], d.delta); return; } }
    else if (commit && d.run) {
      if (d.moved && d.how === 'grow' && d.run.modules >= 1) { callbacks.grow(d.id, d.run.modules); return; }
      if (d.moved && d.how === 'extend' && d.run.modules) { callbacks.extend(d.id, d.run.modules); return; }
    }
    else if (commit && d.moved && (d.how !== 'resize' || d.size)) { callbacks.commit(d.id, { how: d.how, to: d.current, ...(d.size ? { size: d.size } : {}) }); return; }
    if (!scene || !input) return;
    scene.pose(d.id, d.start); scene.showGhost(null, null);
    for (const id of d.posed ?? []) { const i = input.project.instances.find(q => q.id === id); if (i) scene.pose(id, i.transform); }
    for (const id of d.tunnels) {
      const e = input.evaluation.instances.find(i => i.id === id);
      scene.redrawTunnel(id, e?.kind === 'tunnel' ? e.layout : null, e?.kind === 'tunnel' ? e.config : null);
      if (e) scene.pose(id, e.world);
    }
    scene.mark(input.selection, input.flagged, input.tool);
    stage?.invalidate(); publishAnchors();
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || !input) return;
    const point = canvasPoint(event);
    const pick = pickAt(point);
    if (!pick) { emptyDown = point; return; }
    // what the pointer is on is the viewport's: the camera's controls never see it
    event.stopPropagation(); event.preventDefault();
    emptyDown = null;
    // Shift or Ctrl adds to the selection, or takes out what is in it
    if (pick.kind === 'instance' && (event.shiftKey || event.ctrlKey || event.metaKey)) {
      callbacks.select(input.selection.includes(pick.id) ? input.selection.filter(id => id !== pick.id) : [...input.selection, pick.id]);
      return;
    }
    if (pick.kind === 'turn') { callbacks.turn(pick.id, pick.side); return; }
    if ((pick.kind === 'instance' || pick.kind === 'port') && !(input.selection.length === 1 && input.selection[0] === pick.id)) callbacks.select([pick.id]);
    // the body moves the selection, or turns it in the Rotate tool; a handle does what it is for; tunnel elements rise by their arrow;
    // a port's marker grows a new tunnel, a free end's arrow extends its tunnel
    const elements = routeElements(input.project);
    let next: Drag | null;
    if (pick.kind === 'port' || pick.kind === 'extend') next = beginRun(pick.id, pick.kind === 'port' ? 'grow' : 'extend', point, event.pointerId);
    else if (pick.kind === 'elevate' && elements.has(pick.id)) next = beginRaise(input.selection.filter(id => elements.has(id)), point, event.pointerId);
    else {
      const how: Drag['how'] = pick.kind === 'instance' ? (input.tool === 'rotate' ? 'rotate' : 'move') : pick.kind === 'slide' ? 'move' : pick.kind;
      next = beginDrag(pick.id, how, point, event.pointerId, pick.kind === 'resize' ? pick.face : undefined);
    }
    if (!next) return;
    drag = next; controls.enabled = false;
    element.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent) {
    if (drag && event.pointerId === drag.pointer) { dragTo(canvasPoint(event)); return; }
    if (event.buttons) return;
    // the cursor tells what a press would do: one pick a frame, however fast the pointer moves
    hover = canvasPoint(event);
    if (!hoverFrame) hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0; if (!hover) return;
      const pick = pickAt(hover);
      const kind = pick && input?.project.instances.find(i => i.id === pick.id)?.kind;
      renderer.domElement.style.cursor = pick?.kind === 'port' ? 'copy' : pick?.kind === 'extend' ? 'move' : pick?.kind === 'turn' ? 'pointer' : pick?.kind === 'rotate' ? 'grab' : pick?.kind === 'elevate' ? 'ns-resize' : pick?.kind === 'slide' ? 'move' : pick?.kind === 'resize' ? (pick.face === '+z' ? 'ns-resize' : 'ew-resize')
        : kind && MOVABLE.includes(kind) ? (input?.tool === 'rotate' ? 'grab' : 'move') : pick ? 'pointer' : '';
    });
  }
  let hover: [number, number] | null = null; let hoverFrame = 0;
  function onPointerUp(event: PointerEvent) {
    if (drag && event.pointerId === drag.pointer) {
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      endDrag(true); return;
    }
    // a click on empty space (not an orbit) clears the selection
    const point = canvasPoint(event);
    if (emptyDown && Math.hypot(point[0] - emptyDown[0], point[1] - emptyDown[1]) < 4) callbacks.select([]);
    emptyDown = null;
  }
  const onCancel = (event: PointerEvent) => { if (drag && event.pointerId === drag.pointer) endDrag(false); };
  element.addEventListener('pointerdown', onPointerDown, { capture: true });
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onCancel);

  return {
    update, view, fitAll, fitSelection,
    /** Esc: abandons the drag in progress. True when there was one. */
    cancel() { if (!drag) return false; endDrag(false); return true; },
    dragging: () => drag !== null,
    dispose() {
      element.removeEventListener('pointerdown', onPointerDown, { capture: true });
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onCancel);
      controls.removeEventListener('change', publishAnchors); resized.disconnect(); cancelAnimationFrame(hoverFrame);
      scene?.dispose(); stage.dispose();
      delete element.dataset['ready']; delete element.dataset['anchors'];
    },
  };
}
export type PlannerViewport = NonNullable<ReturnType<typeof createPlannerViewport>>;
