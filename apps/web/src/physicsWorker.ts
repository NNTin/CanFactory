/**
 * The interactive mode's physics, in its own Web Worker so that the page never waits on it (docs/physics-plan.md): it forwards the
 * viewer's requests to an `InteractiveSession` from packages/physics and posts back the bodies' poses about 60 times a second.
 * Decompositions are cached in IndexedDB, as a speed-up only.
 */
/// <reference lib="webworker" />
import wasmUrl from '@mujoco/mujoco/mujoco.wasm?url';
import { InteractiveSession, loadEngine, type PhysicsRequest, type PhysicsUpdate, type PieceCache } from '@canfactory/physics';

const post = (update: PhysicsUpdate) => {
  if (update.type === 'poses') self.postMessage(update, [update.poses.buffer]);
  else self.postMessage(update);
};

/** Decompositions by key, in IndexedDB; every failure (a private window, blocked storage) is a miss. */
function indexedDbCache(): PieceCache {
  const open = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('canfactory-physics', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('pieces'); };
    request.onsuccess = () => { resolve(request.result); };
    request.onerror = () => { reject(request.error ?? new Error('IndexedDB is unavailable.')); };
  });
  const run = <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => open.then(db => new Promise<T>((resolve, reject) => {
    const request = action(db.transaction('pieces', mode).objectStore('pieces'));
    request.onsuccess = () => { resolve(request.result); };
    request.onerror = () => { reject(request.error ?? new Error('IndexedDB failed.')); };
  }));
  return {
    get: key => run<unknown>('readonly', store => store.get(key)).then(value => Array.isArray(value) ? value as number[][] : undefined),
    set: (key, pieces) => run('readwrite', store => store.put(pieces, key)).then(() => undefined),
  };
}

const session = loadEngine({ wasmUrl }).then(engine => new InteractiveSession(engine, post, indexedDbCache()));
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const seconds = (now - last) / 1000;
  last = now;
  void session.then(current => { if (current.running) current.tick(seconds); });
}, 1000 / 60);

self.onmessage = (event: MessageEvent<PhysicsRequest>) => {
  void session.then(current => current.handle(event.data)).catch((error: unknown) => {
    post({ type: 'error', message: error instanceof Error ? error.message : 'The physics failed.' });
  });
};
