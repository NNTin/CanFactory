import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Atom, Box, Eye, EyeOff, FlipVertical2, Grid2X2, Pause, Play, RotateCcw } from 'lucide-react';
import { assemblyOffset, assemblyScale, assemblyState, assemblyStops, motionFrames, motionPose, type Assembly, type AssemblyState, type PhysicsSpec } from '@canfactory/contracts';
import type { PhysicsRequest, PhysicsUpdate } from '@canfactory/physics';
import { unzipSync } from 'fflate';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import type { ReferenceObject } from './referenceObjects.ts';
import { viewerGrid } from './viewerLayout.ts';
import { createStage, smoothNormals } from './stage.ts';

/**
 * One mesh to show: STL `bytes`, or a `geometry` built from a library part's dimensions (e.g. a magnet). `reference` marks a
 * real-world object from the assembly (e.g. a lighter), shown in its own colour: it is not printed.
 */
type Part = { name: string; reference?: boolean } & ({ bytes: ArrayBuffer } | { geometry: THREE.BufferGeometry });

interface SceneController {
  /**
   * Replaces every mesh with one per part, auto-arranged in a grid. A single part sits centred, exactly as before. With an
   * assembly, the grid is where the assembly slider starts (see `setProgress`).
   */
  setParts: (parts: Part[], assembly?: Assembly) => LoadedPart[];
  /** Hides the parts with these ids and shows every other one (parts load visible); kept for the parts loaded later. */
  setHidden: (hidden: ReadonlySet<string>) => void;
  /** Places the parts for the assembly slider at `t` (0 = print bed, 1 = assembled); no-op without an assembly. */
  setProgress: (t: number) => void;
  reset: () => void;
  wireframe: (enabled: boolean) => void;
  /** The physics: each body's mesh as triangles in its part's frame (mm), as the interactive mode's worker takes them. */
  physicsMeshes: (ids: readonly string[]) => Record<string, Float32Array>;
  /** Places the parts at these poses (the physics' start), leaving the others where they are. */
  placeAt: (poses: Record<string, Pose>) => void;
  /** Moves the bodies to the physics' poses: per body, its position (mm) and orientation (w, x, y, z). */
  setBodyPoses: (bodies: readonly string[], poses: Float64Array) => void;
  /** The body under the pointer and the point hit (mm, the parts' frame); it also fixes the plane `dragPoint` moves in. */
  pick: (clientX: number, clientY: number, bodies: readonly string[]) => { id: string; point: [number, number, number] } | undefined;
  /** Where the pointer is on the plane through the picked point, facing the camera (mm, the parts' frame). */
  dragPoint: (clientX: number, clientY: number) => [number, number, number] | undefined;
  /** Switches the camera's orbit controls on and off (off while a part is dragged). */
  setOrbit: (enabled: boolean) => void;
  /** Where each of these parts' bounding-box centres is on the screen (client pixels), for the page's tests. */
  screenCentres: (ids: readonly string[]) => Record<string, [number, number]>;
}

/** A part as the viewer shows it, for the parts list: its id (the STL name without `.stl`) and whether it is a reference object. */
interface LoadedPart { id: string; reference: boolean }

const GRID_ROTATION = new THREE.Quaternion();
const UNIT = [1, 1, 1];

type Pose = Assembly['poses'][string];
const poseRotation = (pose: Pose, target: THREE.Quaternion) => {
  const [rx, ry, rz] = (pose.rotation ?? [0, 0, 0]).map(THREE.MathUtils.degToRad) as [number, number, number];
  return target.setFromEuler(new THREE.Euler(rx, ry, rz, 'ZYX'));
};

/** One part's mesh: where it lies on the print bed, and how the assembly slider moves it from there. */
class Placement {
  private readonly rotation = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  private readonly next = new THREE.Quaternion();
  constructor(readonly id: string, readonly mesh: THREE.Mesh, private readonly grid: THREE.Vector3) {}

  /**
   * Blends from the print bed to the part's (offset) assembled pose while the parts are lifted, then follows the steps, then the
   * movements (`frames`, from `motionFrames`): between two frames, rigidly, its rotation along the shorter arc (its scale, if it has
   * one, linearly).
   */
  apply(assembly: Assembly, state: AssemblyState, frames: ReturnType<typeof motionFrames>) {
    const moving = motionPose(frames, this.id, state);
    if (moving) {
      poseRotation(moving.from, this.rotation); poseRotation(moving.to, this.next);
      this.mesh.quaternion.slerpQuaternions(this.rotation, this.next, moving.f);
      this.mesh.position.lerpVectors(this.position.fromArray(moving.from.position), new THREE.Vector3().fromArray(moving.to.position), moving.f);
      this.mesh.scale.lerpVectors(new THREE.Vector3().fromArray(moving.from.scale ?? UNIT), new THREE.Vector3().fromArray(moving.to.scale ?? UNIT), moving.f);
      return;
    }
    const pose = assembly.poses[this.id];
    if (!pose) { this.mesh.position.copy(this.grid); this.mesh.quaternion.identity(); this.mesh.scale.set(1, 1, 1); return; }
    poseRotation(pose, this.rotation);
    this.position.fromArray(pose.position).add(new THREE.Vector3().fromArray(assemblyOffset(assembly, this.id, state)));
    this.mesh.quaternion.slerpQuaternions(GRID_ROTATION, this.rotation, state.arrange);
    this.mesh.position.lerpVectors(this.grid, this.position, state.arrange);
    // squeezed parts (a compressed spring) take their scale as they leave the print bed
    this.mesh.scale.lerpVectors(new THREE.Vector3(1, 1, 1), new THREE.Vector3().fromArray(assemblyScale(assembly, this.id, state)), state.arrange);
  }
}

/** Splits a fetched ZIP into its STL entries, in archive order. Throws if it contains no entries. */
function partsFromZip(bytes: ArrayBuffer): Part[] {
  const entries = unzipSync(new Uint8Array(bytes));
  const parts = Object.entries(entries).map(([name, data]): Part => ({ name, bytes: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) }));
  if (parts.length === 0) throw new Error('The preview archive contained no parts.');
  return parts;
}

/** The caption for slider value `t`: the movement that is playing, or that has just finished at a stop. */
function assemblyCaption(assembly: Assembly, t: number): string {
  const motion = assembly.motion ?? [];
  if (t <= 0) return 'Parts as printed';
  if (t >= 1) return motion.length > 0 ? `Movement ${motion.length} of ${motion.length} · ${motion.at(-1)?.title ?? ''}` : 'Assembled';
  const segment = Math.ceil(t * (assembly.steps.length + 1 + motion.length) - 1e-6);
  const step = assembly.steps[segment - 2];
  if (step) return `Step ${segment - 1} of ${assembly.steps.length} · ${step.title}`;
  const movement = motion[segment - 2 - assembly.steps.length];
  return movement ? `Movement ${segment - 1 - assembly.steps.length} of ${motion.length} · ${movement.title}` : 'Lift and lay out the parts';
}

/** Seconds the play button spends on each of the slider's segments. */
const PLAY_SECONDS = 2.4;

/**
 * Displays the actual downloadable file(s). Camera controls do not change model dimensions. With an assembly, a slider takes the
 * parts from the print bed to the finished assembly, together with its reference objects (`references`), which are not in the file.
 * Every part is shown by default; the parts list under the slider hides or shows each one (`partTitles` names them).
 */
export function Viewer({ url, format, assembly, references = [], partTitles = {}, physics, onError, onLoaded }: { url: string | null; format: 'stl' | 'zip'; assembly?: Assembly | undefined; references?: ReferenceObject[]; partTitles?: Record<string, string>; physics?: PhysicsSpec | undefined; onError: (message: string) => void; onLoaded: (url: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneController | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadedParts, setLoadedParts] = useState<LoadedPart[]>([]);
  const [shownAssembly, setShownAssembly] = useState<Assembly>();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [playing, setPlaying] = useState(false);
  const assemblyRef = useRef(assembly); assemblyRef.current = assembly;
  const referencesRef = useRef(references); referencesRef.current = references;
  const onErrorRef = useRef(onError); onErrorRef.current = onError;
  const onLoadedRef = useRef(onLoaded); onLoadedRef.current = onLoaded;
  const physicsRef = useRef(physics); physicsRef.current = physics;
  const progressRef = useRef(0);
  // The interactive mode (docs/physics-plan.md): the physics runs in its own worker, built when the mode is opened
  const [simulating, setSimulating] = useState(false);
  const [physicsStatus, setPhysicsStatus] = useState('');
  const [upsideDown, setUpsideDown] = useState(false);
  const worker = useRef<Worker | undefined>(undefined);
  const bodies = useRef<string[]>([]);
  const dragging = useRef(false);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const stage = createStage(element, 'Interactive STL preview. Drag to orbit, scroll to zoom, right-drag to pan.');
    if (!stage) { setUnsupported(true); onErrorRef.current('3D preview requires WebGL. Enable browser hardware acceleration and reload.'); return; }
    const { group } = stage;
    const material = new THREE.MeshStandardMaterial({ color: 0xc76743, metalness: 0.06, roughness: 0.58, side: THREE.DoubleSide });
    const referenceMaterial = new THREE.MeshStandardMaterial({ color: 0x3f6ea6, metalness: 0.2, roughness: 0.45, side: THREE.DoubleSide });
    let coloredMaterials: THREE.MeshStandardMaterial[] = [];
    let isWireframe = false;
    let placements: Placement[] = []; let currentAssembly: Assembly | undefined; let sliderValue = 0;
    let frames: ReturnType<typeof motionFrames> = [];
    let hiddenIds: ReadonlySet<string> = new Set();
    // The visible parts, also on the container (`data-visible-parts`), so the page's tests can see what the scene shows.
    const showParts = () => {
      for (const placement of placements) placement.mesh.visible = !hiddenIds.has(placement.id);
      element.dataset['visibleParts'] = placements.filter(placement => placement.mesh.visible).map(placement => placement.id).join(' ');
      stage.invalidate();
    };
    const place = (t: number) => {
      sliderValue = t;
      if (!currentAssembly) return;
      const state = assemblyState(currentAssembly, t);
      for (const placement of placements) placement.apply(currentAssembly, state, frames);
      stage.invalidate();
    };
    let geometries: THREE.BufferGeometry[] = [];
    // Picking and dragging for the physics: the pointer in normalised device coordinates, and points in the parts' frame (mm)
    const raycaster = new THREE.Raycaster();
    const dragPlane = new THREE.Plane();
    const pointer = (clientX: number, clientY: number) => {
      const rect = stage.renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    };
    const toParts = (point: THREE.Vector3): [number, number, number] => group.worldToLocal(point.clone()).toArray();
    scene.current = {
      reset: stage.reset,
      wireframe(enabled) {
        isWireframe = enabled;
        for (const current of [material, referenceMaterial, ...coloredMaterials]) current.wireframe = enabled;
        stage.invalidate();
      },
      setParts(parts, assembly) {
        group.clear();
        for (const geometry of geometries) geometry.dispose();
        geometries = [];
        for (const current of coloredMaterials) current.dispose();
        coloredMaterials = [];
        const prepared = parts.map(part => {
          const geometry = smoothNormals('geometry' in part ? part.geometry : new STLLoader().parse(part.bytes));
          geometry.computeBoundingBox();
          const bounds = geometry.boundingBox;
          if (!bounds) { geometry.dispose(); return null; }
          return { id: part.name.replace(/\.stl$/i, ''), reference: part.reference === true, geometry, bounds, size: bounds.getSize(new THREE.Vector3()) };
        }).filter(part => part !== null);
        if (prepared.length === 0) throw new Error('The preview contains no visible geometry.');
        geometries = prepared.map(part => part.geometry);
        // Arrange parts on an auto-sized grid, one cell per part, each centred in its cell and standing on the floor (z = 0
        // in the parts' frame); a single part sits centred at the origin.
        const bed = viewerGrid(prepared.map(part => part.size));
        placements = prepared.map((part, index) => {
          const [cx, cy] = bed.centres[index] ?? [0, 0];
          const color = assembly?.partColors?.[part.id];
          let partMaterial = part.reference ? referenceMaterial : material;
          if (!part.reference && color) {
            partMaterial = material.clone(); partMaterial.color.set(color); partMaterial.wireframe = isWireframe;
            coloredMaterials.push(partMaterial);
          }
          const partMesh = new THREE.Mesh(part.geometry, partMaterial); partMesh.castShadow = true;
          const grid = new THREE.Vector3(
            cx - (part.bounds.min.x + part.bounds.max.x) / 2,
            cy - (part.bounds.min.y + part.bounds.max.y) / 2,
            -part.bounds.min.z);
          partMesh.position.copy(grid);
          group.add(partMesh);
          return new Placement(part.id, partMesh, grid);
        });
        currentAssembly = assembly;
        frames = assembly ? motionFrames(assembly) : [];
        // Frame every layout the slider passes through, so that no part leaves the view while scrubbing.
        const frame = new THREE.Box3();
        const stops = assembly ? assemblyStops(assembly) - 1 : 0;
        for (const t of assembly ? Array.from({ length: stops * 4 + 1 }, (_, i) => i / (stops * 4)) : [0]) { place(t); group.updateMatrixWorld(true); frame.union(new THREE.Box3().setFromObject(group)); }
        place(sliderValue);
        const frameSize = frame.getSize(new THREE.Vector3());
        const focus = new THREE.Vector3();
        if (assembly) { frame.getCenter(focus); focus.y = 0; }
        stage.frame(Math.max(bed.width, bed.length, frameSize.x, frameSize.y, frameSize.z), frame.max.y, focus);
        showParts();
        return prepared.map(part => ({ id: part.id, reference: part.reference }));
      },
      setProgress: place,
      setHidden(ids) { hiddenIds = ids; showParts(); },
      physicsMeshes(ids) {
        const meshes: Record<string, Float32Array> = {};
        for (const placement of placements) {
          if (!ids.includes(placement.id)) continue;
          const geometry = placement.mesh.geometry;
          const soup = geometry.index ? geometry.toNonIndexed() : geometry;
          meshes[placement.id] = Float32Array.from(soup.getAttribute('position').array);
          if (soup !== geometry) soup.dispose();
        }
        return meshes;
      },
      placeAt(poses) {
        for (const placement of placements) {
          const pose = poses[placement.id];
          if (!pose) continue;
          poseRotation(pose, placement.mesh.quaternion);
          placement.mesh.position.fromArray(pose.position);
          placement.mesh.scale.fromArray(pose.scale ?? UNIT);
        }
        stage.invalidate();
      },
      setBodyPoses(bodies, poses) {
        bodies.forEach((id, index) => {
          const mesh = placements.find(placement => placement.id === id)?.mesh;
          if (!mesh) return;
          const at = (k: number) => poses[7 * index + k] ?? 0;
          mesh.position.set(at(0), at(1), at(2));
          mesh.quaternion.set(at(4), at(5), at(6), at(3));
        });
        stage.invalidate();
      },
      pick(clientX, clientY, bodies) {
        raycaster.setFromCamera(pointer(clientX, clientY), stage.camera);
        const meshes = placements.filter(placement => bodies.includes(placement.id) && placement.mesh.visible).map(placement => placement.mesh);
        const hit = raycaster.intersectObjects(meshes, false)[0];
        const id = hit && placements.find(placement => placement.mesh === hit.object)?.id;
        if (!hit || !id) return undefined;
        dragPlane.setFromNormalAndCoplanarPoint(stage.camera.getWorldDirection(new THREE.Vector3()).negate(), hit.point);
        return { id, point: toParts(hit.point) };
      },
      dragPoint(clientX, clientY) {
        raycaster.setFromCamera(pointer(clientX, clientY), stage.camera);
        const target = raycaster.ray.intersectPlane(dragPlane, new THREE.Vector3());
        return target ? toParts(target) : undefined;
      },
      setOrbit(enabled) { stage.controls.enabled = enabled; },
      screenCentres(ids) {
        const rect = stage.renderer.domElement.getBoundingClientRect();
        const centres: Record<string, [number, number]> = {};
        for (const placement of placements) {
          if (!ids.includes(placement.id)) continue;
          const box = placement.mesh.geometry.boundingBox;
          if (!box) continue;
          const point = placement.mesh.localToWorld(box.getCenter(new THREE.Vector3())).project(stage.camera);
          centres[placement.id] = [rect.left + (point.x + 1) / 2 * rect.width, rect.top + (1 - point.y) / 2 * rect.height];
        }
        return centres;
      },
    };
    return () => {
      scene.current = null;
      for (const geometry of geometries) geometry.dispose();
      for (const current of coloredMaterials) current.dispose();
      material.dispose(); referenceMaterial.dispose(); stage.dispose();
    };
  }, []);

  useEffect(() => {
    if (!url) return;
    const abort = new AbortController();
    // Capture metadata with this URL: settings can change during the fetch.
    const loadedAssembly = assemblyRef.current;
    const loadedReferences = referencesRef.current;
    // Reference objects are static files, or built from their part's dimensions: one that cannot be loaded is left out rather
    // than failing the preview.
    const loadReference = async (reference: ReferenceObject): Promise<Part[]> => {
      if (!('url' in reference)) { const geometry = reference.geometry(); return geometry ? [{ name: reference.id, geometry, reference: true }] : []; }
      const response = await fetch(reference.url, { signal: abort.signal });
      return response.ok ? [{ name: `${reference.id}.stl`, bytes: await response.arrayBuffer(), reference: true }] : [];
    };
    const loadReferences = format === 'zip' && loadedAssembly
      ? Promise.all(loadedReferences.map(reference => loadReference(reference).catch((): Part[] => []))).then(loaded => loaded.flat()) : Promise.resolve([]);
    void fetch(url, { signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error('The preview file is unavailable. Generate it again.');
      const bytes = await response.arrayBuffer();
      const extra = await loadReferences;
      if (abort.signal.aborted) return;
      const loaded = scene.current?.setParts(format === 'zip' ? [...partsFromZip(bytes), ...extra] : [{ name: 'model', bytes }], format === 'zip' ? loadedAssembly : undefined);
      if (loaded) {
        setLoadedParts(format === 'zip' ? loaded : []);
        setShownAssembly(format === 'zip' ? loadedAssembly : undefined);
      }
      if (scene.current) onLoadedRef.current(url);
    }).catch((error: unknown) => {
      if (!abort.signal.aborted) onErrorRef.current(error instanceof Error ? error.message : 'Could not load the preview.');
    });
    return () => abort.abort();
  }, [url, format]);

  useEffect(() => { progressRef.current = progress; scene.current?.setProgress(progress); }, [progress]);
  // The physics session, while the mode is open and the parts are loaded: it starts from the mechanism's poses (the assembly's
  // where it gives none) with the meshes the viewer shows. Closing the mode, or new parts, ends it and puts the slider's poses back.
  useEffect(() => {
    const spec = physicsRef.current, controller = scene.current, element = container.current;
    if (!simulating || !spec || !shownAssembly || !controller || !element) return;
    const start = { ...shownAssembly.poses, ...spec.poses };
    controller.placeAt(start);
    const meshes = controller.physicsMeshes(spec.bodies.map(body => body.id));
    const thread = new Worker(new URL('./physicsWorker.ts', import.meta.url), { type: 'module' });
    worker.current = thread;
    const send = (request: PhysicsRequest, transfer: Transferable[] = []) => { thread.postMessage(request, transfer); };
    element.dataset['physics'] = 'starting';
    setPhysicsStatus('Starting the physics');
    let frames = 0;
    thread.onmessage = (event: MessageEvent<PhysicsUpdate>) => {
      const update = event.data;
      if (update.type === 'status') setPhysicsStatus(update.text);
      else if (update.type === 'error') { element.dataset['physics'] = 'error'; setPhysicsStatus(update.message); }
      else if (update.type === 'ready') { bodies.current = update.bodies; element.dataset['physics'] = 'running'; setPhysicsStatus('Drag a part to move it'); }
      else {
        scene.current?.setBodyPoses(bodies.current, update.poses);
        // for the page's tests: the simulated time, and every tenth frame the bodies' poses (id: x y z qw qx qy qz, mm) and where
        // their centres are on the screen
        element.dataset['physicsTime'] = update.time.toFixed(3);
        if (frames++ % 10 === 0) {
          element.dataset['physicsPoses'] = bodies.current.map((id, index) => `${id}:${Array.from(update.poses.subarray(7 * index, 7 * index + 7), value => value.toFixed(4)).join(' ')}`).join(';');
          element.dataset['physicsScreen'] = Object.entries(scene.current?.screenCentres(bodies.current) ?? {}).map(([id, [x, y]]) => `${id}:${x.toFixed(0)} ${y.toFixed(0)}`).join(';');
        }
      }
    };
    thread.onerror = () => { element.dataset['physics'] = 'error'; setPhysicsStatus('The physics could not start in this browser.'); };
    send({ type: 'start', spec, poses: start, meshes }, Object.values(meshes).map(mesh => mesh.buffer));
    return () => {
      thread.terminate();
      worker.current = undefined; bodies.current = []; dragging.current = false;
      for (const attribute of ['data-physics', 'data-physics-time', 'data-physics-poses', 'data-physics-screen', 'data-physics-hover']) element.removeAttribute(attribute);
      element.style.cursor = '';
      scene.current?.setOrbit(true);
      scene.current?.setProgress(progressRef.current);
    };
  }, [simulating, shownAssembly]);
  useEffect(() => { setSimulating(false); setUpsideDown(false); }, [url]);
  const turnOver = () => {
    const next = !upsideDown;
    setUpsideDown(next);
    worker.current?.postMessage({ type: 'gravity', direction: [0, 0, next ? 1 : -1] } satisfies PhysicsRequest);
  };
  // Dragging a part: the pointer takes the part by the point it hits; the camera does not orbit meanwhile.
  const grab = (event: PointerEvent<HTMLDivElement>) => {
    const controller = scene.current;
    if (!simulating || !worker.current || !controller || event.button !== 0) return;
    const hit = controller.pick(event.clientX, event.clientY, bodies.current);
    if (!hit) return;
    controller.setOrbit(false);
    dragging.current = true;
    event.currentTarget.style.cursor = 'grabbing';
    event.currentTarget.setPointerCapture(event.pointerId);
    worker.current.postMessage({ type: 'grab', body: hit.id, point: hit.point } satisfies PhysicsRequest);
  };
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) {
      // over a part, the pointer offers to take it
      if (!simulating || bodies.current.length === 0) return;
      const over = scene.current?.pick(event.clientX, event.clientY, bodies.current)?.id;
      event.currentTarget.style.cursor = over ? 'grab' : '';
      if (over) event.currentTarget.dataset['physicsHover'] = over; else delete event.currentTarget.dataset['physicsHover'];
      return;
    }
    const point = scene.current?.dragPoint(event.clientX, event.clientY);
    if (point) worker.current?.postMessage({ type: 'drag', point } satisfies PhysicsRequest);
  };
  const letGo = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    event.currentTarget.style.cursor = 'grab';
    scene.current?.setOrbit(true);
    worker.current?.postMessage({ type: 'release' } satisfies PhysicsRequest);
  };
  useEffect(() => { scene.current?.setHidden(hidden); }, [hidden]);
  const toggle = (id: string) => setHidden(current => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const displayedAssembly = shownAssembly ?? assembly;
  const stops = displayedAssembly ? assemblyStops(displayedAssembly) - 1 : 1;
  // Play: the slider runs to the end at PLAY_SECONDS a segment (from the start if it is at the end); any other input stops it.
  useEffect(() => {
    if (!playing) return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const step = (now - last) / 1000 / (PLAY_SECONDS * stops); last = now;
      setProgress(value => {
        const next = Math.min(1, value + step);
        if (next >= 1) setPlaying(false);
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, stops]);
  const togglePlay = () => {
    if (!playing && progress >= 1) setProgress(0);
    setPlaying(value => !value);
  };
  // Arrow keys and Page Up/Down jump between the stops; Home and End keep their native meaning.
  const stepSlider = (event: KeyboardEvent<HTMLInputElement>) => {
    const direction = { ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    const stop = direction > 0 ? Math.floor(progress * stops + 1e-6) + 1 : Math.ceil(progress * stops - 1e-6) - 1;
    setPlaying(false);
    setProgress(Math.min(stops, Math.max(0, stop)) / stops);
  };

  return <>
    <div className="viewer-content">
      <div ref={container} className="canvas-container" data-testid="stl-viewer" onPointerDownCapture={grab} onPointerMove={drag} onPointerUp={letGo} onPointerCancel={letGo} />
      {!url && !unsupported && <div className="viewer-placeholder"><Box size={32} strokeWidth={1} /><span>Preparing your first preview</span></div>}
      {unsupported && <div className="viewer-placeholder"><span>3D preview is unavailable in this browser.</span></div>}
      <div className="viewer-tools">
        <button type="button" onClick={() => scene.current?.reset()} title="Reset camera" aria-label="Reset camera"><RotateCcw size={17} /></button>
        <button type="button" aria-label="Toggle wireframe" aria-pressed={wireframe} title="Toggle wireframe" onClick={() => { setWireframe(value => !value); scene.current?.wireframe(!wireframe); }}><Grid2X2 size={17} /></button>
        {physics && displayedAssembly && format === 'zip' && url && <button type="button" aria-label="Simulate" aria-pressed={simulating} title={simulating ? 'Stop the physics' : 'Simulate: drag the parts and see them move'}
          onClick={() => { setPlaying(false); setSimulating(value => !value); }}><Atom size={17} /></button>}
      </div>
      <div className="viewer-instructions"><span>Drag to orbit</span><i /><span>Scroll to zoom</span><i /><span>Right-drag to pan</span></div>
      <div className="axis-label"><span className="axis-x">X</span><span className="axis-y">Y</span><span className="axis-z">Z</span></div>
    </div>
    {simulating && <div className="assembly-bar physics-bar" role="group" aria-label="Physics">
      <div className="assembly-caption"><span>PHYSICS</span><strong role="status">{physicsStatus}</strong></div>
      <button type="button" aria-pressed={upsideDown} title={upsideDown ? 'Turn it upright again' : 'Turn it upside down (gravity pulls the other way)'} onClick={turnOver}>
        <FlipVertical2 size={15} aria-hidden="true" />{upsideDown ? 'Upside down' : 'Upright'}
      </button>
      <button type="button" title="Start again from the assembled parts" onClick={() => worker.current?.postMessage({ type: 'restart' } satisfies PhysicsRequest)}>
        <RotateCcw size={15} aria-hidden="true" />Restart
      </button>
    </div>}
    {!simulating && displayedAssembly && format === 'zip' && url && <div className="assembly-bar">
      <div className="assembly-caption"><span>ASSEMBLY</span><strong aria-hidden="true">{assemblyCaption(displayedAssembly, progress)}</strong></div>
      <button type="button" className="assembly-play" aria-label={playing ? 'Pause assembly' : 'Play assembly'} aria-pressed={playing} title={playing ? 'Pause' : 'Play the assembly'} onClick={togglePlay}>
        {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
      </button>
      <div className="assembly-track">
        <input type="range" min={0} max={1} step={0.001} value={progress} aria-label="Assembly" aria-valuetext={assemblyCaption(displayedAssembly, progress)}
          onChange={event => { setPlaying(false); setProgress(Number(event.currentTarget.value)); }} onKeyDown={stepSlider} />
        <div className="assembly-stops" aria-hidden="true">{Array.from({ length: stops + 1 }, (_, index) => <i key={index} className={progress * stops >= index - 1e-6 ? 'reached' : ''} />)}</div>
      </div>
    </div>}
    {displayedAssembly && format === 'zip' && url && loadedParts.length > 0 && <div className="assembly-parts" role="group" aria-label="Visible parts">
      <span>PARTS</span>
      <div>{loadedParts.map(part => {
        const visible = !hidden.has(part.id);
        const title = partTitles[part.id] ?? part.id;
        return <button key={part.id} type="button" className={part.reference ? 'reference' : undefined} aria-pressed={visible}
          title={`${visible ? 'Hide' : 'Show'} ${title}`} onClick={() => toggle(part.id)}>
          {visible ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}{title}
          {displayedAssembly.partColors?.[part.id] && <span className="part-color" style={{ backgroundColor: displayedAssembly.partColors[part.id] }} title={`Suggested filament: ${displayedAssembly.partColors[part.id]}`} aria-hidden="true" />}
        </button>;
      })}</div>
    </div>}
  </>;
}
