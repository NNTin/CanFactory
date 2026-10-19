import * as THREE from 'three';
import { MODULAR, modularPortPanel, PORT_FRAME, type EnclosureBox, type EnclosureLayout, type EnclosureMesh, type EnclosurePort, type ModularConfig } from '@canfactory/catio';
import { buildDoorPanel } from './catioDoorScene.ts';
import type { createCatioParts } from './catioParts.ts';

type Parts = ReturnType<typeof createCatioParts>;
type V3 = [number, number, number];
export interface CatioDoor {
  /** A cat port, a maintenance door, or a tunnel's door (a stub's end door, a side-access panel), opened on demand. */
  id: string; label: string; kind: 'cat' | 'human' | 'tunnel'; connected: boolean;
  /** How it opens: a panel lifted out from behind its turn buttons, a gate slid up, or the maintenance door on its hinges. */
  mechanism: 'removable-panel' | 'sliding-gate' | 'hinged' | 'latched';
  /** What moves with it: a sliding gate's leaf and latch, a hinged door's leaf, a removable panel's own pieces. */
  moving: THREE.Group[];
  /** Poses it anywhere from shut and retained (0) to open (1). */
  set: (travel: number) => void;
}
/**
 * The cat ports, drawn into `p` (their doors into `doors`): `port` draws one in its own frame, with its closure and, when coupled,
 * its dock; `coupling` a tunnel's coupling flange. The planner draws every cat port with them.
 */
export function catPorts(p: Parts, c: Pick<ModularConfig, 'tunnelSize' | 'portClosure' | 'doorSeat'>, doors: CatioDoor[]) {
  const { component, box, rod, ring, placed, materials: m } = p;
  const w = c.tunnelSize; const h = c.tunnelSize; const span = w + 80;
  const removable = c.portClosure === 'removable-panel';
  /** What the door controls call a cat port's closure. */
  const closureName = removable ? 'cat-port panel' : 'cat gate';
  /**
   * A cat port, in its own frame: its timber frame round the opening, and on its +Y side (the room's, or the enclosure's inside:
   * the side it is operated from, a tunnel docking on the other) what closes it. That is a removable panel on the frame's face
   * behind turn buttons, as on the window insert page (solid at the window, a framed mesh panel at an enclosure), or a gate
   * sliding up in tracks. `sill` is its floor, where it is not the default (a raised or lowered port).
   */
  function port(id: string, label: string, step: number, connected: boolean, at: 'window' | 'enclosure', stow?: V3, sill: number = MODULAR.sill) {
    const frame = component(`${id}-frame`, step, 'timber', [0, 0, 100]);
    ring(frame, span, h + 2 * PORT_FRAME, PORT_FRAME, PORT_FRAME, 0, sill - PORT_FRAME, m.timber);
    if (removable) {
      const panel = modularPortPanel(c, at, id, stow);
      const timber = component(`${id}-panel`, step, 'timber', [0, 0, 100]); const hardware = component(`${id}-panel-buttons`, step, 'hardware', [0, 0, 100]);
      const meshes = panel.mesh ? component(`${id}-panel-mesh`, step, 'mesh', [0, 0, 100]) : timber;
      // its seat is the frame's +Y face; it comes out along +Y
      const built = buildDoorPanel(p, panel, { origin: [0, PORT_FRAME / 2, sill], u: [-1, 0, 0], v: [0, 0, 1], n: [0, 1, 0] }, { timber, mesh: meshes, hardware });
      doors.push({ id, label, kind: 'cat', connected, mechanism: 'removable-panel', moving: [built.panel, built.panelMesh, built.panelHardware], set: built.set });
    } else {
      const tracks = component(`${id}-tracks`, step, 'hardware', [0, 0, 100]);
      for (const side of [-1, 1]) box(tracks, [12, 28, 2 * h + 45], [side * (w / 2 + 16), 25, sill + h + 12], m.hardware);
      const leafPart = component(`${id}-gate`, step, 'timber', [0, 0, 100]);
      const leaf = new THREE.Group(); leafPart.add(leaf);
      box(leaf, [w + 20, 12, h + 20], [0, 25, sill + h / 2], m.endgrain);
      const hardware = component(`${id}-latch`, step, 'hardware', [0, 0, 100]);
      const movingHardware = new THREE.Group(); hardware.add(movingHardware);
      box(movingHardware, [42, 20, 12], [0, 42, sill + h - 35], m.hardware);
      rod(movingHardware, [w / 2 - 30, 36, sill + 15], [w / 2 + 24, 36, sill + 15], 5);
      const moving = [leaf, movingHardware];
      doors.push({ id, label, kind: 'cat', connected, mechanism: 'sliding-gate', moving, set: travel => { for (const part of moving) part.position.z = (h + 30) * travel; } });
    }
    if (connected) coupling(`${id}-dock`, 0, 0, 0, sill);
  }
  function coupling(id: string, x: number, y: number, angle: number, sill: number = MODULAR.sill) {
    placed(x, y, angle, () => {
      const group = component(`${id}-coupling`, 5, 'hardware', [0, 50, 40]);
      // A shallow matching flange overlaps both mating timber end frames.
      ring(group, span + 8, h + 88, 4, 44, 0, sill - 44, m.hardware);
      for (const side of [-1, 1]) for (const z of [sill + 45, sill + h - 45]) {
        box(group, [12, 65, 20], [side * (w / 2 + 24), 0, z], m.hardware);
        box(group, [20, 25, 8], [side * (w / 2 + 24), 0, z + 14], m.rubber);
      }
    });
  }
  return { removable, closureName, port, coupling };
}

/** What the planner's scene lends the enclosure: placing a sub-frame, and drawing a cat port (with its closure and dock) there. */
export interface EnclosureHost {
  placed: (x: number, y: number, angle: number, build: () => void) => void;
  port: (port: EnclosurePort, label: string) => void;
  doors: CatioDoor[];
}

/** Draws `enclosureLayout` (packages/catio) as stage 2–3 components, in the enclosure's own coordinates. */
export function buildEnclosure(p: Parts, e: EnclosureLayout, closureName: string, host: EnclosureHost) {
  const { component, box, rod, ring, panel, materials: m } = p;
  const id = e.id; const name = id.toUpperCase();
  const material = (b: EnclosureBox) => b.material === 'endgrain' ? m.endgrain : b.material === 'rubber' ? m.rubber : m.timber;
  const boxes = (group: THREE.Group, list: EnclosureBox[]) => list.map(b => box(group, b.size, b.center, material(b)));
  const mesh = (s: EnclosureMesh, step = 2) => panel(s.id, step, s.width, s.height, s.center, s.plane, s.explode);

  const frame = component(`${id}-frame`, 2, 'timber', [0, 100, 200]);
  const feet = component(`${id}-four-feet`, 2, 'hardware', [0, 150, 0]);
  for (const r of e.feet.rods) rod(feet, r.from, r.to, r.radius);
  boxes(feet, e.feet.pads); boxes(frame, e.frame);
  for (const s of e.floor) mesh(s);
  boxes(component(`${id}-roof-net-bearers`, 2, 'timber', [0, 0, 400]), e.bearers);
  mesh(e.roof);
  for (const s of e.rear.mesh) mesh(s);
  host.port(e.rear.port, `Enclosure ${name} rear ${closureName}`);
  for (const wall of e.sides) host.placed(...wall.at, wall.angle, () => {
    for (const s of wall.mesh) mesh(s);
    host.port(wall.port, `Enclosure ${name} ${wall.side} ${closureName}`);
  });
  const landing = component(`${id}-landing-and-ramp`, 3, 'timber', [0, 140, 180]);
  boxes(landing, e.landing);
  const [ramp] = boxes(landing, [e.ramp.board]); if (ramp) ramp.rotation.x = e.ramp.tilt;
  for (const cleat of boxes(landing, e.ramp.cleats)) cleat.rotation.x = e.ramp.tilt;

  const d = e.door;
  const doorTimber = component(`${id}-human-door`, 2, 'timber', [0, 300, 0]);
  ring(doorTimber, d.width, d.height, d.member, d.depth, 0, 0, m.timber);
  const doorMesh = mesh(e.doorMesh);
  const doorMetal = component(`${id}-human-door-hardware`, 2, 'hardware', [0, 300, 0]);
  for (const b of d.hardware) box(doorMetal, b.size, b.center, m.hardware);
  const moving = [doorTimber, doorMesh, doorMetal].map(part => {
    const pivot = new THREE.Group(); pivot.position.set(...d.hinge);
    const centered = new THREE.Group(); centered.position.x = d.width / 2;
    centered.add(...part.children.slice()); pivot.add(centered); part.add(pivot); return pivot;
  });
  host.doors.push({ id: `${id}-human`, label: `Enclosure ${name} maintenance door`, kind: 'human', connected: true, mechanism: 'hinged', moving, set: travel => { for (const part of moving) part.rotation.z = travel * Math.PI / 2; } });
}
