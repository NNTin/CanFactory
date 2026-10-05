/**
 * The window cat guard (models/window-cat-guard/generator.scad, docs/window-cat-guard.md): printed honeycomb panels that close the
 * gaps of a tilted window, two side panels and a top strip, each split into segments that fit a print bed. This module holds the
 * generator's fixed joint sizes and repeats its layout, so that the contract can validate settings and place every segment in the
 * assembly preview exactly where the SCAD file models it.
 *
 * World frame of the assembly (mm): x along the window's width, from the left side panel's outer face; y across the gap, from the
 * frame (the side panels' straight edge) towards the tilted sash; z up, from the side panels' tips.
 */

/** The generator's fixed sizes (SPINE_W ... END_GAP); a test compares them with the SCAD file. */
export const WINDOW_CAT_GUARD = {
  /** The side panel's spine. */
  spineWidth: 12,
  /** The top strip's two ribs. */
  ribWidth: 4,
  /** The ribs (and the bosses their pins plug into) are this far apart at most. */
  ribSpacing: 60,
  /** Dovetail: how far the tab reaches into the next segment, how much wider its tip is than its root (each side), and how much
   * wider its root is than the spine or rib (each side). */
  tabDepth: 8, tabFlare: 3, tabMargin: 1,
  /** The spine or rib laps this far onto the next segment's plate. */
  lap: 3,
  /** The strip's pins: diameter, and how far their axis is below their radius (the flat they print on). */
  pinDiameter: 5, pinFlat: 0.3,
  /** The side panels' bosses: diameter, height above the plate, and their centre below the panel's top. */
  bossDiameter: 11, bossHeight: 7, bossInset: 7,
  /** Between the strip's end and a boss. */
  endGap: 0.5,
} as const;

/**
 * The splice bars that hold the segments together (docs/window-cat-guard.md#splice-bars; the SCAD file's SPLICE_* and NUT_*
 * values, a test keeps them equal). A bar, `width` × `thickness`, lies on the spines (or ribs) of two segments across their joint;
 * one countersunk screw goes down into each segment, `near` past the joint (in the segment with the tab: in its tab) and `far`
 * past it (in the segment with the notch: past the lap), and the bar reaches `end` beyond each screw. A countersunk head leaves
 * `underHead` of the bar under it, in a countersink `sinkPlay` wider. A screw ends in a nut, in a pocket `nutPlay` wider than it
 * from the plate's back, at least `nutRecess` inside the back and with `nutRoof` of spine over it; or in a heat-set insert from the
 * spine's top. A nut's pocket or an insert's hole, with its wall, stays within `holderRadius` of the screw's axis: inside the
 * 12 mm spine and the dovetail's tab.
 */
export const WINDOW_CAT_GUARD_SPLICE = {
  width: 12, thickness: 4, near: 2, far: 18, end: 6, underHead: 0.8, sinkPlay: 0.2, nutPlay: 0.2, nutRecess: 0.2, nutRoof: 1.2, nutWall: 1.2, holderRadius: 5.5,
} as const;

/** How the segments hold together: a splice bar over every joint, screwed into nuts or heat-set inserts; or the dovetails alone. */
export const SEGMENT_JOINT_VALUES = ['nut-bolt', 'threaded-insert', 'glue'] as const;
export type SegmentJoints = typeof SEGMENT_JOINT_VALUES[number];

/** The most segments a side panel or the top strip is split into (one part each). */
export const WINDOW_CAT_GUARD_MAX_SEGMENTS = 8;

/** The settings the layout depends on (the model's parameters of the same names). */
export interface WindowCatGuardShape {
  height: number; gap: number; tipWidth: number; width: number; maxPartLength: number; topStrip: boolean;
  thickness: number; ribHeight: number; border: number; fit: number; segmentJoints: SegmentJoints;
}

/** How many equal segments a length is split into so that none is longer than `max` (as the SCAD file's `ceil`). */
export const segmentCount = (length: number, max: number): number => Math.max(1, Math.ceil(length / max - 1e-9));

/** The generator's derived layout (SIDE_SEGMENTS ... STRIP_PIECE in the SCAD file). */
export function windowCatGuardLayout(p: WindowCatGuardShape) {
  const g = WINDOW_CAT_GUARD;
  const sideSegments = segmentCount(p.height, p.maxPartLength);
  const spacing = Math.min(g.ribSpacing, p.gap - 2 * (p.border + g.bossDiameter / 2 + 1));
  const stripStart = p.thickness + g.bossHeight + g.endGap;
  const stripLength = p.width - 2 * stripStart;
  const stripSegments = segmentCount(stripLength, p.maxPartLength);
  return {
    sideSegments, sideLength: p.height / sideSegments,
    spacing, ribs: [p.gap / 2 - spacing / 2, p.gap / 2 + spacing / 2] as [number, number],
    pinZ: g.pinDiameter / 2 - g.pinFlat,
    pinLength: g.endGap + g.bossHeight + p.thickness - 0.5,
    stripStart, stripLength, stripSegments: p.topStrip ? stripSegments : 0, stripPiece: stripLength / stripSegments,
  };
}

/** A side panel's width at height y above its tip. */
export const sideWidth = (p: Pick<WindowCatGuardShape, 'height' | 'gap' | 'tipWidth'>, y: number): number => p.tipWidth + (p.gap - p.tipWidth) * y / p.height;

/** The least width a side panel needs at a joint: the notch for the dovetail's tip (with its play) and a border either side. */
export const sideJointWidth = (p: Pick<WindowCatGuardShape, 'border' | 'fit'>): number => {
  const g = WINDOW_CAT_GUARD;
  return 2 * (g.spineWidth / 2 + g.tabMargin + g.tabFlare + p.fit + p.border);
};

/** The least distance between the ribs (and bosses): the spine, two bosses and 1 mm between them. */
export const leastRibSpacing = (): number => WINDOW_CAT_GUARD.spineWidth + WINDOW_CAT_GUARD.bossDiameter + 2;

type Vector = [number, number, number];
/** A printed part where it goes: a segment (`segment` is its number), or a splice bar (`segment` is the number of the joint it
 * spans, between that segment and the next; on the strip, `rib` is which of the two ribs it lies on). */
export interface WindowCatGuardPiece { id: string; kind: 'left' | 'right' | 'strip' | 'bar'; panel: 'left' | 'right' | 'strip'; segment: number; rib?: number; position: Vector; rotation: Vector }

/** A point of a part's own frame where its pose puts it: turned about X, then Y, then Z (degrees), then moved. */
export function placePoint(point: Vector, rotation: readonly number[], position: readonly number[]): Vector {
  const [ax, ay, az] = rotation.map(degrees => degrees * Math.PI / 180) as [number, number, number];
  let [x, y, z] = point;
  [y, z] = [y * Math.cos(ax) - z * Math.sin(ax), y * Math.sin(ax) + z * Math.cos(ax)];
  [x, z] = [x * Math.cos(ay) + z * Math.sin(ay), -x * Math.sin(ay) + z * Math.cos(ay)];
  [x, y] = [x * Math.cos(az) - y * Math.sin(az), x * Math.sin(az) + y * Math.cos(az)];
  return [x + (position[0] ?? 0), y + (position[1] ?? 0), z + (position[2] ?? 0)];
}

/** The side panels' spine: its direction, as an angle in degrees from the print frame's x, and the point `s` along it past its point at height y (the SCAD file's SPINE_A and side_at). */
export const spineAngle = (p: Pick<WindowCatGuardShape, 'height' | 'gap' | 'tipWidth'>): number => Math.atan2(1, (p.gap - p.tipWidth) / (2 * p.height)) * 180 / Math.PI;
const spineAt = (p: WindowCatGuardShape, y: number, s: number): [number, number] => {
  const a = spineAngle(p) * Math.PI / 180;
  return [sideWidth(p, y) / 2 + s * Math.cos(a), y + s * Math.sin(a)];
};

/** The panels' poses: a side panel stands in the window's side plane, its print frame's z (the spine's side) inwards. */
const PANEL_POSE = {
  left: () => ({ position: [0, 0, 0] as Vector, rotation: [90, 0, 90] as Vector }),
  right: (p: WindowCatGuardShape) => ({ position: [p.width, 0, 0] as Vector, rotation: [90, 0, -90] as Vector }),
};

/**
 * One screw of a splice bar: the bar, the segment it goes into, and the screw's axis, `at(z)` giving the point at height z over the
 * plate's back in world coordinates; `rotation` turns a part's +z (a screw's head, a nut's top) along the axis, towards the bar.
 * `end` is `near` (the segment with the tab) or `far` (the segment with the notch).
 */
export interface WindowCatGuardBolt { bar: string; segment: string; end: 'near' | 'far'; label: string; rotation: Vector; at: (z: number) => Vector }

/** Every splice bar's two screws (none with `segmentJoints` glue). */
export function windowCatGuardBolts(p: WindowCatGuardShape): WindowCatGuardBolt[] {
  if (p.segmentJoints === 'glue') return [];
  const l = windowCatGuardLayout(p);
  const s = WINDOW_CAT_GUARD_SPLICE;
  const bolts: WindowCatGuardBolt[] = [];
  for (const side of ['left', 'right'] as const) {
    const pose = PANEL_POSE[side](p);
    const mirror = side === 'right' ? -1 : 1;
    for (let j = 1; j < l.sideSegments; j++) {
      const y = p.height - j * l.sideLength;
      for (const [end, offset, segment] of [['near', s.near, j + 1], ['far', s.far, j]] as const) {
        const [x, py] = spineAt(p, y, offset);
        bolts.push({ bar: `${side}-bar-${j}`, segment: `${side}-${segment}`, end, label: `${side} panel, joint ${j}–${j + 1}, in segment ${segment}`, rotation: pose.rotation,
          at: z => placePoint([mirror * x, py, z], pose.rotation, pose.position) });
      }
    }
  }
  const stripZ = p.height - WINDOW_CAT_GUARD.bossInset - l.pinZ;
  for (let j = 1; j < l.stripSegments; j++) for (const [r, rib] of l.ribs.entries())
    for (const [end, offset, segment] of [['near', s.near, j], ['far', s.far, j + 1]] as const)
      bolts.push({ bar: `strip-bar-${j}-${r + 1}`, segment: `strip-${segment}`, end, label: `top strip, joint ${j}–${j + 1}, rib ${r + 1}, in segment ${segment}`, rotation: [0, 0, 0],
        at: z => [l.stripStart + j * l.stripPiece + offset, rib, stripZ + z] });
  return bolts;
}

/**
 * Every printed segment where it goes in the window (the parts' poses). A segment keeps its panel's coordinates, so all segments
 * of a panel share one pose: a side panel stands with its plate in the window's side plane (its print-bed x across the gap, y up,
 * z, the spine's side, inwards); the right one is the left one mirrored, at the window's far side; the strip lies across the top
 * with its pins in the bosses' holes, its plate's end `endGap` off the bosses.
 */
export function windowCatGuardPieces(p: WindowCatGuardShape): WindowCatGuardPiece[] {
  const l = windowCatGuardLayout(p);
  const pieces: WindowCatGuardPiece[] = [];
  for (let k = 1; k <= l.sideSegments; k++)
    for (const side of ['left', 'right'] as const) pieces.push({ id: `${side}-${k}`, kind: side, panel: side, segment: k, ...PANEL_POSE[side](p) });
  const stripZ = p.height - WINDOW_CAT_GUARD.bossInset - l.pinZ;
  for (let k = 1; k <= l.stripSegments; k++) pieces.push({ id: `strip-${k}`, kind: 'strip', panel: 'strip', segment: k, position: [l.stripStart, 0, stripZ], rotation: [0, 0, 0] });
  if (p.segmentJoints === 'glue') return pieces;
  // A splice bar is printed centred, along its x, back on the bed; it lies on the spine (its x along the spine, its middle halfway
  // between its screws) or on a rib, its back on the spine's or rib's top. On a side panel, turning it by the spine's angle a about
  // the print frame's z and then by the panel's [90, 0, ±90] is the same as [90, −a', ±90] (a' = a on the left; the right panel is
  // mirrored, so its spine runs at 180° − a).
  const s = WINDOW_CAT_GUARD_SPLICE;
  const middle = (s.near + s.far) / 2, top = p.thickness + p.ribHeight;
  for (const side of ['left', 'right'] as const) {
    const pose = PANEL_POSE[side](p);
    const mirror = side === 'right' ? -1 : 1;
    const a = side === 'left' ? spineAngle(p) : 180 - spineAngle(p);
    for (let j = 1; j < l.sideSegments; j++) {
      const [x, y] = spineAt(p, p.height - j * l.sideLength, middle);
      pieces.push({ id: `${side}-bar-${j}`, kind: 'bar', panel: side, segment: j, position: placePoint([mirror * x, y, top], pose.rotation, pose.position), rotation: [90, -a, pose.rotation[2]] });
    }
  }
  for (let j = 1; j < l.stripSegments; j++) for (const [r, rib] of l.ribs.entries())
    pieces.push({ id: `strip-bar-${j}-${r + 1}`, kind: 'bar', panel: 'strip', segment: j, rib: r + 1, position: [l.stripStart + j * l.stripPiece + middle, rib, stripZ + top], rotation: [0, 0, 0] });
  return pieces;
}
