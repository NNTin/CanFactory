import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { Value } from 'typebox/value';
import { artifactFormat, AssemblySchema, DEFAULT_QR_MAGNET_TAG, DEFAULT_QR_TAG_MAGNET, findModel, linkedPartData, partUsage, QR_TAG_MAGNETS, qrMagnetTag, qrMagnetTagAssembly, qrTagMagnetFits, qrTagSettings, scadDefines, validateParameters, type ParameterValues } from './models.ts';
import { resolveAssembly } from './assembly.ts';
import { RenderRequestSchema } from './index.ts';
import { findPart, parts } from './parts/index.ts';
import { decodeLogo, LOGO_GRID, svgToLogo } from './svgLogo.ts';
import { encodeQr, filamentChangeHeight, knockoutDamage, knockoutFits, knockoutModules, maxLogoSize, mergeModules, QR_ECC_LEVELS, QR_LOGO_AREA_LIMIT, QR_TAG, QR_TAG_JOINTS, qrScad, qrTagCode, qrTagLayout, type QrEcc, type QrTagCode } from './qrMagnetTag.ts';

/** A leaf with a vein cut out of it (an even-odd hole): a solid logo with curves and a hole, as a user's file might be. */
const LEAF = svgToLogo('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill-rule="evenodd" d="M50 4 C82 18 96 58 50 96 C4 58 18 18 50 4Z M47 30 L53 30 L53 82 L47 82Z"/></svg>').logo;

const LIGHT = [238, 239, 241], DARK = [20, 20, 24], BORDER = [47, 111, 214];

/**
 * The centre piece as a scanner sees it, from above: the light base, the dark modules left after the knockout, the logo (if any)
 * raised dark on its pad, scaled to `logoSize` % of the code's width as the generator does, the quiet zone, and round it the
 * border's colour. `scale` pixels per module; the logo is sampled at each pixel's centre (even-odd).
 */
function picture(code: QrTagCode, quietZone: number, logo: string, logoSize: number, scale = 4) {
  const n = code.symbol.size, border = 3;
  const side = (n + 2 * quietZone + 2 * border) * scale;
  const data = new Uint8ClampedArray(side * side * 4);
  const rings = logo ? decodeLogo(logo) : [];
  const points = rings.flat();
  const [loX, loY] = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1]))];
  const [hiX, hiY] = [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
  const box = logoSize / 100 * n;
  const s = box / Math.max(hiX - loX, hiY - loY, 1);
  const inLogo = (mx: number, my: number) => {
    // module coordinates (from the symbol's centre, y up) to the logo's grid
    const gx = mx / s + (loX + hiX) / 2, gy = my / s + (loY + hiY) / 2;
    let inside = false;
    for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i] ?? [0, 0], [xj, yj] = ring[j] ?? [0, 0];
      if ((yi > gy) !== (yj > gy) && gx < (xj - xi) * (gy - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  for (let py = 0; py < side; py++) for (let px = 0; px < side; px++) {
    const mx = (px + 0.5) / scale - border - quietZone, my = (py + 0.5) / scale - border - quietZone;
    let colour = BORDER;
    if (mx >= -quietZone && my >= -quietZone && mx < n + quietZone && my < n + quietZone) {
      colour = LIGHT;
      if (mx >= 0 && my >= 0 && mx < n && my < n && code.dark[Math.floor(my)]?.[Math.floor(mx)]) colour = DARK;
      if (rings.length && Math.abs(mx - n / 2) <= box / 2 && Math.abs(my - n / 2) <= box / 2 && inLogo(mx - n / 2, n / 2 - my)) colour = DARK;
    }
    data.set([...colour, 255], (py * side + px) * 4);
  }
  return { data, side };
}

function decode(text: string, ecc: QrEcc, options: { logo?: string; logoSize?: number; quietZone?: number } = {}) {
  const logo = options.logo ?? '';
  const logoSize = options.logoSize ?? 20;
  const code = qrTagCode({ qrText: text, errorCorrection: ecc, logo, logoSize });
  const { data, side } = picture(code, options.quietZone ?? 2, logo, logoSize);
  return { code, result: jsQR(data, side, side, { inversionAttempts: 'dontInvert' })?.data };
}

/** The longest text of printable ASCII that still fits this version at this error correction (found by bisection). */
function longestFor(version: number, ecc: QrEcc): string {
  const text = (length: number) => Array.from({ length }, (_, i) => String.fromCharCode(33 + (i * 7) % 94)).join('');
  let [fits, over] = [0, 1200];
  while (over - fits > 1) {
    const middle = Math.floor((fits + over) / 2);
    if (encodeQr(text(middle), ecc).version <= version) fits = middle; else over = middle;
  }
  return text(fits);
}

describe('QR encoding', () => {
  it('encodes in byte mode at exactly the chosen error correction, deterministically', () => {
    // 19 bytes in byte mode: 4 + 8 + 152 bits. Version 2 holds 16 bytes at H, version 3 holds 26.
    const a = encodeQr('https://example.com', 'H');
    expect([a.version, a.size]).toEqual([3, 29]);
    expect(encodeQr('https://example.com', 'H')).toEqual(a);
    expect(encodeQr('https://example.com', 'L').version).toBe(2);
    // byte mode even for digits only (numeric mode would fit 41 digits into version 1 at L; byte mode 17)
    expect(encodeQr('1'.repeat(17), 'L').version).toBe(1);
    expect(encodeQr('1'.repeat(18), 'L').version).toBe(2);
    // the error correction is never raised: a short text stays at L
    expect(encodeQr('A', 'L').version).toBe(1);
    // the finder patterns, timing and format information are function modules
    expect(a.fixed[0]?.[0] && a.fixed[6]?.[10] && a.fixed[8]?.[2]).toBe(true);
    expect(() => encodeQr('café', 'M')).toThrow();
  });

  it('merges the dark modules into rectangles that cover exactly the dark modules', () => {
    for (const ecc of QR_ECC_LEVELS) {
      const { dark } = qrTagCode({ qrText: 'https://github.com/NNTin/CanFactory', errorCorrection: ecc, logo: '', logoSize: 20 });
      const covered = dark.map(row => row.map(() => 0));
      for (const [x, y, w, h] of mergeModules(dark)) for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) { const row = covered[r] ?? []; row[c] = (row[c] ?? 0) + 1; }
      expect(covered).toEqual(dark.map(row => row.map(value => value ? 1 : 0)));
    }
    expect(mergeModules([[true, true, false], [true, true, false], [false, true, true]])).toEqual([[0, 0, 2, 2], [1, 2, 2, 1]]);
  });

  it('writes only integers to OpenSCAD, whatever the text holds', () => {
    const literal = qrScad({ qrText: '"); import("/etc/passwd"); //', errorCorrection: 'M', logo: '', logoSize: 20 });
    expect(literal).toMatch(/^\[\d+,\d+,\[(\[\d+,\d+,\d+,\d+\],?)+\]\]$/);
    expect(JSON.parse(literal)).toHaveLength(3);
  });

  it('knocks out a centred, odd pad of whole modules for the logo, clear of the finder patterns and timing lines', () => {
    expect(knockoutModules(29, 20)).toBe(7);
    expect(knockoutModules(29, 21)).toBe(9);
    const code = qrTagCode({ qrText: 'https://example.com', errorCorrection: 'H', logo: LEAF, logoSize: 20 });
    expect(code.pad).toBe(7);
    for (let y = 11; y < 18; y++) for (let x = 11; x < 18; x++) expect(code.dark[y]?.[x]).toBe(false);
    // the largest pad stays inside rows and columns 9 to size − 10, so it never covers a function pattern at the edges
    for (const size of [21, 25, 29, 33, 45, 57]) for (const ecc of ['Q', 'H'] as const) {
      const most = maxLogoSize(size, ecc);
      if (most === 0) continue;
      const pad = knockoutModules(size, most);
      expect(knockoutFits(size, pad, ecc)).toBe(true);
      expect((size - pad) / 2).toBeGreaterThanOrEqual(9);
      expect(pad * pad / (size * size)).toBeLessThanOrEqual(QR_LOGO_AREA_LIMIT[ecc] + 1e-9);
      expect(knockoutFits(size, knockoutModules(size, most + 1), ecc)).toBe(false);
    }
  });
});

describe('QR decode round-trip (jsQR)', () => {
  it('decodes the default tag, with and without a logo', () => {
    expect(decode('https://example.com', 'H').result).toBe('https://example.com');
    expect(decode('https://example.com', 'H', { logo: LEAF, logoSize: 20 }).result).toBe('https://example.com');
    expect(decode('https://example.com', 'H', { quietZone: 1 }).result).toBe('https://example.com');
    expect(LEAF.length).toBeGreaterThan(0);
    expect(decodeLogo(LEAF).flat().every(([x, y]) => x <= LOGO_GRID && y <= LOGO_GRID)).toBe(true);
  });

  it('decodes every error correction at several payload lengths, up to the longest text', () => {
    const payloads = ['A', 'https://example.com', 'WIFI:T:WPA;S:CanFactory;P:correct horse battery staple;;', 'x'.repeat(100), 'The quick brown fox jumps over the lazy dog! 0123456789 '.repeat(4).slice(0, 200)];
    for (const ecc of QR_ECC_LEVELS) for (const text of payloads) expect(decode(text, ecc).result, `${ecc} ${text.length}`).toBe(text);
  });

  it('decodes the fullest code of every version from 1 to 10 at every error correction', () => {
    for (const ecc of QR_ECC_LEVELS) for (let version = 1; version <= 10; version++) {
      const text = longestFor(version, ecc);
      const { code, result } = decode(text, ecc);
      expect(code.symbol.version).toBe(version);
      expect(result, `${ecc} v${version}`).toBe(text);
    }
  });

  it('counts the codewords a pad destroys as a decoder does: at the full correction capacity the code still decodes', () => {
    // QR_LOGO_ECC_SHARE leaves part of each block's capacity for the print's flaws; spending all of it must still decode, which
    // shows that knockoutDamage never undercounts. The same layout of codewords as the standard: 26 codewords in version 2.
    expect(knockoutDamage(2, 'Q', 25 - 18)).toEqual({ damaged: [expect.any(Number)], correctable: [11] });
    for (const ecc of ['Q', 'H'] as const) for (let version = 2; version <= 9; version++) {
      const size = 17 + 4 * version;
      let pad = 1;
      for (let candidate = 3; candidate <= size - 18; candidate += 2) {
        const { damaged, correctable } = knockoutDamage(version, ecc, candidate);
        if (damaged.every((count, block) => count <= (correctable[block] ?? 0))) pad = candidate;
      }
      const text = longestFor(version, ecc);
      const code = qrTagCode({ qrText: text, errorCorrection: ecc, logo: '', logoSize: 20 });
      const from = (size - pad) / 2;
      const knocked = { ...code, dark: code.dark.map((row, y) => row.map((value, x) => value && !(y >= from && y < from + pad && x >= from && x < from + pad))) };
      const { data, side } = picture(knocked, 2, '', 20);
      expect(jsQR(data, side, side, { inversionAttempts: 'dontInvert' })?.data, `${ecc} v${version} pad ${pad}`).toBe(text);
    }
  });

  it('decodes with the largest logo allowed, at Q and H, at every version that has room for one', () => {
    let tested = 0;
    for (const ecc of ['Q', 'H'] as const) for (let version = 2; version <= 12; version++) {
      for (const text of [longestFor(version, ecc), longestFor(version - 1, ecc) + 'x']) {
        const size = 17 + 4 * version;
        const logoSize = Math.min(40, maxLogoSize(size, ecc));
        if (logoSize < 10) continue;
        const { code, result } = decode(text, ecc, { logo: LEAF, logoSize });
        expect(code.symbol.version).toBe(version);
        expect(code.pad, `${ecc} v${version}`).toBeGreaterThan(0);
        expect(result, `${ecc} v${version} logo ${logoSize} %`).toBe(text);
        tested++;
      }
    }
    expect(tested).toBeGreaterThan(30);
  });
});

const source = readFileSync(new URL('../../../models/qr-magnet-tag/generator.scad', import.meta.url), 'utf8');
const defaults = qrMagnetTag.defaults;
const issues = (parameters: ParameterValues) => validateParameters(qrMagnetTag, { ...defaults, ...parameters });
const said = (parameters: ParameterValues, field: string) => issues(parameters).filter(issue => issue.field === field).map(issue => issue.message).join(' ');
const magnet = (id: string) => findPart(id) ?? (() => { throw new Error(`Missing ${id}`); })();

describe('QR magnet tag contract', () => {
  it('is a registered two-part model whose defaults validate', () => {
    expect(findModel('qr-magnet-tag')).toBe(qrMagnetTag);
    expect(artifactFormat(qrMagnetTag)).toBe('zip');
    expect(qrMagnetTag.parts.map(part => part.id)).toEqual(['border', 'centre']);
    expect(defaults).toEqual(DEFAULT_QR_MAGNET_TAG);
    expect(issues({})).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: 'qr-magnet-tag', modelVersion: '1', parameters: defaults })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'qr-magnet-tag', modelVersion: '1', parameters: { ...defaults, matrix: [[1]] } })).toBe(false);
    expect(Value.Check(RenderRequestSchema, { modelId: 'qr-magnet-tag', modelVersion: '1', parameters: { ...defaults, qrText: 'naïve' } })).toBe(false);
    expect(Value.Check(RenderRequestSchema, { modelId: 'qr-magnet-tag', modelVersion: '1', parameters: { ...defaults, qrText: 'x'.repeat(201) } })).toBe(false);
  });

  it('keeps every SCAD default and fixed size equal to the contract', () => {
    for (const part of qrMagnetTag.parts) for (const [name, literal] of scadDefines(qrMagnetTag, part, defaults).filter(([name]) => name !== 'PART'))
      expect(source, name).toMatch(new RegExp(`^${name} = ${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};`, 'm'));
    expect(scadDefines(qrMagnetTag, qrMagnetTag.parts[1] ?? {}, defaults)).toEqual(expect.arrayContaining([['PART', '"centre"'], ['MAGNET_D', '8.1'], ['MAGNET_T', '2.1']]));
    const t = QR_TAG;
    const fixed = {
      POCKET_PLAY: t.pocketPlay, FLOOR_WALL: t.floorWall, SIDE_WALL: t.sideWall, JOINT_BACK_WALL: t.jointBackWall, CENTRE_WALL: t.centreWall, MAGNET_GAP: t.magnetGap,
      PUSH_HOLE: t.pushHole, SEAT_RADIUS: t.seatRadius, LUG_DEPTH: t.lugDepth, LUG_ANGLE: t.lugAngle, LUG_HEIGHT: t.lugHeight, LUGS: t.lugs, LOCK_ANGLE: t.lockAngle,
      TWIST_ENGAGE: t.twistEngage, RIDGE_ANGLE: t.ridgeAngle, STOP_ANGLE: t.stopAngle, RIB_RADIUS: t.ribRadius, RIB_SQUEEZE: t.ribSqueeze, RIBS_PER_SIDE: t.ribsPerSide,
      RIBS_ROUND: t.ribsRound, DETENT_ENGAGE: t.detentEngage, DETENT_SPAN: t.detentSpan, EMBED_SKIN: t.embedSkin, EMBED_HEADROOM: t.embedHeadroom,
    };
    for (const [name, value] of Object.entries(fixed)) expect(source, name).toMatch(new RegExp(`^${name} = ${String(value).replace('.', '\\.')};`, 'm'));
  });

  it('passes the code to OpenSCAD as numbers, encoded again from the text, the error correction and the logo', () => {
    const centre = qrMagnetTag.parts[1] ?? (() => { throw new Error('centre'); })();
    const qr = (parameters: ParameterValues) => Object.fromEntries(scadDefines(qrMagnetTag, centre, { ...defaults, ...parameters }))['QR'] ?? '';
    const vector = (parameters: ParameterValues) => JSON.parse(qr(parameters)) as [number, number, number[][]];
    expect(vector({})[0]).toBe(29);
    expect(vector({ errorCorrection: 'L' })[0]).toBe(25);
    expect(vector({ logo: LEAF })[1]).toBe(7);
    expect(qr({ qrText: 'a"b' })).toMatch(/^[[\]\d,]+$/);
    // the border never sees the code or the logo
    expect(Object.keys(qrMagnetTag.parts[0]?.scadMapping ?? {})).not.toContain('qrText');
  });

  it('refuses modules smaller than a millimetre, with what to do', () => {
    expect(said({ qrText: 'x'.repeat(200) }, 'qrText')).toMatch(/only 0\.\d+ mm wide; at least 1 mm .* Shorten the text, lower the error correction or enlarge the tile\./);
    expect(issues({ qrText: 'x'.repeat(200), errorCorrection: 'L', size: 120 })).toEqual([]);
    expect(said({ qrText: '' }, 'qrText')).toContain('Enter the text');
    // the round twist lock's inscribed code is smaller: the same text needs a larger tile
    expect(issues({ joint: 'twist-lock' })).toEqual([]);
    expect(said({ joint: 'twist-lock', size: 45 }, 'qrText')).toContain('at least 1 mm');
  });

  it('allows a logo only at Q or H, and only as large as the code can lose', () => {
    expect(said({ logo: LEAF, errorCorrection: 'M' }, 'errorCorrection')).toContain('at least Q');
    expect(said({ logo: LEAF, errorCorrection: 'L' }, 'errorCorrection')).toContain('at least Q');
    expect(issues({ logo: LEAF })).toEqual([]);
    // at Q the same text is a smaller code (25 modules), which can lose less: a 7 × 7 pad costs it too many codewords
    expect(said({ logo: LEAF, errorCorrection: 'Q' }, 'logoSize')).toBe('A 20 % logo needs a 7 × 7 module pad, more than this 25 × 25 code at Q can lose. At most 16 %, or choose H.');
    expect(issues({ logo: LEAF, errorCorrection: 'Q', logoSize: 16 })).toEqual([]);
    expect(said({ logo: LEAF, logoSize: 40 }, 'logoSize')).toMatch(/At most \d+ %/);
    expect(said({ logo: 'M0 0L1 0Z' }, 'logo')).not.toBe('');
  });

  it('checks that the relief has two dark layers above the filament change', () => {
    expect(filamentChangeHeight(1.6, 0.2)).toBe(1.6);
    expect(filamentChangeHeight(1.5, 0.2)).toBe(1.6);
    expect(filamentChangeHeight(1.6, 0.12)).toBe(1.68);
    expect(said({ baseThickness: 1.5, reliefHeight: 0.4 }, 'reliefHeight')).toContain('only 1 layer');
    expect(issues({ baseThickness: 1.5, reliefHeight: 0.5 })).toEqual([]);
    expect(qrMagnetTag.derived(defaults).notes?.[0]).toContain('Change to the dark filament at 1.6 mm, before layer 9');
    expect(qrMagnetTag.derived({ ...defaults, baseThickness: 1.5 }).notes?.[0]).toContain('at 1.6 mm');
    expect(qrMagnetTag.derived(defaults).notes?.[1]).toContain('version 3: 29 × 29 modules of 1.43 mm');
    expect(qrMagnetTag.derived({ ...defaults, qrText: '' }).notes).toBeUndefined();
  });

  it('offers every library magnet that fits, and checks its pockets fit the tile', () => {
    expect(QR_TAG_MAGNETS).toEqual(parts.filter(qrTagMagnetFits).map(part => part.id));
    expect(QR_TAG_MAGNETS).toContain(DEFAULT_QR_TAG_MAGNET);
    for (const id of ['supermagnete-q-05-05-02-n', 'supermagnete-r-10-04-05-n', 'supermagnete-csn-10']) expect(qrTagMagnetFits(magnet(id)), id).toBe(false);
    expect(linkedPartData(qrMagnetTag).map(part => part.id)).toEqual([...QR_TAG_MAGNETS]);
    expect(partUsage(magnet(DEFAULT_QR_TAG_MAGNET))).toContainEqual({ modelId: 'qr-magnet-tag', modelTitle: qrMagnetTag.title, via: 'Magnets', kind: 'model' });
    // a round 30 mm tile has no room for 12 mm pockets clear of the push-out hole; a square one has, in its corners
    expect(said({ shape: 'round', size: 30, borderWidth: 5, qrText: 'hi', errorCorrection: 'L', magnet: 'supermagnete-s-12-02-n' }, 'magnet')).toContain('do not fit in the back of a 30 mm tile');
    expect(issues({ size: 30, borderWidth: 3, quietZone: 1, qrText: 'hi', errorCorrection: 'L', magnet: 'supermagnete-s-12-02-n' })).toEqual([]);
    expect(issues({ size: 30, borderWidth: 3, quietZone: 1, qrText: 'hi', errorCorrection: 'L', magnet: 'supermagnete-s-06-02-n' })).toEqual([]);
    expect(said({ joint: 'magnets', size: 40, borderWidth: 4, qrText: 'hi', errorCorrection: 'L', magnet: 'supermagnete-s-12-02-n' }, 'magnet')).toContain('joint magnets');
    expect(issues({ joint: 'magnets' })).toEqual([]);
    // the pockets: the greatest size plus play, as deep as the magnet is high, with the floor's wall over them
    const layout = qrTagLayout(qrTagSettings(defaults));
    for (const [actual, expected] of [[layout.pocketD, 8.3], [layout.pocketDepth, 2.1], [layout.floor, 2.9]] as const) expect(actual).toBeCloseTo(expected, 9);
    expect(layout.backPockets.map(point => point.map(value => Math.round(value * 100) / 100))).toEqual([[24.65, 24.65], [-24.65, -24.65], [-24.65, 24.65], [24.65, -24.65]]);
  });

  it('refuses joints that do not fit their settings', () => {
    expect(said({ joint: 'detent', fit: 0.5 }, 'fit')).toContain('lower the fit to 0.4 mm');
    expect(issues({ joint: 'detent', fit: 0.4 })).toEqual([]);
    expect(said({ joint: 'twist-lock', baseThickness: 0.8, reliefHeight: 0.4, layerHeight: 0.08 }, 'baseThickness')).toContain('lip over the lugs');
    expect(said({ joint: 'twist-lock', borderWidth: 3, size: 120, fit: 0.4 }, 'borderWidth')).toContain('at least 3.1 mm');
    expect(issues({ joint: 'twist-lock', borderWidth: 3, size: 120 })).toEqual([]);
    expect(said({ borderWidth: 20, size: 50 }, 'borderWidth')).toContain('at least 20 mm');
    expect(said({ cornerRadius: 20, size: 30 }, 'cornerRadius')).toContain('At most 14 mm');
  });

  it('embeds the magnets in sealed cavities that close at a pause height on a layer boundary', () => {
    const layout = (parameters: ParameterValues) => qrTagLayout(qrTagSettings({ ...defaults, magnetMount: 'embedded', ...parameters }));
    // 0.4 mm of skin, the 2.1 mm magnet and 0.05 mm of headroom: the cavity closes at 2.6 mm (a layer boundary), under 0.8 mm of floor
    expect(layout({})).toMatchObject({ embedded: true, skin: 0.4, pauseHeight: 2.6, backMagnetZ: 0.4 });
    expect(layout({}).floor).toBeCloseTo(3.4, 9);
    // the layer height moves the pause onto its layers: 0.48 mm of skin and a pause at 2.64 mm at 0.12 mm layers; 0.64 and 2.88 at 0.32
    expect(layout({ layerHeight: 0.12 })).toMatchObject({ skin: 0.48, pauseHeight: 2.64 });
    expect(layout({ layerHeight: 0.32 })).toMatchObject({ skin: 0.64, pauseHeight: 2.88 });
    // with the magnet joint, the seat's magnets are embedded at the same height (one pause), and the centre's stands into an open
    // pocket above the floor over them
    const joint = layout({ joint: 'magnets' });
    expect(joint.seatMagnetZ).toBe(joint.skin);
    expect(joint.floor).toBeCloseTo(joint.pauseHeight + QR_TAG.floorWall + joint.protrusion + QR_TAG.magnetGap, 9);
    expect(issues({ magnetMount: 'embedded', joint: 'magnets' })).toEqual([]);
    // the editor says where to pause, and how many magnets go in
    expect(qrMagnetTag.derived({ ...defaults, magnetMount: 'embedded' }).notes).toContain('Border: pause the print at 2.6 mm, before layer 14 at 0.2 mm layers, and drop the 4 magnets into their cavities; then resume.');
    expect(qrMagnetTag.derived({ ...defaults, magnetMount: 'embedded', joint: 'magnets', magnetCount: 2 }).notes?.join(' ')).toContain('drop the 4 magnets');
    expect(qrMagnetTag.derived(defaults).notes?.join(' ')).not.toContain('pause');
    expect(qrMagnetTag.parts.find(part => part.id === 'border')?.sealedVoids).toBe(true);
    // embedded magnets are in the border from the start: no step of their own, and no gluing step for the seat's
    const assembly = resolveAssembly(qrMagnetTag, qrMagnetTag.assembly, { ...defaults, magnetMount: 'embedded', joint: 'magnets' });
    expect(assembly?.steps.map(step => step.title)).toEqual(['Set the centre onto the joint magnets']);
    expect(assembly?.poses['magnet-back-1']?.position[2]).toBe(0.4);
    expect(assembly?.poses['magnet-seat-1']?.position[2]).toBe(0.4);
  });

  it('assembles both parts and the magnets, in steps that suit the joint', () => {
    for (const joint of QR_TAG_JOINTS) for (const magnetCount of [2, 4]) {
      const all = { ...defaults, joint, magnetCount };
      const assembly = resolveAssembly(qrMagnetTag, qrMagnetTag.assembly, all);
      if (!assembly) throw new Error('Expected an assembly');
      expect(Value.Check(AssemblySchema, assembly)).toBe(true);
      const layout = qrTagLayout(qrTagSettings(all));
      expect(assembly.poses['centre']?.position).toEqual([0, 0, layout.floor]);
      const magnets = Object.keys(assembly.poses).filter(id => id.startsWith('magnet-'));
      expect(magnets).toHaveLength(joint === 'magnets' ? 3 * magnetCount : magnetCount);
      expect(assembly.steps.at(-1)).toEqual({ title: 'Press the magnets into the back', parts: magnets.filter(id => id.startsWith('magnet-back')), from: [0, 0, -12] });
      // the centre's joint magnets move with the centre
      if (joint === 'magnets') expect(assembly.steps.find(step => step.parts.includes('centre'))?.parts).toContain('magnet-centre-1');
      expect(assembly.motion?.length ?? 0).toBe(joint === 'twist-lock' ? 1 : 0);
    }
    const twist = qrMagnetTagAssembly({ ...defaults, joint: 'twist-lock' });
    expect(twist.steps.map(step => step.title)).toEqual(['Drop the centre in, its lugs through the notches']);
    expect(twist.motion?.[0]?.frames.at(-1)).toEqual({ centre: { position: [0, 0, expect.closeTo(2.9, 9)], rotation: [0, 0, -QR_TAG.lockAngle] } });
    // the magnets sit in their pockets: the back ones flush with the back, a joint pair QR_TAG.magnetGap apart
    const layout = qrTagLayout(qrTagSettings({ ...defaults, joint: 'magnets' }));
    const pose = (id: string) => resolveAssembly(qrMagnetTag, qrMagnetTag.assembly, { ...defaults, joint: 'magnets' })?.poses[id]?.position ?? [];
    expect(pose('magnet-back-1')).toEqual([...(layout.backPockets[0] ?? []), 0]);
    expect((pose('magnet-centre-1')[2] ?? 0) - (pose('magnet-seat-1')[2] ?? 0) - layout.pocketDepth).toBeCloseTo(QR_TAG.magnetGap, 9);
    expect((pose('magnet-centre-1')[2] ?? 0) + layout.pocketDepth).toBeCloseTo(layout.floor + layout.centrePocket, 9);
  });
});
