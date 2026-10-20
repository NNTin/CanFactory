import { dimensionOf, findPart, TUNNEL_HARDWARE as HW, toggleLatchMechanism as TL, type Part } from '@canfactory/contracts';
import type { CatioView } from './catioDesign.ts';
import { doorBom, doorLibraryParts } from './catioDoor.ts';
import { DOOR_FIXING_LABELS, sidePortOffset, STANDARD_PORT } from './catioPort.ts';
import { E_PROFILE_SEAL, PRINTED_LATCH, PRINTED_LATCH_JOINT, printedLatchLine } from './catioPrintedLatch.ts';
import type { CatioMode } from './catioDesign.ts';
import type { AssemblyStep, BomLine, CameraPreset, DesignDecision, SubassemblyFact, V3 } from './catioSubassembly.ts';
import { LATCH_SCREW_EDGE, tunnelPitch, SUPPORT_FIXING_LABELS, supportFixingSteps, TUNNEL, tunnelCutList, tunnelLayout, vec, type Piece, type TunnelConfig, type TunnelSite } from './catioTunnel.ts';
import { couplingGap, parseTunnelCoupling, TUNNEL_COUPLING_CONTROLS, TUNNEL_COUPLING_DEFAULT, type TunnelCouplingConfig } from './catioTunnelJoint.ts';

export { parseTunnelCoupling, TUNNEL_COUPLING_CONTROLS, TUNNEL_COUPLING_DEFAULT, type TunnelCouplingConfig };

/**
 * The tunnel–tunnel coupling: how two of the tunnel's sections are joined, flange to flange. Millimetres; X across the tunnel, +Y
 * along it (out from the wall), Z up, the grass at the wall Z=0, as on the tunnel page.
 *
 * The mechanism is the project's: every tunnel is coupled so at every section and collar. The view shows one coupling of a straight,
 * level tunnel built by the tunnel's own layout (`tunnelLayout`), so the sections, the support under the joint, its feet and the
 * latches or bolts are exactly the tunnel's: two identical sections of the tunnel page's longest length, on the support between
 * them, at a fixed height above the grass (the joint is the same wherever it is on the route).
 */
export const TUNNEL_COUPLING = {
  /** The sections' floor above the grass at the wall: a typical height on the route, high enough for a support on legs. */
  floor: 450,
} as const;

/** The tunnel as its page sets it, and the catio's window and tunnel sizes. */
export interface TunnelCouplingSite { tunnel: TunnelConfig; site: TunnelSite }

/**
 * The tunnel the page shows its first coupling of, the gaps as the coupling sets them, each run one section of the tunnel page's
 * longest length: straight and level out from the wall in three runs (a section's end to the next one's), or out from the wall and
 * turning 90° to the right at a side port (a section's end to the side port of the section after it).
 */
export function straightTunnel(tunnel: TunnelConfig, config: TunnelCouplingConfig, site: Pick<TunnelSite, 'w'>): TunnelConfig {
  const run = tunnel.sectionLength * tunnelPitch(site, config) - couplingGap(config);
  if (config.jointShown === 'end-side') {
    const lateral = site.w / 2 + TUNNEL.flange.width;
    return { ...tunnel, portX: run - sidePortOffset(site.w), portY: TUNNEL.wallGap + run + lateral + couplingGap(config), portFacing: 90, portLevel: 'window', slopeLeg: 'middle', angleJoint: 'side-port' };
  }
  const length = run + couplingGap(config);
  return { ...tunnel, portX: 0, portY: TUNNEL.wallGap + 3 * length, portFacing: 0, portLevel: 'window', approach: length, final: length, slopeLeg: 'middle', angleJoint: 'angle-collar' };
}

function part(id: string): Part {
  const found = findPart(id); if (!found) throw new Error(`The parts library has no ${id}.`); return found;
}

/** The coupling, placed: the two sections either side of it, the support under it, and its latches or bolts. */
export function tunnelCouplingLayout(config: TunnelCouplingConfig, { tunnel: saved, site }: TunnelCouplingSite) {
  // how the tunnel is held on its supports: the project's one setting, which the tunnel's view edits too
  const tunnel: TunnelConfig = { ...saved, supportFixing: config.supportFixing, supportBase: config.supportBase };
  const straight = straightTunnel(tunnel, config, site);
  const tl = tunnelLayout(straight, { ...site, floorZ: TUNNEL_COUPLING.floor }, config);
  // the tunnel's checks, but only this support's for how it is held (the straight tunnel's other supports are not shown)
  const errors = tl.errors.filter(e => !/a trestle cannot stand on its own/.test(e));
  const coupling = tl.couplings.find(c => c.id === 'coupling-1');
  const before = tl.pieces.find(p => p.id === coupling?.before); const after = tl.pieces.find(p => p.id === coupling?.after);
  const support = tl.supports.find(s => s.id === 'support-coupling-1');
  if (!coupling || !before || !after || !support) throw new Error('The straight tunnel has no first coupling on a support.');
  if (!support.hold.attached && tunnel.supportBase === 'trestle') errors.push(`${tunnel.supportFixing === 'gravity' ? 'With gravity only nothing holds' : 'Nothing holds'} the support to the tunnel, and a trestle cannot stand on its own along the tunnel: choose self-standing supports, or another fixing.`);
  const pieces = [before.id, after.id];
  const latchScrews = tl.fasteners.filter(f => (f.component === 'latch-screws' || f.component === 'catch-screws') && coupling.latches.some(q => q.id === f.of));
  // how the joint is held on its support (the tunnel page's `supportFixing`): the screws up through the bearer, when it is screwed
  const fixings = tl.fasteners.filter(f => f.component === 'flange-screws' && f.support === support.id);
  return {
    config, tunnel, site, tl, straight, coupling, before, after, pieces, support, latchScrews, fixings, errors,
    gap: coupling.gap, latches: coupling.latches, bolts: coupling.bolts, seal: coupling.seal,
    w: tl.w, h: tl.h, floor: TUNNEL_COUPLING.floor, sectionLength: before.length,
    /** What the two elements are, in words: a section, and a section or one with a side port. */
    first: elementName(before), second: elementName(after), side: after.sidePort !== null,
  };
}
export type TunnelCouplingLayout = ReturnType<typeof tunnelCouplingLayout>;

export function validateTunnelCoupling(_variant: CatioMode, config: TunnelCouplingConfig, site: TunnelCouplingSite): string[] {
  return tunnelCouplingLayout(config, site).errors;
}

/** A tunnel element in words. */
export const elementName = (piece: Pick<Piece, 'sidePort'>) => piece.sidePort ? 'section with a side port' : 'section';
const round1 = (mm: number) => Number(mm.toFixed(1));
const cm = (mm: number) => `${Number((mm / 10).toFixed(1))}`;

/** Stage 0 is one support on the grass; 1 a section built and laid; 2 its joint readied; 3 the second section comes in; 4 coupled; 5 fixed down. */
export function tunnelCouplingSteps(_variant: CatioMode, config: TunnelCouplingConfig, site: TunnelCouplingSite): readonly AssemblyStep[] {
  const l = tunnelCouplingLayout(config, site);
  const printed = l.coupling.kind === 'latched'; const n = l.latches.length; const bolts = l.bolts.length;
  const length = `${cm(l.sectionLength)} cm`;
  const fixing = supportFixingSteps(l.tl, 'one');
  return [
    { title: 'The site', detail: `Grass, and the support that will carry the joint: a bearer ${l.support.kind === 'trestle' ? 'on two legs' : 'ripped to depth'}${l.support.soles.length ? ' on soles along the tunnel' : ''}, on ${l.tl.pad ? 'printed feet' : 'levelling feet'} on paving slabs, levelled to its line (the tunnel page, stages 1–2). ${fixing.support ? `${fixing.support} ` : ''}No tunnel yet.` },
    { title: `Build one ${l.first}`, detail: `Stand two flange rings, screw the four rails between them and the floor board onto the bottom rails, then ${l.tl.mesh.soft ? 'lay the net over it as one hood and staple it, a staple over every mesh of its cut edges' : 'staple the side and roof mesh on'} (the tunnel page, stages 3–4).${fixing.pieces ? ` ${fixing.pieces}` : ''} Lay the ${l.first}, ${length} long, on its supports${fixing.lay} so that its outgoing flange sits over the bearer.` },
    { title: 'Ready its joint', detail: printed
      ? `${l.seal ? `Stick the EPDM E-profile seal round the middle of the outgoing flange’s face${l.side ? ' (or the side port’s)' : ''}. ` : ''}A standard port carries its latches’ base plates on its left and their catch plates on its right, seen from outside it. Screw ${n / 2} base ${n / 2 === 1 ? 'plate' : 'plates'} of the printed toggle latch, lever and link already snapped on, onto the outgoing flange’s right side and ${n / 2} catch ${n / 2 === 1 ? 'plate' : 'plates'} onto its left, ${round1(PRINTED_LATCH.overhang)} mm proud of its face, two 4 × 25 screws each (pre-drill them).`
      : `Nothing to fit yet: the bolts go through both flanges once the next section is down. Have ${bolts} M8 × 80 bolts, ${2 * bolts} large washers and ${bolts} nuts to hand.` },
    { title: `The second ${l.second} comes in`, detail: `${l.side ? `A section, ${cm(l.after.length)} cm long, its end bay’s side door taken out: the opening, framed like an end, the middle of it ${cm(sidePortOffset(l.w))} cm from its start, the section’s start shut by a door. It lies square across the first, the opening facing the first one’s end frame` : l.first === l.second ? `An identical ${l.second}, also ${length} long` : `A ${l.second}, ${cm(l.after.length)} cm long: its port the same as the ${l.first}’s`}${printed ? `, with the other halves of the latches already screwed onto ${l.side ? 'the side port’s' : 'its incoming flange’s'} sides: base plates on its left, catch plates on its right, seen from outside it` : ''}, comes in along the first one’s axis from beyond it, onto the same bearer${fixing.lay ? ` (lifted over the dowels and set down${fixing.lay})` : ''}, and stops ${printed ? `${l.gap} mm short of the first one’s flange, on the seal` : 'flange to flange against the first'}. The bearer, not the joint, sets where it lies.` },
    { title: 'Couple', detail: printed
      ? `Hook each latch’s link over its catch and press the lever down until it snaps over centre: the link draws the flanges in to the ${l.gap} mm gap${l.seal ? ', squashing the seal' : ''}, the plates ${round1(PRINTED_LATCH.locked)} mm apart. ${n} levers, no tools. To part the sections, lift the levers and unhook.`
      : `Push ${bolts} M8 × 80 bolts through both flanges with a large washer under each head, then run a large washer and a nut on from the far side and tighten them with a 13 mm spanner.` },
    { title: 'Hold it on the support', detail: `${fixing.hold} The joint is done; the next section couples on the same way.` },
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
export function tunnelCouplingBom(_variant: CatioMode, config: TunnelCouplingConfig, site: TunnelCouplingSite): BomLine[] {
  const l = tunnelCouplingLayout(config, site);
  const lines = tunnelCutList(l.tl, { pieces: l.pieces, supports: false });
  const library = (id: string, quantity: number, use: string) => {
    const same = lines.find(line => line.partId === id);
    if (same) { same.quantity += quantity; if (!same.use.includes(use)) same.use = `${same.use}; ${use}`; return; }
    const p = part(id); lines.push({ id, group: 'Hardware', name: p.title, quantity, size: `${p.designation} · ${partSize(p)}`, use, partId: id });
  };
  const each = ['', 'One', 'Two', 'Three'][config.latchesPerSide] ?? String(config.latchesPerSide);
  // the stub's end door behind a side port: its latches, or its turn buttons, and their screws
  const doors = l.tl.doors.filter(d => l.pieces.includes(d.piece));
  const doorLatches = doors.flatMap(d => d.latches);
  const doorLatchScrews = l.tl.fasteners.filter(f => (f.component === 'latch-screws' || f.component === 'catch-screws') && doorLatches.some(q => q.id === f.of));
  const latchCount = (l.coupling.kind === 'latched' ? l.latches.length : 0) + doorLatches.length;
  if (latchCount) lines.push(printedLatchLine(latchCount, [
    l.coupling.kind === 'latched' ? `${each} on each side of the joint` : '', doorLatches.length ? `${each.toLowerCase()} on each side of the stub’s end door` : '',
  ].filter(Boolean).join(', and ') + ': seen from outside each port, its base plates on its left, its catch plates on its right'));
  if (l.coupling.kind === 'latched') {
    library(HW.latchScrew, l.latchScrews.length, 'Two through each latch plate, into the flanges’ sides');
    if (l.seal) lines.push({ id: 'coupling-seal', group: 'Hardware', name: E_PROFILE_SEAL, quantity: 1, size: `about ${PRINTED_LATCH_JOINT.seal.width} × ${PRINTED_LATCH_JOINT.seal.height} · ${Math.ceil(l.seal.length / 10) * 10} long`, use: `Round the middle of the flange’s face; squashed to the ${l.gap} mm gap` });
  } else {
    library(HW.couplingBolt, l.bolts.length, 'Through both flanges');
    library(HW.couplingWasher, 2 * l.bolts.length, 'Under every bolt head and nut');
    library(HW.couplingNut, l.bolts.length, 'On every bolt');
  }
  if (doorLatchScrews.length) library(HW.latchScrew, doorLatchScrews.length, 'Two through each latch plate, into the stub’s ring and its door’s');
  for (const f of doors.flatMap(d => d.door.fasteners)) library(f.partId, 1, `Stub’s end door: ${f.use.charAt(0).toLowerCase()}${f.use.slice(1)}`);
  for (const extra of doors.flatMap(d => doorLibraryParts(d.door))) if (extra.quantity) library(extra.partId, extra.quantity, `Stub’s end door: ${extra.use.charAt(0).toLowerCase()}${extra.use.slice(1)}`);
  for (const line of doors.flatMap(d => doorBom(d.door, { prefix: 'end-door', where: 'Stub’s end door', mesh: l.tl.mesh })).filter(q => q.group === 'Hardware')) {
    const same = lines.find(q => q.name === line.name && q.size === line.size);
    if (same) same.quantity += line.quantity; else lines.push(line);
  }
  return lines;
}

export function tunnelCouplingFacts(_variant: CatioMode, config: TunnelCouplingConfig, site: TunnelCouplingSite): SubassemblyFact[] {
  const l = tunnelCouplingLayout(config, site);
  const printed = l.coupling.kind === 'latched';
  return [
    { label: 'Coupling', value: printed ? 'Printed toggle latch · locks over centre, no tools' : 'M8 bolts through both flanges · a 13 mm spanner' },
    { label: 'Gap · seal', value: printed ? `${l.gap} mm · ${l.seal ? `squashed from ${PRINTED_LATCH_JOINT.seal.height} mm` : 'left open'}` : 'None · flange to flange' },
    printed ? { label: 'Latches per coupling', value: `${l.latches.length} · ${config.latchesPerSide} each side, plates ${round1(PRINTED_LATCH.locked)} mm apart locked` }
      : { label: 'Bolts per coupling', value: `${l.bolts.length} × ISO 4017 M8 × 80 · two large washers and a nut each` },
    { label: 'Mitred joints', value: `Bolted, ${config.boltsPerCoupling} per coupling (${config.boltsPerCoupling / 4} on each side)` },
    { label: 'Enclosure end', value: printed ? 'Latched: a standard port like every other' : `Bolted, ${config.boltsPerCoupling} per coupling` },
    { label: 'Doors · held by', value: `${l.tl.doors.filter(d => l.pieces.includes(d.piece)).length} on these two sections, every opening not coupled · ${DOOR_FIXING_LABELS[config.doorFixing].toLowerCase()}` },
    { label: 'Joint shown', value: `${l.side ? 'Section end to a side port' : 'Section end to section end'}: the standard port either way` },
    { label: 'Section length', value: `${cm(l.sectionLength)} cm · the longest section`, from: { page: 'tunnel', settings: ['sectionLength'] } },
    { label: 'On the support', value: `${SUPPORT_FIXING_LABELS[l.tunnel.supportFixing]}${l.support.hold.attached || l.tunnel.supportFixing === 'gravity' ? '' : ' · does not fit here'} · ${l.support.soles.length ? 'self-standing' : 'a trestle'}` },
  ];
}

export function tunnelCouplingViews(_variant: CatioMode, config: TunnelCouplingConfig, site: TunnelCouplingSite): Record<CatioView, CameraPreset> {
  const l = tunnelCouplingLayout(config, site);
  const joint = l.coupling.face.at; const cz = joint[2] + l.h / 2; const L = l.sectionLength; const span = l.w + 2 * TUNNEL.flange.width;
  const latch = l.latches.find(q => q.side > 0);
  const focus: V3 = latch ? latch.at : [span / 2, joint[1], cz];
  return {
    Exterior: { position: [L * 1.5, joint[1] - L * 0.9, cz + L * 1.1], target: [0, joint[1], cz - 80] },
    Interior: { position: [0, joint[1] - L * 1.7, cz + l.h * 0.4], target: [0, joint[1], cz] },
    Front: { position: [0, joint[1] + L * 2.6, cz], target: [0, joint[1], cz] },
    Side: { position: [L * 2.4, joint[1], cz + 60], target: [0, joint[1], cz - 60] },
    Top: { position: [0, joint[1], cz + L * 2.4], target: [0, joint[1] + 1, cz] },
    // beside the joint, outside the right-hand flanges: the latch (or the bolts) across the gap, and below it the bearer's end with
    // whatever holds the tunnel on it
    Mounting: { position: [focus[0] + 420, focus[1] - 300, focus[2] + 120], target: [focus[0], focus[1], (focus[2] + l.support.top) / 2] },
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
  { title: 'One standard port, coupled or closed', parameter: 'Door held by',
    choice: `Every flange is the same standard port: a ${STANDARD_PORT.ring.thickness} × ${STANDARD_PORT.ring.width} ring round the square clear opening, its latch and bolt stations the same on all four sides. Seen from outside, every port carries its latches’ base plates on its left side and their catch plates on its right. The enclosure’s port is one too, coupled like any other. A side port, on the rails of the section after a turn, is one too. A port that is not coupled (the stub’s end behind every side port) is closed by a door: set into it on turn buttons by default, or a blank ring closed by mesh on the port’s own latches.`,
    why: 'With one port, and base and catch on fixed sides of it, any element meets any other: two ports facing each other have a base across from every catch, whichever elements they belong to, and a door latched on is a blank element’s port. Stations the same on every side let a port fit another at any quarter turn, so a side port takes a section’s end like any other. The window end is the insert–tunnel coupling page’s docking frame, set out to the same stations.' },
];

/** Where the second section waits before it comes in, beyond the first, along the tunnel. */
export const ENTRY = (l: TunnelCouplingLayout): V3 => vec.mul(l.coupling.face.n, 1.4 * l.sectionLength);
