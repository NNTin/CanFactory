import * as THREE from 'three';
import { toggleLatchMechanism as TL } from '@canfactory/contracts';
import { latchAcross, type LatchMount } from './catioPrintedLatch.ts';
import { buildToggleLatchMeshes, placeLatchPart } from './toggleLatchMeshes.ts';

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
 * The printed toggle latches on a joint, built from their parts' real profiles and moved by the shared mechanism: each catch in
 * its own group, and each base with its lever and link in another, both placed at the mount (so a scene can move them in on
 * their own). `setOpen` opens a latch (0 locked, 1 released); its catch stays where the lock holds it. `dispose` frees the meshes.
 */
export function buildPrintedLatches<M extends LatchMount>(mounts: M[]) {
  const meshes = buildToggleLatchMeshes();
  const locked = TL.latchPoses(TL.latchState(TL.CLOSED));
  const at = (mount: M) => { const group = new THREE.Group(); group.position.set(...mount.at); const frame = latchFrame(mount); group.add(frame); return { group, frame }; };
  const part = (frame: THREE.Group, id: 'base' | 'lever' | 'link' | 'catch') => { const object = meshes[id].clone(); frame.add(object); return object; };
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
  return { catches, latches, dispose: () => meshes.dispose() };
}
