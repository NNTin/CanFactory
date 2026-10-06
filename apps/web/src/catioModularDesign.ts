import type { CatioView } from './catioDesign.ts';

/** All lengths are millimetres. Grass Z=0; wall Y=0; outdoors is +Y. */
export interface EnclosureSize { width: number; depth: number; height: number }
export interface ModularConfig {
  glassWidth: number; glassHeight: number; sashWidth: number; sashHeight: number;
  enclosure: EnclosureSize; second: EnclosureSize; secondEnabled: boolean;
  tunnelWidth: number; tunnelHeight: number;
  route: 'straight' | 'left' | 'right'; approach: number; lateral: number; final: number; link: number;
}
export const MODULAR_DEFAULT: ModularConfig = {
  glassWidth: 800, glassHeight: 800, sashWidth: 910, sashHeight: 910,
  enclosure: { width: 1200, depth: 1000, height: 1200 }, second: { width: 1200, depth: 1000, height: 1200 }, secondEnabled: false,
  tunnelWidth: 300, tunnelHeight: 300, route: 'straight', approach: 2, lateral: 2, final: 1, link: 2,
};
export const MODULAR = { moduleLength: 500, timber: 40, sill: 200, floor: 4, wall: 300, recess: 150 } as const;
export const MODULAR_STEPS = [
  { title: 'Existing window', detail: 'Start with the inward-opening window and grass outside.' },
  { title: 'Fit the window insert', detail: 'From inside, tighten the padded recess clamps. Keep the small sliding cat gate closed; mesh fills the remaining opening.' },
  { title: 'Position the enclosures', detail: 'Place each enclosure on four short feet. Fit its continuous grass-level mesh floor, skirts, walls, roof and latched front maintenance door.' },
  { title: 'Fit landings and cat ports', detail: 'Add the raised rear landing and ramp. Fit the small sliding gates on the rear and side ports; keep unused ports closed.' },
  { title: 'Lay the supported tunnel', detail: 'Join 50 cm straight sections and, for an offset, two 90° corners. The enclosed solid walkway stays level with the sill on feet at each joint.' },
  { title: 'Couple the connections', detail: 'Seat the matching rectangular collars and secure the removable clamps at every joint. Gates remain closed while connections are made.' },
  { title: 'Open the connected gates', detail: 'With maintenance doors latched, open the gates along the connected route. Before disconnecting a run, close and latch the gates at both ends.' },
] as const;
/** The modular concept's second step when the window insert hangs on the window frame (its default). */
export const MODULAR_HUNG_STEP = { title: 'Fit the window insert', detail: 'Hang it on the window frame: its screen hooks reach behind the fixed frame’s lip and its feet stand on the recess floor, so the sash still closes. Keep the small sliding cat gate closed; mesh fills the remaining opening.' };

export function validateModular(c: ModularConfig): string[] {
  const errors: string[] = [];
  const range = (n: number, low: number, high: number, name: string) => {
    if (!Number.isFinite(n) || n < low || n > high) errors.push(`${name} must be ${low / 10}–${high / 10} cm.`);
  };
  range(c.glassWidth, 400, 1400, 'Glass width'); range(c.glassHeight, 400, 1400, 'Glass height');
  range(c.sashWidth, 500, 1600, 'Sash width'); range(c.sashHeight, 500, 1600, 'Sash height');
  if (c.sashWidth - c.glassWidth < 60 || c.sashHeight - c.glassHeight < 60) errors.push('The sash needs at least 3 cm of frame on each side of the glass.');
  range(c.tunnelWidth, 200, 450, 'Tunnel clear width'); range(c.tunnelHeight, 200, 450, 'Tunnel clear height');
  if (c.tunnelWidth + 80 > c.sashWidth - 10) errors.push('The cat port and its frame must fit inside the window collar.');
  if (2 * c.tunnelHeight + 40 > c.sashHeight - 10) errors.push('The sliding gate needs room for its full upward travel inside the window collar.');
  for (const [label, size] of [['Enclosure A', c.enclosure], ['Enclosure B', c.second]] as const) {
    range(size.width, 800, 2400, `${label} width`); range(size.depth, 800, 2400, `${label} depth`); range(size.height, 900, 2200, `${label} height`);
    if (label === 'Enclosure B' && !c.secondEnabled) continue;
    if (MODULAR.sill + 2 * c.tunnelHeight + 80 > size.height) errors.push(`${label} is too low for the raised cat gate.`);
    if (size.depth - (c.tunnelWidth + 100) - 80 < 300) errors.push(`${label} needs at least 30 cm of ramp run beyond the landing.`);
  }
  for (const [key, value] of Object.entries({ approach: c.approach, lateral: c.lateral, final: c.final, link: c.link })) {
    if (!Number.isInteger(value) || value < 1 || value > 6) errors.push(`${key} run needs 1–6 modules.`);
  }
  if (!['straight', 'left', 'right'].includes(c.route)) errors.push('Choose a straight, left or right route.');
  return errors;
}
export type Point = [number, number];
export interface TunnelSection { id: string; kind: 'straight' | 'corner'; center: Point; length: number; angle: number; openings: ('back' | 'front' | 'left' | 'right')[] }
export interface EnclosurePlacement { id: 'a' | 'b'; centerX: number; rearY: number; size: EnclosureSize }
export function modularLayout(c: ModularConfig) {
  const sections: TunnelSection[] = [];
  const span = c.tunnelWidth + 80;
  let serial = 0;
  const run = (start: Point, angle: number, count: number): Point => {
    const dx = -Math.sin(angle); const dy = Math.cos(angle);
    for (let i = 0; i < count; i++) sections.push({ id: `tunnel-${serial++}`, kind: 'straight', center: [start[0] + dx * (i + 0.5) * 500, start[1] + dy * (i + 0.5) * 500], length: 500, angle, openings: ['back', 'front'] });
    return [start[0] + dx * count * 500, start[1] + dy * count * 500];
  };
  let end = run([0, 0], 0, c.approach);
  if (c.route !== 'straight') {
    const sign = c.route === 'right' ? 1 : -1;
    sections.push({ id: `tunnel-${serial++}`, kind: 'corner', center: [0, end[1] + span / 2], length: span, angle: 0, openings: ['back', sign > 0 ? 'right' : 'left'] });
    end = run([sign * span / 2, end[1] + span / 2], -sign * Math.PI / 2, c.lateral);
    const center: Point = [end[0] + sign * span / 2, end[1]];
    sections.push({ id: `tunnel-${serial++}`, kind: 'corner', center, length: span, angle: 0, openings: [sign > 0 ? 'left' : 'right', 'front'] });
    end = run([center[0], center[1] + span / 2], 0, c.final);
  }
  const enclosures: EnclosurePlacement[] = [{ id: 'a', centerX: end[0], rearY: end[1], size: c.enclosure }];
  if (c.secondEnabled) {
    const x = end[0] + c.enclosure.width / 2;
    run([x, end[1] + (c.tunnelWidth + 100) / 2], -Math.PI / 2, c.link);
    enclosures.push({ id: 'b', centerX: x + c.link * 500 + c.second.width / 2, rearY: end[1], size: c.second });
  }
  const minX = Math.min(-c.sashWidth / 2 - 250, ...enclosures.map(e => e.centerX - e.size.width / 2));
  const maxX = Math.max(c.sashWidth / 2 + 250, ...enclosures.map(e => e.centerX + e.size.width / 2));
  const maxY = Math.max(...enclosures.map(e => e.rearY + e.size.depth + e.size.width)); // includes open human doors
  const maxZ = Math.max(c.sashHeight + 300, ...enclosures.map(e => e.size.height));
  return { sections, enclosures, end, bounds: { minX, maxX, maxY, maxZ } };
}
export function modularCamera(c: ModularConfig, view: CatioView, exploded: boolean) {
  const b = modularLayout(c).bounds;
  const center: [number, number, number] = [(b.minX + b.maxX) / 2, b.maxY / 2, b.maxZ / 2];
  const extent = Math.max(b.maxX - b.minX, b.maxY + 400, b.maxZ) + (exploded ? 1000 : 0);
  const vectors = { Exterior: [1.8, 1.1, 1.7], Interior: [0.65, -1.7, 0.65], Front: [0, 1.9, 0.12], Side: [1.9, 0, 0.12], Top: [0, 0.001, 2.1], Mounting: [0.5, -1.5, 0.6] };
  if (view === 'Mounting' || view === 'Interior') {
    const target: [number, number, number] = [0, -60, 200 + c.sashHeight / 2];
    return { target, position: vectors[view].map((v, i) => (target[i] ?? 0) + v * Math.max(c.sashWidth, c.sashHeight) * (exploded ? 1.6 : 1.2)) as [number, number, number] };
  }
  return { target: center, position: vectors[view].map((v, i) => (center[i] ?? 0) + v * extent) as [number, number, number] };
}
