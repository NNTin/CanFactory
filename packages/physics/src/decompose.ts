/**
 * Convex decomposition of a part's mesh into the pieces MuJoCo collides (it collides a mesh as its convex hull). Two decomposers
 * are compiled to WebAssembly (decomposers/build.sh) for spike 2 (docs/physics-plan.md); one will be kept. Both run
 * single-threaded, with fixed settings and seed, so that the browser and CI get the same pieces from the same mesh.
 */

/** The Emscripten module of a decomposer: the C ABI of decomposers/results.h. */
export interface DecomposerModule {
  HEAPF64: Float64Array;
  HEAP32: Int32Array;
  _malloc(bytes: number): number;
  _free(pointer: number): void;
  _decompose(vertices: number, vertexCount: number, triangles: number, triangleCount: number, params: number): number;
  _hull_count(): number;
  _hull_vertex_count(index: number): number;
  _hull_vertices(index: number): number;
  _hull_triangle_count(index: number): number;
  _hull_triangles(index: number): number;
  _release(): void;
}

export type DecomposerId = 'vhacd' | 'coacd';

/** V-HACD 4's settings (its defaults, with at most 64 hulls of 64 vertices). */
export interface VhacdSettings {
  maxHulls: number; resolution: number; minVolumePercentError: number; maxRecursionDepth: number; maxVerticesPerHull: number;
  shrinkWrap: boolean; minEdgeLength: number; findBestPlane: boolean;
}
export const VHACD_DEFAULTS: VhacdSettings = {
  maxHulls: 64, resolution: 400000, minVolumePercentError: 1, maxRecursionDepth: 10, maxVerticesPerHull: 64, shrinkWrap: true, minEdgeLength: 2, findBestPlane: false,
};

/** CoACD's settings (its defaults: concavity 0.05, merging, seed 0). */
export interface CoacdSettings {
  threshold: number; maxHulls: number; sampleResolution: number; mctsNodes: number; mctsIterations: number; mctsMaxDepth: number;
  pca: boolean; merge: boolean; decimate: boolean; maxVerticesPerHull: number; seed: number;
}
export const COACD_DEFAULTS: CoacdSettings = {
  threshold: 0.05, maxHulls: -1, sampleResolution: 2000, mctsNodes: 20, mctsIterations: 150, mctsMaxDepth: 3, pca: false, merge: true, decimate: false, maxVerticesPerHull: 256, seed: 0,
};

export type DecomposeSettings = { decomposer: 'vhacd' } & Partial<VhacdSettings> | { decomposer: 'coacd' } & Partial<CoacdSettings>;

const modules = new Map<DecomposerId, Promise<DecomposerModule>>();

function loadModule(id: DecomposerId): Promise<DecomposerModule> {
  let module = modules.get(id);
  if (!module) {
    // CoACD built without spdlog prints its progress unformatted: drop the modules' output
    const quiet = { print: () => undefined, printErr: () => undefined };
    module = id === 'vhacd' ? import('./wasm/vhacd.mjs').then(m => m.default(quiet)) : import('./wasm/coacd.mjs').then(m => m.default(quiet));
    modules.set(id, module);
  }
  return module;
}

/** An indexed mesh: shared vertices (x, y, z, ...) and triangles (i, j, k, ...). */
export interface IndexedMesh { vertices: Float64Array; triangles: Int32Array }

/** Welds a triangle soup (9 numbers per triangle, as an STL) into an indexed mesh: vertices at the same position are one. */
export function indexMesh(soup: ArrayLike<number>): IndexedMesh {
  const index = new Map<string, number>();
  const vertices: number[] = [];
  const triangles = new Int32Array(soup.length / 3);
  for (let i = 0; i < soup.length; i += 3) {
    const x = soup[i] ?? 0, y = soup[i + 1] ?? 0, z = soup[i + 2] ?? 0;
    const key = `${x},${y},${z}`;
    let id = index.get(key);
    if (id === undefined) { id = vertices.length / 3; index.set(key, id); vertices.push(x, y, z); }
    triangles[i / 3] = id;
  }
  return { vertices: Float64Array.from(vertices), triangles };
}

function parameters(settings: DecomposeSettings): number[] {
  if (settings.decomposer === 'vhacd') {
    const s = { ...VHACD_DEFAULTS, ...settings };
    return [s.maxHulls, s.resolution, s.minVolumePercentError, s.maxRecursionDepth, s.maxVerticesPerHull, Number(s.shrinkWrap), s.minEdgeLength, Number(s.findBestPlane)];
  }
  const s = { ...COACD_DEFAULTS, ...settings };
  return [s.threshold, s.maxHulls, s.sampleResolution, s.mctsNodes, s.mctsIterations, s.mctsMaxDepth, Number(s.pca), Number(s.merge), Number(s.decimate), s.maxVerticesPerHull, s.seed];
}

/** A convex piece: its hull's vertices and triangles, in the mesh's units and frame. */
export interface ConvexPiece { vertices: number[]; triangles: number[] }

/** The convex pieces of a closed mesh (a triangle soup, 9 numbers per triangle). */
export async function decompose(soup: ArrayLike<number>, settings: DecomposeSettings): Promise<ConvexPiece[]> {
  const module = await loadModule(settings.decomposer);
  const mesh = indexMesh(soup);
  const params = parameters(settings);
  const pointers = [mesh.vertices.length * 8, mesh.triangles.length * 4, params.length * 8].map(bytes => module._malloc(Math.max(8, bytes)));
  const [vertices = 0, triangles = 0, values = 0] = pointers;
  try {
    module.HEAPF64.set(mesh.vertices, vertices / 8);
    module.HEAP32.set(mesh.triangles, triangles / 4);
    module.HEAPF64.set(params, values / 8);
    const count = module._decompose(vertices, mesh.vertices.length / 3, triangles, mesh.triangles.length / 3, values);
    if (count < 0) throw new Error(`${settings.decomposer} could not decompose the mesh.`);
    const pieces: ConvexPiece[] = [];
    for (let i = 0; i < count; i++) {
      // the heap may have grown during the call: read through the module's current views
      const v = module._hull_vertices(i) / 8, nv = module._hull_vertex_count(i) * 3;
      const t = module._hull_triangles(i) / 4, nt = module._hull_triangle_count(i) * 3;
      pieces.push({ vertices: Array.from(module.HEAPF64.subarray(v, v + nv)), triangles: Array.from(module.HEAP32.subarray(t, t + nt)) });
    }
    return pieces;
  } finally {
    module._release();
    for (const pointer of pointers) module._free(pointer);
  }
}
