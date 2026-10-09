import { cornerBracketHoles, devBoardLayout, METRIC_THREADS, type DevBoardComponent, type MetricThread, type Part } from '@canfactory/contracts';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Builds a part of the library from its dimensions, for the parts library's preview: millimetres, Z up, standing on z = 0. The
 * shapes are simplified (a thread is drawn as rings at its pitch, knurls as bands) but every size in them is the part's own,
 * so that parts can be compared. Colours are vertex colours, so that one mesh (one hover target) can have a dark socket.
 */

const STEEL = 0xa3a8ad;
const DARK = 0x3b4046;
const BRASS = 0xc9a24c;
const NICKEL = 0xcfd2d6;
const NYLON = 0xece4cc;
const SHIELD = 0x58606a;

type Piece = THREE.BufferGeometry;

function paint(geometry: Piece, color: number): Piece {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  flat.deleteAttribute('uv');
  const { r, g, b } = new THREE.Color(color);
  const count = flat.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([r, g, b], i * 3);
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return flat;
}

/** A solid of revolution about Z from an outline of (radius, z) points; an outline that starts and ends on the axis is closed. */
function revolve(outline: [number, number][], color: number, segments = 48): Piece {
  const geometry = new THREE.LatheGeometry(outline.map(([r, z]) => new THREE.Vector2(Math.max(r, 0), z)), segments);
  geometry.rotateX(Math.PI / 2);
  return paint(geometry, color);
}

/** A closed ring (tube) of revolution from its cross-section, given counter-clockwise in (radius, z). */
function ring(section: [number, number][], color: number, segments = 48): Piece {
  return revolve([...section, section[0] ?? [0, 0]], color, segments);
}

function polygon(sides: number, circumradius: number, rotation = Math.PI / 6): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i <= sides; i++) {
    const angle = rotation + i * 2 * Math.PI / sides;
    if (i === 0) shape.moveTo(circumradius * Math.cos(angle), circumradius * Math.sin(angle));
    else shape.lineTo(circumradius * Math.cos(angle), circumradius * Math.sin(angle));
  }
  return shape;
}

function circle(radius: number): THREE.Path {
  const path = new THREE.Path(); path.absarc(0, 0, radius, 0, Math.PI * 2, false); return path;
}

/** A prism of `shape` from z0 up by `height`. */
function prism(shape: THREE.Shape, z0: number, height: number, color: number): Piece {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 32 });
  geometry.translate(0, 0, z0);
  return paint(geometry, color);
}

const hexAcrossFlats = (s: number) => s / Math.sqrt(3);

/** A threaded shaft from z0 to z1, threaded over `threadLength` from z0: rings at the pitch between the major and minor radius. */
function shaft(d: number, pitch: number, z0: number, z1: number, threadLength: number, color: number): Piece {
  const major = d / 2; const minor = major - 0.6 * pitch;
  const outline: [number, number][] = [[0, z0], [minor, z0]];
  const top = Math.min(z1, z0 + threadLength);
  for (let z = z0 + pitch / 2; z < top; z += pitch) outline.push([major, z], [minor, Math.min(z + pitch / 2, top)]);
  outline.push([major, top], [major, z1], [0, z1]);
  return revolve(outline, color, 32);
}

const value = (part: Part, key: string, fallback = 0) => part.dimensions[key]?.value ?? fallback;
/** The largest size a dimension may have: what a printed pocket must take. */
const largest = (part: Part, key: string, fallback = 0) => part.dimensions[key]?.max ?? value(part, key, fallback);

function screw(part: Part): Piece[] {
  const d = value(part, 'd'); const pitch = value(part, 'pitch'); const l = value(part, 'l'); const k = largest(part, 'k');
  const dk = largest(part, 'dk', d * 1.7); const s = value(part, 's'); const t = value(part, 't', k * 0.5);
  const head = part.attributes['head'];
  const color = head === 'socket-cap' ? DARK : STEEL;
  const socketColor = head === 'socket-cap' ? 0x1f2226 : DARK;
  if (head === 'countersunk') {
    // The length includes the head: the cone sits on top of the shaft.
    return [shaft(d, pitch, 0, l - k, value(part, 'b', l), color), revolve([[0, l - k], [d / 2, l - k], [dk / 2, l], [0, l]], color),
      prism(polygon(6, hexAcrossFlats(s)), l - 0.01, 0.02, socketColor)];
  }
  const threaded = value(part, 'b', l) < l ? value(part, 'b', l) : l;
  const pieces = [shaft(d, pitch, 0, l, threaded, color)];
  if (head === 'socket-cap') {
    const socket = new THREE.Shape(); socket.absarc(0, 0, dk / 2, 0, Math.PI * 2, false);
    socket.holes.push(polygon(6, hexAcrossFlats(s)));
    pieces.push(revolve([[0, l], [dk / 2 - 0.2, l], [dk / 2, l + 0.2], [dk / 2, l + k - t], [0, l + k - t]], color), prism(socket, l + k - t, t, color),
      prism(polygon(6, hexAcrossFlats(s)), l + k - t, 0.02, socketColor));
  } else if (head === 'button') {
    const arc: [number, number][] = Array.from({ length: 9 }, (_, i) => { const a = (i / 8) * Math.PI / 2; return [s * 0.75 + (dk / 2 - s * 0.75) * Math.cos(a), l + k * 0.2 + k * 0.8 * Math.sin(a)]; });
    pieces.push(revolve([[0, l], [dk / 2, l], ...arc, [0, l + k]], color), prism(polygon(6, hexAcrossFlats(s)), l + k - 0.01, 0.02, socketColor));
  } else if (head === 'hex') {
    pieces.push(prism(polygon(6, value(part, 'e', s * 1.15) / 2), l, k, color));
  } else {
    // pan head with a cross recess
    const arc: [number, number][] = Array.from({ length: 9 }, (_, i) => { const a = (i / 8) * Math.PI / 2; return [dk * 0.3 + dk * 0.2 * Math.cos(a), l + k * 0.45 + k * 0.55 * Math.sin(a)]; });
    const slot = (width: number, depth: number) => { const box = new THREE.BoxGeometry(width, depth, 0.04); box.translate(0, 0, l + k); return paint(box, socketColor); };
    pieces.push(revolve([[0, l], [dk / 2, l], [dk / 2, l + k * 0.45], ...arc, [0, l + k]], color), slot(dk * 0.45, dk * 0.1), slot(dk * 0.1, dk * 0.45));
  }
  return pieces;
}

function nut(part: Part): Piece[] {
  const d = value(part, 'd'); const s = largest(part, 's'); const m = largest(part, 'm');
  const shape = part.attributes['shape']?.startsWith('square') ? polygon(4, s / Math.SQRT2, Math.PI / 4) : polygon(6, hexAcrossFlats(s));
  shape.holes.push(circle(d / 2));
  const pieces = [prism(shape, 0, m, STEEL)];
  if (part.attributes['shape'] === 'hex-nyloc') {
    const h = largest(part, 'h'); const collar = value(part, 'dw', s * 0.85) / 2;
    pieces.push(ring([[d / 2 + 0.3, m], [collar, m], [collar, h - 0.4], [collar - 0.4, h], [d / 2 + 0.3, h]], STEEL),
      ring([[d / 2, m], [d / 2 + 0.3, m], [d / 2 + 0.3, h - 0.3], [d / 2, h - 0.3]], NYLON));
  }
  return pieces;
}

function washer(part: Part): Piece[] {
  const d1 = value(part, 'd1') / 2; const d2 = value(part, 'd2') / 2; const h = value(part, 'h');
  const chamfer = part.attributes['series']?.includes('chamfered') ? h * 0.35 : 0;
  return [ring([[d1, 0], [d2, 0], [d2, h - chamfer], [d2 - chamfer, h], [d1, h]], STEEL)];
}

function insert(part: Part): Piece[] {
  const l = value(part, 'l'); const outer = value(part, 'd') / 2; const pilot = value(part, 'pilot', outer * 1.7 - value(part, 'hole') * 0.7) / 2;
  const bore = Number(part.attributes['thread']?.slice(1) ?? 3) / 2 * 0.85; const groove = outer - (outer - pilot) * 0.6;
  // pilot at the bottom, then two knurled bands with a groove between them
  return [ring([[bore, 0], [pilot, 0], [pilot, l * 0.2], [outer, l * 0.22], [outer, l * 0.52], [groove, l * 0.55], [groove, l * 0.65], [outer, l * 0.68], [outer, l], [bore, l]], BRASS, 24)];
}

function bearing(part: Part): Piece[] {
  const d = value(part, 'd') / 2; const D = value(part, 'D') / 2; const B = value(part, 'B');
  const wall = (D - d) * 0.22; const c = Math.min(0.3, wall / 3);
  const race = (r0: number, r1: number): Piece => ring([[r0 + c, 0], [r1 - c, 0], [r1, c], [r1, B - c], [r1 - c, B], [r0 + c, B], [r0, B - c], [r0, c]], STEEL);
  return [race(d, d + wall), race(D - wall, D), ring([[d + wall, 0.3], [D - wall, 0.3], [D - wall, B - 0.3], [d + wall, B - 0.3]], SHIELD)];
}

function pin(part: Part): Piece[] {
  const r = largest(part, 'd') / 2; const l = value(part, 'l'); const c = value(part, 'c');
  return [revolve([[0, 0], [r - c, 0], [r, c], [r, l - c], [r - c, l], [0, l]], STEEL, 32)];
}

function magnet(part: Part): Piece[] {
  const t = value(part, 'thickness'); const c = Math.min(0.15, t / 6);
  const shape = part.attributes['shape'];
  if (shape === 'block') {
    const box = new THREE.BoxGeometry(value(part, 'length'), value(part, 'width'), t); box.translate(0, 0, t / 2);
    return [paint(box, NICKEL)];
  }
  const r = value(part, 'diameter') / 2; const hole = value(part, 'innerDiameter') / 2;
  if (shape === 'countersunk-pot') {
    const sink = value(part, 'countersinkDiameter', hole * 2) / 2;
    return [ring([[hole, 0], [r - c, 0], [r, c], [r, t - c], [r - c, t], [sink, t], [hole, t - (sink - hole)]], STEEL)];
  }
  if (hole > 0) return [ring([[hole, 0], [r - c, 0], [r, c], [r, t - c], [r - c, t], [hole, t]], NICKEL)];
  return [revolve([[0, 0], [r - c, 0], [r, c], [r, t - c], [r - c, t], [0, t]], NICKEL)];
}

function insertNut(part: Part): Piece[] {
  // a steel sleeve: the coarse wood thread as rings between its core and outer diameter, with the metric bore inside
  const l = value(part, 'l'); const outer = value(part, 'd') / 2; const core = value(part, 'core') / 2;
  const bore = Number(part.attributes['thread']?.slice(1) ?? 8) / 2; const pitch = l / 6;
  const outline: [number, number][] = [[bore, 0], [core, 0]];
  for (let z = pitch / 2; z < l - pitch / 2; z += pitch) outline.push([outer, z], [core, Math.min(z + pitch / 2, l)]);
  outline.push([core, l], [bore, l]);
  return [ring(outline, STEEL, 32)];
}

function woodScrew(part: Part): Piece[] {
  // the countersunk head is part of the length; the shank tapers to a point over its last 1.5 d
  const d = value(part, 'd'); const l = value(part, 'l'); const dk = value(part, 'dk'); const k = value(part, 'k');
  const pitch = d * 0.45; const tip = d * 1.5; const top = l - k;
  const outline: [number, number][] = [[0, 0]];
  for (let z = pitch / 2; z < top; z += pitch) {
    const scale = Math.min(1, z / tip);
    outline.push([d / 2 * scale, z], [d * 0.33 * scale, Math.min(z + pitch / 2, top)]);
  }
  outline.push([d * 0.33, top], [dk / 2, l], [0, l]);
  const recess = (width: number, depth: number) => { const box = new THREE.BoxGeometry(width, depth, 0.04); box.translate(0, 0, l); return paint(box, DARK); };
  return [revolve(outline, STEEL, 32), recess(dk * 0.45, dk * 0.1), recess(dk * 0.1, dk * 0.45)];
}

function staple(part: Part): Piece[] {
  // two pointed legs joined by a round crown; the width across the legs is illustrative (no source gives it)
  const d = value(part, 'd'); const l = value(part, 'l'); const r = l * 0.22;
  // the crown's centre line peaks at l - d/2, so that the wire's top is at l
  const base = l - d / 2 - r; const control = base + r * 4 / 3;
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(new THREE.LineCurve3(new THREE.Vector3(-r, 0, d * 1.5), new THREE.Vector3(-r, 0, base)));
  path.add(new THREE.CubicBezierCurve3(new THREE.Vector3(-r, 0, base), new THREE.Vector3(-r, 0, control), new THREE.Vector3(r, 0, control), new THREE.Vector3(r, 0, base)));
  path.add(new THREE.LineCurve3(new THREE.Vector3(r, 0, base), new THREE.Vector3(r, 0, d * 1.5)));
  const wire = paint(new THREE.TubeGeometry(path, 48, d / 2, 12, false), STEEL);
  const point = (x: number) => { const cone = new THREE.ConeGeometry(d / 2, d * 1.5, 12); cone.rotateX(-Math.PI / 2); cone.translate(x, 0, d * 0.75); return paint(cone, STEEL); };
  return [wire, point(-r), point(r)];
}

function levellingFoot(part: Part): Piece[] {
  // elastomer cap, foot plate, ball cup, the hexagon on the ball, and the stud with its nut
  const d1 = value(part, 'd1') / 2; const d = value(part, 'd'); const l1 = value(part, 'l1'); const l2 = value(part, 'l2');
  const l3 = value(part, 'l3', l2); const l4 = value(part, 'l4'); const s = value(part, 's');
  const cap = l3 - l2; const plate = cap + l4; const hex = s * 0.45; const top = l3;
  return [
    revolve([[0, 0], [d1 - 0.5, 0], [d1, 0.5], [d1, cap], [0, cap]], DARK),
    revolve([[0, cap], [d1, cap], [d1, plate], [d1 * 0.62, plate + (top - hex - plate) * 0.55], [s * 0.45, top - hex], [0, top - hex]], STEEL),
    prism(polygon(6, hexAcrossFlats(s)), top - hex, hex, STEEL),
    shaft(d, (part.attributes['thread'] ?? '') in METRIC_THREADS ? METRIC_THREADS[part.attributes['thread'] as MetricThread] : d * 0.15, top, top + l1, l1, STEEL),
    (() => { const nutShape = polygon(6, hexAcrossFlats(d * 1.6)); nutShape.holes.push(circle(d / 2)); return prism(nutShape, top + l1 * 0.45, d * 0.8, STEEL); })(),
  ];
}

function toggleLatch(part: Part): Piece[] {
  // closed, along +X: the base plate with its pivot block, the lever over to the hook, and the separate catch bracket at the far
  // end; a safety catch (h3) or padlock eye (h4) stands on the lever
  const b1 = value(part, 'b1'); const b2 = value(part, 'b2'); const b3 = value(part, 'b3'); const b4 = value(part, 'b4');
  const h1 = value(part, 'h1'); const h2 = value(part, 'h2'); const l1 = value(part, 'l1'); const sheet = 1.5;
  const block = (size: [number, number, number], at: [number, number, number], color = STEEL) => {
    const geometry = new THREE.BoxGeometry(...size); geometry.translate(at[0] + size[0] / 2, at[1], at[2] + size[2] / 2); return paint(geometry, color);
  };
  const pieces = [
    block([b3, b1, sheet], [0, 0, 0]),
    block([b3 * 0.55, b1 * 0.8, h1 * 0.75], [b3 * 0.2, 0, sheet]),
    block([l1 - b4 * 0.6 - b3 * 0.25, b1 * 0.9, sheet], [b3 * 0.25, 0, h1 - sheet]),
    block([b4, b2, sheet], [l1 - b4, 0, 0]),
    block([sheet * 2, b2 * 0.6, h2], [l1 - b4, 0, sheet], DARK),
  ];
  const guard = value(part, 'h3') || value(part, 'h4');
  if (guard) pieces.push(block([3, 4, guard - h1 + sheet], [l1 * 0.45, 0, h1 - sheet], DARK));
  return pieces;
}

function screenHook(part: Part): Piece[] {
  // bent for a lip in the middle of its range: the screwed leg standing up, the strip turned along +Y past the lip, the tip up
  const h = value(part, 'h'); const l = value(part, 'l'); const w = value(part, 'w'); const t = value(part, 't'); const d = value(part, 'd');
  const reach = (value(part, 'x1') + value(part, 'x2')) / 2 + value(part, 'c');
  const block = (size: [number, number, number], at: [number, number, number]) => {
    const geometry = new THREE.BoxGeometry(...size); geometry.translate(at[0], at[1] + size[1] / 2, at[2] + size[2] / 2); return paint(geometry, STEEL);
  };
  const hole = new THREE.CylinderGeometry(d / 2, d / 2, t * 1.4, 20); hole.translate(0, t / 2, l * 0.25);
  return [block([w, t, l], [0, 0, 0]), block([w, reach + t, t], [0, 0, l - t]), block([w, t, h], [0, reach, l - t]), paint(hole, DARK)];
}

function cornerBracket(part: Part): Piece[] {
  // lying flat: leg a along +X and leg b along +Y from the outer corner, with its screw holes as dark discs
  const a = value(part, 'a'); const b = value(part, 'b'); const c = value(part, 'c'); const t = value(part, 't'); const d = value(part, 'd');
  const plate = (x: number, y: number, w: number, h: number) => { const geometry = new THREE.BoxGeometry(w, h, t); geometry.translate(x + w / 2, y + h / 2, t / 2); return paint(geometry, STEEL); };
  const holes = cornerBracketHoles(part).map(hole => {
    const geometry = new THREE.CylinderGeometry(d / 2, d / 2, t * 1.2, 20); geometry.rotateX(Math.PI / 2);
    geometry.translate(hole.leg === 'a' ? hole.along : hole.across, hole.leg === 'a' ? hole.across : hole.along, t / 2); return paint(geometry, DARK);
  });
  return [plate(0, 0, a, c), plate(0, c, c, b - c), ...holes];
}

function setScrew(part: Part): Piece[] {
  // headless, threaded all along, standing on its flat point with the hex socket at the top
  const d = value(part, 'd'); const l = value(part, 'l'); const dp = value(part, 'dp'); const s = value(part, 's'); const t = value(part, 't');
  const chamfer = (d - dp) / 2;
  const body = revolve([[0, 0], [dp / 2, 0], [d / 2, chamfer], [d / 2, l - d * 0.08], [d / 2 - d * 0.08, l], [0, l]], STEEL, 32);
  const socket = prism(polygon(6, hexAcrossFlats(s)), l - t, t + 0.01, DARK);
  return [body, socket];
}

function ball(part: Part): Piece[] {
  const r = value(part, 'd') / 2;
  const sphere = new THREE.SphereGeometry(r, 32, 16); sphere.translate(0, 0, r);
  return [paint(sphere, NICKEL)];
}

function spring(part: Part): Piece[] {
  // the wire's centre line as a helix at the mean diameter, at its free length; closed ends drawn as one flat turn each
  const d = value(part, 'd'); const De = value(part, 'De'); const L0 = value(part, 'L0');
  const coils = Number(/with ([\d.]+) active coils/.exec(part.description)?.[1] ?? 5);
  const radius = (De - d) / 2; const turns = coils + 2; const samples = Math.ceil(turns * 24);
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= samples; i++) {
    const turn = i / samples * turns;
    // the end turns lie flat (closed), the active ones rise evenly between them
    const z = d / 2 + (L0 - d) * Math.min(1, Math.max(0, (turn - 1) / coils));
    points.push(new THREE.Vector3(radius * Math.cos(turn * 2 * Math.PI), radius * Math.sin(turn * 2 * Math.PI), z));
  }
  return [paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), samples, d / 2, 8, false), STEEL)];
}

function splitRing(part: Part): Piece[] {
  // two flat turns of the band, one on the other, each half the ring's thickness, with rounded edges
  const r1 = value(part, 'd') / 2; const r2 = value(part, 'D') / 2; const turn = value(part, 'b') / 2;
  const c = Math.min(0.2, turn / 3, (r2 - r1) / 3);
  const color = part.attributes['material']?.startsWith('stainless') ? STEEL : NICKEL;
  const band = (z0: number): Piece => ring([[r1, z0 + c], [r1 + c, z0], [r2 - c, z0], [r2, z0 + c], [r2, z0 + turn - c], [r2 - c, z0 + turn], [r1 + c, z0 + turn], [r1, z0 + turn - c]], color);
  return [band(0), band(turn)];
}

const INLAY = 0xdfe6ea;
const COLLAR = 0x3a6ea5;

function nfcTag(part: Part): Piece[] {
  // a flat disc with its antenna's outer turn drawn on top (none is published for a coin)
  const r = value(part, 'D') / 2; const h = value(part, 'h'); const antenna = value(part, 'antenna') / 2;
  const colour = part.attributes['colour'];
  const body = revolve([[0, 0], [r, 0], [r, h], [0, h]], colour === 'black' ? DARK : colour === 'clear' ? INLAY : 0xf4f4f2, 64);
  if (!antenna) return [body];
  return [body, ring([[antenna - 0.8, h], [antenna, h], [antenna, h + 0.02], [antenna - 0.8, h + 0.02]], STEEL, 64)];
}

function catCollar(part: Part): Piece[] {
  // a 60 mm piece of the strap, lying flat along X
  const strap = new THREE.BoxGeometry(60, value(part, 'width'), largest(part, 'thickness')); strap.translate(0, 0, largest(part, 'thickness') / 2);
  return [paint(strap, COLLAR)];
}

const SOLDER_MASK = { black: 0x1f2124, blue: 0x24539c } as const;
const GOLD = 0xd4a93c;
const COMPONENT_COLOURS: Record<DevBoardComponent['kind'], number> = {
  button: 0xf1efe9, led: 0xf3f3f1, chip: DARK, regulator: DARK, crystal: NICKEL, diode: DARK, antenna: 0xc8473f, connector: GOLD, shield: NICKEL, other: DARK,
};
const PLUNGER = 0xe6cf9e;
const LENS = 0xfbf7e8;

/** A board's outline in its plane: a rectangle with rounded corners and, for a castellated board, a half hole at each pin's edge. */
function boardOutline(width: number, length: number, radius: number, notches: { x: number; y: number }[], notch: number): THREE.Shape {
  const shape = new THREE.Shape();
  const r = Math.max(radius, 0.001);
  const left = notches.filter(pin => pin.x < width / 2).map(pin => pin.y).sort((a, b) => b - a);
  const right = notches.filter(pin => pin.x >= width / 2).map(pin => pin.y).sort((a, b) => a - b);
  shape.moveTo(r, 0);
  shape.lineTo(width - r, 0); shape.absarc(width - r, r, r, -Math.PI / 2, 0, false);
  for (const y of right) { shape.lineTo(width, y - notch); shape.absarc(width, y, notch, -Math.PI / 2, Math.PI / 2, true); }
  shape.lineTo(width, length - r); shape.absarc(width - r, length - r, r, 0, Math.PI / 2, false);
  shape.lineTo(r, length); shape.absarc(r, length - r, r, Math.PI / 2, Math.PI, false);
  for (const y of left) { shape.lineTo(0, y + notch); shape.absarc(0, y, notch, Math.PI / 2, -Math.PI / 2, true); }
  shape.lineTo(0, r); shape.absarc(r, r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

function devBoard(part: Part): Piece[] {
  // the board lying component side up, as its layout places everything: corner at the origin, USB-C towards +Y
  const layout = devBoardLayout(part);
  if (!layout) return [];
  const w = value(part, 'W'); const l = value(part, 'L'); const t = value(part, 't'); const d = value(part, 'd');
  const outline = boardOutline(w, l, value(part, 'r'), layout.castellated ? layout.pins : [], d / 2);
  const hole = (x: number, y: number) => { const path = new THREE.Path(); path.absarc(x, y, d / 2, 0, Math.PI * 2, true); return path; };
  outline.holes.push(...layout.pins.map(pin => hole(pin.x, pin.y)));
  // a gold ring round each hole on top
  const pads = layout.pins.map(pin => {
    const pad = new THREE.Shape(); pad.absarc(pin.x, pin.y, d / 2 + 0.35, 0, Math.PI * 2, false); pad.holes.push(hole(pin.x, pin.y));
    return prism(pad, t, 0.04, GOLD);
  });
  const { usb } = layout;
  // the receptacle's shell: a stadium across X and up Z, run along Y from y0 to y1
  const stadium = new THREE.Shape(); const rr = usb.height / 2;
  stadium.moveTo(usb.x0 + rr, 0); stadium.lineTo(usb.x1 - rr, 0); stadium.absarc(usb.x1 - rr, rr, rr, -Math.PI / 2, Math.PI / 2, false);
  stadium.lineTo(usb.x0 + rr, usb.height); stadium.absarc(usb.x0 + rr, rr, rr, Math.PI / 2, Math.PI * 1.5, false);
  const shell = new THREE.ExtrudeGeometry(stadium, { depth: usb.y1 - usb.y0, bevelEnabled: false, curveSegments: 16 });
  shell.rotateX(Math.PI / 2); shell.translate(0, usb.y1, t);
  const components = layout.components.flatMap(component => {
    const turn = component.rotation * Math.PI / 180;
    const box = new THREE.BoxGeometry(component.width, component.length, component.height);
    box.rotateZ(turn); box.translate(component.x, component.y, t + component.height / 2);
    const pieces = [paint(box, COMPONENT_COLOURS[component.kind])];
    const { top } = component;
    if (top) {
      // a button's plunger or an LED's lens, centred on the body up to its own height
      const plan = new THREE.Shape(); const [w, l] = [top.width, top.length];
      if (top.shape === 'round') plan.absarc(0, 0, w / 2, 0, Math.PI * 2, false);
      else if (top.shape === 'oval') {
        const r = Math.min(w, l) / 2; const [dx, dy] = w < l ? [0, l / 2 - r] : [w / 2 - r, 0];
        plan.absarc(dx, dy, r, w < l ? 0 : -Math.PI / 2, w < l ? Math.PI : Math.PI / 2, false);
        plan.absarc(-dx, -dy, r, w < l ? Math.PI : Math.PI / 2, w < l ? Math.PI * 2 : Math.PI * 1.5, false);
      } else { plan.moveTo(-w / 2, -l / 2); plan.lineTo(w / 2, -l / 2); plan.lineTo(w / 2, l / 2); plan.lineTo(-w / 2, l / 2); }
      const cap = prism(plan, 0, top.height - component.height, component.kind === 'led' ? LENS : component.kind === 'button' ? PLUNGER : DARK);
      cap.rotateZ(turn); cap.translate(component.x, component.y, t + component.height);
      pieces.push(cap);
    }
    return pieces;
  });
  // the pads underneath, as thin gold discs under the PCB
  const bottomPads = layout.bottomPads.map(pad => {
    const disc = new THREE.Shape(); disc.absarc(pad.x, pad.y, 0.55, 0, Math.PI * 2, false);
    return prism(disc, -0.04, 0.04, GOLD);
  });
  return [prism(outline, 0, t, SOLDER_MASK[layout.solderMask]), ...pads, ...bottomPads, paint(shell, NICKEL), ...components];
}

const BUILDERS: Record<string, (part: Part) => Piece[]> = {
  screw, nut, washer, 'threaded-insert': insert, bearing, pin, magnet, 'wood-screw': woodScrew, nail: staple, 'insert-nut': insertNut, 'levelling-foot': levellingFoot, 'toggle-latch': toggleLatch, 'screen-hook': screenHook, 'corner-bracket': cornerBracket,
  'set-screw': setScrew, ball, spring, 'split-ring': splitRing, 'nfc-tag': nfcTag, 'cat-collar': catCollar, 'dev-board': devBoard,
};

/** The part as one geometry with vertex colours, or null for a family without a builder (those parts have an STL preview). */
export function partGeometry(part: Part): THREE.BufferGeometry | null {
  const build = BUILDERS[part.family];
  if (!build) return null;
  const pieces = build(part);
  const merged = mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();
  return merged;
}
