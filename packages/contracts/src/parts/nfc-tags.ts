import type { Part, PartFamily } from './schema.ts';
import { measured } from './sources.ts';

/**
 * NFC tags (13.56 MHz, NFC Forum Type 2): thin inlays and stickers with an etched aluminium antenna round an NXP NTAG chip, and
 * rigid coins. A print can hold one in a pocket, or seal it in at a print pause (the cat collar tag).
 */
export const nfcTagFamily: PartFamily = {
  id: 'nfc-tag', title: 'NFC tags',
  description: 'Round NFC tags by product (NXP NTAG213/215/216): adhesive inlays, on-metal stickers with a ferrite layer, and rigid coins, with the maker’s diameter, thickness and antenna size.',
  attributes: [{ key: 'chip', label: 'Chip' }, { key: 'memory', label: 'User memory' }, { key: 'construction', label: 'Construction' }, { key: 'colour', label: 'Colour' }, { key: 'manufacturer', label: 'Manufacturer' }],
  dimensions: [
    { key: 'D', label: 'Diameter', symbol: 'D', required: true },
    { key: 'h', label: 'Thickness', symbol: 'H', required: true },
    { key: 'antenna', label: 'Antenna diameter', symbol: 'Da', required: false },
  ],
};

type Chip = 'NTAG213' | 'NTAG215' | 'NTAG216';
type Construction = 'inlay' | 'on-metal sticker' | 'coin';
interface NfcTag {
  manufacturer: string; sku: string; url: string; source: string; chip: Chip; construction: Construction; colour: 'clear' | 'white' | 'black';
  D: number; h: number; antenna?: number; detail: string;
}

/** The NTAG's user memory, NXP's data sheet (the total is 180, 540 or 924 bytes). */
const USER_MEMORY: Record<Chip, string> = { NTAG213: '144 bytes', NTAG215: '504 bytes', NTAG216: '888 bytes' };
const GOTOTAGS = 'https://store.gototags.com/';

const TAGS: NfcTag[] = [
  { manufacturer: 'GoToTags', sku: 'BGRDUHNVRL', colour: 'clear', url: `${GOTOTAGS}simple-nfc-inlay-ntag213-18-mm-circle/`, source: 'gototags-nfc', chip: 'NTAG213', construction: 'inlay', D: 18, h: 0.2, antenna: 15.25,
    detail: 'a clear, flexible PET inlay with hot-melt adhesive (GoToTags Simple NFC Inlay)' },
  { manufacturer: 'GoToTags', sku: 'GML7CQG3V7', colour: 'clear', url: `${GOTOTAGS}simple-nfc-inlay-ntag215-25-mm-circle/`, source: 'gototags-nfc', chip: 'NTAG215', construction: 'inlay', D: 25, h: 0.2, antenna: 22,
    detail: 'a clear, flexible PET inlay with hot-melt adhesive (GoToTags Simple NFC Inlay)' },
  { manufacturer: 'GoToTags', sku: 'HG5W9BYET8', colour: 'clear', url: `${GOTOTAGS}simple-nfc-inlay-ntag216-25-mm-circle/`, source: 'gototags-nfc', chip: 'NTAG216', construction: 'inlay', D: 25, h: 0.18, antenna: 22,
    detail: 'a clear, flexible PET inlay with an oil-resistant adhesive (GoToTags Simple NFC Inlay)' },
  { manufacturer: 'GoToTags', sku: 'FJZ3AM6FJZ', colour: 'white', url: `${GOTOTAGS}thin-on-metal-nfc-sticker-ntag213-23-mm-circle-white/`, source: 'gototags-nfc', chip: 'NTAG213', construction: 'on-metal sticker', D: 23, h: 0.41, antenna: 21,
    detail: 'a white, semi-flexible sticker with a ferrite layer behind the antenna, for use on metal (GoToTags Thin On-Metal NFC Sticker)' },
  { manufacturer: 'GoToTags', sku: 'BZKX3ZLHXX', colour: 'black', url: `${GOTOTAGS}thin-on-metal-nfc-sticker-ntag213-30-mm-circle-black/`, source: 'gototags-nfc', chip: 'NTAG213', construction: 'on-metal sticker', D: 30, h: 0.5, antenna: 25,
    detail: 'a black, semi-flexible sticker with a ferrite layer behind the antenna, for use on metal (GoToTags Thin On-Metal NFC Sticker)' },
  { manufacturer: 'Core Electronics', sku: 'CE08496', colour: 'white', url: 'https://core-electronics.com.au/ntag213-coin-25mm-white.html', source: 'core-electronics-ce08496', chip: 'NTAG213', construction: 'coin', D: 25, h: 0.9,
    detail: 'a rigid white coin tag without adhesive (Core Electronics RFID/NFC Tag 25mm Coin)' },
];

const CONSTRUCTION_TEXT: Record<Construction, string> = { inlay: 'NFC inlay', 'on-metal sticker': 'On-metal NFC sticker', coin: 'NFC coin tag' };

export const nfcTagParts: Part[] = TAGS.map((tag): Part => {
  const dimension = measured('manufacturer', tag.source);
  return {
    id: `${tag.manufacturer.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${tag.sku.toLowerCase()}`, family: 'nfc-tag',
    title: `${CONSTRUCTION_TEXT[tag.construction]} ${tag.chip}, Ø ${tag.D} × ${tag.h} mm`,
    designation: `${tag.manufacturer} ${tag.sku}`, aliases: [],
    description: `An ${tag.chip} NFC tag, Ø ${tag.D} mm and ${tag.h} mm thick${tag.antenna ? ` with a Ø ${tag.antenna} mm antenna` : ''}: ${tag.detail}. ${USER_MEMORY[tag.chip]} of user memory.`,
    standard: null, product: { manufacturer: tag.manufacturer, sku: tag.sku, url: tag.url },
    attributes: { chip: tag.chip, memory: USER_MEMORY[tag.chip], construction: tag.construction, colour: tag.colour, manufacturer: tag.manufacturer },
    dimensions: { D: dimension(tag.D), h: dimension(tag.h), ...(tag.antenna ? { antenna: dimension(tag.antenna) } : {}) },
    sources: [tag.source, 'nxp-ntag213-215-216'],
    notes: `Diameter, thickness${tag.antenna ? ' and antenna' : ''} as stated on the article’s page (no tolerances); the user memory from NXP’s data sheet.${tag.construction === 'coin' ? ' The page gives no antenna size.' : ''} Metal behind or beside the antenna (a magnet, too) detunes it and shortens the read range; only the on-metal stickers are made for that.`,
    preview: { kind: 'procedural' },
  };
});
