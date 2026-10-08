/**
 * The neighbourhood coupon: a grid of dark and light modules that holds every one of the 512 possible 3 × 3 neighbourhoods at least
 * once. Slicing only looks a few modules round each module, so a code whose every neighbourhood slices right slices right: the
 * coupon checks every situation a real code can hold, which a few real codes would not (tools/test-slicer.ts).
 */

/** mulberry32: small, seedable, and the same everywhere. */
function random(state: number): () => number {
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const windowAt = (grid: boolean[][], y: number, x: number) => {
  let code = 0;
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) code = code * 2 + (grid[y + dy]?.[x + dx] ? 1 : 0);
  return code;
};

/** The 3 × 3 neighbourhoods a grid holds, as 9-bit numbers. */
export function neighbourhoods(grid: boolean[][]): Set<number> {
  const found = new Set<number>();
  for (let y = 0; y + 3 <= grid.length; y++) for (let x = 0; x + 3 <= (grid[0]?.length ?? 0); x++) found.add(windowAt(grid, y, x));
  return found;
}

/** A `size` × `size` grid holding all 512 neighbourhoods, found by flipping modules from a seeded random start while it gains any. */
export function neighbourhoodCoupon(size = 30, seed = 1): boolean[][] {
  const next = random(seed);
  for (let attempt = 0; attempt < 50; attempt++) {
    const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => next() < 0.5));
    let score = neighbourhoods(grid).size;
    for (let tries = 0; tries < 200_000 && score < 512; tries++) {
      const y = Math.floor(next() * size), x = Math.floor(next() * size);
      const row = grid[y] ?? [];
      row[x] = !row[x];
      const after = neighbourhoods(grid).size;
      if (after >= score) score = after; else row[x] = !row[x];
    }
    if (score === 512) return grid;
  }
  throw new Error(`No ${size} × ${size} grid with all 512 neighbourhoods found.`);
}
