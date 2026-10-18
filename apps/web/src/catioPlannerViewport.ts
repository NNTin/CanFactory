import * as THREE from 'three';
import { applyTransform, previewTunnels, snapToModules, worldTransforms, type EnclosureParams, type PlatformParams, type Project, type ProjectEvaluation, type Transform, type TunnelLayout } from '@canfactory/catio';
import { createStage, type Stage } from './stage.ts';
import { createPlannerScene, type PlannerScene, type PlannerTool } from './catioPlannerScene.ts';
import { facePoint, resizeFrom, type SizeFace, type Sized } from './catioPlannerHandles.ts';

/**
 * The planner's viewport: the stage, the scene drawn from the evaluated project, and direct manipulation. A click picks an instance
 * (or a handle of the selected one); dragging an enclosure moves it on the ground, a platform within its enclosure at its elevation
 * (its arrow raises or lowers it), the ring turns either in 15° steps, and in the Resize tool a handle on a face drags that face. A
 * drag on an instance or handle never orbits: the viewport takes the pointer before the camera's controls see it. In 3D empty space
 * orbits; the Top, Front and Side views are orthographic, and there it pans (FR-02.3). The middle (or right) button pans, the wheel
 * zooms.
 *
 * During a drag only the dragged instance's pose and the tunnels coupled to it (`previewTunnels`) are updated; nothing is evaluated
 * and the document is untouched until the drag ends, when `commit` makes it one edit. Esc (`cancel`) puts everything back.
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
}

interface Drag {
  id: string; how: 'move' | 'rotate' | 'elevate' | 'resize'; pointer: number; start: Transform; current: Transform;
  /** A resize's face, the instance's size and frame in the site's as it began, and its size so far. */
  face?: SizeFace; sized?: Sized; own: Transform; size?: DragResult['size'];
  /** The plane it is dragged on (z = const), and where the pointer took hold, in the site's frame. */
  plane: THREE.Plane; grab: THREE.Vector3;
  /** Its parent's frame in the site's. */
  parent: Transform;
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
      ...(face ? { face } : {}), ...(sized ? { sized } : {}),
    };
  }
  function dragTo(point: [number, number]) {
    if (!drag || !input || !scene) return;
    if (!drag.moved && Math.hypot(point[0] - drag.down[0], point[1] - drag.down[1]) < 4) return;
    drag.moved = true;
    const hit = siteRay(point).intersectPlane(drag.plane, new THREE.Vector3()); if (!hit) return;
    const { start, parent } = drag; const snap = input.snap;
    let to: Transform;
    const name = input.project.instances.find(i => i.id === drag?.id)?.name ?? drag.id;
    if (drag.how === 'elevate') {
      to = { ...start, z: snapTo(start.z + hit.z - drag.grab.z, snap ? SNAP.grid : 1) };
      if (to.z === drag.current.z) return;
      drag.current = to; scene.pose(drag.id, to); stage?.invalidate(); publishAnchors();
      callbacks.readout({ x: point[0], y: point[1], title: `Raising ${name}`, lines: [`Elevation ${cm(to.z)} cm (${signed(to.z - start.z)})`], ok: true });
      return;
    }
    if (drag.how === 'resize' && drag.face && drag.sized) {
      // how far the pointer pulled the face out, along its own axis
      const axis = drag.face[1]; const sign = drag.face[0] === '+' ? 1 : -1; const yaw = drag.own.yaw * RAD;
      const out = axis === 'x' ? [Math.cos(yaw), Math.sin(yaw)] : [-Math.sin(yaw), Math.cos(yaw)];
      const delta = axis === 'z' ? hit.z - drag.grab.z : sign * ((hit.x - drag.grab.x) * (out[0] ?? 0) + (hit.y - drag.grab.y) * (out[1] ?? 0));
      const r = resizeFrom(drag.sized, start, drag.face, delta, snap ? SNAP.grid : 1);
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
      to = { ...start, x: snapTo(start.x + c * dx - s * dy, step), y: snapTo(start.y + s * dx + c * dy, step) };
      if (snap) to = snapToModules(input.project, input.evaluation, drag.id, to);
    } else {
      const origin = new THREE.Vector3(parent.x + Math.cos(parent.yaw * RAD) * start.x - Math.sin(parent.yaw * RAD) * start.y, parent.y + Math.sin(parent.yaw * RAD) * start.x + Math.cos(parent.yaw * RAD) * start.y, 0);
      const angle = (v: THREE.Vector3) => Math.atan2(v.y - origin.y, v.x - origin.x) / RAD;
      to = { ...start, yaw: normalYaw(snapTo(start.yaw + angle(hit) - angle(drag.grab), snap ? SNAP.yaw : 1)) };
    }
    if (JSON.stringify(to) === JSON.stringify(drag.current)) return;
    drag.current = to;
    scene.pose(drag.id, to);
    // only the tunnels this moves are solved again
    const tunnels = previewTunnels(input.project, input.evaluation, new Map([[drag.id, to]]));
    for (const t of tunnels) { scene.redrawTunnel(t.id, t.layout, t.config); drag.tunnels.add(t.id); }
    stage?.invalidate();
    const lines = drag.how === 'move'
      ? [`x ${metres(to.x)} (${signed(to.x - start.x)})`, `y ${metres(to.y)} (${signed(to.y - start.y)})`]
      : [`Yaw ${Math.round(to.yaw)}° (${to.yaw - start.yaw >= 0 ? '+' : '−'}${Math.abs(Math.round(normalYaw(to.yaw - start.yaw)))}°)`];
    for (const t of tunnels) lines.push(t.layout ? `Tunnel: ${tunnelModules(t.layout)} modules${t.reaches ? '' : ' · does not reach'}` : 'Tunnel: no route');
    callbacks.readout({ x: point[0], y: point[1], title: `${drag.how === 'move' ? 'Moving' : 'Turning'} ${name}`, lines, ok: tunnels.every(t => t.reaches) });
  }
  /** Ends the drag: committed as one edit, or (Esc) put back. */
  function endDrag(commit: boolean) {
    const d = drag; drag = null; controls.enabled = true;
    callbacks.readout(null);
    if (!d) return;
    if (commit && d.moved && (d.how !== 'resize' || d.size)) { callbacks.commit(d.id, { how: d.how, to: d.current, ...(d.size ? { size: d.size } : {}) }); return; }
    if (!scene || !input) return;
    scene.pose(d.id, d.start); scene.showGhost(null, null);
    for (const id of d.tunnels) {
      const e = input.evaluation.instances.find(i => i.id === id);
      scene.redrawTunnel(id, e?.kind === 'tunnel' ? e.layout : null, e?.kind === 'tunnel' ? e.config : null);
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
    if (pick.kind === 'instance' && !(input.selection.length === 1 && input.selection[0] === pick.id)) callbacks.select([pick.id]);
    // the body moves the selection, or turns it in the Rotate tool; a handle does what it is for
    const how: Drag['how'] = pick.kind === 'instance' ? (input.tool === 'rotate' ? 'rotate' : 'move') : pick.kind;
    const next = beginDrag(pick.id, how, point, event.pointerId, pick.kind === 'resize' ? pick.face : undefined);
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
      renderer.domElement.style.cursor = pick?.kind === 'rotate' ? 'grab' : pick?.kind === 'elevate' ? 'ns-resize' : pick?.kind === 'resize' ? (pick.face === '+z' ? 'ns-resize' : 'ew-resize')
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
