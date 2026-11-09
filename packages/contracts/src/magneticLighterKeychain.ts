import { Type, type Static } from 'typebox';
import type { Assembly, LinkedReference, ParameterIssue, ParameterValues } from './models.ts';
import { bailHole, COLLAR_TAG } from './catCollarTag.ts';
import { dimensionOf, findPart } from './parts/index.ts';
import type { Part } from './parts/schema.ts';
import { embedCavity, layerAbove } from './printPause.ts';

/**
 * Magnetic lighter keychain (models/magnetic-lighter-keychain/generator.scad, docs/magnetic-lighter-keychain.md): an original design.
 * A sleeve holds the parts library's BIC Mini lighter (J25) on crush ribs; two magnets sealed in its foot (at a print pause) pair
 * with two in a keychain plate of the same outline, which carries an eyelet for a split ring. The foot's underside is flat, so the
 * holder also sticks to a fridge. Two small fit checks try the lighter's fit and the magnet floor before the real prints.
 *
 * Frame: millimetres, z up from the face on the print bed, centred on the Z axis; the lighter's width along Y, its thickness along X.
 */

/** The lighter the sleeve is fitted to (the parts library's; its plan's sizes are copied into the generator as LIGHTER_*). */
export const KEYCHAIN_LIGHTER = 'bic-j25-mini-lighter';

/** Fixed design sizes, the same as the generator's fixed constants (a test keeps them equal). */
export const LIGHTER_KEYCHAIN = {
  /** Magnets in the foot, and as many in the plate, in a row along Y. */
  magnets: 2,
  /** Least wall between a cavity and the outline, and between the two cavities. */
  sideWall: 1.2,
  /** Plastic over the cavities, printed after the pause: under the lighter, and under the eyelet. */
  cap: 0.8,
  /** Least room over a magnet before the pause (as the QR tag's and the collar tag's). */
  headroom: 0.05,
  /** Crush ribs: width, place on the flat faces (y = ±ribY, as the cigarette case's), start above the foot, and their top's lead-in. */
  ribWidth: 1, ribY: 3.5, ribStart: 3, ribRamp: 2,
  /** The chamfer round the sleeve's mouth. */
  mouth: 0.6,
  /** The eyelet: thickness along X, plastic round its hole (the bridge the ring goes round), and between the hole and the plate. */
  eyeThickness: 3, eyeWall: 2, eyeBase: 1,
  /** The lighter fit check's height. */
  checkHeight: 10,
  /** The split ring must also take a key ring's wire this thick beside the eyelet's bridge, with `COLLAR_TAG.ringPlay` to spare. */
  keyringWire: 2,
} as const;

/** The lighter's weight, BIC's own figure (as the cigarette case's physics), and PLA's density, for the notes. */
const LIGHTER_MASS = 13, PLA_DENSITY = 1.24;

/** The magnets the keychain offers: disc magnets of the parts library up to these sizes. Per setting, `lighterKeychainIssues` then
 * checks that their cavities fit the outline. */
export const KEYCHAIN_MAGNET_LIMIT = { diameter: 10.1, thickness: 3.1 } as const;
export function keychainMagnetFits(part: Part): boolean {
  return part.family === 'magnet' && part.attributes['shape'] === 'disc' && Boolean(part.dimensions['diameter'])
    && dimensionOf(part, 'diameter', 'max') <= KEYCHAIN_MAGNET_LIMIT.diameter + 1e-9 && dimensionOf(part, 'thickness', 'max') <= KEYCHAIN_MAGNET_LIMIT.thickness + 1e-9;
}
/** Every magnet of the parts library that fits (`keychainMagnetFits`), in the library's order; a test keeps the list equal to the library. */
export const KEYCHAIN_MAGNETS = ['supermagnete-s-04-02-n', 'supermagnete-s-05-01-n', 'supermagnete-s-05-02-n52n', 'supermagnete-s-06-01-n', 'supermagnete-s-06-02-n', 'supermagnete-s-06-03-n', 'supermagnete-s-08-01-n', 'supermagnete-s-08-02-n', 'supermagnete-s-08-03-n', 'supermagnete-s-10-01-n', 'supermagnete-s-10-02-n', 'supermagnete-s-10-03-n'] as const;
/** Every split ring of the parts library; a test keeps the list equal to the library. */
export const KEYCHAIN_SPLIT_RINGS = ['avco-kr-90920', 'avco-kr-90930', 'avco-kr-92000', 'avco-kr-92100', 'avco-kr-92200', 'avco-kr-9335', 'avco-kr-9337', 'avco-kr-93400'] as const;

export const DEFAULT_LIGHTER_KEYCHAIN = {
  fit: 0.2, squeeze: 0.15, wall: 1.6, sleeveDepth: 35, magnetFit: 0.1, skin: 0.4, layerHeight: 0.2,
  /** S-08-02-N: 8 × 2 mm, 1.1 kg of pull each at contact. */
  magnet: 'supermagnete-s-08-02-n',
  /** A ½″ stainless ring, as the cat collar tag's. */
  splitRing: 'avco-kr-9335',
} as const;
const d = DEFAULT_LIGHTER_KEYCHAIN;

const mm = (title: string, description: string, value: number, minimum: number, maximum: number, multipleOf: number) =>
  Type.Number({ title, description, default: value, minimum, maximum, multipleOf });

export const MagneticLighterKeychainParametersSchema = Type.Object({
  fit: mm('Lighter fit', 'Gap per side between the lighter and the sleeve’s bore, in mm, for the holder and its fit check alike. The crush ribs stand this much plus their squeeze proud of the bore, so the grip does not change with it: raise it if the lighter does not slide into the fit check.', d.fit, 0.1, 0.6, 0.05),
  squeeze: mm('Rib squeeze', 'How far the lighter squeezes each of the four crush ribs on its flat faces, in mm. They hold it as it hangs mouth down from the keys: more holds tighter and is harder to pull out.', d.squeeze, 0, 0.4, 0.05),
  wall: mm('Wall', 'The sleeve’s wall, in mm, which also sets the outline the foot and the keychain plate share. 1.6 mm is four lines of a 0.4 mm nozzle.', d.wall, 1.2, 3, 0.1),
  sleeveDepth: mm('Sleeve depth', 'How much of the lighter’s 50 mm plastic body the sleeve holds, above the foot, in mm. The hood, the wheel and the lever stay clear above it, so the lighter can be used in the holder.', d.sleeveDepth, 15, 45, 1),
  magnetFit: mm('Magnet fit', 'Gap per side between a magnet (at its greatest diameter) and its cavity, in mm, in both holders and the keychain fit check. Raise it if the magnets do not drop into the fit check’s pockets.', d.magnetFit, 0.05, 0.3, 0.05),
  skin: mm('Skin under the magnets', 'The plastic between the magnets and the flat bed face, in mm, rounded up to whole layers. Thinner pulls harder; at least 0.4 mm keeps two full layers at 0.2 mm, so the face prints closed and flat.', d.skin, 0.4, 1.2, 0.05),
  layerHeight: mm('Layer height', 'Your slicer’s layer height, in mm: the skin and the pause height are put on layer boundaries.', d.layerHeight, 0.08, 0.32, 0.02),
  magnet: Type.Enum(KEYCHAIN_MAGNETS, { title: 'Magnets', description: 'The disc magnets sealed in the lighter holder’s foot and in the keychain plate, two in each. Each is a real product from the parts library; its cavities are cut to its greatest size plus the magnet fit.', default: d.magnet }),
  splitRing: Type.Enum(KEYCHAIN_SPLIT_RINGS, { title: 'Split ring', description: 'The split ring that hangs the keychain plate on your keys, a real product from the parts library. The eyelet’s hole is sized for its band, and the ring is checked to go round the eyelet’s bridge.', default: d.splitRing }),
}, { additionalProperties: false, description: 'Magnetic lighter keychain parameters. All fields are required; dimensions are in millimetres; the magnet and split ring are parts-library ids.' });
export type MagneticLighterKeychainParameters = Static<typeof MagneticLighterKeychainParametersSchema>;

const libraryPart = (id: string): Part => {
  const part = findPart(id);
  if (!part) throw new Error(`${id} is not a part of the parts library.`);
  return part;
};

/** The lighter's plan as the generator draws it: the library SCAD's 96-point superellipse (lighter_plan()). */
export function keychainLighterPlan(steps = 96): [number, number][] {
  const lighter = libraryPart(KEYCHAIN_LIGHTER);
  const a = dimensionOf(lighter, 'thickness') / 2, b = dimensionOf(lighter, 'width') / 2, n = dimensionOf(lighter, 'profileExponent');
  return Array.from({ length: steps }, (_, i) => {
    const t = 2 * Math.PI * i / steps, c = Math.cos(t), s = Math.sin(t);
    return [a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.sign(s) * Math.abs(s) ** (2 / n)];
  });
}

/** The plan's half-extent across X at y (lighter_plan_x()). */
export function keychainLighterPlanX(y: number): number {
  const lighter = libraryPart(KEYCHAIN_LIGHTER);
  const a = dimensionOf(lighter, 'thickness') / 2, b = dimensionOf(lighter, 'width') / 2, n = dimensionOf(lighter, 'profileExponent');
  return a * (1 - (Math.abs(y) / b) ** n) ** (1 / n);
}

/** Area and perimeter of a closed polygon. */
function polygonMeasures(points: [number, number][]) {
  let area = 0, perimeter = 0;
  points.forEach(([x0, y0], i) => {
    const [x1, y1] = points[(i + 1) % points.length] ?? [x0, y0];
    area += x0 * y1 - x1 * y0;
    perimeter += Math.hypot(x1 - x0, y1 - y0);
  });
  return { area: Math.abs(area) / 2, perimeter };
}

/** The least distance from a point inside a convex polygon to its edges. */
function inset(points: [number, number][], [px, py]: [number, number]): number {
  let least = Infinity;
  points.forEach(([x0, y0], i) => {
    const [x1, y1] = points[(i + 1) % points.length] ?? [x0, y0];
    const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy)));
    least = Math.min(least, Math.hypot(px - x0 - t * dx, py - y0 - t * dy));
  });
  return least;
}

/** The library sizes a layout needs: the magnet's greatest diameter and height, and the split ring's. */
export function lighterKeychainParts(p: MagneticLighterKeychainParameters) {
  const magnet = libraryPart(p.magnet), ring = libraryPart(p.splitRing);
  return {
    magnet, ring,
    magnetD: dimensionOf(magnet, 'diameter', 'max'), magnetT: dimensionOf(magnet, 'thickness', 'max'),
    ringA: dimensionOf(ring, 'a', 'max'), ringB: dimensionOf(ring, 'b', 'max'), ringD: dimensionOf(ring, 'D'), ringd: dimensionOf(ring, 'd'),
  };
}

/** The generator's derived layout (POCKET_D ... OUTLINE_Y in the SCAD file), and the figures worked out from it. */
export function lighterKeychainLayout(p: MagneticLighterKeychainParameters) {
  const k = LIGHTER_KEYCHAIN, parts = lighterKeychainParts(p);
  const lighter = libraryPart(KEYCHAIN_LIGHTER);
  const um = (value: number) => Math.round(value * 1e6) / 1e6;
  const pocketD = um(parts.magnetD + 2 * p.magnetFit);
  const { skin, pause } = embedCavity(p.skin, parts.magnetT, k.headroom, p.layerHeight);
  const floor = um(pause + k.cap);
  const magnetY = um(pocketD / 2 + k.sideWall / 2);
  const outset = um(p.fit + p.wall);
  const top = floor + p.sleeveDepth;
  const hole = bailHole(parts.ringA, parts.ringB);
  const eyeR = hole / 2 + k.eyeWall, eyeZ = k.eyeBase + hole / 2;
  const plan = keychainLighterPlan();
  const { area, perimeter } = polygonMeasures(plan);
  /** A plan offset outwards by r: the polygon's area, its perimeter times r, and a full circle of r (convex). */
  const grown = (r: number) => area + perimeter * r + Math.PI * r * r;
  const outlineArea = grown(outset), boreArea = grown(p.fit);
  const cavity = Math.PI * (pocketD / 2) ** 2;
  const eyeArea = (2 * eyeR) * eyeZ + Math.PI * eyeR ** 2 / 2 - Math.PI * (hole / 2) ** 2;
  return {
    ...parts, pocketD, skin, pause, floor, magnetY, outset, top, hole, eyeR, eyeZ,
    pauseLayer: layerAbove(pause, p.layerHeight),
    outlineX: dimensionOf(lighter, 'thickness') / 2 + outset, outlineY: dimensionOf(lighter, 'width') / 2 + outset,
    /** The bore across the flat faces, and across the ribs' crests (the lighter squeezes each by `squeeze`). */
    boreX: dimensionOf(lighter, 'thickness') + 2 * p.fit, ribCircle: 2 * (keychainLighterPlanX(k.ribY) - p.squeeze),
    /** Between a magnet in the foot and its partner in the plate: the two skins. */
    magnetGap: 2 * skin,
    /** The keychain plate's height to the eyelet's top. */
    plateHeight: floor + eyeZ + eyeR,
    /** Approximate volumes (mm³): the lighter fit check's ring (without its ribs), the keychain fit check's floor and eyelet sample. */
    lighterCheckVolume: (outlineArea - boreArea) * k.checkHeight,
    keychainCheckVolume: (outlineArea - k.magnets * cavity) * pause + (eyeArea + 2 * 2 * eyeR) * k.eyeThickness,
    holderVolume: outlineArea * top - boreArea * p.sleeveDepth - k.magnets * cavity * (pause - skin),
  };
}
export type LighterKeychainLayout = ReturnType<typeof lighterKeychainLayout>;

/** Grams of PLA for a volume in mm³. */
export const plaGrams = (volume: number) => volume / 1000 * PLA_DENSITY;

/** How far the cavities may grow and stay `sideWall` inside the outline: the least distance from the cavity's centre to the plan,
 * plus the outline's offset less the side wall (the outline is the plan grown by `outset`, which is convex). */
export function cavityRoom(layout: LighterKeychainLayout): number {
  return inset(keychainLighterPlan(), [0, layout.magnetY]) + layout.outset - LIGHTER_KEYCHAIN.sideWall;
}

/** Whether the split ring goes round the eyelet's bridge: the ring's circle passes through the hole's centre, and the bridge (from the
 * hole's edge out by its wall, through the eyelet's thickness) must lie inside its opening (the cat collar tag's rule for its bail). */
export function ringGoesRound(layout: LighterKeychainLayout): boolean {
  const ri = layout.ringd / 2, rm = (layout.ringd + layout.ringD) / 4, k = LIGHTER_KEYCHAIN;
  const near = layout.hole / 2 - rm, far = layout.hole / 2 + k.eyeWall - rm;
  return Math.hypot(Math.max(Math.abs(near), Math.abs(far)), k.eyeThickness / 2) <= ri - COLLAR_TAG.ringClearance + 1e-9;
}

const fmt = (value: number) => `${Math.round(value * 100) / 100} mm`;

export function lighterKeychainIssues(p: MagneticLighterKeychainParameters): ParameterIssue[] {
  const issues: ParameterIssue[] = [];
  const l = lighterKeychainLayout(p), k = LIGHTER_KEYCHAIN;
  const room = cavityRoom(l);
  if (l.pocketD / 2 > room + 1e-9)
    issues.push({ field: 'magnet', message: `This magnet’s ${fmt(l.pocketD)} cavities do not fit the outline with ${fmt(k.sideWall)} of wall round them (at most ${fmt(2 * room)} across with this wall and fit). Choose a smaller magnet, or a thicker wall.` });
  if (!ringGoesRound(l))
    issues.push({ field: 'splitRing', message: `This split ring’s ${fmt(l.ringd)} opening is too small to go round the eyelet (${fmt(k.eyeWall)} of plastic round a ${fmt(l.hole)} hole, ${fmt(k.eyeThickness)} thick). Choose a larger ring.` });
  else if (l.ringd < k.eyeWall + k.keyringWire + COLLAR_TAG.ringPlay - 1e-9)
    issues.push({ field: 'splitRing', message: `The ring must hold the eyelet’s bridge and a key ring’s wire side by side: its opening must be at least ${fmt(k.eyeWall + k.keyringWire + COLLAR_TAG.ringPlay)}. Choose a larger ring.` });
  return issues;
}

/** What the editor shows under the settings: the pause and the polarity, the fit, the eyelet, and the filament the prints take. */
export function lighterKeychainNotes(p: MagneticLighterKeychainParameters): string[] {
  const l = lighterKeychainLayout(p);
  const g = (volume: number) => `${plaGrams(volume).toFixed(1)} g`;
  return [
    `Lighter holder and keychain holder: pause the print at ${l.pause} mm, before layer ${l.pauseLayer} at ${p.layerHeight} mm layers, drop the 2 magnets into each print’s cavities and resume. They sit ${l.skin} mm above the flat bed face, so a pair is ${fmt(l.magnetGap)} apart through both faces.`,
    'Polarity: stack all 4 magnets into one column and mark the top of each. In the lighter holder put both marked side down (towards the bed); in the keychain holder both marked side up. The two faces then attract in either turn, and each pair pulls the plate into line with the foot.',
    `Sleeve: bore ${fmt(l.boreX)} across the lighter’s 11 mm flat faces; its 4 crush ribs leave ${fmt(l.ribCircle)} there, squeezing each by ${fmt(p.squeeze)}. Cavities Ø ${fmt(l.pocketD)} for the ${l.magnet.title} (${l.magnet.attributes['pullForce']} each at contact).`,
    `Eyelet: a ${fmt(l.hole)} hole for the ${l.ring.title}, ${fmt(LIGHTER_KEYCHAIN.eyeWall)} of plastic round it.`,
    `Filament (PLA): about ${g(l.lighterCheckVolume)} for the lighter fit check and ${g(l.keychainCheckVolume)} for the keychain fit check; about ${g(l.holderVolume)} for the lighter holder, which with the ${LIGHTER_MASS} g lighter hangs on the magnets.`,
  ];
}

/**
 * The parts' poses, as the keychain hangs from the keys: the lighter upside down with its hood on the floor, the holder turned over
 * onto it (its foot up, at `foot`), the keychain plate on the foot as printed (flat face down, eyelet up); the fit checks beside them
 * as printed.
 */
export function lighterKeychainPoses(p: MagneticLighterKeychainParameters) {
  const l = lighterKeychainLayout(p), side = l.outlineX + 15;
  const height = dimensionOf(libraryPart(KEYCHAIN_LIGHTER), 'height'), foot = height + l.floor;
  type V = [number, number, number];
  return {
    foot,
    poses: {
      'lighter-holder': { position: [0, 0, foot] as V, rotation: [180, 0, 0] as V },
      'keychain-holder': { position: [0, 0, foot] as V },
      'lighter-fit-check': { position: [side, 0, 0] as V },
      'keychain-fit-check': { position: [-side, 0, 0] as V },
      lighter: { position: [0, 0, height] as V, rotation: [180, 0, 0] as V },
    },
  };
}

/**
 * The preview: the holder comes down over the lighter (in use the lighter is pushed in, base first), then the keychain plate comes
 * down onto the foot and the magnets hold it. The embedded magnets are in their prints from the start and move with them
 * (`lighterKeychainReferences`); the split ring rides with the plate.
 */
export function lighterKeychainAssembly(parameters: ParameterValues): Assembly {
  const p = { ...DEFAULT_LIGHTER_KEYCHAIN, ...parameters } as MagneticLighterKeychainParameters;
  return {
    partColors: { 'lighter-holder': '#d9482b', 'keychain-holder': '#2b2f36', 'lighter-fit-check': '#e8a33d', 'keychain-fit-check': '#8a9099' },
    poses: lighterKeychainPoses(p).poses,
    references: [{ id: 'lighter', part: KEYCHAIN_LIGHTER, title: 'BIC Mini lighter (J25)' }],
    steps: [
      { title: 'Slide the lighter into the holder, base first, past the crush ribs', parts: ['lighter-holder'], from: [0, 0, 45] },
      { title: 'Bring the keychain holder to the foot: the magnets pull it flat against it, in line', parts: ['keychain-holder'], from: [0, 0, 55] },
    ],
    lift: 20,
  };
}

/** The embedded magnets (two in the foot, two in the plate, each moving with its print) and the split ring through the eyelet. */
export function lighterKeychainReferences(parameters: ParameterValues): LinkedReference[] {
  const p = { ...DEFAULT_LIGHTER_KEYCHAIN, ...parameters } as MagneticLighterKeychainParameters;
  const l = lighterKeychainLayout(p), { foot } = lighterKeychainPoses(p);
  const b = l.ringB, mean = (l.ringD + l.ringd) / 4;
  const sides = [['+Y', 1], ['−Y', -1]] as const;
  return [
    // the holder is turned over about X: its +Y cavity is at -Y, the magnet in it upside down under the foot's skin
    ...sides.map(([name, s]): LinkedReference => ({ id: `magnet-foot-${s > 0 ? 'plus' : 'minus'}-y`, part: p.magnet, label: `embedded in the foot, ${name}`, pose: { position: [0, -s * l.magnetY, foot - l.skin], rotation: [180, 0, 0] }, movesWith: 'lighter-holder' })),
    ...sides.map(([name, s]): LinkedReference => ({ id: `magnet-plate-${s > 0 ? 'plus' : 'minus'}-y`, part: p.magnet, label: `embedded in the keychain holder, ${name}`, pose: { position: [0, s * l.magnetY, foot + l.skin] }, movesWith: 'keychain-holder' })),
    // the ring stands in the XZ plane, its band through the hole (along X), its circle through the hole's centre
    { id: 'split-ring', part: p.splitRing, label: 'through the eyelet', pose: { position: [0, b / 2, foot + l.floor + l.eyeZ + mean], rotation: [90, 0, 0] }, movesWith: 'keychain-holder' },
  ];
}
