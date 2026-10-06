/**
 * The existing tilt-and-turn (Dreh-Kipp) window as a real frame and sash, from outside: the fixed frame's outer lip
 * (Blendrahmenüberschlag) overlaps the closed sash, whose face lies behind it across the gap its outer seal fills. Millimetres; X
 * along the wall, +Y outdoors, Z up, as in catioDesign.ts.
 *
 * The profile's defaults are a VEKA Softline 82 MD window (VEKA, technical product information 07/2020, p. 22): 82 mm deep, the
 * fixed frame 73 mm wide seen from outside. The lip's thickness and the seal gap are not dimensioned there; they are scaled from
 * its section drawing (about 15.6 and 3.5 mm). Measure your own window and set them on the window insert page.
 */
export interface WindowProfile {
  /** How wide the fixed frame shows from outside, from its outer edge to the tip of its lip (VEKA 82 MD: 73 mm). */
  frameFace: number;
  /** The lip's thickness: from the frame's outer face to the lip's back, where its seal is. */
  frameLip: number;
  /** From the lip's back to the closed sash's outer face: the gap the outer seal fills. */
  sealGap: number;
  /** The frame's depth (Bautiefe); the sash is drawn as deep. */
  frameDepth: number;
}

export const WINDOW_PROFILE_DEFAULT: WindowProfile = { frameFace: 73, frameLip: 15.5, sealGap: 3.5, frameDepth: 82 };

/** The ranges the window insert page offers, in mm. */
export const WINDOW_PROFILE_RANGES: Record<keyof WindowProfile, { min: number; max: number; step: number }> = {
  frameFace: { min: 40, max: 120, step: 1 },
  frameLip: { min: 5, max: 35, step: 0.5 },
  sealGap: { min: 1, max: 10, step: 0.5 },
  frameDepth: { min: 58, max: 120, step: 1 },
};

/** Where the fixed frame's outer face stands, 32.5 mm proud of the 150 mm reveal's back, as the catio has always drawn it. */
export const FRAME_FACE_Y = -117.5;
/** The gap round the sash's edge in the frame's rebate, where the fittings run (Falzluft): 12 mm in the usual Euro-groove systems. */
export const FALZLUFT = 12;
/** How far a tilted sash leans into the room at most, in degrees: its stays stop it at about 10–15 cm at the top. */
export const TILT_MAX = 12;

/** The window opening and its sash, as `WindowSpec` gives them, with the profile. */
export interface WindowShape {
  sashWidth: number; sashHeight: number; openingWidth: number; openingHeight: number; recessFloor: number; sill: number; profile: WindowProfile;
}

/** The frame and sash of a window, placed: the planes from outside in, and the lip's opening. */
export function windowFrame(w: WindowShape) {
  const { frameFace, frameLip, sealGap, frameDepth } = w.profile;
  const face = FRAME_FACE_Y; const lipBack = face - frameLip; const sashFace = lipBack - sealGap;
  const top = w.recessFloor + w.openingHeight;
  // the clear opening inside the lip's tips, which a screen (or the insert) overlaps
  const lip = { width: w.openingWidth - 2 * frameFace, bottom: w.recessFloor + frameFace, top: top - frameFace };
  const sash = { left: -w.sashWidth / 2, right: w.sashWidth / 2, bottom: w.sill, top: w.sill + w.sashHeight, face: sashFace, room: sashFace - frameDepth };
  // how far the lip covers the sash's edge on each side: what its seal closes on
  const overlap = Math.min(w.sashWidth / 2 - lip.width / 2, lip.bottom - sash.bottom, sash.top - lip.top);
  // the frame's body behind the lip stops the Falzluft short of the sash's edge
  const body = { width: (w.openingWidth - w.sashWidth) / 2 - FALZLUFT, bottom: sash.bottom - FALZLUFT - w.recessFloor, top: top - sash.top - FALZLUFT };
  return { face, lipBack, sashFace, back: face - frameDepth, top, lip, sash, overlap, body };
}
export type WindowFrame = ReturnType<typeof windowFrame>;

/** What is wrong with a window's profile, if anything. */
export function validateWindowProfile(w: WindowShape): string[] {
  const f = windowFrame(w); const errors: string[] = [];
  if (f.overlap < 10) errors.push(`The fixed frame’s lip covers the sash by only ${Math.round(f.overlap)} mm: the sash needs at least 10 mm to close against. Widen the frame as seen from outside.`);
  if (Math.min(f.body.width, f.body.bottom, f.body.top) < 15) errors.push('The fixed frame round this sash is too narrow for its rebate and fittings.');
  return errors;
}
