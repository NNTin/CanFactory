import { createHash } from 'node:crypto';
import type { Dimensions } from '@canfactory/contracts';

/** Validated binary STL metadata. Volume is mm³; dimensions are mm. */
export interface MeshInfo { sha256: string; bytes: number; triangles: number; dimensions: Dimensions; volume: number }

/** Reject incomplete, degenerate, open, inconsistently wound, or disconnected generated solids. */
export function inspectStl(bytes: Buffer): MeshInfo {
  if (bytes.length < 84) throw new Error('The renderer produced an incomplete STL.');
  const triangleCount = bytes.readUInt32LE(80);
  if (triangleCount === 0 || triangleCount > 1_000_000 || bytes.length !== 84 + triangleCount * 50)
    throw new Error('The renderer produced an empty or invalid binary STL.');
  const vertices = new Map<string, number>();
  const parents: number[] = [];
  const edges = new Map<string, { count: number; winding: number }>();
  const bounds = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  let volume = 0;
  function root(id: number): number {
    let current = id;
    while (parents[current] !== current) {
      const next = parents[current];
      if (next === undefined) throw new Error('Invalid mesh connectivity.');
      current = next;
    }
    return current;
  }
  function vertex(x: number, y: number, z: number): number {
    if (![x, y, z].every(Number.isFinite)) throw new Error('The mesh contains non-finite coordinates.');
    bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y);
    bounds.minZ = Math.min(bounds.minZ, z); bounds.maxZ = Math.max(bounds.maxZ, z);
    const key = `${x},${y},${z}`;
    const found = vertices.get(key);
    if (found !== undefined) return found;
    const id = vertices.size;
    vertices.set(key, id); parents.push(id);
    return id;
  }
  function edge(a: number, b: number) {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const value = edges.get(key) ?? { count: 0, winding: 0 };
    value.count++; value.winding += a < b ? 1 : -1;
    edges.set(key, value);
    const ar = root(a); const br = root(b);
    if (ar !== br) parents[Math.max(ar, br)] = Math.min(ar, br);
  }
  for (let index = 0; index < triangleCount; index++) {
    const offset = 84 + index * 50 + 12;
    const ax = bytes.readFloatLE(offset); const ay = bytes.readFloatLE(offset + 4); const az = bytes.readFloatLE(offset + 8);
    const bx = bytes.readFloatLE(offset + 12); const by = bytes.readFloatLE(offset + 16); const bz = bytes.readFloatLE(offset + 20);
    const cx = bytes.readFloatLE(offset + 24); const cy = bytes.readFloatLE(offset + 28); const cz = bytes.readFloatLE(offset + 32);
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (nx * nx + ny * ny + nz * nz < 1e-20) throw new Error('The mesh contains a zero-area triangle.');
    const a = vertex(ax, ay, az); const b = vertex(bx, by, bz); const c = vertex(cx, cy, cz);
    edge(a, b); edge(b, c); edge(c, a);
    volume += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
  }
  for (const edgeInfo of edges.values()) {
    if (edgeInfo.count !== 2 || edgeInfo.winding !== 0) throw new Error('The mesh is not a closed, consistently wound solid.');
  }
  if (parents.some((_, index) => root(index) !== root(0))) throw new Error('The mesh contains disconnected pieces.');
  if (!Number.isFinite(volume) || volume <= 0) throw new Error('The mesh has no positive enclosed volume.');
  return {
    sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, triangles: triangleCount, volume,
    dimensions: { x: bounds.maxX - bounds.minX, y: bounds.maxY - bounds.minY, z: bounds.maxZ - bounds.minZ },
  };
}
