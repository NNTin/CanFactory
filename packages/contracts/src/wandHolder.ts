import { Type, type Static } from 'typebox';
import type { Assembly, ParameterIssue } from './models.ts';

/**
 * Wand holder (models/wand-holder/generator.scad, docs/wand-holder.md): an original design. A C-shaped spring clip snaps onto a
 * sisal scratching post from the side, at any height, and an upright socket at its back holds a cat wand toy's rigid handle end
 * by friction. The clip is one fixed design for posts from `postMin` to `postMax` across the rope: its own bend takes up the
 * diameter (owner's decision on #149), so the post's diameter is not a setting. Only the socket is sized from settings.
 *
 * Frame: millimetres, Z up along the post's axis, the post's centre on the Z axis, the clip's mouth towards +X, the socket
 * towards -X; the clip's bottom face on z = 0, as it prints.
 */

/** Fixed design sizes, the same as the generator's fixed constants (a test keeps them equal). */
export const WAND_HOLDER = {
  /** The posts it is for, across the rope: TRIXIE's ø 9 cm trunks to its ø 11 cm ones, round the owner's ~10 cm post. */
  postMin: 90, postMax: 110,
  /** The grip face's ridge crests, relaxed: smaller than the thinnest post, so the clip always squeezes it. */
  gripD: 88,
  /** Horizontal ridges inside, which press into the rope between its turns. */
  ridge: 0.8, ridgePitch: 4, ridgeLand: 0.4,
  /** The band behind the ridges, its height along the post, and how far round the post it reaches relaxed (degrees). */
  band: 3.5, height: 36, wrap: 270,
  /**
   * The flared lips at the tips: their length and their angle outwards from the mouth's axis. A post of diameter D pushed into
   * the mouth meets a lip's inner face where its normal points at the post's centre, D/2 · cos(flareAngle) off the axis: 34.5 to
   * 42.1 mm for 90 to 110 mm posts, inside the faces' 31 to 43 mm, so the lips act as a wedge (spreading force 1/tan 40° ≈ 1.2 ×
   * the push) for every post in the range.
   */
  flare: 18, flareAngle: 40,
  /** The web joining the socket's tube to the band spans this far either side of -X (degrees): the arms bend from its ends. */
  back: 12,
  /** The socket's tube: its wall, floor, vent hole, crush ribs, mouth chamfer, the ribs' ramp, and how far it runs into the band. */
  wall: 3, floor: 2, vent: 2, ribs: 3, ribWidth: 1.2, lead: 0.8, ribRamp: 3, sink: 0.8,
  /** The least socket depth, in handle diameters: shallower, a tug tilts the handle out of it. */
  depthRatio: 3,
} as const;

/**
 * The strain that the arms may see, as a fraction. PETG (the recommended material) yields at about 4 % and is linear to about
 * 2.4 % (≈ 50 MPa over ≈ 2.1 GPa); staying under 1.5 %, below two thirds of that, leaves room for repeated cycles and for the
 * linear estimate below. PLA is stiffer and more brittle (linear to about 1.7 %, cracking soon after), so it is not recommended.
 */
export const WAND_HOLDER_STRAIN_LIMIT = 0.015;

export const WandHolderParametersSchema = Type.Object({
  handleDiameter: Type.Number({ title: 'Wand handle diameter', description: 'Diameter of the wand toy’s rigid handle end that goes into the socket (the issue’s 8 mm). Measure it with a caliper: the socket’s ribs grip it by this.', default: 8, minimum: 5, maximum: 12, multipleOf: 0.1 }),
  socketDepth: Type.Number({ title: 'Socket depth', description: 'How deep the socket holds the handle, above its closed floor. 40 mm (five handle diameters) keeps a tugged wand from levering itself out; at least three diameters.', default: 40, minimum: 25, maximum: 60, multipleOf: 1 }),
  clearance: Type.Number({ title: 'Socket clearance', description: 'Play between the handle and the bore on each side. The ribs stand this much plus their squeeze proud of the bore, so the grip does not change with it: raise it if your printer prints holes small.', default: 0.2, minimum: 0.1, maximum: 0.5, multipleOf: 0.05 }),
  squeeze: Type.Number({ title: 'Rib squeeze', description: 'How far the handle squeezes each of the socket’s three crush ribs. More holds tighter and is harder to push in; 0 leaves a loose guide hole.', default: 0.15, minimum: 0, maximum: 0.4, multipleOf: 0.05 }),
}, { additionalProperties: false });
export type WandHolderParameters = Static<typeof WandHolderParametersSchema>;

export const DEFAULT_WAND_HOLDER: WandHolderParameters = { handleDiameter: 8, socketDepth: 40, clearance: 0.2, squeeze: 0.15 };

const rad = (degrees: number) => degrees * Math.PI / 180;

/** The clip's radii: ridge crests, the band's inside and outside, and its middle line. */
export function wandHolderBand() {
  const h = WAND_HOLDER;
  const crest = h.gripD / 2, inside = crest + h.ridge, outside = inside + h.band;
  return { crest, inside, outside, middle: (inside + outside) / 2, tip: 180 - h.wrap / 2 };
}

/** The socket's sizes, as the generator builds them. */
export function wandHolderLayout(p: WandHolderParameters) {
  const h = WAND_HOLDER, band = wandHolderBand();
  const bore = p.handleDiameter / 2 + p.clearance, tube = bore + h.wall;
  return {
    bore, tube, tubeX: -(band.outside + tube - h.sink), tubeHeight: h.floor + p.socketDepth,
    /** The circle across the ribs' faces: the handle squeezes each by `squeeze`. */
    ribCircle: p.handleDiameter - 2 * p.squeeze,
    ...band,
  };
}

/**
 * How the clip bends on a post of diameter `post` (across the rope). Each arm is a curved cantilever of the band's middle radius
 * from the web's end to its tip. Going on, the tips must spread until they are `post` apart; linear curved-beam theory gives the
 * strain at the arm's root for that spread, from a sideways (±Y) load at the tip: deflection P/EI ∫ (x_tip − x)² ds and root
 * moment P (x_tip − x_root). Seated, the band is bent from its relaxed radius to the post's, a uniform strain. It is an estimate
 * (the spread is large for linear theory, and the post's own give, the rope's, is ignored, which errs on the safe side).
 */
export function wandHolderFlex(post: number) {
  const h = WAND_HOLDER, band = wandHolderBand();
  const tip = rad(band.tip), root = rad(180 - h.back), r = band.middle;
  const xTip = r * Math.cos(tip), xRoot = r * Math.cos(root);
  const steps = 400;
  let integral = 0;
  for (let i = 0; i < steps; i++) {
    const a = tip + (root - tip) * (i + 0.5) / steps;
    integral += (xTip - r * Math.cos(a)) ** 2 * r * (root - tip) / steps;
  }
  /** The tips' inner corners, relaxed, across the mouth. */
  const mouth = 2 * band.crest * Math.sin(tip);
  const spread = Math.max(0, (post - mouth) / 2);
  const passing = spread * (h.band / 2) * Math.abs(xTip - xRoot) / integral;
  const seated = (h.band / 2) * (1 / r - 1 / (post / 2 + h.ridge + h.band / 2));
  /** The band's arc round the post, seated, and how far its tips stand behind the post's widest line (towards the socket). */
  const wrap = h.wrap * band.crest / (post / 2);
  const behind = post / 2 * (1 - Math.sin(rad((360 - wrap) / 2)));
  return { mouth, spread, passing, seated, wrap, behind };
}

export function wandHolderIssues(p: WandHolderParameters): ParameterIssue[] {
  const least = WAND_HOLDER.depthRatio * p.handleDiameter;
  return p.socketDepth + 1e-9 < least
    ? [{ field: 'socketDepth', message: `The socket must be at least ${WAND_HOLDER.depthRatio} handle diameters deep (${least.toFixed(1)} mm for a ${p.handleDiameter} mm handle), or a tug levers the wand out of it.` }]
    : [];
}

/** The clip on the thinnest post it is for (the parts library's TRIXIE ø 9 cm trunk), part-way up it. */
export const WAND_HOLDER_POST = { part: 'trixie-43991-sisal-trunk', diameter: 90, height: 400, clipAt: 250 } as const;

/**
 * The preview: the clip comes from the side, spread open, over the post and springs shut round it. The clip's scale stands in for
 * its bend (the preview moves parts rigidly): spread along Y until its tips clear the post, then let go to the post's diameter.
 */
export function wandHolderAssembly(): Assembly {
  const band = wandHolderBand();
  const seated = (WAND_HOLDER_POST.diameter / 2) / band.crest;
  const tipY = band.crest * Math.sin(rad(band.tip));
  const open = Math.ceil((WAND_HOLDER_POST.diameter / 2 + 1.5) / tipY * 100) / 100;
  const spread: [number, number, number] = [seated, open, 1];
  return {
    partColors: { clip: '#2f8f6f' },
    poses: {
      clip: { position: [0, 0, WAND_HOLDER_POST.clipAt], scale: [seated, seated, 1] },
      post: { position: [0, 0, 0] },
    },
    references: [{ id: 'post', part: WAND_HOLDER_POST.part, title: 'TRIXIE replacement sisal trunk, ø 9 × 40 cm (43991), standing in for your scratching post' }],
    steps: [
      { title: 'Press the clip’s mouth against the post at any height: the flared lips spread its arms over the post', parts: ['clip'], from: [-150, 0, 0], scaleFrom: spread },
      { title: 'Past the post’s widest line the arms spring shut round it; push the wand’s handle down into the socket', parts: ['clip'], from: [0, 0, 0], scaleFrom: spread },
    ],
    lift: 20,
  };
}
