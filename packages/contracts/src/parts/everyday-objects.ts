import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Real objects that models are sized around, such as the lighter the cigarette case holds. Each has a SCAD model with its
 * dimensions as named values and that file rendered as an STL beside it (`partAssetPath`), which the library and the assembly
 * previews show. A model shows one in its assembly through `Assembly.references` (see `referencePart`).
 */
export const everydayObjectFamily: PartFamily = {
  id: 'everyday-object', title: 'Everyday objects',
  description: 'Real objects that models are made to hold or fit, modelled from the manufacturer’s dimensions, with estimated details marked as such.',
  attributes: [{ key: 'kind', label: 'Kind' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'height', label: 'Height', symbol: 'H', required: true },
    { key: 'width', label: 'Width', symbol: 'W', required: true },
    { key: 'thickness', label: 'Thickness', symbol: 'T', required: true },
    { key: 'bodyHeight', label: 'Body height (below the hood)', symbol: 'h', required: false },
    { key: 'profileExponent', label: 'Plan shape (superellipse exponent: 2 is an ellipse)', symbol: 'n', required: false },
  ],
};

const confirmed = measured('manufacturer', 'bic-graphic-j25');
const estimated = measured('estimated', 'canfactory-lighter-estimate');

export const everydayObjectParts: Part[] = [
  {
    id: 'bic-j25-mini-lighter', family: 'everyday-object', title: 'BIC Mini lighter (J25)', designation: 'BIC J25', aliases: ['BIC Mini'],
    description: 'The small BIC flint lighter (J25, “BIC Mini”): an opaque oval plastic body, 62 × 22 × 11 mm, under a metal hood with the spark wheel and the lever. The cigarette case’s round bay is fitted to it.',
    standard: null, product: { manufacturer: 'BIC', sku: 'J25 (3460002360)', url: 'https://www.bicgraphic.com/gb/bic-j25-lighter-3460002360.html' },
    attributes: { kind: 'lighter', manufacturer: 'BIC' },
    dimensions: { height: confirmed(62), width: confirmed(22), thickness: confirmed(11), bodyHeight: estimated(50), profileExponent: estimated(2.5) },
    sources: ['bic-graphic-j25', '4imprint-j25', 'wemag-j25', 'canfactory-lighter-estimate'],
    notes: 'Height, width and thickness are BIC’s own (confirmed by two retailers; US listings give 7/8 × 2 7/16 in, 22.2 × 61.9 mm). The oval plan, the hood, the wheel and the lever are estimated from photographs: no published figure exists for them. The model leaves out the inside of the hood.',
    preview: { kind: 'stl', path: 'parts/everyday-objects/bic-j25-mini-lighter.stl' },
  },
];
