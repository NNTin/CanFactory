import * as THREE from 'three';
import type { BomLine } from './catioSubassembly.ts';
import type { createCatioParts } from './catioParts.ts';

export type CatClosure = 'removable' | 'sliding';
export const CAT_CLOSURES = [
  { value: 'removable', label: 'Removable panel with turn buttons' },
  { value: 'sliding', label: 'Vertical sliding gate' },
] as const;
/** Proposed workshop dimensions, not measured PawHut hardware or load-rated construction. mm. */
export const CAT_DOOR = { overlap: 10, clearance: 2, thickness: 12, stop: 4, surround: 16, frame: 30, button: { length: 30, width: 20, thickness: 4, pivot: 12 }, withdrawal: 100 } as const;
export const CAT_DOOR_WARNING = 'For removable panels: retract each captive locking pin, rotate all four turn buttons clear, then withdraw the panel. Refit against the continuous stop and re-engage all pins. Secure cats elsewhere before opening maintenance access; close and retain both end gates before disconnecting a tunnel. Retention and pinch safety require physical tests; this is not a certified cat-proof mechanism.';

/** A stop supports the overlapping leaf inwards; four positively locked tabs retain it outwards. */
export function catDoorLayout(width: number, height: number, floorSeated = false) {
  const { overlap, clearance, surround, button } = CAT_DOOR;
  const bottomOverlap = floorSeated ? 0 : overlap;
  const leafWidth = width + 2 * overlap; const leafHeight = height + overlap + bottomOverlap;
  const buttons = [-1, 1].flatMap(side => [0.25, 0.75].map(t => ({ x: side * (leafWidth / 2 + button.pivot), z: height * t, side })));
  return { width, height, leafWidth, leafHeight, bottomOverlap, receivingWidth: leafWidth + 2 * clearance, receivingHeight: leafHeight + (floorSeated ? 1 : 2) * clearance,
    outerWidth: leafWidth + 2 * (clearance + surround), outerHeight: leafHeight + (floorSeated ? 1 : 2) * (clearance + surround), buttons,
    retainedOverlap: button.length - button.pivot, withdrawal: Math.max(CAT_DOOR.withdrawal, width + 40) };
}

/** Split an axis-aligned timber box around a local clearance pocket; preserve the other five faces. */
export function doorPocket(b: { size: [number, number, number]; center: [number, number, number] }, cut: { size: [number, number, number]; center: [number, number, number] }) {
  const lo = b.center.map((v, i) => v - (b.size[i] ?? 0) / 2); const hi = b.center.map((v, i) => v + (b.size[i] ?? 0) / 2);
  const a = cut.center.map((v, i) => Math.max(lo[i] ?? 0, v - (cut.size[i] ?? 0) / 2));
  const z = cut.center.map((v, i) => Math.min(hi[i] ?? 0, v + (cut.size[i] ?? 0) / 2));
  if (a.some((v, i) => v >= (z[i] ?? 0))) return [b];
  const pieces: typeof b[] = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const side of [-1, 1]) {
      const l = [...lo]; const u = [...hi];
      if (side < 0) u[axis] = a[axis] ?? 0; else l[axis] = z[axis] ?? 0;
      if (l.every((v, i) => v < (u[i] ?? 0))) pieces.push({ size: l.map((v, i) => (u[i] ?? 0) - v) as [number, number, number], center: l.map((v, i) => (v + (u[i] ?? 0)) / 2) as [number, number, number] });
    }
    lo[axis] = a[axis] ?? 0; hi[axis] = z[axis] ?? 0;
  }
  return pieces;
}

export interface CatioDoor {
  id: string; label: string; kind: 'cat' | 'human' | 'access'; connected: boolean; moving: THREE.Group[];
  /** Human doors retain their hinge animation; cat/access panels own their opening motion. */
  setOpen?: (fraction: number) => void;
}
export interface CatDoorOptions {
  id: string; label: string; step: number; width: number; height: number; bottom: number; y: number;
  normal?: 1 | -1; closure: CatClosure; floorSeated?: boolean; solid?: boolean; kind?: 'cat' | 'access'; connected?: boolean;
}

/** Shared by the insert, its installed contexts, enclosure ports and tunnel maintenance panels. +Y is withdrawal. */
export function buildCatDoor(p: ReturnType<typeof createCatioParts>, o: CatDoorOptions): CatioDoor {
  const { component, box, rod, ring, panel, materials: m } = p;
  const { id, step, width: w, height: h, bottom, y, closure } = o; const n = o.normal ?? 1;
  const moving: THREE.Group[] = [];
  const child = (parent: THREE.Group) => { const g = new THREE.Group(); parent.add(g); moving.push(g); return g; };
  const leaf = child(component(`${id}-gate`, step, 'timber'));
  if (closure === 'sliding') {
    const tracks = component(`${id}-tracks`, step, 'hardware');
    for (const side of [-1, 1]) box(tracks, [12, 12, 2 * h + 45], [side * (w / 2 + 16), y, bottom + h + 22.5], m.hardware);
    box(leaf, [w + 20, 12, h + 20], [0, y, bottom + (h + 20) / 2], m.endgrain);
    const latch = child(component(`${id}-latch`, step, 'hardware'));
    box(latch, [42, 20, 12], [0, y + n * 16, bottom + h - 35], m.hardware);
    return { id, label: o.label, kind: o.kind ?? 'cat', connected: o.connected ?? true, moving,
      setOpen: t => { for (const g of moving) g.position.z = t * (h + 30); } };
  }
  const floorSeated = o.floorSeated ?? (!o.solid && o.kind !== 'access');
  const d = catDoorLayout(w, h, floorSeated); const leafBottom = bottom - d.bottomOverlap; const leafCenter = leafBottom + d.leafHeight / 2; const face = y; const leafY = face + n * (CAT_DOOR.thickness / 2 + 1);
  const seat = component(`${id}-seat`, step, 'timber');
  if (floorSeated) {
    // The existing solid threshold completes the seat: never cut holes in a continuous cat walkway.
    for (const side of [-1, 1]) box(seat, [CAT_DOOR.overlap, CAT_DOOR.stop, d.leafHeight], [side * (w / 2 + CAT_DOOR.overlap / 2), face - n * CAT_DOOR.stop / 2, leafCenter], m.endgrain);
    box(seat, [w, CAT_DOOR.stop, CAT_DOOR.overlap], [0, face - n * CAT_DOOR.stop / 2, bottom + h + CAT_DOOR.overlap / 2], m.endgrain);
  } else ring(seat, d.leafWidth, d.leafHeight, CAT_DOOR.overlap, CAT_DOOR.stop, face - n * CAT_DOOR.stop / 2, leafBottom, m.endgrain);
  // A locating surround leaves 2 mm per edge, and carries the tab pivots outside the leaf. It is fixed, not a moving door frame.
  if (floorSeated) {
    for (const side of [-1, 1]) box(seat, [CAT_DOOR.surround, CAT_DOOR.thickness + 2, d.outerHeight], [side * (d.outerWidth - CAT_DOOR.surround) / 2, leafY, bottom + d.outerHeight / 2], m.timber);
    box(seat, [d.receivingWidth, CAT_DOOR.thickness + 2, CAT_DOOR.surround], [0, leafY, bottom + d.outerHeight - CAT_DOOR.surround / 2], m.timber);
  } else ring(seat, d.outerWidth, d.outerHeight, CAT_DOOR.surround, CAT_DOOR.thickness + 2, leafY, leafBottom - CAT_DOOR.clearance - CAT_DOOR.surround, m.timber);
  if (o.solid) {
    const seal = component(`${id}-gasket`, step, 'hardware');
    ring(seal, d.leafWidth, d.leafHeight, 6, 1, face + n * 0.5, leafBottom, m.rubber);
    box(leaf, [d.leafWidth, CAT_DOOR.thickness, d.leafHeight], [0, leafY, leafCenter], m.endgrain);
  } else {
    ring(leaf, d.leafWidth, d.leafHeight, CAT_DOOR.frame, CAT_DOOR.thickness, leafY, leafBottom, m.endgrain);
    // Mesh edges lie under the timber rim; no full side panel remains behind this opening.
    const mesh = panel(`${id}-panel-mesh`, step, d.leafWidth - 12, d.leafHeight - 12, [0, leafY, leafCenter], 'xz', [0, 0, 0]);
    const meshLeaf = child(mesh); meshLeaf.add(...mesh.children.filter(c => c !== meshLeaf));
    const battens = child(component(`${id}-edge-battens`, step, 'timber'));
    ring(battens, d.leafWidth, d.leafHeight, 12, 4, leafY + n * 4, leafBottom, m.endgrain);
  }
  const hardware = component(`${id}-turn-buttons`, step, 'hardware');
  const tabs = d.buttons.map((b, index) => {
    const pivot = new THREE.Group(); pivot.position.set(b.x, face + n * 15, bottom + b.z); hardware.add(pivot);
    const arm = new THREE.Group(); arm.name = `${id}-tab-${index}`; pivot.add(arm);
    box(arm, [CAT_DOOR.button.length, 4, CAT_DOOR.button.width], [-b.side * CAT_DOOR.button.length / 2, 0, 0], m.endgrain);
    rod(arm, [0, -2, 0], [0, 2, 0], CAT_DOOR.button.width / 2, m.endgrain); // rounded pivot end: sound timber around the screw
    rod(pivot, [0, -n * 3, 0], [0, n * 3, 0], 2); // M4 pivot, into the fixed surround
    rod(pivot, [0, n * 2, 0], [0, n * 3, 0], 6); // ISO 7093 M4 washer
    rod(pivot, [0, n * 3, 0], [0, n * 4, 0], 3); // pivot head
    const pin = new THREE.Group(); pin.name = `${id}-locking-pin-${index}`; pivot.add(pin);
    // Captive indexing pin on the non-overlapping end: retract axially before turning. Custom/schematic, not friction alone.
    rod(pin, [-b.side * 6, -n * 8, 6], [-b.side * 6, n * 4, 6], 1.5, m.hardware);
    box(pin, [6, 4, 6], [-b.side * 6, n * 5, 6], m.hardware);
    return { arm, pin, side: b.side };
  });
  return { id, label: o.label, kind: o.kind ?? 'cat', connected: o.connected ?? true, moving,
    setOpen: fraction => {
      const release = THREE.MathUtils.clamp(fraction * 5, 0, 1);
      const turn = THREE.MathUtils.clamp((fraction - 0.2) / 0.3, 0, 1);
      const withdraw = THREE.MathUtils.clamp((fraction - 0.5) / 0.5, 0, 1);
      for (const t of tabs) { t.pin.position.y = n * release * 12; t.arm.rotation.y = t.side * turn * Math.PI / 2; }
      for (const g of moving) g.position.y = n * withdraw * d.withdrawal;
    } };
}

export function catDoorBom(id: string, width: number, height: number, solid: boolean, floorSeated = false): BomLine[] {
  const d = catDoorLayout(width, height, floorSeated);
  const line = (suffix: string, group: BomLine['group'], name: string, quantity: number, size: string, use: string): BomLine => ({ id: `${id}-${suffix}`, group, name, quantity, size, use });
  return [
    ...(solid ? [line('panel', 'Timber', 'Removable solid cat panel', 1, `${d.leafWidth} × ${d.leafHeight} × 12 exterior plywood`, 'Room-side window port; pulls out, does not slide upwards')]
      : [line('stiles', 'Timber', 'Removable panel stile', 2, `30 × 12 · ${d.leafHeight} long`, 'Framed outdoor mesh panel'), line('rails', 'Timber', 'Removable panel rail', 2, `30 × 12 · ${d.leafWidth - 60} long`, 'Between stiles; glued and screwed'),
        line('mesh', 'Mesh', 'Removable panel mesh cut', 1, `${d.leafWidth - 12} × ${d.leafHeight - 12}`, 'Clamp every cut edge under 12 × 4 cover battens'),
        line('battens', 'Timber', 'Panel edge battens', 1, `12 × 4 · 2 × ${d.leafHeight} + 2 × ${d.leafWidth - 24} long`, 'Cover and continuously clamp cut mesh edges'),
        line('frame-screws', 'Hardware', 'Panel frame screws (custom selection)', 8, 'Countersunk 3 × 50, pilot-drilled', 'Driven in the panel plane through 30 mm stiles, 20 mm into rail ends; no exposed tips'),
        { ...line('batten-screws', 'Hardware', 'Panel batten screws', 8, 'DIN 7997 3 × 12', 'Let battens flush into the frame; screw tips must stay within the timber'), partId: 'din-7997-3x12' }]),
    line('seat', 'Timber', 'Continuous panel backstop', 1, `10 × 4 · 2 × ${d.leafHeight} + ${floorSeated ? 1 : 2} × ${width} long`, floorSeated ? 'Sides and head resist inward pressure; existing solid threshold completes the seat' : 'Prevents inward push-through; clear opening unchanged'),
    line('surround', 'Timber', 'Panel locating surround', 1, `16 × 14 · 2 × ${d.outerHeight} + ${floorSeated ? 1 : 2} × ${d.receivingWidth} long`, floorSeated ? '2 mm side/head clearance; leaf seats on existing floor, no threshold pocket' : '2 mm leaf clearance on every edge; carries pivots'),
    { ...line('seat-screws', 'Hardware', 'Backstop/surround screws', floorSeated ? 12 : 16, 'DIN 7997 3 × 25; pilot drill', 'Two per edge of each ring, seated in sound timber; check fixing strength'), partId: 'din-7997-3x25' },
    line('tabs', 'Timber', 'Door turn button (custom)', 4, '40 × 20 × 4 hardwood, rounded pivot end; pivot 10 mm from end', `${d.retainedOverlap} mm nominal overlap; four points of outward retention`),
    line('pivots', 'Hardware', 'Door turn-button pivot set (custom selection)', 4, 'M4 shoulder pivot and threaded insert; verify fit', 'Screw-fixed into the locating surround; rotation without loosening the anchor'),
    { ...line('washers', 'Hardware', 'Door pivot washer', 4, 'ISO 7093 M4', 'Washer at each turn-button pivot'), partId: 'iso-7093-m4' },
    line('pins', 'Hardware', 'Captive locking indexing pin (custom, schematic)', 4, '3 mm pin, ≥4 mm engagement; retract ≥12 mm', 'Locks each turn button closed; retract deliberately before rotating'),
    ...(solid ? [line('seal', 'Hardware', 'Cat-panel gasket', 1, `6 × 1 compressed · ${2 * (d.leafWidth + d.leafHeight - 12)} long`, 'Continuous draught seal against the backstop; verify compression')] : []),
  ];
}
