import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

export const ballFamily: PartFamily = {
  id: 'ball', title: 'Steel balls',
  description: 'Loose precision balls of hardened chromium steel (100Cr6, AISI 52100) by diameter and grade (ISO 3290-1, DIN 5401), as in ball detents and spring plungers.',
  attributes: [{ key: 'diameter', label: 'Diameter' }, { key: 'material', label: 'Material' }, { key: 'grade', label: 'Grade' }],
  dimensions: [{ key: 'd', label: 'Ball diameter', symbol: 'Dw', required: true }],
};

/**
 * ISO 3290-1 grade G100's boundary dimensions, ±47.5 µm on the nominal diameter (read from Kugel Pompel's DIN 5401:2002 data sheet,
 * which follows ISO 3290). A grade's balls are much closer to each other (G100: 2.5 µm per ball, 5 µm per lot), but any lot may
 * lie anywhere within these limits, so a bore is sized from the largest.
 */
const G100 = 0.0475;

/** The nominal diameters, in mm: common trade sizes of the standard, those that the spring ball detent's bores can take. */
const DIAMETERS = [2.5, 3, 3.5, 4, 4.5, 5, 6];

export const ballParts: Part[] = DIAMETERS.map((d): Part => {
  const size = String(d).replace('.', '-');
  return {
    id: `steel-ball-${size}-g100`, family: 'ball', title: `Steel ball ${d} mm G100`, designation: `ISO 3290-1 ${d} G100 100Cr6`,
    aliases: [`DIN 5401 ${String(d).replace('.', ',')} G100 100Cr6`, `AISI 52100 ball ${d} mm grade 100`],
    description: `A hardened chromium-steel (100Cr6) precision ball, ${d} mm in diameter, of grade G100 (ISO 3290-1, DIN 5401): the ordinary bearing ball, round to 2.5 µm.`,
    standard: 'iso-3290-1', product: null, attributes: { diameter: `${d} mm`, material: '100Cr6 (AISI 52100)', grade: 'G100' },
    dimensions: { d: measured('standard', 'kugel-pompel-din-5401')(d, Number((d - G100).toFixed(4)), Number((d + G100).toFixed(4))) },
    sources: ['iso-3290-1', 'din-5401', 'kugel-pompel-din-5401'],
    notes: 'The limits are grade G100’s boundary dimensions (±47.5 µm). Stainless (1.4034, AISI 420C) balls of the same grade have the same sizes.',
    preview: { kind: 'procedural' },
  };
});
