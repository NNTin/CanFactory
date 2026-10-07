import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * Cat collars that accessories are sized for (the cat collar tag): the strap's width and thickness, and the neck range. Makers
 * publish the width and the neck range; no maker found publishes the strap's thickness, so it is estimated from published nylon
 * webbing of the same width, and marked as such.
 */
export const catCollarFamily: PartFamily = {
  id: 'cat-collar', title: 'Cat collars',
  description: 'Cat collars by product: the strap’s width (the maker’s), its thickness (estimated from nylon webbing of that width) and the neck range, with the safety buckle and the ring for a tag.',
  attributes: [{ key: 'brand', label: 'Brand' }, { key: 'width', label: 'Width' }, { key: 'closure', label: 'Closure' }, { key: 'ring', label: 'Tag ring' }],
  dimensions: [
    { key: 'width', label: 'Strap width', symbol: 'b', required: true },
    { key: 'thickness', label: 'Strap thickness', symbol: 's', required: true },
    { key: 'neckMin', label: 'Smallest neck circumference', symbol: 'Umin', required: false },
    { key: 'neckMax', label: 'Largest neck circumference', symbol: 'Umax', required: true },
  ],
};

const INCH = 25.4;
const inches = (value: number) => Math.round(value * INCH * 1000) / 1000;

/**
 * Fox Valley's 3/8″ nylon webbing is 1.18 mm thick (the page prints “0.46 inches”, a slip for 0.046 in, which its 1.18 mm
 * matches), and its 5/8″ to 1 1/2″ webbing 1.80 mm. A collar of up to 3/8″ (8 to 11 mm here) is taken as the 3/8″ webbing; a 1/2″
 * one as lying between the two.
 */
const narrow = measured('estimated', 'fox-valley-webbing')(1.18);
const halfInch = measured('estimated', 'fox-valley-webbing')(1.5, 1.18, 1.8);

interface Collar {
  id: string; brand: string; name: string; sku: string; url: string; designation: string;
  width: number; widthText: string; neck: [min: number | null, max: number]; material: string;
  closure: string; ring: string; sources: [width: string, ...more: string[]]; detail: string;
}

const COLLARS: Collar[] = [
  { id: 'rogz-kiddycat-8mm', brand: 'Rogz', name: 'KiddyCat Safety Release Collar, 8 mm', sku: 'COLKID8D', designation: 'Rogz KiddyCat 8 mm (COLKID8D, COLKID8R)',
    url: 'https://rogz.com/product/rogz-kiddycat-safety-release-collar/', width: 8, widthText: '8 mm', neck: [165, 230], material: 'soft webbing',
    closure: 'Safeloc breakaway buckle, three load settings', ring: 'D-ring', sources: ['vetnpetdirect-rogz', 'rogz-cat-collars'],
    detail: 'the narrowest collar here, for small necks' },
  { id: 'rogz-kiddycat-11mm', brand: 'Rogz', name: 'KiddyCat Safety Release Collar, 11 mm', sku: 'COLKID11D', designation: 'Rogz KiddyCat 11 mm (COLKID11D, COLKID11R)',
    url: 'https://rogz.com/product/rogz-kiddycat-safety-release-collar/', width: 11, widthText: '11 mm', neck: [255, 310], material: 'soft webbing',
    closure: 'Safeloc breakaway buckle, three load settings', ring: 'D-ring', sources: ['vetnpetdirect-rogz', 'rogz-cat-collars'],
    detail: 'the larger size of the KiddyCat' },
  { id: 'rogz-alleycat-11mm', brand: 'Rogz', name: 'AlleyCat Safety Release Collar, 11 mm', sku: 'COLFRAB', designation: 'Rogz AlleyCat 11 mm (COLFRAB, COLFRAR, COLFRAP, COLFRAPK)',
    url: 'https://rogz.com/product/rogz-alleycat-safety-release-collar/', width: 11, widthText: '11 mm', neck: [200, 310], material: 'reflective nylon webbing',
    closure: 'Safeloc breakaway buckle, three load settings', ring: 'D-ring', sources: ['vetnpetdirect-rogz', 'rogz-cat-collars'],
    detail: 'reflective, with a wider neck range than the KiddyCat' },
  { id: 'coastal-safe-cat-fashion-3-8in', brand: 'Coastal Pet Products', name: 'Safe Cat Fashion Adjustable Breakaway Collar, 3/8″', sku: '064830', designation: 'Coastal Safe Cat Fashion Adjustable Breakaway Collar 3/8″ × 8–12″',
    url: 'https://reberranch.com/collections/pet-collars/products/coastal-pet-product-safe-cat-fashion-adjustable-breakaway-collar', width: inches(3 / 8), widthText: '3/8″',
    neck: [inches(8), inches(12)], material: 'nylon', closure: 'pivoting breakaway buckle', ring: 'not stated', sources: ['reberranch-coastal-safe-cat'],
    detail: 'a 3/8″ (9.5 mm) American collar' },
  { id: 'trixie-4180', brand: 'TRIXIE', name: 'Cat Collar with Address Tag (4180)', sku: '4180', designation: 'TRIXIE 4180',
    url: 'https://www.trixie.de/en/productworld/cat/transport-travel/cat-harnesses-collars/cat-collar-with-address-tag-1001435869-1001449753?itemNo=4180', width: 10, widthText: '10 mm',
    neck: [null, 220], material: 'nylon webbing tape', closure: 'Snap & Easy safety fastening', ring: 'address tag fitted', sources: ['zooplus-trixie-4180', 'trixie-4180'],
    detail: 'a 10 mm European collar, sold with its own address tag' },
  { id: 'lupinepet-original-designs-safety-cat-collar', brand: 'LupinePet', name: 'Original Designs Safety Cat Collar, 1/2″', sku: 'Original Designs Safety Cat Collar', designation: 'LupinePet Original Designs Safety Cat Collar 1/2″ × 8–12″',
    url: 'https://www.lupinepet.com/products/original-designs-safety-cat-collar', width: inches(1 / 2), widthText: '1/2″', neck: [inches(8), inches(12)], material: 'woven nylon webbing',
    closure: 'YKK breakaway buckle, about 5 lb', ring: 'steel D-ring', sources: ['lupinepet-safety-cat-collar'],
    detail: 'the widest collar here, 1/2″ (12.7 mm)' },
];

export const catCollarParts: Part[] = COLLARS.map((collar): Part => {
  const [width, ...more] = collar.sources;
  const stated = measured('manufacturer', width);
  const [neckMin, neckMax] = collar.neck;
  return {
    id: collar.id, family: 'cat-collar', title: `${collar.brand} ${collar.name}`, designation: collar.designation, aliases: [],
    description: `A cat collar of ${collar.material}, ${collar.widthText} wide (${collar.brand} ${collar.name}), for necks ${neckMin ? `of ${neckMin}` : 'up'} to ${neckMax} mm, with a ${collar.closure}: ${collar.detail}.`,
    standard: null, product: { manufacturer: collar.brand, sku: collar.sku, url: collar.url },
    attributes: { brand: collar.brand, width: collar.widthText, closure: collar.closure, ring: collar.ring },
    dimensions: {
      width: stated(collar.width), thickness: collar.width > 11 ? halfInch : narrow,
      ...(neckMin ? { neckMin: stated(neckMin) } : {}), neckMax: stated(neckMax),
    },
    sources: [width, ...more, 'fox-valley-webbing'],
    notes: `Width and neck range as published (inch sizes converted). No maker publishes the strap’s thickness: it is estimated from Fox Valley’s nylon webbing of the same width, so measure your own collar if a fit is tight.${collar.width > 11 ? ' A 1/2″ webbing lies between Fox Valley’s 3/8″ (1.18 mm) and 5/8″ (1.80 mm): size a slot from the greatest.' : ''} The ring for a tag is not dimensioned by any maker.`,
    preview: { kind: 'procedural' },
  };
});
