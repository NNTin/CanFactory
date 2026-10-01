/** Millimetres; X along the wall, +Y outdoors, Z up. Grass is Z=0, exterior wall face Y=0. */
export const CATIO = {
  width: 1200, depth: 1000, height: 1200,
  glass: 800, sash: 910, sill: 200,
  // Illustrative defaults, not measurements of the user's fixed frame or recess.
  fixedFrame: 1000, wall: 300, recess: 150, sashThickness: 60,
  timber: 45, meshOpening: 20, wire: 2, floorZ: 4,
  collarOuter: 980, collarMember: 40, collarDepth: 60, collarY: -60,
  rampWidth: 300, rampRun: 700, rampStartY: 70, rampThickness: 18,
} as const;

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
  { title: 'Build the enclosure', detail: 'Fit the corner posts, upper rails and mesh side panels. Cover the mesh edges with timber battens.' },
  { title: 'Connect to the window', detail: 'Attach the rear panel and enclosed passage to the collar using removable exterior brackets. Close every edge around the passage.' },
  { title: 'Fit ramp, roof and door', detail: 'Add the ramp down to the grass, mesh roof and hinged maintenance door with its latch.' },
  { title: 'Completed catio', detail: 'Latch the maintenance door. The original window can open inward and close with the catio installed.' },
] as const;

export type CatioLayer = 'timber' | 'mesh' | 'hardware' | 'environment';
export type CatioView = 'Exterior' | 'Interior' | 'Front' | 'Side' | 'Top' | 'Mounting';
export const CATIO_VIEWS: Record<CatioView, { position: [number, number, number]; target: [number, number, number] }> = {
  Exterior: { position: [2300, 3100, 2100], target: [0, 300, 560] },
  Interior: { position: [-1850, -2700, 1600], target: [0, -70, 600] },
  Front: { position: [0, 3700, 650], target: [0, 200, 650] },
  Side: { position: [3500, 450, 630], target: [0, 450, 630] },
  Top: { position: [0, 450, 3700], target: [0, 451, 0] },
  Mounting: { position: [-950, -1200, 1100], target: [-280, -55, 700] },
};
