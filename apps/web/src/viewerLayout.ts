/** A compact print-bed grid. Size each column/row independently so tiny reference fasteners do not each reserve a housing-sized cell. */
export function viewerGrid(sizes: readonly { x: number; y: number }[]) {
  if (!sizes.length) return { width: 0, length: 0, centres: [] as [number, number][] };
  const columns = Math.ceil(Math.sqrt(sizes.length)), rows = Math.ceil(sizes.length / columns);
  const widths = Array.from({ length: columns }, (_, column) => Math.max(...sizes.filter((_, i) => i % columns === column).map(s => s.x)) * 1.4);
  const lengths = Array.from({ length: rows }, (_, row) => Math.max(...sizes.slice(row * columns, (row + 1) * columns).map(s => s.y)) * 1.4);
  const width = widths.reduce((sum, value) => sum + value, 0), length = lengths.reduce((sum, value) => sum + value, 0);
  const centres = sizes.map((_, i): [number, number] => {
    const column = i % columns, row = Math.floor(i / columns);
    return [widths.slice(0, column).reduce((sum, value) => sum + value, 0) + (widths[column] ?? 0) / 2 - width / 2,
      length / 2 - lengths.slice(0, row).reduce((sum, value) => sum + value, 0) - (lengths[row] ?? 0) / 2];
  });
  return { width, length, centres };
}
