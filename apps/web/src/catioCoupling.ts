import { COUPLING_HARDWARE as HW, COUPLING_LATCH, couplingLatch, dimensionOf, findPart, toggleLatchMechanism as TL, type Part } from '@canfactory/contracts';
import type { CatioView } from './catioDesign.ts';
import { E_PROFILE_SEAL, latchHeights, PRINTED_LATCH, PRINTED_LATCH_JOINT, printedLatchLine, printedLatchScrews, type LatchMount } from './catioPrintedLatch.ts';
import type { CatioMode } from './catioSettings.ts';
import { clearOf, fastenerClashes, fastenersAlong, loadSubassemblyConfig, parseControlled, type AssemblyStep, type BomLine, type CameraPreset, type DesignDecision, type SubassemblyControl, type SubassemblyFact, type V3 } from './catioSubassembly.ts';
import { parseTunnel, TUNNEL, TUNNEL_DEFAULT, tunnelLayout, tunnelSite, type TunnelConfig, type TunnelSite } from './catioTunnel.ts';
import { INSERT, windowInsertLayout } from './catioWindowInsert.ts';

/**
 * The insert–tunnel coupling: the joint between the window insert's cat port and the tunnel's first flange. Millimetres; X along
 * the wall, +Y outdoors, Z up; the wall face is Y=0 and the grass at the wall Z=0, as in catioDesign.ts.
 *
 * Both sides are fixed interfaces and stay as their pages set them: the insert's port frame (40 × 40 jambs and transom, faced
 * with mesh and, by default, cover battens) sits inside the recess, its face 28 mm behind the wall face; the tunnel's first
 * flange stands 10 mm off the wall face on its own wall support. The coupling adds a docking frame to the insert that presents
 * a flat face short of the flange (6 mm for the GN 831, 3 mm for the printed latch), a seal squashed in that gap, a rubber lip over
 * the floor gap, and toggle latches across the joint on both sides: Ganter GN 831s from the parts library, or the printed toggle
 * latch (the `toggle-latch` model). The layout below is the one source for the 3D scene, the parts list and the tests.
 */
export interface CouplingConfig {
  /** Which toggle latches: the Ganter GN 831 (steel, from the parts library) or the printed `toggle-latch` model. */
  latch: 'gn-831' | 'printed';
  /** GN 831 type: S has a safety catch that stops a knocked lever opening, A has none, SV takes a padlock. */
  latchType: typeof COUPLING_LATCH.types[number];
  /** Stainless steel or zinc-plated steel. */
  latchMaterial: typeof COUPLING_LATCH.materials[number];
  /** Latches on each side of the joint. */
  latchesPerSide: 1 | 2;
  /** What closes the floor gap between the insert's threshold and the flange. */
  floorLip: 'rubber-lip' | 'none';
}

export const COUPLING_DEFAULT: CouplingConfig = { latch: 'printed', latchType: 'S', latchMaterial: 'NI', latchesPerSide: 1, floorLip: 'rubber-lip' };

/** Fixed sizes of the coupling. */
export const COUPLING = {
  /** The gap the seal fills, between the docking frame's face and the flange's back, with GN 831 latches. */
  gap: 6,
  /** Self-adhesive hollow EPDM D-profile seal: its free height and width. */
  seal: { height: 10, width: 12 },
  /** With the printed latch: its 3 mm gap, and the self-adhesive EPDM E-profile seal (9 × 4, made for 2–3.5 mm gaps) squashed in it. */
  printed: PRINTED_LATCH_JOINT,
  /** 3 mm EPDM sheet over the floor gap: how far it laps onto the threshold. */
  lip: { thickness: 3, overlap: 25 },
  /** Docking frame screw spacing, and the latch body's distance in from the flange's face. */
  screwPitch: 150, latchInset: 2,
  /** How far a docking frame screw bites at least into the jamb or transom behind it. */
  frameBite: 20,
  /** The least distance from a docking frame screw to a batten screw or staple already in the insert's port frame. */
  screwClearance: 12,
} as const;

/** The seal gap and the seal for this latch: a short printed latch needs the frame closer to the flange (`PRINTED_LATCH`). */
export function couplingJoint(config: Pick<CouplingConfig, 'latch'>) {
  return config.latch === 'printed'
    ? { gap: COUPLING.printed.gap, seal: { ...COUPLING.printed.seal, name: E_PROFILE_SEAL, profile: 'E-profile' } }
    : { gap: COUPLING.gap, seal: { ...COUPLING.seal, name: 'EPDM D-profile seal, self-adhesive (custom)', profile: 'D-profile' } };
}

const TG = TL.TOGGLE_LATCH_GEOMETRY;
/** The printed toggle latch's sizes on a joint: shared with the tunnel–tunnel coupling (catioPrintedLatch.ts). */
export { PRINTED_LATCH };

/** The docking frame's depth with GN 831 latches: from the insert's mesh face to the seal gap in front of the tunnel's first flange. */
const FRAME_DEPTH = TUNNEL.wallGap - COUPLING.gap - (INSERT.y + INSERT.depth / 2 + INSERT.mesh.wire);
/** The same with the printed latches (the default), whose gap is narrower. */
const PRINTED_FRAME_DEPTH = FRAME_DEPTH + COUPLING.gap - COUPLING.printed.gap;
/** How far the joint runs, from the first flange's face back to the insert's mesh face. */
const JOINT_DEPTH = TUNNEL.wallGap + TUNNEL.flange.thickness - (INSERT.y + INSERT.depth / 2 + INSERT.mesh.wire);
const FRAME_SCREW_LENGTH = dimensionOf(part(HW.frameScrew), 'l');
/** How far behind the wall face the insert's port frame lies. */
const PORT_FACE_DEPTH = -(INSERT.y + INSERT.depth / 2 + INSERT.mesh.wire);

/** The fixed interfaces: the window insert and the tunnel as their pages set them (or their defaults). */
export interface CouplingSite { tunnel: TunnelConfig; site: TunnelSite }
export function couplingSite(): CouplingSite {
  return { tunnel: loadSubassemblyConfig('tunnel', parseTunnel, TUNNEL_DEFAULT), site: tunnelSite() };
}
/** The coupling as saved on its page (or its defaults), for the pages that show it. */
export const savedCoupling = () => loadSubassemblyConfig('insert-tunnel-coupling', parseCoupling, COUPLING_DEFAULT);

function part(id: string): Part {
  const found = findPart(id); if (!found) throw new Error(`The parts library has no ${id}.`); return found;
}

export interface Box { size: V3; center: V3 }
export interface FrameMember { id: string; name: string; boxes: Box[]; length: number; cut: string }
export interface Latch {
  id: string; side: -1 | 1; z: number;
  /** The printed latch: where its base plate's edge faces the catch across the gap (along Y); the catch plate's edge is `locked`
   * nearer the insert. Its base runs from `hingeY` (that edge) to `baseY`, its catch from `catchY` to the gap. `mount` places it. */
  printed?: { seam: number; mount: LatchMount };
  /** The latch body on the flange's outer side: from `baseY` (its end under the lever) to `hingeY` (the pivot end). */
  baseY: number; hingeY: number;
  /** The catch bracket on the docking frame's outer side, from `catchY` (its far end) to `catchY + b4`. */
  catchY: number;
  /** The outer side faces it is screwed to, both at this X. */
  faceX: number;
}
export interface Fastener { partId: string; component: 'frame-screws' | 'latch-screws' | 'catch-screws' | 'lip-screws'; at: V3; direction: V3; use: string; of?: string }

/** Everything the coupling is, placed and installed. */
export function couplingLayout(config: CouplingConfig, { tunnel, site }: CouplingSite = couplingSite()) {
  const errors: string[] = [];
  const insert = windowInsertLayout('modular', site.insert, site.window);
  const tl = tunnelLayout(tunnel, site);
  const port = insert.port ?? { width: site.w, height: site.h, transomZ: insert.floor + site.h };
  const { width: w, height: h, transomZ } = port; const floor = insert.floor;
  const F = TUNNEL.flange.width; const T = TUNNEL.flange.thickness; const pm = INSERT.portMember;
  // the insert's outdoor faces: the mesh over the port frame, and the cover battens over that
  const meshFace = insert.yOut + INSERT.mesh.wire;
  const battens = site.insert.meshFixing !== 'staples';
  const battenFace = battens ? meshFace + INSERT.batten.thickness : meshFace;
  const flangeBack = TUNNEL.wallGap; const flangeFront = flangeBack + T;
  const joint = couplingJoint(config);
  const front = flangeBack - joint.gap; const thickness = front - meshFace;

  // The docking frame: two stiles on the port jambs and a head across them on the transom, the flange's outline above the floor.
  // Where a cover batten is under it, its back is rebated over the batten (the same 40 mm as the jamb or transom it covers).
  const stileHeight = transomZ - floor;
  const rebate = battens ? ` · rebated ${INSERT.batten.thickness} × ${pm} along its back over the cover batten` : '';
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box => ({ size: [x1 - x0, y1 - y0, z1 - z0], center: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] });
  const frame: FrameMember[] = [
    ...([-1, 1] as const).map(s => {
      const [inner, rebated, outer] = [s * w / 2, s * (w / 2 + pm), s * (w / 2 + F)];
      return { id: `frame-${s < 0 ? 'left' : 'right'}`, name: `Docking frame stile, ${s < 0 ? 'left' : 'right'}`, length: stileHeight, cut: `${Math.round(stileHeight)} long, square ends${rebate}`,
        boxes: [box(Math.min(inner, rebated), Math.max(inner, rebated), battenFace, front, floor, transomZ), box(Math.min(rebated, outer), Math.max(rebated, outer), meshFace, front, floor, transomZ)] };
    }),
    { id: 'frame-head', name: 'Docking frame head', length: w + 2 * F, cut: `${w + 2 * F} long, square ends${rebate}`,
      boxes: [box(-w / 2 - F, w / 2 + F, battenFace, front, transomZ, transomZ + pm), box(-w / 2 - F, w / 2 + F, meshFace, front, transomZ + pm, transomZ + F)] },
  ];
  if (w / 2 + F > insert.Wi / 2) errors.push(`The docking frame (${w + 2 * F} mm wide) does not fit between the collar stiles (${insert.Wi} mm apart).`);
  if (transomZ + F > insert.z0 + insert.H - INSERT.member) errors.push('The docking frame’s head would stand above the collar’s head rail: the cat port is too tall for this window.');

  // The seal: a U of D-profile along the middle of the frame's face; the floor lip: EPDM sheet from the flange onto the threshold.
  const mid = F / 2;
  const seal = { ...joint.seal, length: 2 * (h + mid) + (w + 2 * mid), path: [[-w / 2 - mid, floor], [-w / 2 - mid, transomZ + mid], [w / 2 + mid, transomZ + mid], [w / 2 + mid, floor]] as [number, number][], y0: front, y1: flangeBack };
  const lip = config.floorLip === 'rubber-lip' ? { x0: -w / 2 + 2, x1: w / 2 - 2, y0: -COUPLING.lip.overlap, y1: flangeFront, z: floor } : null;

  // The latches. A GN 831: body on the flange's outer side, its pivot end just inside the flange's face, the lever across the gap,
  // and the catch bracket on the docking frame's outer side where the hook falls with it set to the middle of its range. The printed
  // latch: base plate on the flange's side and catch plate on the frame's, across the gap, at the spacing its lock sets.
  const heights = latchHeights(config.latchesPerSide);
  const placeLatches = (place: (side: -1 | 1) => Omit<Latch, 'id' | 'side' | 'z' | 'faceX'>) => ([-1, 1] as const).flatMap(side => heights.map((f, i) => ({
    id: `latch-${side < 0 ? 'left' : 'right'}-${i}`, side, z: floor + f * (h + F), faceX: side * (w / 2 + F), ...place(side),
  })));
  let latchPart: Part | null = null; let latches: Latch[]; let tolerance: number; let latchName: string; let latchSpan: number;
  if (config.latch === 'gn-831') {
    const gn = couplingLatch(config.latchType, config.latchMaterial); latchPart = gn; latchName = gn.designation;
    const [b3, b4, l, w2] = (['b3', 'b4', 'l1', 'w2'] as const).map(key => dimensionOf(gn, key)) as [number, number, number, number];
    const hingeY = flangeFront - COUPLING.latchInset; const baseY = hingeY - b3; const catchY = hingeY - l - w2 / 2;
    latches = placeLatches(() => ({ baseY, hingeY, catchY }));
    if (baseY < flangeBack) errors.push(`The latch body (${b3} mm) is longer than the flange is thick.`);
    if (catchY < meshFace || catchY + b4 > front) errors.push(`The ${gn.designation} catch bracket would not sit on the docking frame’s side: it needs ${Math.ceil(l + w2 / 2 + COUPLING.latchInset)} mm from the flange’s face, the joint is ${Math.round(flangeFront - meshFace)} mm deep.`);
    tolerance = w2 / 2; latchSpan = dimensionOf(gn, 'b1');
  } else {
    const { locked, overhang, along: a } = PRINTED_LATCH; latchName = 'printed toggle latch';
    const seam = flangeBack - overhang;
    latches = placeLatches(() => ({ baseY: seam + a, hingeY: seam, catchY: seam - locked - a }))
      .map(q => ({ ...q, printed: { seam, mount: { id: q.id, side: q.side, at: [q.faceX, seam, q.z], out: [q.side, 0, 0], pull: [0, 1, 0] } } }));
    if (seam + a > flangeFront) errors.push(`The printed latch’s base plate (${a} mm) is longer than the flange is thick.`);
    if (seam - locked - a < meshFace) errors.push('The printed latch’s catch plate would not sit on the docking frame’s side.');
    tolerance = PRINTED_LATCH.hooked - locked; latchSpan = PRINTED_LATCH.length;
  }
  for (const latch of latches) if (latch.z - latchSpan / 2 < floor || latch.z + latchSpan / 2 > transomZ + F) errors.push('A latch does not fit on the docking frame’s side.');

  // Fasteners: frame screws through the frame (and batten) into the jambs and transom, kept clear of the batten screws and
  // staples already on those centre lines; two screws in each latch body and catch.
  const fasteners: Fastener[] = [];
  // a frame screw bites at least COUPLING.frameBite into the jamb or transom behind the frame (and the batten under it): the usual
  // 5 × 60, or a 6 × 90 when the insert hangs on the window frame and its port frame lies deeper
  const frameScrew = [part(HW.frameScrew), part(HW.frameScrewDeep)].find(p => dimensionOf(p, 'l') - (front - insert.yOut) >= COUPLING.frameBite) ?? part(HW.frameScrewDeep);
  if (dimensionOf(frameScrew, 'l') - (front - insert.yOut) < COUPLING.frameBite) errors.push(`The docking frame is too thick for its screws to bite ${COUPLING.frameBite} mm into the port frame.`);
  const latchScrew = part(HW.latchScrew);
  const spaced = (from: number, to: number, count: number) => Array.from({ length: count }, (_, i) => count === 1 ? (from + to) / 2 : from + i * (to - from) / (count - 1));
  const gap = COUPLING.screwClearance;
  const faceFasteners = insert.fasteners.filter(f => f.component === 'batten-screws' || f.component === 'staples');
  /** Along a frame member's screw line: the insert fasteners within `gap` of it, as positions along it. */
  const near = (index: 0 | 2, at: number, along: 0 | 2) => faceFasteners.filter(f => Math.abs(f.at[index] - at) < gap).map(f => f.at[along]);
  for (const s of [-1, 1]) {
    const x = s * (w / 2 + pm / 2);
    for (const z of clearOf(spaced(floor + 30, transomZ - 30, fastenersAlong(stileHeight - 60, COUPLING.screwPitch)), near(0, x, 2), gap, floor + 15, transomZ - 15)) {
      fasteners.push({ partId: frameScrew.id, component: 'frame-screws', at: [x, front, z], direction: [0, -1, 0], use: 'Docking frame stiles into the port jambs' });
    }
  }
  const headZ = transomZ + pm / 2;
  for (const x of clearOf(spaced(-w / 2 - pm / 2, w / 2 + pm / 2, fastenersAlong(w + pm, COUPLING.screwPitch)), near(2, headZ, 0), gap, -w / 2 - pm + 10, w / 2 + pm - 10)) {
    fasteners.push({ partId: frameScrew.id, component: 'frame-screws', at: [x, front, headZ], direction: [0, -1, 0], use: 'Docking frame head into the transom' });
  }
  if (fastenerClashes(fasteners, faceFasteners, gap).length > 0) errors.push(`A docking frame screw would come within ${gap} mm of a batten screw or staple in the port frame: change the window insert’s fixing spacing.`);
  if (latchPart) {
    const [m1, m2, m4, b4] = (['m1', 'm2', 'm4', 'b4'] as const).map(key => dimensionOf(latchPart, key)) as [number, number, number, number];
    for (const latch of latches) for (const k of [-1, 1]) {
      fasteners.push({ partId: latchScrew.id, component: 'latch-screws', at: [latch.faceX, latch.hingeY - m2, latch.z + k * m1 / 2], direction: [-latch.side, 0, 0], use: 'Latch bodies onto the first flange’s sides', of: latch.id });
      fasteners.push({ partId: latchScrew.id, component: 'catch-screws', at: [latch.faceX, latch.catchY + b4 / 2, latch.z + k * m4 / 2], direction: [-latch.side, 0, 0], use: 'Catch brackets onto the docking frame’s sides', of: latch.id });
    }
  } else {
    // through the plates' holes: their heads on the plates' fronts (the shared placement)
    for (const latch of latches) if (latch.printed) {
      const screws = printedLatchScrews(latch.printed.mount);
      for (const f of screws.base) fasteners.push({ partId: latchScrew.id, component: 'latch-screws', ...f, use: 'Latch base plates onto the first flange’s sides', of: latch.id });
      for (const f of screws.catch) fasteners.push({ partId: latchScrew.id, component: 'catch-screws', ...f, use: 'Catch plates onto the docking frame’s sides', of: latch.id });
    }
  }
  if (lip) for (const x of spaced(-w / 2 + 40, w / 2 - 40, 3)) {
    fasteners.push({ partId: part(HW.lipScrew).id, component: 'lip-screws', at: [x, flangeBack + T / 2, floor + COUPLING.lip.thickness], direction: [0, 0, -1], use: 'Floor lip onto the first flange’s sill' });
  }

  const first = tl.pieces[0]; const wallSupport = tl.supports.find(s => s.id === 'support-wall');
  if (!first || !wallSupport) errors.push('The tunnel has no first section on a wall support.');
  return {
    config, site, tunnel, insert, tl, first, wallSupport, w, h, floor, transomZ, meshFace, battenFace, front, thickness, flangeBack, flangeFront,
    frame, seal, lip, latches, latchPart, latchName, fasteners, errors, gap: joint.gap,
    /** GN 831: how far the joint may end up from its gap and still be closed by the latch's adjustable hook. Printed: how much
     * further apart than locked the plates may be when the link is hooked on, to be drawn in. */
    tolerance,
  };
}
export type CouplingLayout = ReturnType<typeof couplingLayout>;

export function validateCoupling(_variant: CatioMode, config: CouplingConfig, site?: CouplingSite): string[] {
  return couplingLayout(config, site).errors;
}

/** Stage 0 is the insert in its recess and the tunnel's levelled wall support; 1–2 at the insert, 3 on the first section, 4–5 the joint. */
export function couplingSteps(_variant: CatioMode, config: CouplingConfig): readonly AssemblyStep[] {
  const l = couplingLayout(config);
  const n = l.latches.length; const latch = l.latchName; const printed = !l.latchPart;
  const frameScrews = l.fasteners.filter(f => f.component === 'frame-screws').length;
  const close = printed ? '' : config.latchType === 'S' ? ' The safety catch clicks over the lever.' : config.latchType === 'SV' ? ' Hang a padlock through each eye if the tunnel should stay put.' : '';
  const catches = printed ? `Screw ${n === 2 ? 'a catch plate' : `${n} catch plates`} of the printed latch onto ${n === 2 ? 'each stile’s outer side' : 'the stiles’ outer sides'}, hook outwards, ${round1(PRINTED_LATCH.overhang)} mm proud of the frame’s face, two 4 × 25 screws each.`
    : `Screw ${n === 2 ? 'a catch bracket' : 'the catch brackets'} of the ${latch} onto ${n === 2 ? 'each stile’s outer side' : 'the stiles’ outer sides'}, two 4 × 25 screws each.`;
  const bodies = printed ? `screw ${n === 2 ? 'a base plate' : `${n} base plates`} of the printed latch, lever and link already snapped on, onto the first flange’s outer sides, ${round1(PRINTED_LATCH.overhang)} mm proud of its back, two 4 × 25 screws each.`
    : `screw ${n === 2 ? 'a latch body' : `${n} latch bodies`} onto the first flange’s outer sides, pivot end 2 mm in from its face, two 4 × 25 screws each.`;
  const draw = l.latchPart ? `the hook draws ${dimensionOf(l.latchPart, 'w1')} mm and holds ${l.latchPart.attributes['holdingForce'] ?? ''}`
    : `the link draws the joint in to its ${l.gap} mm gap, the plates ${round1(PRINTED_LATCH.locked)} mm apart, and the lever comes to rest on its base plate`;
  return [
    { title: 'The two sides as they are', detail: 'The window insert stands in its recess with its cat gate shut. The tunnel’s wall support is levelled to the window floor (the tunnel page, stage 2). Nothing joins the two yet.' },
    { title: 'Docking frame onto the insert', detail: `From outdoors, offer the two stiles to the port jambs${l.battenFace > l.meshFace ? ', their rebates over the cover battens,' : ''} and the head across them onto the transom. Drive ${frameScrews} countersunk 5 × 60 screws through the frame${l.battenFace > l.meshFace ? ' and battens' : ''} into the jambs and transom. The frame stays on the insert from now on, also when it is lifted out.` },
    { title: printed ? 'Seal and catch plates' : 'Seal and catch brackets', detail: `Stick the ${l.seal.profile} seal round the middle of the frame’s face, down both stiles and across the head. ${catches}` },
    { title: 'Latches on the first section', detail: `Where the first section was framed: ${bodies}${l.lip ? ' Screw the EPDM floor lip onto the flange’s sill so that it reaches 25 mm past the flange’s back.' : ''}` },
    { title: 'Lay the first section', detail: `Lower the first section onto its wall support, square to the port: its flange stands ${l.gap} mm off the docking frame and squashes the seal${l.lip ? '; the lip lies on the threshold' : ''}. Screw it down and couple the rest of the tunnel to it as the tunnel page describes. The wall support carries it; the insert carries nothing.` },
    { title: 'Dock: close the latches', detail: `Hook each latch over its catch and press the lever down until it snaps over centre: ${draw}.${close} Open the cat gate. To undock, lift ${n === 2 ? 'both levers' : `the ${n} levers`} and unhook: the insert can come out of its recess and the tunnel stays on its supports. No tools either way.` },
  ];
}

const round1 = (mm: number) => Number(mm.toFixed(1));

const partSize = (p: Part) => {
  const d = (key: string) => p.dimensions[key] ? `${key} ${p.dimensions[key].value}` : '';
  switch (p.family) {
    case 'wood-screw': return [d('d'), d('l'), d('dk')].filter(Boolean).join(' · ');
    case 'toggle-latch': return [`l ${p.dimensions['l1']?.value ?? ''} to ${(p.dimensions['l1']?.value ?? 0) + (p.dimensions['w2']?.value ?? 0)}`, d('b1'), d('h1'), `stroke ${p.dimensions['w1']?.value ?? ''}`].join(' · ');
    default: return '';
  }
};

/** The parts list: the docking frame's cut list, the latches and screws by library part, and the seal and lip. */
export function couplingBom(_variant: CatioMode, config: CouplingConfig, site?: CouplingSite): BomLine[] {
  const l = couplingLayout(config, site);
  const lines: BomLine[] = [];
  const section = `${Math.round(l.thickness)} × ${TUNNEL.flange.width}`;
  const stiles = l.frame.filter(m => m.id !== 'frame-head'); const head = l.frame.find(m => m.id === 'frame-head');
  if (stiles[0]) lines.push({ id: 'frame-stile', group: 'Timber', name: 'Docking frame stile', quantity: stiles.length, size: `${section} · ${stiles[0].cut}`, use: 'On each port jamb, from the threshold to the transom' });
  if (head) lines.push({ id: 'frame-head', group: 'Timber', name: 'Docking frame head', quantity: 1, size: `${section} · ${head.cut}`, use: 'Across the stiles, on the transom' });
  const each = config.latchesPerSide === 1 ? 'One' : 'Two';
  if (l.latchPart) lines.push({ id: l.latchPart.id, group: 'Hardware', name: l.latchPart.title, quantity: l.latches.length, size: `${l.latchPart.designation} · ${partSize(l.latchPart)}`, use: `${each} on each side of the joint: body on the flange, catch bracket on the docking frame`, partId: l.latchPart.id });
  else lines.push(printedLatchLine(l.latches.length, `${each} on each side of the joint: base plate on the flange, catch plate on the docking frame`));
  const counts = new Map<string, { quantity: number; uses: Set<string> }>();
  for (const f of l.fasteners) {
    const entry = counts.get(f.partId) ?? { quantity: 0, uses: new Set<string>() };
    entry.quantity++; entry.uses.add(f.use); counts.set(f.partId, entry);
  }
  for (const [partId, entry] of counts) {
    const p = part(partId);
    lines.push({ id: partId, group: 'Hardware', name: p.title, quantity: entry.quantity, size: `${p.designation} · ${partSize(p)}`, use: [...entry.uses].join('; '), partId });
  }
  lines.push({ id: 'seal', group: 'Hardware', name: l.seal.name, quantity: 1, size: `about ${l.seal.width} × ${l.seal.height}${l.latchPart ? ' hollow' : ''} · ${Math.ceil(l.seal.length / 10) * 10} long`, use: `Round the docking frame’s face; squashed to the ${l.gap} mm gap` });
  if (l.lip) lines.push({ id: 'floor-lip', group: 'Hardware', name: 'EPDM sheet floor lip (custom)', quantity: 1, size: `${COUPLING.lip.thickness} mm · ${Math.round(l.lip.x1 - l.lip.x0)} × ${Math.round(l.lip.y1 - l.lip.y0)}`, use: 'On the first flange’s sill, lying on the threshold over the floor gap' });
  return lines;
}

export function couplingFacts(_variant: CatioMode, config: CouplingConfig, site?: CouplingSite): SubassemblyFact[] {
  const l = couplingLayout(config, site);
  const cm = (mm: number) => `${Number((mm / 10).toFixed(1))}`;
  return [
    { label: 'Docking frame · outside', value: `${cm(l.w + 2 * TUNNEL.flange.width)} × ${cm(l.transomZ + TUNNEL.flange.width - l.floor)} cm, ${Math.round(l.thickness)} mm deep` },
    { label: 'Gap · seal', value: `${l.gap} mm · squashed from ${l.seal.height} mm` },
    l.latchPart ? { label: 'Latches · holding', value: `${l.latches.length} × ${l.latchPart.designation} · ${l.latchPart.attributes['holdingForce'] ?? ''} each` }
      : { label: 'Latches', value: `${l.latches.length} × printed toggle latch · locks over centre, plates ${round1(PRINTED_LATCH.locked)} mm apart` },
    l.latchPart ? { label: 'Hook takes up', value: `±${l.tolerance} mm of the gap` } : { label: 'Draws in', value: `up to ${round1(l.tolerance)} mm, hooked on with the joint that far open` },
    { label: 'Dock or undock', value: `${l.latches.length} levers, no tools` },
    { label: 'Cover battens at the port', value: l.battenFace > l.meshFace ? `Yes · frame rebated ${INSERT.batten.thickness} mm over them` : 'None · frame flat on the mesh', from: { page: 'window-insert', settings: ['meshFixing'] } },
  ];
}

export function couplingViews(_variant: CatioMode, config: CouplingConfig): Record<CatioView, CameraPreset> {
  const l = couplingLayout(config);
  const cz = l.floor + l.h / 2; const span = l.w + 2 * TUNNEL.flange.width;
  // far enough out to see the whole recess and the first section raised over its support
  const room = Math.max(l.site.window.openingWidth, l.site.window.openingHeight);
  const latch = l.latches.find(q => q.side > 0) ?? l.latches[0];
  const focus: V3 = latch ? [latch.faceX, (latch.catchY + latch.hingeY) / 2, latch.z] : [span / 2, 0, cz];
  return {
    Exterior: { position: [room * 1.3, room * 2, cz + room * 1.1], target: [0, 150, cz + 100] },
    Interior: { position: [room * 0.6, -room * 1.9, cz + room * 0.5], target: [0, -40, cz] },
    Front: { position: [0, span * 4.2, cz], target: [0, 0, cz] },
    Side: { position: [span * 3.2, 0, cz + 60], target: [0, 0, cz] },
    Top: { position: [0, 0, cz + span * 3.6], target: [0, 1, cz] },
    // from outdoors, beside the latch: the lever, the hook over the gap and the catch on the docking frame
    Mounting: { position: [focus[0] + 300, focus[1] + 260, focus[2] + 190], target: focus },
  };
}

export const COUPLING_CONTROLS: SubassemblyControl<CouplingConfig>[] = [
  { key: 'latch', label: 'Latches', group: 'Latches', help: `The printed toggle latch from the model library, which locks over centre at a fixed spacing: the frame comes to ${COUPLING.printed.gap} mm of the flange, with a thin seal. Or Ganter GN 831 steel latches from the parts library, with an adjustable hook and a rated hold, ${COUPLING.gap} mm off with a thicker seal.`,
    options: [{ value: 'printed', label: 'Printed toggle latch (model)' }, { value: 'gn-831', label: 'Ganter GN 831 (steel)' }] },
  { key: 'latchType', label: 'Latch', group: 'Latches', help: 'Ganter GN 831, short type. A safety catch stops a knocked lever springing open; the padlock eye lets the joint be locked.',
    options: [{ value: 'S', label: 'With safety catch (S)' }, { value: 'A', label: 'Plain lever (A)' }, { value: 'SV', label: 'With padlock eye (SV)' }], when: config => config.latch === 'gn-831' },
  { key: 'latchMaterial', label: 'Material', group: 'Latches', help: 'Stainless steel outdoors for good; zinc-plated steel is cheaper and rusts in time.',
    options: [{ value: 'NI', label: 'Stainless steel' }, { value: 'ST', label: 'Steel, zinc plated' }], when: config => config.latch === 'gn-831' },
  { key: 'latchesPerSide', label: 'Latches per side', group: 'Latches', help: 'One each side, at half height, holds the joint; two pull the seal on evenly over its whole height.',
    options: [{ value: 1, label: '1 (2 in all)' }, { value: 2, label: '2 (4 in all)' }] },
  { key: 'floorLip', label: 'Floor gap', group: 'Seal', help: `Between the threshold’s end and the flange there is a ${TUNNEL.wallGap} mm gap across the floor. A rubber lip bridges it; it only lies on the threshold.`,
    options: [{ value: 'rubber-lip', label: 'EPDM lip over it' }, { value: 'none', label: 'Left open' }] },
];

export const parseCoupling = (raw: unknown) => parseControlled(COUPLING_DEFAULT, COUPLING_CONTROLS, raw);

export const COUPLING_DECISIONS: DesignDecision[] = [
  { title: 'Toggle latches, not bolts', parameter: 'Latch',
    choice: 'Toggle latches, one on each side of the joint: the base on the tunnel’s first flange, the catch on the insert’s docking frame. By default the printed toggle latch (below); Ganter GN 831, size 100, short type, type S, stainless, remains selectable.',
    why: 'Docking and undocking are one movement per lever, without tools, and nothing comes loose to be lost in the grass. A GN 831 holds 1000 N, draws 5.5 mm as it closes, and its hook can be set over 8 mm (12 for types A and SV), which takes up how far the two sides end up from the design gap; the printed latch is cheaper and to hand, but has a fixed spacing and no rated hold. Rejected: M8 bolts like the section couplings (a spanner and six nuts every time); wing nuts or star knobs on studs (many turns, loose parts, not in the library); drop pins through lugs (loose pins, and slack); a sleeve or spigot into the port (it narrows the cat’s passage or rests on the threshold, so the insert would carry the tunnel); magnets (a cat can push them apart).' },
  { title: 'The insert carries nothing', parameter: 'Latches per side',
    choice: 'The tunnel’s wall support carries the first flange, as on the tunnel page. The joint touches the insert only through the soft seal and the latches, which pull along the tunnel; the docking frame has no sill, and nothing of the tunnel rests on the threshold except the rubber lip.',
    why: 'The insert is held in its recess only by pressure, so it must not take the tunnel’s weight. Locating pins or a spigot would hand that weight to it as soon as the support settled, so there are none: the support’s levelling feet set the height. If a latch has to lift or push the flange to close, re-level the wall support, not the latch.' },
  { title: 'A docking frame on the insert', from: { page: 'window-insert', settings: ['meshFixing', 'fixingPitch'] },
    choice: `Two ${PRINTED_FRAME_DEPTH} × ${TUNNEL.flange.width} stiles (${FRAME_DEPTH} × ${TUNNEL.flange.width} with GN 831 latches) on the port jambs and a head on the transom, screwed through into them with DIN 7997 5 × ${FRAME_SCREW_LENGTH} screws, rebated ${INSERT.batten.thickness} mm over the cover battens where the insert has them. Its face is the flange’s outline above the floor, ${COUPLING.printed.gap} mm short of the flange (${COUPLING.gap} mm with GN 831 latches). The screws sit between the insert’s batten screws and staples, at least ${COUPLING.screwClearance} mm from each. Whether there are battens, and where their screws are, is set by the window insert’s mesh fixing: with staples only the frame sits flat on the mesh, unrebated. When the insert hangs on the window frame, its port frame lies 27.5 mm deeper in the recess: the frame is that much thicker and takes DIN 7997 6 × 90 screws.`,
    why: `The port frame’s face lies ${PORT_FACE_DEPTH} mm inside the recess and is broken up by battens, while the flange stands ${TUNNEL.wallGap} mm off the wall: the frame brings a flat, matching face to the joint, and gives the catch brackets a side in line with the flange’s side. ${PRINTED_FRAME_DEPTH} mm is the depth from the mesh to the gap (${FRAME_DEPTH} mm with GN 831 latches), so the screws reach ${FRAME_SCREW_LENGTH - PRINTED_FRAME_DEPTH - INSERT.mesh.wire} mm into the jambs (${FRAME_SCREW_LENGTH - FRAME_DEPTH - INSERT.mesh.wire} mm) whichever mesh fixing the insert has. A screw on a batten screw’s centre line would run into its hole or split the 40 mm jamb, so they are moved clear. It stays on the insert when the insert is lifted out.` },
  { title: 'A squashed seal and a floor lip', parameter: 'Floor gap',
    choice: `A self-adhesive EPDM E-profile (${COUPLING.printed.seal.width} × ${COUPLING.printed.seal.height}, made for 2–3.5 mm gaps) round the frame’s face, squashed to the printed latches’ ${COUPLING.printed.gap} mm gap; with GN 831 latches, a hollow EPDM D-profile about ${COUPLING.seal.height} mm high, squashed to their ${COUPLING.gap} mm gap; a ${COUPLING.lip.thickness} mm EPDM lip screwed to the flange’s sill, lying ${COUPLING.lip.overlap} mm onto the threshold.`,
    why: 'The old foam strip pressed against the wall round the flange, but the flange stands in front of the open recess, where there is no wall: the seal now sits between two faces that are there. A hollow or slotted profile squashes with little force, so the latches need not pull hard and the insert is not dragged out of its recess. The lip closes the floor gap to claws and draughts and bends out of the way when the joint opens.' },
  { title: 'The printed toggle latch', parameter: 'Latches',
    choice: `The toggle latch from the model library, printed: base plate on the flange’s side, catch plate on the frame’s, lever and link snapped on. It has no adjustable hook and is short (${PRINTED_LATCH.along * 2 + round1(PRINTED_LATCH.locked)} mm over both plates, locked), so the frame comes to ${COUPLING.printed.gap} mm of the flange, with the thin E-profile seal; each plate stands ${round1(PRINTED_LATCH.overhang)} mm proud of its face into the gap. DIN 7997 4 × 25 screws, the model’s default.`,
    why: `Locked, its plates stand ${round1(PRINTED_LATCH.locked)} mm apart (its over-centre lock, from the model’s own geometry), so a gap of ${COUPLING.gap} mm would leave its screws next to the timber’s edges. At ${COUPLING.printed.gap} mm they sit ${round1(TG.base.holeZ - PRINTED_LATCH.overhang)} mm in from the frame’s face and the flange’s back: pre-drill them. Hooked on with the joint up to ${round1(PRINTED_LATCH.hooked - PRINTED_LATCH.locked)} mm further open, the lever draws it in. It is printed, with no safety catch or padlock eye, and its holding force is not rated: choose the GN 831 for a joint that must hold, or one that must be locked.` },
  { title: 'With GN 831 latches, the short type, because of the depth',
    choice: 'GN 831 identification no. 2: 54 mm closed (61 mm for type S), set at the middle of its hook’s range.',
    why: `From the flange’s face to the back of the docking frame the joint is ${JOINT_DEPTH} mm deep. The long type is 67 mm closed (74 for type S) before its hook is set at all, so its catch bracket would hang off the back of the frame; the short one sits on the frame with its hook at the middle of its range, and the page checks it.` },
];
