/** Room left around every part on the print bed, as a factor of its size. */
const SPACING = 1.4;

/**
 * A compact print bed: the cells (one per part, or per group of identical library parts) packed into rows, deepest first, each row as
 * deep as its deepest cell, so small fasteners share shallow rows of their own instead of each taking a housing-sized cell. The rows
 * fill up to a width that keeps the bed roughly square, and are centred on the origin; `centres` follow the input order.
 */
export function viewerGrid(sizes: readonly { x: number; y: number }[]) {
  if (!sizes.length) return { width: 0, length: 0, centres: [] as [number, number][] };
  const cells = sizes.map((size, index) => ({ index, x: size.x * SPACING, y: size.y * SPACING }));
  const target = Math.max(...cells.map(cell => cell.x), Math.sqrt(cells.reduce((sum, cell) => sum + cell.x * cell.y, 0)) * 1.2);
  const rows: { cells: typeof cells; width: number; length: number }[] = [];
  for (const cell of [...cells].sort((a, b) => b.y - a.y || a.index - b.index)) {
    const row = rows.at(-1);
    if (row && row.width + cell.x <= target + 1e-9) { row.cells.push(cell); row.width += cell.x; row.length = Math.max(row.length, cell.y); }
    else rows.push({ cells: [cell], width: cell.x, length: cell.y });
  }
  const width = Math.max(...rows.map(row => row.width)), length = rows.reduce((sum, row) => sum + row.length, 0);
  const centres: [number, number][] = sizes.map(() => [0, 0]);
  let top = length / 2;
  for (const row of rows) {
    let left = -row.width / 2;
    for (const cell of row.cells) { centres[cell.index] = [left + cell.x / 2, top - row.length / 2]; left += cell.x; }
    top -= row.length;
  }
  return { width, length, centres };
}

/**
 * Pushes overlays on the viewer (pixels) apart until no two are nearer than `gap` ([x, y]: a tag is wider than it is tall), each pair
 * about its middle, in place; then rounds them. Two that sit at the same point go apart sideways.
 */
export function spreadApart(points: [number, number][], gap: readonly [number, number]): void {
  for (let pass = 0; pass < 8; pass++) for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    const a = points[i], b = points[j];
    if (!a || !b) continue;
    const dx = (b[0] - a[0]) / gap[0], dy = (b[1] - a[1]) / gap[1], distance = Math.hypot(dx, dy);
    if (distance >= 1) continue;
    const [ux, uy] = distance > 1e-6 ? [dx / distance, dy / distance] : [1, 0], push = (1 - distance) / 2;
    a[0] -= ux * push * gap[0]; a[1] -= uy * push * gap[1]; b[0] += ux * push * gap[0]; b[1] += uy * push * gap[1];
  }
  for (const point of points) { point[0] = Math.round(point[0]); point[1] = Math.round(point[1]); }
}
