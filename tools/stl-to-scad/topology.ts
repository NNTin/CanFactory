import { g, triangleCount, type Mesh } from './stl.ts';

export interface Topology {
  triangles: number;
  uniqueVertices: number;
  /** Zero-area triangles (after welding identical coordinates). */
  degenerate: number;
  /** Undirected edges used by a number of triangles other than two. */
  openOrNonManifoldEdges: number;
  /** Edges whose two triangles traverse them in the same direction (inconsistent winding). */
  windingConflicts: number;
  /** Connected components of the welded vertex graph. */
  bodies: number;
  /** Closed, manifold, consistently wound, and non-degenerate. */
  watertight: boolean;
}

/** Weld identical coordinates and reduce the mesh to indexed triangles. Vertices are welded exactly (STL float32 shares bits). */
export function weld(mesh: Mesh, decimals?: number): { points: number[]; faces: number[] } {
  const ids = new Map<string, number>();
  const points: number[] = [];
  const faces: number[] = [];
  const round = decimals === undefined ? (v: number) => v : (v: number) => Number(v.toFixed(decimals));
  for (let i = 0; i < mesh.tris.length; i += 3) {
    const x = round(g(mesh.tris, i)), y = round(g(mesh.tris, i + 1)), z = round(g(mesh.tris, i + 2));
    const key = `${x},${y},${z}`;
    let id = ids.get(key);
    if (id === undefined) {
      id = ids.size;
      ids.set(key, id);
      points.push(x, y, z);
    }
    faces.push(id);
  }
  return { points, faces };
}

export function analyzeTopology(mesh: Mesh): Topology {
  const { points, faces } = weld(mesh);
  const vertexCount = points.length / 3;
  const parent = Int32Array.from({ length: vertexCount }, (_, i) => i);
  const find = (v: number): number => {
    let root = v;
    while (g(parent, root) !== root) root = g(parent, root);
    for (let next = g(parent, v); next !== root; next = g(parent, v)) { parent[v] = root; v = next; }
    return root;
  };
  const edges = new Map<number, { count: number; forward: number }>();
  let degenerate = 0;
  for (let t = 0; t < triangleCount(mesh); t++) {
    const a = g(faces, t * 3), b = g(faces, t * 3 + 1), c = g(faces, t * 3 + 2);
    if (a === b || b === c || a === c) { degenerate++; continue; }
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
      const lo = Math.min(u, v), hi = Math.max(u, v);
      const key = lo * vertexCount + hi;
      const entry = edges.get(key) ?? { count: 0, forward: 0 };
      entry.count++;
      entry.forward += u < v ? 1 : -1;
      edges.set(key, entry);
      const ru = find(u), rv = find(v);
      if (ru !== rv) parent[Math.max(ru, rv)] = Math.min(ru, rv);
    }
  }
  let open = 0, conflicts = 0;
  for (const entry of edges.values()) {
    if (entry.count !== 2) open++;
    else if (entry.forward !== 0) conflicts++;
  }
  let bodies = 0;
  const used = new Set<number>();
  for (const face of faces) used.add(face);
  for (const v of used) if (find(v) === v) bodies++;
  return {
    triangles: triangleCount(mesh), uniqueVertices: vertexCount, degenerate, openOrNonManifoldEdges: open,
    windingConflicts: conflicts, bodies, watertight: degenerate === 0 && open === 0 && conflicts === 0 && bodies === 1,
  };
}
