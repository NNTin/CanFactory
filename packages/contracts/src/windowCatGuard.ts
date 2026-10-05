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

/** The most segments a side panel or the top strip is split into (one part each). */
export const WINDOW_CAT_GUARD_MAX_SEGMENTS = 8;

/** The settings the layout depends on (the model's parameters of the same names). */
export interface WindowCatGuardShape {
  height: number; gap: number; tipWidth: number; width: number; maxPartLength: number; topStrip: boolean;
  thickness: number; ribHeight: number; border: number; fit: number;
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
export interface WindowCatGuardPiece { id: string; kind: 'left' | 'right' | 'strip'; segment: number; position: Vector; rotation: Vector }

/**
 * Every printed segment where it goes in the window (the parts' poses). A segment keeps its panel's coordinates, so all segments
 * of a panel share one pose: a side panel stands with its plate in the window's side plane (its print-bed x across the gap, y up,
 * z, the spine's side, inwards); the right one is the left one mirrored, at the window's far side; the strip lies across the top
 * with its pins in the bosses' holes, its plate's end `endGap` off the bosses.
 */
export function windowCatGuardPieces(p: WindowCatGuardShape): WindowCatGuardPiece[] {
  const l = windowCatGuardLayout(p);
  const pieces: WindowCatGuardPiece[] = [];
  for (let k = 1; k <= l.sideSegments; k++) {
    pieces.push({ id: `left-${k}`, kind: 'left', segment: k, position: [0, 0, 0], rotation: [90, 0, 90] });
    pieces.push({ id: `right-${k}`, kind: 'right', segment: k, position: [p.width, 0, 0], rotation: [90, 0, -90] });
  }
  const stripZ = p.height - WINDOW_CAT_GUARD.bossInset - l.pinZ;
  for (let k = 1; k <= l.stripSegments; k++) pieces.push({ id: `strip-${k}`, kind: 'strip', segment: k, position: [l.stripStart, 0, stripZ], rotation: [0, 0, 0] });
  return pieces;
}
