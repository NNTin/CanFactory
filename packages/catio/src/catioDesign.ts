import { CATIO_MESH_DEFAULT, catioMesh } from '@canfactory/contracts';

/** The mesh every page starts from: soft cat netting (see `CATIO_MESHES`). */
const MESH = catioMesh(CATIO_MESH_DEFAULT);

/** Millimetres; X along the wall, +Y outdoors, Z up. Grass is Z=0, exterior wall face Y=0. */
export const CATIO = {
  glass: 800, sash: 910, sill: 200,
  // Illustrative defaults, not measurements of the user's fixed frame or recess.
  fixedFrame: 1000, wall: 300, recess: 150, sashThickness: 60,
  wire: MESH.strand, floorZ: 4,
  collarOuter: 980, collarMember: 40, collarDepth: 60, collarY: -60,
  rampRun: 700, rampStartY: 70, rampThickness: 18,
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
  fixedBottom: CATIO.sill - (CATIO.fixedFrame - CATIO.sash) / 2,
} satisfies Record<string, number>;

/** A sub-assembly's two variants: direct on the window (the insert is the enclosure's collar), or modular, with a tunnel. */
export type CatioMode = 'direct' | 'modular';
export type CatioLayer = 'timber' | 'mesh' | 'hardware' | 'environment';
export type CatioView = 'Exterior' | 'Interior' | 'Front' | 'Side' | 'Top' | 'Mounting';
