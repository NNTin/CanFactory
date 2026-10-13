import { CATIO_MESH_DEFAULT, catioMesh } from '@canfactory/contracts';

/** The mesh every page starts from: soft cat netting (see `CATIO_MESHES`). */
const MESH = catioMesh(CATIO_MESH_DEFAULT);

/** Millimetres; X along the wall, +Y outdoors, Z up. Grass is Z=0, exterior wall face Y=0. */
export const CATIO = {
  width: 1200, depth: 1000, height: 1200,
  glass: 800, sash: 910, sill: 200,
  // Illustrative defaults, not measurements of the user's fixed frame or recess.
  fixedFrame: 1000, wall: 300, recess: 150, sashThickness: 60,
  timber: 45, meshOpening: MESH.opening, wire: MESH.strand, floorZ: 4,
  collarOuter: 980, collarMember: 40, collarDepth: 60, collarY: -60,
  rampWidth: 300, rampRun: 700, rampStartY: 70, rampThickness: 18,
} as const;

/**
 * A net roof is carried: a soft net sags between its edges, and bags under a cat that climbs onto it, so cross rails lie under it
 * no farther apart than `span`. Welded mesh would span an enclosure's roof on its own.
 */
export const ROOF_NET = { span: 400, bearer: { width: 30, depth: 30 } } as const;
/** Where the cross rails lie under a net roof with `clear` between its end rails: evenly spaced, measured from the first end rail. */
export function roofBearers(clear: number): number[] {
  const bays = Math.max(1, Math.ceil(clear / ROOF_NET.span - 1e-9));
  return Array.from({ length: bays - 1 }, (_, i) => (i + 1) * clear / bays);
}

export const CATIO_DERIVED = {
  sashBorder: (CATIO.sash - CATIO.glass) / 2,
  sashY: -CATIO.recess - CATIO.sashThickness / 2 - 20,
  fixedBottom: CATIO.sill - (CATIO.fixedFrame - CATIO.sash) / 2,
  portalWidth: CATIO.collarOuter - 2 * CATIO.collarMember,
  portalTop: CATIO.sill + CATIO.collarOuter - 2 * CATIO.collarMember,
  rampTop: [0, CATIO.rampStartY, CATIO.sill],
  rampFoot: [0, CATIO.rampStartY + CATIO.rampRun, CATIO.floorZ + CATIO.rampThickness],
} satisfies Record<string, number | [number, number, number]>;

export const CATIO_STEPS = [
  { title: 'Existing window', detail: 'The window and grass stay in place while the catio is assembled.' },
  { title: 'Fit the recess collar', detail: 'Open the sash inward. Reach through and tighten the four padded clamps against the solid exterior recess.' },
  { title: 'Position the base', detail: 'Set the four feet on the grass. Secure the continuous mesh floor and its low perimeter skirt to the timber base.' },
  { title: 'Build the enclosure', detail: 'Fit the corner posts, upper rails and the net on the sides, pulled taut. Clamp its edges under timber battens.' },
  { title: 'Connect to the window', detail: 'Attach the rear panel and enclosed passage to the collar using removable exterior brackets. Close every edge around the passage.' },
  { title: 'Fit ramp, roof and door', detail: 'Add the ramp down to the grass, the roof’s cross rails with the net pulled taut over them, and the hinged maintenance door with its latch.' },
  { title: 'Completed catio', detail: 'Latch the maintenance door. The original window can open inward and close with the catio installed.' },
] as const;

export type CatioLayer = 'timber' | 'mesh' | 'hardware' | 'environment';
export type CatioView = 'Exterior' | 'Interior' | 'Front' | 'Side' | 'Top' | 'Mounting';
export const CATIO_VIEWS: Record<CatioView, { position: [number, number, number]; target: [number, number, number] }> = {
  Exterior: { position: [2300, 3100, 2100], target: [0, 300, 560] },
  Interior: { position: [1850, -2700, 1600], target: [0, -70, 600] },
  Front: { position: [0, 3700, 650], target: [0, 200, 650] },
  Side: { position: [3500, 450, 630], target: [0, 450, 630] },
  Top: { position: [0, 450, 3700], target: [0, 451, 0] },
  Mounting: { position: [700, -1400, 1100], target: [-180, -55, 680] },
};

/** The concept's second step when the window insert hangs on the window frame (its default), instead of clamping into the recess. */
export const CATIO_HUNG_STEP = { title: 'Hang the collar on the window', detail: 'Open the sash inward. Lift the collar, slip its long screen hooks up behind the fixed frame’s head lip, and let it down: its short hooks drop behind the sill lip and its feet stand on the recess floor. The sash still closes over the hooks.' };
