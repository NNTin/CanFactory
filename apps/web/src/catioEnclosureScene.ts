import * as THREE from 'three';
import type { EnclosureBox, EnclosureLayout, EnclosureMesh, EnclosurePort } from '@canfactory/catio';
import type { createCatioParts } from './catioParts.ts';
import type { CatioDoor } from './catioModularScene.ts';

type Parts = ReturnType<typeof createCatioParts>;
/** What the modular scene lends the enclosure: placing a sub-frame, and drawing a cat port (with its closure and dock) there. */
export interface EnclosureHost {
  placed: (x: number, y: number, angle: number, build: () => void) => void;
  port: (port: EnclosurePort, label: string) => void;
  doors: CatioDoor[];
}

/** Draws `enclosureLayout` (packages/catio) as the modular catio's stage 2–3 components, in the enclosure's own coordinates. */
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
