import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { toggleLatch, toggleLatchMechanism as TL, type RenderRequest } from '@canfactory/contracts';
import { latchAcross, type LatchMount } from './catioPrintedLatch.ts';
import { smoothNormals } from './stage.ts';
import { completedRender } from './useRender.ts';
import { partsFromZip } from './Viewer.tsx';

/** The printed parts' filament colours, as the toggle latch model suggests them. */
const COLOURS = { base: '#5f7350', catch: '#5f7350', lever: '#d98460', link: '#3f6ea6' } as const;
type LatchPartId = keyof typeof COLOURS;

let latchParts: Promise<Map<string, THREE.BufferGeometry>> | undefined;
/**
 * The toggle latch model's own four STLs at its defaults, as the editor shows them: rendered once per page (the render API caches
 * it) and shared by every scene, each in its SCAD frame, where `latchPoses` places it. Outside the browser there is no renderer,
 * and the parts stay empty.
 */
function loadLatchParts(): Promise<Map<string, THREE.BufferGeometry>> {
  latchParts ??= typeof window === 'undefined' ? Promise.resolve(new Map()) : (async () => {
    const render = await completedRender({ modelId: toggleLatch.id, modelVersion: toggleLatch.version, parameters: toggleLatch.defaults } as RenderRequest, new AbortController().signal);
    if (!render.artifact) throw new Error('The toggle latch render has no file.');
    const response = await fetch(render.artifact.url);
    if (!response.ok) throw new Error(`The toggle latch's parts could not be fetched (${response.status}).`);
    return new Map(partsFromZip(await response.arrayBuffer()).map(({ name, bytes }) => [name.replace(/\.stl$/i, ''), smoothNormals(new STLLoader().parse(bytes))]));
  })().catch((error: unknown) => {
    // not retried on every scene rebuild (each slider change): the page shows the latches without their parts until reloaded
    console.error('CanFactory: the printed toggle latch could not be loaded', error);
    return new Map();
  });
  return latchParts;
}

/** Places a part at its pose in the latch's own frame (`latchPoses`: x across the latch, y along the pull, z off the face). */
function placeLatchPart(object: THREE.Object3D, pose: TL.LatchPose) {
  object.position.set(...pose.position);
  const [rx, ry, rz] = pose.rotation.map(THREE.MathUtils.degToRad) as [number, number, number];
  object.rotation.set(rx, ry, rz, 'ZYX');
}

/** How far open (0 locked, 1 released) puts the printed latch: the lever back over centre to open, then the link swung off the hook. */
export function printedLatchState(open: number) {
  const turn = THREE.MathUtils.clamp(open / 0.7, 0, 1), swing = THREE.MathUtils.clamp((open - 0.7) / 0.3, 0, 1);
  return TL.latchState(TL.CLOSED + (TL.OPEN - TL.CLOSED) * turn, TL.SWING * swing);
}

/** The latch's own frame at its mount: (pull × out, pull, out), a rotation, inside a group at `mount.at`. */
function latchFrame(mount: LatchMount) {
  const frame = new THREE.Group(); frame.matrixAutoUpdate = false;
  frame.matrix.makeBasis(new THREE.Vector3(...latchAcross(mount)), new THREE.Vector3(...mount.pull), new THREE.Vector3(...mount.out));
  return frame;
}

/**
 * The printed toggle latches on a joint, the model's own parts (`loadLatchParts`) moved by the shared mechanism: each catch in
 * its own group, and each base with its lever and link in another, both placed at the mount (so a scene can move them in on
 * their own). Each part is a group named `toggle-latch-<part>`, posed at once; its mesh joins it when the parts have loaded.
 * `setOpen` opens a latch (0 locked, 1 released); its catch stays where the lock holds it. `dispose` frees the materials.
 */
export function buildPrintedLatches<M extends LatchMount>(mounts: M[]) {
  const materials = Object.fromEntries(Object.entries(COLOURS).map(([id, color]) => [id, new THREE.MeshStandardMaterial({ color, roughness: 0.6 })])) as Record<LatchPartId, THREE.MeshStandardMaterial>;
  const parts: [LatchPartId, THREE.Group][] = [];
  let disposed = false;
  void loadLatchParts().then(geometries => {
    if (disposed) return;
    for (const [id, group] of parts) {
      const geometry = geometries.get(id); if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, materials[id]); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    }
  });
  const locked = TL.latchPoses(TL.latchState(TL.CLOSED));
  const at = (mount: M) => { const group = new THREE.Group(); group.position.set(...mount.at); const frame = latchFrame(mount); group.add(frame); return { group, frame }; };
  const part = (frame: THREE.Group, id: LatchPartId) => { const object = new THREE.Group(); object.name = `toggle-latch-${id}`; frame.add(object); parts.push([id, object]); return object; };
  const catches = mounts.map(mount => {
    const { group, frame } = at(mount);
    placeLatchPart(part(frame, 'catch'), locked.catch);
    return { mount, group };
  });
  const latches = mounts.map(mount => {
    const { group, frame } = at(mount);
    placeLatchPart(part(frame, 'base'), locked.base);
    const lever = part(frame, 'lever'); lever.name = `${mount.id}-lever`; const link = part(frame, 'link');
    /** Puts the lever and the link where the mechanism has them in `state`; the base and catch stay put. */
    const setState = (state: TL.LatchState) => { const poses = TL.latchPoses(state); placeLatchPart(lever, poses.lever); placeLatchPart(link, poses.link); };
    const setOpen = (open: number) => setState(printedLatchState(open));
    setOpen(0);
    return { mount, group, lever, setOpen, setState };
  });
  return { catches, latches, dispose: () => { disposed = true; for (const material of Object.values(materials)) material.dispose(); } };
}
