import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { RenderRequestSchema, toggleLatch, toggleLatchMechanism as TL } from '@canfactory/contracts';
import { Value } from 'typebox/value';
import { smoothNormals } from './stage.ts';
import { completedRender } from './useRender.ts';
import { partsFromZip } from './Viewer.tsx';
import { latchAcross, type LatchMount } from '@canfactory/catio';

/** The printed parts' filament colours, as the toggle latch model suggests them. */
const COLOURS = { base: '#5f7350', catch: '#5f7350', lever: '#d98460', link: '#3f6ea6' } as const;
type LatchPartId = keyof typeof COLOURS;

type LatchParts = Map<string, THREE.BufferGeometry>;
/** Whether the latch's parts are drawn: not asked for yet, on their way, drawn, or missing (a retry is scheduled). */
export type LatchPartsStatus = 'idle' | 'loading' | 'loaded' | 'missing';
/** How long one attempt may take, queue included, and the waits before each retry (the last one repeats). */
const DEADLINE_MS = 120_000;
const RETRY_MS = [15_000, 30_000, 60_000, 300_000];

let status: LatchPartsStatus = 'idle';
let loaded: LatchParts | undefined;
let failures = 0;
let retry: ReturnType<typeof setTimeout> | undefined;
/** The scenes still waiting for the parts: each fills its latches when they arrive. */
const waiting = new Set<(parts: LatchParts) => void>();
const listeners = new Set<() => void>();
function setStatus(next: LatchPartsStatus) { status = next; for (const listener of listeners) listener(); }

/** The latch parts' status, for `useSyncExternalStore(watchLatchParts, latchPartsStatus)`: a page redraws and marks its viewer. */
export const latchPartsStatus = () => status;
export function watchLatchParts(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * The toggle latch model's own four STLs at its defaults, as the editor shows them: rendered once per page (the render API caches
 * it) and shared by every scene, each in its SCAD frame, where `latchPoses` places it. A failed attempt (queue full, outage, a
 * model version this API does not have) is retried after a growing wait while a scene still waits, and the scenes are filled
 * when the parts arrive. Outside the browser there is no renderer, and the parts stay empty.
 */
function loadLatchParts() {
  if (typeof window === 'undefined' || status === 'loading') return;
  if (retry) { setStatus('missing'); return; }
  setStatus('loading');
  const signal = AbortSignal.timeout(DEADLINE_MS);
  void (async () => {
    // checked as the editor checks its request (useRender), not cast: the defaults' static type is any model's settings
    const request = { modelId: toggleLatch.id, modelVersion: toggleLatch.version, parameters: toggleLatch.defaults };
    if (!Value.Check(RenderRequestSchema, request)) throw new Error('The toggle latch defaults are not a valid render request.');
    const render = await completedRender(request, signal);
    if (!render.artifact) throw new Error('The toggle latch render has no file.');
    const response = await fetch(render.artifact.url, { signal });
    if (!response.ok) throw new Error(`The toggle latch's parts could not be fetched (${response.status}).`);
    return new Map(partsFromZip(await response.arrayBuffer()).map(({ name, bytes }) => [name.replace(/\.stl$/i, ''), smoothNormals(new STLLoader().parse(bytes))]));
  })().then(parts => {
    loaded = parts; failures = 0;
    for (const fill of waiting) fill(parts);
    waiting.clear(); setStatus('loaded');
  }, (error: unknown) => {
    console.error('CanFactory: the printed toggle latch could not be loaded', error);
    const wait = RETRY_MS[Math.min(failures, RETRY_MS.length - 1)]; failures++;
    setStatus('missing');
    retry = setTimeout(() => { retry = undefined; if (waiting.size) loadLatchParts(); }, wait);
  });
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
 * their own). Each part is a group named `toggle-latch-<part>`, posed at once; its mesh joins it when the parts have loaded (the page
 * redraws on `watchLatchParts`).
 * `setOpen` opens a latch (0 locked, 1 released); its catch stays where the lock holds it. `dispose` frees the materials.
 */
export function buildPrintedLatches<M extends LatchMount>(mounts: M[]) {
  const materials = Object.fromEntries(Object.entries(COLOURS).map(([id, color]) => [id, new THREE.MeshStandardMaterial({ color, roughness: 0.6 })])) as Record<LatchPartId, THREE.MeshStandardMaterial>;
  const parts: [LatchPartId, THREE.Group][] = [];
  const fill = (geometries: LatchParts) => {
    for (const [id, group] of parts) {
      const geometry = geometries.get(id); if (!geometry) continue;
      const mesh = new THREE.Mesh(geometry, materials[id]); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    }
  };
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
  if (loaded) fill(loaded);
  else { waiting.add(fill); loadLatchParts(); }
  return { catches, latches, dispose: () => {
    waiting.delete(fill);
    // nothing on the page lacks the parts any more (a retry still fills the next scene)
    if (!waiting.size && status === 'missing') setStatus('idle');
    for (const material of Object.values(materials)) material.dispose();
  } };
}
