import * as THREE from 'three';
import { dimensionOf, findPart } from '@canfactory/contracts';
import type { createCatioParts } from './catioParts.ts';
import { DOOR, doorPose, type DoorBox, type DoorFrame, type DoorPanel } from './catioDoor.ts';

/** The groups a door is drawn into, by layer: each gets the door's pieces of that layer, placed by the door's frame. */
export interface DoorLayers { timber: THREE.Object3D; mesh: THREE.Object3D; hardware: THREE.Object3D }

/**
 * A removable door panel (catioDoor.ts) as 3D pieces, drawn once for every scene that shows one: the window insert's cat port
 * (on its own page and as context on the tunnel's and the coupling's), the enclosures' cat ports and the tunnel's side access.
 * Every piece is a group in the door's own frame (u, v, n), so a scene can bring it in along the way it is fitted. `set` poses the
 * whole door anywhere between seated and retained (0) and removed and set aside (1): the buttons turn, then the panel comes out.
 */
export function buildDoorPanel(p: ReturnType<typeof createCatioParts>, door: DoorPanel, frame: DoorFrame, into: DoorLayers) {
  const { materials: m } = p;
  const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(...frame.u), new THREE.Vector3(...frame.v), new THREE.Vector3(...frame.n)).setPosition(new THREE.Vector3(...frame.origin));
  /** A group in the door's frame under `parent`. */
  const placed = (parent: THREE.Object3D) => { const g = new THREE.Group(); basis.decompose(g.position, g.quaternion, g.scale); parent.add(g); return g; };
  const timber = placed(into.timber); const meshes = placed(into.mesh); const hardware = placed(into.hardware);
  const piece = (parent: THREE.Object3D) => { const g = new THREE.Group(); parent.add(g); return g; };
  const boxes = (parent: THREE.Group, list: DoorBox[], material: THREE.Material) => { for (const b of list) p.box(parent, b.size, b.center, material); return parent; };

  // fixed round the opening: stops and locating strips, and the seal on the seat
  const fixed = door.timber.filter(t => !t.moves).map(t => ({ timber: t, group: boxes(piece(timber), t.boxes, m.endgrain) }));
  const seal = door.seal ? boxes(piece(hardware), door.seal.boxes, m.rubber) : null;
  // the panel, which comes out as one: its sheet or frame, its mesh, its pull and its own screws
  const panel = piece(timber); const panelMesh = piece(meshes); const panelHardware = piece(hardware);
  for (const t of door.timber.filter(q => q.moves)) boxes(panel, t.boxes, t.id === 'panel-frame-stile' || t.id === 'panel-frame-rail' ? m.timber : m.endgrain);
  if (door.mesh) {
    const { width, height, center } = door.mesh; const pitch = p.mesh.opening + p.mesh.strand;
    const lines = (size: number) => { const at: number[] = []; for (let x = -size / 2; x < size / 2; x += pitch) at.push(x); at.push(size / 2); return at; };
    const us = lines(width); const vs = lines(height);
    const wires = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), m.mesh, us.length + vs.length); const dummy = new THREE.Object3D(); let i = 0;
    for (const u of us) { dummy.position.set(u, 0, 0); dummy.scale.set(p.mesh.strand, height, p.mesh.strand); dummy.updateMatrix(); wires.setMatrixAt(i++, dummy.matrix); }
    for (const v of vs) { dummy.position.set(0, v, 0); dummy.scale.set(width, p.mesh.strand, p.mesh.strand); dummy.updateMatrix(); wires.setMatrixAt(i++, dummy.matrix); }
    wires.position.set(...center); wires.name = `${door.id}-mesh`; panelMesh.add(wires);
  }
  if (door.pull) p.box(panelHardware, door.pull.size, door.pull.center, m.printed);
  const screw = (parent: THREE.Group, f: DoorPanel['fasteners'][number]) => {
    const part = findPart(f.partId); if (!part) return;
    const g = new THREE.Group(); g.position.set(...f.at); parent.add(g);
    // a staple: a short bar over the mesh
    if (part.family === 'nail') { p.rod(g, [-5, 0, 0], [5, 0, 0], 1); return g; }
    const tip = f.direction.map(x => x * dimensionOf(part, 'l')) as [number, number, number]; const head = f.direction.map(x => x * 1.5) as [number, number, number];
    p.rod(g, [0, 0, 0], head, dimensionOf(part, 'dk') / 2); p.rod(g, [0, 0, 0], tip, dimensionOf(part, 'd') / 2.4);
    return g;
  };
  for (const f of door.fasteners.filter(q => q.moves)) screw(panelHardware, f);
  const fixedScrews = piece(hardware);
  for (const f of door.fasteners.filter(q => !q.moves && q.role !== 'pivot')) screw(fixedScrews, f);

  // the turn buttons: each a bar on its pivot, over its washer, turning a quarter turn between closed and open
  const washerHeight = dimensionOf(door.washer, 'h'); const { thickness, width } = DOOR.button;
  const buttons = door.buttons.map(b => {
    const group = piece(hardware); group.position.set(b.pivot[0], b.pivot[1], b.pivot[2]);
    p.rod(group, [0, 0, -washerHeight], [0, 0, 0], dimensionOf(door.washer, 'd2') / 2);
    const arm = piece(group);
    p.box(arm, [b.reach + b.tail, width, thickness], [(b.reach - b.tail) / 2, 0, thickness / 2], m.printed);
    const pivot = door.fasteners.find(f => f.role === 'pivot' && f.at[0] === b.pivot[0] && f.at[1] === b.pivot[1]);
    if (pivot) { const g = screw(arm, { ...pivot, at: [0, 0, thickness] }); g?.position.set(0, 0, thickness); }
    // its captive locking pin, through the button at the lock and down into its hole; lifted by its knob before the button turns
    const { lock } = DOOR.button; const d = Math.hypot(b.lock[0] - b.pivot[0], b.lock[1] - b.pivot[1]);
    const pin = piece(arm); pin.position.set(d, 0, 0); pin.name = `${b.id}-lock`;
    p.rod(pin, [0, 0, -washerHeight - lock.into], [0, 0, thickness + lock.knob.height], lock.diameter / 2);
    p.rod(pin, [0, 0, thickness], [0, 0, thickness + lock.knob.height], lock.knob.diameter / 2, m.printed);
    const closed = Math.atan2(b.closed[1], b.closed[0]); const open = Math.atan2(b.open[1], b.open[0]);
    const quarter = Math.atan2(Math.sin(open - closed), Math.cos(open - closed));
    const setTurn = (turn: number) => { arm.rotation.z = closed + quarter * turn; pin.position.z = turn > 0 ? lock.into + 1 : 0; };
    setTurn(0);
    return { button: b, group, arm, setTurn };
  });

  const moving = [panel, panelMesh, panelHardware];
  /** The buttons `turn` of the way open, and the panel `offset` from its seat (in the door's frame), or `gone`: carried away. */
  const pose = (turn: number, offset: readonly [number, number, number], gone = false) => {
    for (const b of buttons) b.setTurn(turn);
    for (const g of moving) { g.position.set(...offset); for (const child of g.children) child.visible = !gone; }
  };
  /** Anywhere between seated and retained (0) and removed (1): set aside where the page stows it, or carried away. */
  const set = (travel: number) => { const q = doorPose(door, travel); pose(q.turn, q.offset, q.gone); };
  set(0);
  return { door, frame, fixed, seal, fixedScrews, panel, panelMesh, panelHardware, moving, buttons, pose, set };
}
export type BuiltDoor = ReturnType<typeof buildDoorPanel>;
