import { loadSubassemblyConfig, parseControlled, type SubassemblyControl } from './catioSubassembly.ts';
import { PRINTED_LATCH_JOINT } from './catioPrintedLatch.ts';

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
  /** M8 bolts through a bolted coupling: every coupling with bolts, and always the enclosure end and mitred joints. */
  boltsPerCoupling: 4 | 6 | 8;
  /** What fills the printed latch's gap. */
  seal: 'e-profile' | 'none';
}

export const TUNNEL_COUPLING_DEFAULT: TunnelCouplingConfig = { mechanism: 'printed-latch', latchesPerSide: 2, boltsPerCoupling: 6, seal: 'e-profile' };

export const TUNNEL_COUPLING_CONTROLS: SubassemblyControl<TunnelCouplingConfig>[] = [
  { key: 'mechanism', label: 'Coupling', group: 'Coupling',
    help: `The printed toggle latch from the model library joins two flanges without tools across a ${PRINTED_LATCH_JOINT.gap} mm sealed gap; M8 bolts through both flanges, face to face, need a spanner every time but have a rated hold. Mitred joints and the enclosure end are bolted either way.`,
    options: [{ value: 'printed-latch', label: 'Printed toggle latch (model)' }, { value: 'bolts', label: 'M8 bolts through both flanges' }] },
  { key: 'latchesPerSide', label: 'Latches per side', group: 'Coupling', when: config => config.mechanism === 'printed-latch',
    help: 'The printed latch’s hold is not rated: two on each side of every coupling pull the seal on evenly; three for a long, heavy run.',
    options: [{ value: 1, label: '1 (2 per coupling)' }, { value: 2, label: '2 (4 per coupling)' }, { value: 3, label: '3 (6 per coupling)' }] },
  { key: 'boltsPerCoupling', label: 'Bolts per coupling', group: 'Coupling',
    help: 'M8 bolts through each bolted pair of flanges, outside the mesh where a spanner reaches: every coupling with bolts, and with the printed latch still the enclosure end and any mitred joint.',
    options: [{ value: 4, label: '4 · two each side' }, { value: 6, label: '6 · three each side' }, { value: 8, label: '8 · three each side, two on top' }] },
  { key: 'seal', label: 'Seal', group: 'Coupling', when: config => config.mechanism === 'printed-latch',
    help: `A self-adhesive EPDM E-profile (${PRINTED_LATCH_JOINT.seal.width} × ${PRINTED_LATCH_JOINT.seal.height}, for 2–3.5 mm gaps) round the flange’s face gives the over-centre lock something to squash, and closes the gap to draughts and claws.`,
    options: [{ value: 'e-profile', label: 'EPDM E-profile in the gap' }, { value: 'none', label: 'None · gap left open' }] },
];

export const parseTunnelCoupling = (raw: unknown) => parseControlled(TUNNEL_COUPLING_DEFAULT, TUNNEL_COUPLING_CONTROLS, raw);
/** The coupling as saved on its page (or its defaults), for the tunnel page, which follows it. */
export const savedTunnelCoupling = () => loadSubassemblyConfig('tunnel-tunnel-coupling', parseTunnelCoupling, TUNNEL_COUPLING_DEFAULT);

/** The gap between two latched flanges, and between two bolted ones (face to face). */
export const couplingGap = (config: Pick<TunnelCouplingConfig, 'mechanism'>) => config.mechanism === 'printed-latch' ? PRINTED_LATCH_JOINT.gap : 0;
