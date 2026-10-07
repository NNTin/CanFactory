/**
 * The cat collar tag (models/cat-collar-tag/generator.scad, docs/cat-collar-tag.md): a name tag with text or a logo on each face,
 * an optional NFC tag and optional magnets (to stick it to a fridge) in it, and one of several ways to attach it to a collar.
 *
 * This module repeats the generator's layout, so that the contract can validate settings, report the print pause and place the
 * hardware in the assembly preview exactly where the SCAD file cuts its pockets. A test keeps `COLLAR_TAG` equal to the SCAD file's
 * fixed sizes.
 *
 * Frame (mm): the tag lies back down, its outline centred on the origin (the outline's bounding box, without the hanging bail),
 * x along its width, y along its height, the back on z = 0 and the front at z = thickness. A hanging tag's bail is at the top (+y).
 */
import { embedCavity, toLayers } from './printPause.ts';
import { TEXT_ADVANCES, TEXT_EXTENTS } from './textMetrics.ts';

export const COLLAR_TAG_ATTACHMENTS = ['hanging', 'slide-on'] as const;
export type CollarTagAttachment = typeof COLLAR_TAG_ATTACHMENTS[number];
export const COLLAR_TAG_SHAPES = ['round', 'rounded-rectangle', 'bone', 'heart', 'fish'] as const;
export type CollarTagShape = typeof COLLAR_TAG_SHAPES[number];
/** What a face carries. */
export const COLLAR_TAG_MARKS = ['none', 'text', 'logo'] as const;
export type CollarTagMark = typeof COLLAR_TAG_MARKS[number];
/** How the front's mark is made; the back lies on the print bed, so its mark is always engraved. */
export const COLLAR_TAG_FRONT_STYLES = ['engrave', 'emboss'] as const;
export type CollarTagFrontStyle = typeof COLLAR_TAG_FRONT_STYLES[number];
/** How an NFC tag or the magnets are held: not at all, in an open pocket in the back, or sealed in at a print pause. */
export const COLLAR_TAG_MOUNTS = ['none', 'pocket', 'embedded'] as const;
export type CollarTagMount = typeof COLLAR_TAG_MOUNTS[number];

/** The generator's fixed sizes (SIDE_WALL ... OVERLAP); a test compares them with the SCAD file. */
export const COLLAR_TAG = {
  /** Least wall between a pocket, a cavity, a slot or the text and an edge or each other. */
  sideWall: 1.2,
  /** Least plastic over a pocket or a cavity, under the front (and its engraving). */
  coverWall: 0.6,
  /** Least plastic between the back's and the front's engravings. */
  coreWall: 0.6,
  /** Embedded items: the least skin under them (whole layers), and the least headroom over them before the pause. */
  embedSkin: 0.4, embedHeadroom: 0.05,
  /** A pocket or cavity is the item's greatest diameter plus this. */
  pocketPlay: 0.2,
  /** Magnets stay this far outside an NFC tag's antenna (or, without a published antenna, its edge): metal near it detunes it. */
  nfcGap: 5,
  /** Hanging: the bail's hole takes the split ring's band (its width A and thickness B, both turns) with this much play, and is at
   * least `holeMin` wide; its edge is `hangGap` above the outline's top. */
  holePlay: 0.4, holeMin: 3, hangGap: 0.3,
  /** Hanging: the split ring must also hold the collar's D-ring with this much play, and clear the bail by `ringClearance`. */
  ringPlay: 0.5, ringClearance: 0.2,
  /** Slide-on: each slot is this much longer than the collar is wide, at each end. */
  slotLengthPlay: 0.5,
  /** Slide-on: the least width of the face between the slots, for the text. */
  minMiddle: 8,
  /** Text: margin inside its area, and the distance between two lines' baselines per mm of text size. */
  textMargin: 0.5, linePitch: 1.35,
  /** The outline's corners, inner and outer, are rounded to this radius. */
  cornerRound: 1,
  /** The rounded edges are built of steps this high (or a little less) on each face, each inset by a multiple of `insetGrid`. */
  edgeStep: 0.1, insetGrid: 0.02,
  /** How far each step of a rounded edge reaches into the next, so that they fuse. */
  overlap: 0.01,
} as const;

/** PLA's density, for the tag's weight, in g/cm³. */
export const PLA_DENSITY = 1.24;

// The heart: a square turned 45° (half-diagonal √½) with a circle of diameter 1 on each upper side, in units of the square's side.
const HEART_C = Math.SQRT1_2 / 2;
const HEART = { width: 2 * (HEART_C + 0.5), top: HEART_C + 0.5, bottom: -Math.SQRT1_2 } as const;
const HEART_HEIGHT = HEART.top - HEART.bottom;
const HEART_SHIFT = (HEART.top + HEART.bottom) / 2;

export interface Box { x: number; y: number; w: number; h: number }

/** The outline's height: a round tag is as high as it is wide. */
export const outlineHeight = (shape: CollarTagShape, width: number, height: number): number => shape === 'round' ? width : height;

/**
 * Each outline's free area (`box`, a rectangle that lies inside it, for the text and the hardware) and its hanging point (the
 * outline's top where the bail joins it).
 */
export function shapeGeometry(shape: CollarTagShape, width: number, height: number): { box: Box; hang: [number, number] } {
  const W = width, H = outlineHeight(shape, width, height);
  switch (shape) {
    case 'round': return { box: { x: 0, y: 0, w: W * Math.SQRT1_2, h: W * Math.SQRT1_2 }, hang: [0, W / 2] };
    case 'rounded-rectangle': {
      // the corners' radius is a quarter of the shorter side; the box's corners lie on their arcs
      const k = 2 * Math.min(W, H) / 4 * (1 - Math.SQRT1_2);
      return { box: { x: 0, y: 0, w: W - k, h: H - k }, hang: [0, H / 2] };
    }
    // a bar 0.6 H high between four lobes of radius H / 4 at (±(W / 2 − H / 4), ±H / 4)
    case 'bone': return { box: { x: 0, y: 0, w: W - H / 2, h: 0.6 * H }, hang: [0, 0.3 * H] };
    case 'heart': {
      // in the unit heart, |x| ≤ 0.45 and −0.2 ≤ y ≤ 0.3 lie inside it; the dip between the lobes is at x = 0, y = √½
      const sx = W / HEART.width, sy = H / HEART_HEIGHT;
      return { box: { x: 0, y: (0.05 - HEART_SHIFT) * sy, w: 0.9 * sx, h: 0.5 * sy }, hang: [0, (Math.SQRT1_2 - HEART_SHIFT) * sy] };
    }
    // an elliptic body (semi-axes 0.36 W and H / 2, centred at x = −0.14 W) and a tail; the box is the body's inscribed rectangle
    case 'fish': return { box: { x: -0.14 * W, y: 0, w: 0.72 * W * Math.SQRT1_2, h: H * Math.SQRT1_2 }, hang: [-0.14 * W, H / 2] };
  }
}

/** Whether a point lies inside the outline (without its 1 mm corner rounding): for the area, and for the tests. */
export function insideShape(shape: CollarTagShape, width: number, height: number, x: number, y: number): boolean {
  const W = width, H = outlineHeight(shape, width, height);
  switch (shape) {
    case 'round': return Math.hypot(x, y) <= W / 2;
    case 'rounded-rectangle': {
      const r = Math.min(W, H) / 4;
      const dx = Math.max(Math.abs(x) - (W / 2 - r), 0), dy = Math.max(Math.abs(y) - (H / 2 - r), 0);
      return Math.abs(x) <= W / 2 && Math.abs(y) <= H / 2 && Math.hypot(dx, dy) <= r;
    }
    case 'bone': {
      const r = H / 4, cx = W / 2 - r;
      return (Math.abs(x) <= cx && Math.abs(y) <= 0.3 * H) || Math.hypot(Math.abs(x) - cx, Math.abs(y) - r) <= r;
    }
    case 'heart': {
      const u = x / (W / HEART.width), v = y / (H / HEART_HEIGHT) + HEART_SHIFT;
      return Math.abs(u) + Math.abs(v) <= Math.SQRT1_2 || Math.hypot(Math.abs(u) - HEART_C, v - HEART_C) <= 0.5;
    }
    case 'fish': {
      const body = ((x + 0.14 * W) / (0.36 * W)) ** 2 + (y / (H / 2)) ** 2 <= 1;
      // the tail: a triangle from (0.12 W, 0) to (0.5 W, ±0.42 H)
      const t = (x - 0.12 * W) / (0.38 * W);
      return body || (t >= 0 && t <= 1 && Math.abs(y) <= 0.42 * H * t);
    }
  }
}

/** The outline's area in mm², sampled on a 0.25 mm grid (without the corner rounding). */
export function shapeArea(shape: CollarTagShape, width: number, height: number): number {
  const W = width, H = outlineHeight(shape, width, height), step = 0.25;
  let count = 0;
  for (let x = -W / 2 + step / 2; x < W / 2; x += step) for (let y = -H / 2 + step / 2; y < H / 2; y += step) if (insideShape(shape, W, H, x, y)) count++;
  return count * step * step;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Text

/** A face's lines: the visible ones, in order. */
export const textLines = (line1: string, line2: string): string[] => [line1, line2].filter(line => line.trim() !== '');

/** Width in mm of one line of text at this font and size, from the measured advance widths (kerning ignored). */
export function lineWidth(font: string, text: string, size: number): number {
  const advances = TEXT_ADVANCES[font];
  if (!advances) return Number.POSITIVE_INFINITY;
  let width = 0;
  for (const char of text) width += advances[char] ?? Number.POSITIVE_INFINITY;
  return width * size;
}

/** The block of lines: its widest line and its height from the lowest descender to the highest ascender. The SCAD file sets each
 * line on a baseline `linePitch × size` below the one before, the block centred in the text area. */
export function textBlock(font: string, lines: readonly string[], size: number): { width: number; height: number; above: number } {
  const extents = TEXT_EXTENTS[font] ?? { below: -0.35, above: 1.1 };
  const width = Math.max(0, ...lines.map(line => lineWidth(font, line, size)));
  const height = lines.length === 0 ? 0 : (lines.length - 1) * COLLAR_TAG.linePitch * size + (extents.above - extents.below) * size;
  return { width, height, above: extents.above * size };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Layout

export interface CollarTagFace { mark: CollarTagMark; line1: string; line2: string; font: string; textSize: number; logo: string; logoSize: number }

/** The settings the layout depends on (the model's parameters of the same names), and the chosen parts' greatest sizes. */
export interface CollarTagSettings {
  attachment: CollarTagAttachment; shape: CollarTagShape; width: number; height: number; thickness: number; edgeRadius: number;
  front: CollarTagFace; frontStyle: CollarTagFrontStyle; back: CollarTagFace; engraveDepth: number; embossHeight: number;
  nfc: CollarTagMount; nfcDiameter: number; nfcThickness: number; nfcAntenna: number;
  magnetMount: CollarTagMount; magnetCount: number; magnetDiameter: number; magnetThickness: number;
  layerHeight: number;
  /** Hanging: the split ring's inner diameter, outer diameter, band width (A) and thickness over both turns (B); the D-ring's wire
   * and the bail's wall. */
  ringInner: number; ringOuter: number; ringBand: number; ringThickness: number; dRingWire: number; bailWall: number;
  /** Slide-on: the collar's width and greatest thickness, the slots' play and the end bars' width. */
  collarWidth: number; collarThickness: number; slotFit: number; barWidth: number;
}

export const hasMark = (face: CollarTagFace): boolean =>
  face.mark === 'text' ? textLines(face.line1, face.line2).length > 0 : face.mark === 'logo' ? face.logo !== '' : false;

const ceil1 = (value: number) => Math.ceil(value * 10 - 1e-9) / 10;

/** The hanging bail's hole: wide enough for the split ring's band, both turns of it, to pass. */
export const bailHole = (ringBand: number, ringThickness: number): number =>
  Math.max(COLLAR_TAG.holeMin, ceil1(Math.hypot(ringBand, ringThickness) + COLLAR_TAG.holePlay));

type Point = [number, number];

/** The generator's derived layout (BOX ... HEIGHT in the SCAD file). */
export function collarTagLayout(p: CollarTagSettings) {
  const t = COLLAR_TAG;
  const H = outlineHeight(p.shape, p.width, p.height);
  const { box, hang } = shapeGeometry(p.shape, p.width, p.height);
  const hanging = p.attachment === 'hanging';
  // Hanging: the bail at the outline's top, round the hole for the split ring
  const holeD = hanging ? bailHole(p.ringBand, p.ringThickness) : 0;
  const hole: Point = [hang[0], hang[1] + holeD / 2 + t.hangGap];
  const earR = holeD / 2 + p.bailWall;
  // Slide-on: a slot near each end of the free area, the collar's strap through both; the text and hardware between them
  const slotWidth = p.collarThickness + p.slotFit;
  const slotLength = p.collarWidth + 2 * t.slotLengthPlay;
  const slotX = box.w / 2 - p.barWidth - slotWidth / 2;
  const slots: Point[] = hanging ? [] : [[box.x - slotX, box.y], [box.x + slotX, box.y]];
  const area: Box = hanging ? box : { x: box.x, y: box.y, w: 2 * (slotX - slotWidth / 2 - t.sideWall), h: box.h };
  // Through the thickness: the engravings, then an embedded item's cavity or a pocket's depth, under a cover wall
  const backDepth = hasMark(p.back) ? p.engraveDepth : 0;
  const frontDepth = hasMark(p.front) && p.frontStyle === 'engrave' ? p.engraveDepth : 0;
  const emboss = hasMark(p.front) && p.frontStyle === 'emboss' ? p.embossHeight : 0;
  const embedded = p.nfc === 'embedded' ? 'nfc' : p.magnetMount === 'embedded' ? 'magnet' : null;
  const embedHeight = embedded === 'nfc' ? p.nfcThickness : embedded === 'magnet' ? p.magnetThickness : 0;
  const cavity = embedCavity(t.embedSkin + backDepth, embedHeight, t.embedHeadroom, p.layerHeight);
  const skin = embedded ? cavity.skin : 0;
  const pauseHeight = embedded ? cavity.pause : 0;
  const pocketDepth = Math.max(p.nfc === 'pocket' ? p.nfcThickness : 0, p.magnetMount === 'pocket' ? p.magnetThickness : 0);
  // the least thickness, and what sets it
  const needs: [number, 'engravings' | 'embedded' | 'pockets' | 'edges'][] = [[backDepth + frontDepth + t.coreWall, 'engravings'],
    [embedded ? pauseHeight + t.coverWall + frontDepth : 0, 'embedded'], [pocketDepth > 0 ? pocketDepth + t.coverWall + frontDepth : 0, 'pockets'], [2 * p.edgeRadius, 'edges']];
  const [minThickness, thicknessSetBy] = needs.reduce((most, need) => need[0] > most[0] + 1e-9 ? need : most);
  // The hardware, in the free area: the NFC tag in its middle; the magnets beside it, clear of its antenna, or one in the middle,
  // or two as far apart as the area allows
  const nfcPocket = p.nfcDiameter + t.pocketPlay;
  const magnetPocket = p.magnetDiameter + t.pocketPlay;
  const nfcAt: Point | null = p.nfc === 'none' ? null : [area.x, area.y];
  const r = magnetPocket / 2;
  const nfcReach = p.nfc === 'none' ? 0 : (p.nfcAntenna > 0 ? p.nfcAntenna / 2 : nfcPocket / 2);
  const spread = area.w / 2 - r - t.sideWall;
  const magnets: Point[] = p.magnetMount === 'none' ? []
    : p.nfc !== 'none' ? (p.magnetCount === 1 ? [[area.x + spread, area.y]] : [[area.x - spread, area.y], [area.x + spread, area.y]])
    : p.magnetCount === 1 ? [[area.x, area.y]] : [[area.x - spread, area.y], [area.x + spread, area.y]];
  const magnetsClear = p.nfc === 'none' || spread >= nfcReach + t.nfcGap + r - 1e-9;
  const magnetZ = p.magnetMount === 'embedded' ? skin : 0;
  const nfcZ = p.nfc === 'embedded' ? skin : 0;
  // The outline's bounding box, with the bail
  const earTop = hanging ? hole[1] + earR : -Infinity;
  const top = Math.max(H / 2, earTop);
  return {
    H, box, hang, hanging, holeD, hole, earR, slots, slotWidth, slotLength, slotX, area, backDepth, frontDepth, emboss, embedded, skin, pauseHeight,
    pocketDepth, minThickness, thicknessSetBy, nfcPocket, magnetPocket, nfcAt, nfcReach, magnets, magnetsClear, magnetZ, nfcZ,
    bounds: { x: p.width, y: top + H / 2, z: p.thickness + emboss, top },
  };
}
export type CollarTagLayout = ReturnType<typeof collarTagLayout>;

const mm = (value: number) => `${Number(value.toFixed(1))} mm`;

/** Problems with these settings (empty when they make a tag), each for the parameter to change, in words for the user. */
export function collarTagIssues(p: CollarTagSettings, layout: CollarTagLayout = collarTagLayout(p)): { field: string; message: string }[] {
  const t = COLLAR_TAG;
  const issues: { field: string; message: string }[] = [];
  const L = layout;
  if (p.shape === 'bone' && p.width < 1.4 * p.height - 1e-9)
    issues.push({ field: 'width', message: `A bone must be at least 1.4 times as wide as it is high: at least ${mm(1.4 * p.height)} for ${mm(p.height)}.` });
  if (p.edgeRadius > p.thickness / 2 + 1e-9)
    issues.push({ field: 'edgeRadius', message: `The edges can be rounded by at most half the thickness: ${mm(p.thickness / 2)}.` });
  if (p.nfc === 'embedded' && p.magnetMount === 'embedded')
    issues.push({ field: 'magnetMount', message: 'Only one of the NFC tag and the magnets can be embedded: there is one print pause. Put the magnets in pockets, or embed only one of them.' });
  const pocket = p.nfc === 'pocket' || p.magnetMount === 'pocket';
  if (pocket && hasMark(p.back))
    issues.push({ field: 'backMark', message: 'Open pockets are in the back, where the back’s text or logo would be cut through. Embed the NFC tag or magnets instead, or leave the back blank.' });
  // Slide-on: room for the strap and between the slots
  if (!L.hanging) {
    if (L.slotLength + 2 * t.sideWall > L.box.h + 1e-9)
      issues.push({ field: 'height', message: `The collar’s ${mm(p.collarWidth)} strap needs ${mm(L.slotLength)} slots, so the tag’s free area must be at least ${mm(L.slotLength + 2 * t.sideWall)} high; it is ${mm(L.box.h)}. Make the tag higher.` });
    if (L.area.w < t.minMiddle - 1e-9)
      issues.push({ field: 'width', message: `Between the slots only ${mm(Math.max(L.area.w, 0))} of the face is left; at least ${mm(t.minMiddle)}. Make the tag wider or the end bars narrower.` });
  }
  // Hanging: the split ring goes round the bail, and holds the D-ring too
  if (L.hanging) {
    const ri = p.ringInner / 2, rm = (p.ringInner + p.ringOuter) / 4;
    // the ring's circle passes through the hole's centre; the bail (from the hole's edge out by its wall, the tag's full thickness)
    // must lie inside the ring's opening
    const near = L.holeD / 2 - rm, far = L.holeD / 2 + p.bailWall - rm;
    const reach = Math.hypot(Math.max(Math.abs(near), Math.abs(far)), p.thickness / 2);
    if (reach > ri - t.ringClearance + 1e-9)
      issues.push({ field: 'splitRing', message: `This split ring’s ${mm(p.ringInner)} opening is too small to go round the tag’s bail (${mm(p.bailWall)} of wall round a ${mm(L.holeD)} hole, ${mm(p.thickness)} thick). Choose a larger ring, or a thinner bail or tag.` });
    else if (p.ringInner < p.bailWall + p.dRingWire + t.ringPlay - 1e-9)
      issues.push({ field: 'splitRing', message: `The ring must hold the bail (${mm(p.bailWall)}) and the collar’s ${mm(p.dRingWire)} D-ring side by side: its opening must be at least ${mm(p.bailWall + p.dRingWire + t.ringPlay)}. Choose a larger ring.` });
  }
  // The marks fit their area
  for (const [face, f] of [['front', p.front], ['back', p.back]] as const) {
    if (!hasMark(f)) continue;
    const room = { w: L.area.w - 2 * t.textMargin, h: L.area.h - 2 * t.textMargin };
    if (f.mark === 'text') {
      const block = textBlock(f.font, textLines(f.line1, f.line2), f.textSize);
      if (block.width > room.w + 1e-9)
        issues.push({ field: `${face}Line1`, message: `This ${face} text is about ${Number.isFinite(block.width) ? mm(block.width) : 'too many mm'} wide at this font and size, but only ${mm(room.w)} are free. Shorten it, lower the text size or make the tag wider.` });
      else if (block.height > room.h + 1e-9)
        issues.push({ field: `${face}TextSize`, message: `The ${face} text’s lines are ${mm(block.height)} high, but only ${mm(room.h)} are free. Lower the text size, use one line or make the tag higher.` });
    } else if (f.logoSize > room.h + 1e-9) {
      issues.push({ field: `${face}LogoSize`, message: `The ${face} logo can be at most ${mm(room.h)} high on this tag.` });
    }
  }
  // The hardware fits the free area
  const fits = (diameter: number, x: number) => Math.abs(x - L.area.x) + diameter / 2 + t.sideWall <= L.area.w / 2 + 1e-9 && diameter / 2 + t.sideWall <= L.area.h / 2 + 1e-9;
  if (p.nfc !== 'none' && !fits(L.nfcPocket, L.area.x))
    issues.push({ field: 'nfcTag', message: `The ${mm(p.nfcDiameter)} NFC tag needs a free area of at least ${mm(L.nfcPocket + 2 * t.sideWall)} across; this tag has ${mm(Math.min(L.area.w, L.area.h))}. Choose a smaller NFC tag or make the tag larger.` });
  if (p.magnetMount !== 'none') {
    if (L.magnets.some(([x]) => !fits(L.magnetPocket, x)))
      issues.push({ field: 'magnet', message: `The ${mm(p.magnetDiameter)} magnets do not fit in the tag’s free area (${mm(L.area.w)} × ${mm(L.area.h)}). Choose a smaller magnet, fewer magnets or a larger tag.` });
    else if (L.magnets.length === 2 && p.nfc === 'none' && 2 * (L.area.w / 2 - L.magnetPocket / 2 - t.sideWall) < L.magnetPocket + t.sideWall - 1e-9)
      issues.push({ field: 'magnetCount', message: 'Two magnets do not fit side by side here. Use one, a smaller magnet or a wider tag.' });
    else if (!L.magnetsClear)
      issues.push({ field: 'magnet', message: `The magnets must stay ${mm(t.nfcGap)} clear of the NFC tag’s antenna (metal detunes it), which needs a free area at least ${mm(2 * (L.nfcReach + t.nfcGap + L.magnetPocket + t.sideWall))} wide; this one is ${mm(L.area.w)}. Make the tag wider, or choose a smaller NFC tag or magnet.` });
  }
  if (p.thickness < L.minThickness - 1e-9) {
    const by = L.thicknessSetBy;
    const why = by === 'embedded' ? (L.embedded === 'magnet' ? `Embedded magnets (up to ${mm(p.magnetThickness)} high) need` : `An embedded ${mm(p.nfcThickness)} NFC tag needs`)
      : by === 'pockets' ? 'The pockets in the back need' : by === 'edges' ? `Edges rounded by ${mm(p.edgeRadius)} need` : 'The engravings need';
    const remedy = by === 'embedded' ? (L.embedded === 'magnet' ? ', choose a thinner magnet or turn the magnets off' : ', or put the NFC tag in a pocket')
      : by === 'pockets' ? (p.magnetMount === 'pocket' ? ', or choose a thinner magnet' : '') : by === 'edges' ? ', or round the edges less' : ', or engrave less deep';
    const engraved = by === 'embedded' ? L.backDepth + L.frontDepth : by === 'pockets' ? L.frontDepth : 0;
    const save = engraved > 0 ? ` The engraving${by === 'embedded' && L.backDepth > 0 && L.frontDepth > 0 ? 's over and under it add' : ' adds'} ${mm(engraved)}: leave a face blank or engrave less deep to save some of that.` : '';
    issues.push({ field: 'thickness', message: `${why} a tag at least ${mm(L.minThickness)} thick at these settings. Make it thicker${remedy}.${save}` });
  }
  return issues;
}

/** The tag's weight in PLA, before the hardware, in grams (the outline's area times the thickness, less the slots and the hole). */
export function collarTagWeight(p: CollarTagSettings, layout: CollarTagLayout = collarTagLayout(p)): number {
  const area = shapeArea(p.shape, p.width, p.height) + (layout.hanging ? Math.PI * layout.earR ** 2 * 0.75 - Math.PI * (layout.holeD / 2) ** 2 : 0)
    - layout.slots.length * layout.slotWidth * layout.slotLength;
  return area * p.thickness / 1000 * PLA_DENSITY;
}

/** The height of the front's filament change for an embossed mark: the face's top, on a layer boundary. */
export const embossChangeHeight = (p: CollarTagSettings): number => toLayers(p.thickness, p.layerHeight);
