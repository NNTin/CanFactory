import { parseControlled, type SubassemblyControl } from './catioSubassembly.ts';
import { DOOR_FIXING_LABELS, DOOR_FIXINGS, type DoorFixing } from './catioPort.ts';
import { PRINTED_LATCH_JOINT } from './catioPrintedLatch.ts';

/**
 * How the tunnel is held on its supports: screwed up through the bearers (the original), strapped over each support with a rubber
 * strap, dropped over dowels in the bearer top, held by turn buttons hooked under keepers on the bearer, or resting by its own weight. The tunnel page owns it; the
 * tunnel–tunnel coupling page shares it.
 */
export const SUPPORT_FIXINGS = ['screws', 'strap', 'dowels', 'turn-buttons', 'gravity'] as const;
export type SupportFixing = typeof SUPPORT_FIXINGS[number];
export type SupportBase = 'trestle' | 'self-standing';
export const SUPPORT_FIXING_LABELS: Record<SupportFixing, string> = {
  screws: 'Screwed up through the bearer', strap: 'Rubber strap over the support', dowels: 'Dowels in the bearer top', 'turn-buttons': 'Turn buttons over keepers', gravity: 'Gravity only',
};

/**
 * A self-standing support's sole: a 45 × 70 set on edge along the tunnel under each leg (or each end of a low bearer), a foot near
 * each of its ends. It is deep enough to hold each foot's insert nut and its screw over the whole of its travel, so no screw comes
 * out of its top.
 */
export const SUPPORT_SOLE = { thickness: 70, width: 45, length: 300, footInset: 40 } as const;

/** The two settings of how the tunnel is held on its supports, for each page that sets them. */
export function supportControls<C extends { supportFixing: SupportFixing; supportBase: SupportBase }>(group: string): SubassemblyControl<C>[] {
  const sole = SUPPORT_SOLE;
  return [
    { key: 'supportFixing', label: 'Held on the supports by', group,
      help: 'Screws bind the tunnel to its supports for good; the others let a section lift off to be moved. Dowels locate it and keep the supports upright; a strap or turn buttons also hold it down; gravity only needs supports that stand on their own.',
      options: SUPPORT_FIXINGS.map(value => ({ value: value as C[keyof C], label: SUPPORT_FIXING_LABELS[value] })) },
    { key: 'supportBase', label: 'Supports stand', group,
      help: `A trestle is one bearer on two legs across the tunnel: along it, it stands only when fixed to the tunnel. A ${sole.width} × ${sole.thickness} sole on edge along the tunnel under each leg, with a foot near each end, lets it stand on its own; a support too low for that becomes a low bearer 195 mm wide along the tunnel, on a foot near each corner.`,
      options: [{ value: 'trestle' as C[keyof C], label: 'Held up by the tunnel (trestles)' }, { value: 'self-standing' as C[keyof C], label: 'On their own (a sole under each leg)' }] },
  ];
}

/**
 * How the tunnel's sections are joined flange to flange: the tunnel–tunnel coupling page's settings. They live here, apart from
 * that page (catioTunnelCoupling.ts), because the tunnel's own layout (catioTunnel.ts) follows them at every coupling and that page
 * is built from the tunnel's layout in turn.
 */
export interface TunnelCouplingConfig {
  /** The printed toggle latch (the `toggle-latch` model) across a sealed gap, or M8 bolts through both flanges, face to face. */
  mechanism: 'printed-latch' | 'bolts';
  /** Printed latches on each side of a coupling. */
  latchesPerSide: 1 | 2 | 3;
  /**
   * M8 bolts through a bolted coupling: every coupling with bolts, and always the mitred joints. The same number on each of the four
   * sides of the standard port (catioPort.ts `boltStations`), so a port takes another at any quarter turn.
   */
  boltsPerCoupling: 4 | 8 | 12;
  /** What fills the printed latch's gap. */
  seal: 'e-profile' | 'none';
  /** How a door closing a port is held there: by the port's own latches, as a coupling, or by turn buttons on its ring. */
  doorFixing: DoorFixing;
  /** Which joint the coupling page shows: a section's end to the next one's, or to a side port at a turn. Only that page's. */
  jointShown: JointShown;
  /** How the tunnel is held on its supports, and whether they stand on their own: the tunnel page's settings, shared here. */
  supportFixing: SupportFixing;
  supportBase: SupportBase;
}

/** The joint the tunnel–tunnel coupling page shows. */
export type JointShown = 'end-end' | 'end-side';

export const TUNNEL_COUPLING_DEFAULT: TunnelCouplingConfig = { mechanism: 'printed-latch', latchesPerSide: 2, boltsPerCoupling: 8, seal: 'e-profile', doorFixing: 'turn-buttons', jointShown: 'end-end', supportFixing: 'screws', supportBase: 'trestle' };

export const TUNNEL_COUPLING_CONTROLS: SubassemblyControl<TunnelCouplingConfig>[] = [
  { key: 'mechanism', label: 'Coupling', group: 'Coupling',
    help: `The printed toggle latch from the model library joins two flanges without tools across a ${PRINTED_LATCH_JOINT.gap} mm sealed gap; M8 bolts through both flanges, face to face, need a spanner every time but have a rated hold. Mitred joints are bolted either way: a mitre’s face is not a standard port.`,
    options: [{ value: 'printed-latch', label: 'Printed toggle latch (model)' }, { value: 'bolts', label: 'M8 bolts through both flanges' }] },
  { key: 'latchesPerSide', label: 'Latches per side', group: 'Coupling', when: config => config.mechanism === 'printed-latch',
    help: 'The printed latch’s hold is not rated: two on each side of every coupling pull the seal on evenly; three for a long, heavy run.',
    options: [{ value: 1, label: '1 (2 per coupling)' }, { value: 2, label: '2 (4 per coupling)' }, { value: 3, label: '3 (6 per coupling)' }] },
  { key: 'boltsPerCoupling', label: 'Bolts per coupling', group: 'Coupling',
    help: 'M8 bolts through each bolted pair of flanges, outside the mesh where a spanner reaches: every coupling with bolts, and with the printed latch still any mitred joint. The same number on all four sides of the ring, so a port fits another whichever way round it is turned.',
    options: [{ value: 4, label: '4 · one on each side' }, { value: 8, label: '8 · two on each side' }, { value: 12, label: '12 · three on each side' }] },
  { key: 'seal', label: 'Seal', group: 'Coupling', when: config => config.mechanism === 'printed-latch',
    help: `A self-adhesive EPDM E-profile (${PRINTED_LATCH_JOINT.seal.width} × ${PRINTED_LATCH_JOINT.seal.height}, for 2–3.5 mm gaps) round the flange’s face gives the over-centre lock something to squash, and closes the gap to draughts and claws.`,
    options: [{ value: 'e-profile', label: 'EPDM E-profile in the gap' }, { value: 'none', label: 'None · gap left open' }] },
  { key: 'doorFixing', label: 'Door held by', group: 'Doors',
    help: 'A door closes a port that is not coupled: the end of the stub behind every side port. Held by turn buttons (the default), it is a slim mesh panel set into the port about flush with the ring, as the PawHut tunnel’s doors are, seated as the catio concept page sets (stop strips or a rebate) and kept in by four buttons on the ring, each locked by its pin. Held by the port’s own latches, it is a blank flange ring closed by mesh, outside the port, that goes on and off like a coupled section: sturdier, but bulkier.',
    options: DOOR_FIXINGS.map(value => ({ value, label: DOOR_FIXING_LABELS[value] })) },
  { key: 'jointShown', label: 'Joint shown', group: 'Shown',
    help: 'Every element ends in the standard port, and a side port is one too, so every joint couples the same way: a section’s end to the next section’s, straight on, or at a turn to the side port of the section after it.',
    options: [{ value: 'end-end', label: 'Section end to section end' }, { value: 'end-side', label: 'Section end to a side port (a turn)' }] },
  ...supportControls<TunnelCouplingConfig>('On the support'),
];

/** A coupling page saved before cubes were dropped shows the nearest joint: two sections' ends, or a section's end at a side port for one that met a cube. */
const SHOWN_BEFORE: Record<string, JointShown> = { tunnel: 'end-end', 'section-section': 'end-end', 'section-cube': 'end-side', 'cube-cube': 'end-side' };
export const parseTunnelCoupling = (raw: unknown) => {
  const saved = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw as Record<string, unknown> } : raw;
  if (saved && typeof saved === 'object') { const record = saved as Record<string, unknown>; const shown = SHOWN_BEFORE[String(record['jointShown'])]; if (shown) record['jointShown'] = shown; }
  return parseControlled(TUNNEL_COUPLING_DEFAULT, TUNNEL_COUPLING_CONTROLS, saved);
};

/** The gap between two latched flanges, and between two bolted ones (face to face). */
export const couplingGap = (config: Pick<TunnelCouplingConfig, 'mechanism'>) => config.mechanism === 'printed-latch' ? PRINTED_LATCH_JOINT.gap : 0;
