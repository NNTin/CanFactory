import { dimensionOf, findPart, TUNNEL_HARDWARE as HW, toggleLatchMechanism as TL, type Part } from '@canfactory/contracts';
import type { CatioView } from './catioDesign.ts';
import { E_PROFILE_SEAL, PRINTED_LATCH, PRINTED_LATCH_JOINT, printedLatchLine } from './catioPrintedLatch.ts';
import type { CatioMode } from './catioSettings.ts';
import { loadSubassemblyConfig, type AssemblyStep, type BomLine, type CameraPreset, type DesignDecision, type SubassemblyFact, type V3 } from './catioSubassembly.ts';
import { LATCH_SCREW_EDGE, parseTunnel, TUNNEL, TUNNEL_DEFAULT, tunnelCutList, tunnelLayout, tunnelSite, vec, type TunnelConfig, type TunnelSite } from './catioTunnel.ts';
import { couplingGap, parseTunnelCoupling, TUNNEL_COUPLING_CONTROLS, TUNNEL_COUPLING_DEFAULT, type TunnelCouplingConfig } from './catioTunnelJoint.ts';

export { parseTunnelCoupling, TUNNEL_COUPLING_CONTROLS, TUNNEL_COUPLING_DEFAULT, type TunnelCouplingConfig };

/**
 * The tunnel–tunnel coupling: how two of the tunnel's sections are joined, flange to flange. Millimetres; X across the tunnel, +Y
 * along it (out from the wall), Z up, the grass at the wall Z=0, as on the tunnel page.
 *
 * The page owns the mechanism; the tunnel page follows it at every section and collar coupling. It shows one coupling of a straight,
 * level tunnel built by the tunnel's own layout (`tunnelLayout`), so the sections, the support under the joint, its feet and the
 * latches or bolts are exactly the tunnel's: two identical sections of the tunnel page's longest length, on the support between
 * them, at a fixed height above the grass (the joint is the same wherever it is on the route).
 */
export const TUNNEL_COUPLING = {
  /** The sections' floor above the grass at the wall: a typical height on the route, high enough for a support on legs. */
  floor: 450,
} as const;

/** The tunnel as saved on its page (or its defaults), and the catio's window and tunnel sizes. */
export interface TunnelCouplingSite { tunnel: TunnelConfig; site: TunnelSite }
export function tunnelCouplingSite(): TunnelCouplingSite {
  return { tunnel: loadSubassemblyConfig('tunnel', parseTunnel, TUNNEL_DEFAULT), site: tunnelSite() };
}

/**
 * A straight, level tunnel out from the wall of three sections of the tunnel page's longest length, the gaps between them as the
 * coupling sets them: the page shows its first coupling. (A route has at least three straight runs; each of these is one section.)
 */
export function straightTunnel(tunnel: TunnelConfig, config: TunnelCouplingConfig): TunnelConfig {
  const L = tunnel.sectionLength; const g = couplingGap(config);
  return { ...tunnel, portX: 0, portY: TUNNEL.wallGap + 3 * L + 2 * g, portFacing: 0, portLevel: 'window', approach: L, final: L + g, slopeLeg: 'middle', angleJoint: 'angle-collar' };
}

function part(id: string): Part {
  const found = findPart(id); if (!found) throw new Error(`The parts library has no ${id}.`); return found;
}

/** The coupling, placed: the two sections either side of it, the support under it, and its latches or bolts. */
export function tunnelCouplingLayout(config: TunnelCouplingConfig, { tunnel, site }: TunnelCouplingSite = tunnelCouplingSite()) {
  const straight = straightTunnel(tunnel, config);
  const tl = tunnelLayout(straight, { ...site, floorZ: TUNNEL_COUPLING.floor }, config);
  const errors = [...tl.errors];
  const coupling = tl.couplings.find(c => c.id === 'coupling-1');
  const before = tl.pieces.find(p => p.id === coupling?.before); const after = tl.pieces.find(p => p.id === coupling?.after);
  const support = tl.supports.find(s => s.id === 'support-coupling-1');
  if (!coupling || !before || !after || !support) throw new Error('The straight tunnel has no first coupling on a support.');
  const pieces = [before.id, after.id];
  const latchScrews = tl.fasteners.filter(f => (f.component === 'latch-screws' || f.component === 'catch-screws') && coupling.latches.some(q => q.id === f.of));
  const fixings = tl.fasteners.filter(f => f.component === 'flange-screws' && support.fixings.some(q => Math.hypot(q[0] - f.at[0], q[1] - f.at[1]) < 1e-6));
  return {
    config, tunnel, site, tl, straight, coupling, before, after, pieces, support, latchScrews, fixings, errors,
    gap: coupling.gap, latches: coupling.latches, bolts: coupling.bolts, seal: coupling.seal,
    w: tl.w, h: tl.h, floor: TUNNEL_COUPLING.floor, sectionLength: before.length,
  };
}
export type TunnelCouplingLayout = ReturnType<typeof tunnelCouplingLayout>;

export function validateTunnelCoupling(_variant: CatioMode, config: TunnelCouplingConfig, site?: TunnelCouplingSite): string[] {
  return tunnelCouplingLayout(config, site).errors;
}

const round1 = (mm: number) => Number(mm.toFixed(1));
const cm = (mm: number) => `${Number((mm / 10).toFixed(1))}`;

/** Stage 0 is one support on the grass; 1 a section built and laid; 2 its joint readied; 3 the second section comes in; 4 coupled; 5 fixed down. */
export function tunnelCouplingSteps(_variant: CatioMode, config: TunnelCouplingConfig, site?: TunnelCouplingSite): readonly AssemblyStep[] {
  const l = tunnelCouplingLayout(config, site);
  const printed = l.coupling.kind === 'latched'; const n = l.latches.length; const bolts = l.bolts.length;
  const length = `${cm(l.sectionLength)} cm`;
  return [
    { title: 'The site', detail: `Grass, and the support that will carry the joint: a bearer ${l.support.kind === 'trestle' ? 'on two legs' : 'ripped to depth'}, on ${l.tl.pad ? 'printed feet' : 'levelling feet'} on paving slabs, levelled to its line (the tunnel page, stages 1–2). No tunnel yet.` },
    { title: 'Build one section', detail: `Stand two flange rings, screw the four rails between them and the floor board onto the bottom rails, then staple the side and roof mesh on (the tunnel page, stages 3–4). Lay the section, ${length} long, on its supports so that its outgoing flange sits over the bearer.` },
    { title: 'Ready its joint', detail: printed
      ? `${l.seal ? 'Stick the EPDM E-profile seal round the middle of the outgoing flange’s face. ' : ''}Screw ${n / 2} base ${n / 2 === 1 ? 'plate' : 'plates'} of the printed toggle latch, lever and link already snapped on, onto each of the flange’s outer sides, ${round1(PRINTED_LATCH.overhang)} mm proud of its face, two 4 × 25 screws each (pre-drill them).`
      : `Nothing to fit yet: the bolts go through both flanges once the next section is down. Have ${bolts} M8 × 80 bolts, ${2 * bolts} large washers and ${bolts} nuts to hand.` },
    { title: 'The second section comes in', detail: `An identical section, also ${length} long${printed ? `, with the latches’ catch plates already screwed onto its incoming flange’s sides` : ''}, comes in along the tunnel’s axis from beyond the first, onto the same bearer, and stops ${printed ? `${l.gap} mm short of the first one’s flange, on the seal` : 'flange to flange against the first'}. The bearer, not the joint, sets where it lies.` },
    { title: 'Couple', detail: printed
      ? `Hook each latch’s link over its catch and press the lever down until it snaps over centre: the link draws the flanges in to the ${l.gap} mm gap${l.seal ? ', squashing the seal' : ''}, the plates ${round1(PRINTED_LATCH.locked)} mm apart. ${n} levers, no tools. To part the sections, lift the levers and unhook.`
      : `Push ${bolts} M8 × 80 bolts through both flanges with a large washer under each head, then run a large washer and a nut on from the far side and tighten them with a 13 mm spanner.` },
    { title: 'Fix down', detail: `Screw up through the bearer into both flanges: ${l.fixings.length} countersunk 6 × 100 screws, two into each flange. The joint is done; the next section couples on the same way.` },
  ];
}

const partSize = (p: Part) => {
  const d = (key: string) => p.dimensions[key] ? `${key} ${p.dimensions[key].value}` : '';
  switch (p.family) {
    case 'wood-screw': return [d('d'), d('l'), d('dk')].filter(Boolean).join(' · ');
    case 'screw': return [d('d'), d('l'), `A/F ${p.dimensions['s']?.value ?? ''}`].join(' · ');
    case 'washer': return [d('d1'), d('d2'), d('h')].filter(Boolean).join(' · ');
    case 'nut': return [d('s'), d('m')].join(' · ');
    default: return '';
  }
};

/** The parts list: the two sections' cut list and mesh (from the tunnel's), then the coupling's latches and seal, or its bolts. */
export function tunnelCouplingBom(_variant: CatioMode, config: TunnelCouplingConfig, site?: TunnelCouplingSite): BomLine[] {
  const l = tunnelCouplingLayout(config, site);
  const lines = tunnelCutList(l.tl, { pieces: l.pieces, supports: false });
  const library = (id: string, quantity: number, use: string) => { const p = part(id); lines.push({ id, group: 'Hardware', name: p.title, quantity, size: `${p.designation} · ${partSize(p)}`, use, partId: id }); };
  const each = ['', 'One', 'Two', 'Three'][config.latchesPerSide] ?? String(config.latchesPerSide);
  if (l.coupling.kind === 'latched') {
    lines.push(printedLatchLine(l.latches.length, `${each} on each side of the joint: base plate on the first section’s flange, catch plate on the second’s`));
    library(HW.latchScrew, l.latchScrews.length, 'Two through each latch plate, into the flanges’ sides');
    if (l.seal) lines.push({ id: 'coupling-seal', group: 'Hardware', name: E_PROFILE_SEAL, quantity: 1, size: `about ${PRINTED_LATCH_JOINT.seal.width} × ${PRINTED_LATCH_JOINT.seal.height} · ${Math.ceil(l.seal.length / 10) * 10} long`, use: `Round the middle of the flange’s face; squashed to the ${l.gap} mm gap` });
  } else {
    library(HW.couplingBolt, l.bolts.length, 'Through both flanges');
    library(HW.couplingWasher, 2 * l.bolts.length, 'Under every bolt head and nut');
    library(HW.couplingNut, l.bolts.length, 'On every bolt');
  }
  return lines;
}

export function tunnelCouplingFacts(_variant: CatioMode, config: TunnelCouplingConfig, site?: TunnelCouplingSite): SubassemblyFact[] {
  const l = tunnelCouplingLayout(config, site);
  const printed = l.coupling.kind === 'latched';
  return [
    { label: 'Coupling', value: printed ? 'Printed toggle latch · locks over centre, no tools' : 'M8 bolts through both flanges · a 13 mm spanner' },
    { label: 'Gap · seal', value: printed ? `${l.gap} mm · ${l.seal ? `squashed from ${PRINTED_LATCH_JOINT.seal.height} mm` : 'left open'}` : 'None · flange to flange' },
    printed ? { label: 'Latches per coupling', value: `${l.latches.length} · ${config.latchesPerSide} each side, plates ${round1(PRINTED_LATCH.locked)} mm apart locked` }
      : { label: 'Bolts per coupling', value: `${l.bolts.length} × ISO 4017 M8 × 80 · two large washers and a nut each` },
    { label: 'Enclosure end · mitred joints', value: `Bolted, ${config.boltsPerCoupling} per coupling` },
    { label: 'Section length', value: `${cm(l.sectionLength)} cm · the longest section`, from: { page: 'tunnel', settings: ['sectionLength'] } },
  ];
}

export function tunnelCouplingViews(_variant: CatioMode, config: TunnelCouplingConfig): Record<CatioView, CameraPreset> {
  const l = tunnelCouplingLayout(config);
  const joint = l.coupling.face.at; const cz = joint[2] + l.h / 2; const L = l.sectionLength; const span = l.w + 2 * TUNNEL.flange.width;
  const latch = l.latches.find(q => q.side > 0);
  const focus: V3 = latch ? latch.at : [span / 2, joint[1], cz];
  return {
    Exterior: { position: [L * 1.5, joint[1] - L * 0.9, cz + L * 1.1], target: [0, joint[1], cz - 80] },
    Interior: { position: [0, joint[1] - L * 1.7, cz + l.h * 0.4], target: [0, joint[1], cz] },
    Front: { position: [0, joint[1] + L * 2.6, cz], target: [0, joint[1], cz] },
    Side: { position: [L * 2.4, joint[1], cz + 60], target: [0, joint[1], cz - 60] },
    Top: { position: [0, joint[1], cz + L * 2.4], target: [0, joint[1] + 1, cz] },
    // beside the joint, outside the right-hand flanges: the latch (or the bolts) across the gap
    Mounting: { position: [focus[0] + 300, focus[1] - 200, focus[2] + 160], target: focus },
  };
}

const TG = TL.TOGGLE_LATCH_GEOMETRY; const T = TUNNEL.flange.thickness;
const BOLT_LENGTH = dimensionOf(part(HW.couplingBolt), 'l');

/** The design calls, built from the sizes they quote. */
export const TUNNEL_COUPLING_DECISIONS: DesignDecision[] = [
  { title: 'Toggle latches by default, bolts optional', parameter: 'Coupling',
    choice: `The printed toggle latch (the toggle-latch model), ${TUNNEL_COUPLING_DEFAULT.latchesPerSide} on each side of every coupling: the base plate, lever and link snapped on, on one flange’s outer side, its catch plate on the other’s, in line, pulling along the tunnel. Bolted flanges remain selectable: ${TUNNEL_COUPLING_DEFAULT.boltsPerCoupling} ISO 4017 M8 × ${BOLT_LENGTH} bolts per coupling, with ISO 7093 large washers and ISO 4032 nuts.`,
    why: `A latch closes by hand in one movement and opens the same way, so the tunnel comes apart without tools and nothing loose is dropped in the grass. Bolts need a 13 mm spanner and ${TUNNEL_COUPLING_DEFAULT.boltsPerCoupling} nuts at every coupling, every time, but they are rated parts from the library: the printed latch’s hold is not rated, which is why there are two each side by default. Choose bolts for a tunnel that stays put, or one a cat must not be able to work loose.` },
  { title: 'A sealed gap for the over-centre lock', parameter: 'Seal',
    choice: `With latches, the flanges stand ${PRINTED_LATCH_JOINT.gap} mm apart with a self-adhesive EPDM E-profile (${PRINTED_LATCH_JOINT.seal.width} × ${PRINTED_LATCH_JOINT.seal.height}, for 2–3.5 mm gaps) round the flange’s face; each plate stands ${round1(PRINTED_LATCH.overhang)} mm proud of its flange into the gap. Bolted flanges meet face to face.`,
    why: `The latch locks over centre: its plates come closest at the dead centre and ease back to ${round1(PRINTED_LATCH.locked)} mm apart where it locks, so the joint must give a little as the lever goes over. Two rigid timber faces flush give nothing; the seal does, and closes the gap to draughts and claws. Each run of the tunnel holds its sections and these gaps, so the route still ends exactly at the enclosure port. The plates’ screws sit ${round1(TG.base.holeZ - PRINTED_LATCH.overhang)} mm inside the ${T} mm flanges (at least ${LATCH_SCREW_EDGE} mm is checked): pre-drill them.` },
  { title: 'No locating pins: the bearer locates', parameter: 'Latches per side',
    choice: 'Nothing on the joint locates one section on the other. Both flanges rest on the same support’s bearer, which is screwed up into each of them.',
    why: 'The support is levelled to its line before the sections are laid, so the bearer already sets both sections’ height and line. Pins or a spigot would fight it wherever the support settled, and would have to line up before the latches could close. If a latch has to lift or push a flange to close, re-level the support, not the latch.' },
  { title: 'Latches only where the flanges are square', parameter: 'Coupling', from: { page: 'tunnel', settings: ['angleJoint'] },
    choice: 'Every section-to-section coupling and every coupling to an angle collar is latched; a mitred joint stays bolted.',
    why: 'A latch needs its two plates in line on two side faces in one plane, pulling along the joint. Angle collars keep every coupling square, so they latch like straight ones. A mitre’s two flanges are cut on the bisector, so their side faces do not line up for a straight latch.' },
  { title: 'The enclosure end stays bolted', parameter: 'Bolts per coupling',
    choice: `The tunnel’s last flange always bolts to the enclosure’s port flange, with this page’s bolts per coupling (${TUNNEL_COUPLING_DEFAULT.boltsPerCoupling} by default), face to face.`,
    why: 'The enclosure’s 30 mm port flange with the same bolt pattern is the one requirement the tunnel places on the enclosure: a fixed interface that does not change with the couplings between sections. The window end is not bolted either way: it is the insert–tunnel coupling page’s docking frame and latches.' },
];

/** The cross-page settings of the tunnel this page is built from: its sections’ length and the support’s feet and ground. */
export const TUNNEL_SETTINGS_FOLLOWED = ['sectionLength', 'footPad', 'padHeight', 'padSurface', 'footDiameter', 'groundFall', 'groundTolerance'];

/** Where the second section waits before it comes in, beyond the first, along the tunnel. */
export const ENTRY = (l: TunnelCouplingLayout): V3 => vec.mul(l.coupling.face.n, 1.4 * l.sectionLength);
