import { readFileSync } from 'node:fs';
import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import { artifactFormat, catCollarTag, catCollarTagSettings, COLLAR_TAG_COLLARS, COLLAR_TAG_MAGNETS, COLLAR_TAG_NFC_TAGS, COLLAR_TAG_SPLIT_RINGS, collarTagMagnetFits, DEFAULT_CAT_COLLAR_TAG, findModel, linkedPartData, partUsage, scadDefines, validateParameters, type ParameterValues } from './models.ts';
import { RenderRequestSchema } from './index.ts';
import { findPart, parts, partsOfFamily } from './parts/index.ts';
import { activeParts } from './models.ts';
import { COLLAR_TAG, COLLAR_TAG_SHAPES, collarTagLayout, insideShape, outlineHeight, shapeArea, shapeGeometry, textBlock } from './catCollarTag.ts';
import { toLayers } from './printPause.ts';
import { TEXT_EXTENTS } from './textMetrics.ts';

const source = readFileSync(new URL('../../../models/cat-collar-tag/generator.scad', import.meta.url), 'utf8');
const defaults = catCollarTag.defaults;
const issues = (parameters: ParameterValues) => validateParameters(catCollarTag, { ...defaults, ...parameters });
const said = (parameters: ParameterValues, field: string) => issues(parameters).filter(issue => issue.field === field).map(issue => issue.message).join(' ');
const layoutFor = (parameters: ParameterValues) => collarTagLayout(catCollarTagSettings({ ...defaults, ...parameters }));
const notes = (parameters: ParameterValues) => catCollarTag.derived({ ...defaults, ...parameters }).notes ?? [];
const blank = { frontMark: 'none', backMark: 'none' };

describe('cat collar tag contract', () => {
  it('is a registered one-part model whose defaults validate', () => {
    expect(findModel('cat-collar-tag')).toBe(catCollarTag);
    expect(artifactFormat(catCollarTag)).toBe('zip');
    expect(defaults).toEqual(DEFAULT_CAT_COLLAR_TAG);
    expect(issues({})).toEqual([]);
    expect(Value.Check(RenderRequestSchema, { modelId: 'cat-collar-tag', modelVersion: '1', parameters: defaults })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'cat-collar-tag', modelVersion: '1', parameters: { ...defaults, frontLine1: 'Mïa' } })).toBe(false);
    expect(Value.Check(RenderRequestSchema, { modelId: 'cat-collar-tag', modelVersion: '1', parameters: { ...defaults, frontLine1: 'x'.repeat(17) } })).toBe(false);
  });

  it('keeps every SCAD default and fixed size equal to the contract', () => {
    const [part] = catCollarTag.parts;
    for (const [name, literal] of scadDefines(catCollarTag, part ?? {}, defaults).filter(([name]) => name !== 'PART'))
      expect(source, name).toMatch(new RegExp(`^${name} = ${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')};`, 'm'));
    const t = COLLAR_TAG;
    const fixed: Record<string, number> = {
      SIDE_WALL: t.sideWall, COVER_WALL: t.coverWall, CORE_WALL: t.coreWall, EMBED_SKIN: t.embedSkin, EMBED_HEADROOM: t.embedHeadroom, POCKET_PLAY: t.pocketPlay,
      NFC_GAP: t.nfcGap, HOLE_PLAY: t.holePlay, HOLE_MIN: t.holeMin, HANG_GAP: t.hangGap, RING_PLAY: t.ringPlay, RING_CLEARANCE: t.ringClearance,
      SLOT_LENGTH_PLAY: t.slotLengthPlay, MIN_MIDDLE: t.minMiddle, TEXT_MARGIN: t.textMargin, LINE_PITCH: t.linePitch, CORNER_ROUND: t.cornerRound,
      EDGE_STEP: t.edgeStep, INSET_GRID: t.insetGrid, OVERLAP: t.overlap,
      CARRIER_ROUND: t.carrierRound, CARRIER_EDGE: t.carrierEdge, TAB_GAP: t.tabGap, TAB_T: t.tabThickness, MIN_OPENING: t.minOpening,
      FLAP_GAP: t.flapGap, BUMP: t.bump, BUMP_PLAY: t.bumpPlay, HINGE: t.hinge,
    };
    expect(Object.keys(fixed)).toHaveLength(Object.keys(t).length);
    for (const [name, value] of Object.entries(fixed)) expect(source, name).toMatch(new RegExp(`^${name} = ${value};`, 'm'));
    // the lines' layout needs each font's extents, as text() draws them
    for (const [font, extents] of Object.entries(TEXT_EXTENTS))
      expect(source).toMatch(new RegExp(`name == "${font}" \\? \\[${extents.below}, ${extents.above}\\]|\\[${extents.below}, ${extents.above}\\];`));
  });

  it('offers every library part that fits, and links the model to them', () => {
    expect(COLLAR_TAG_MAGNETS).toEqual(parts.filter(collarTagMagnetFits).map(part => part.id));
    expect(COLLAR_TAG_NFC_TAGS).toEqual(partsOfFamily('nfc-tag').map(part => part.id));
    expect(COLLAR_TAG_SPLIT_RINGS).toEqual(partsOfFamily('split-ring').map(part => part.id));
    expect(COLLAR_TAG_COLLARS).toEqual(partsOfFamily('cat-collar').map(part => part.id));
    expect(linkedPartData(catCollarTag).map(part => part.id)).toEqual(expect.arrayContaining([...COLLAR_TAG_NFC_TAGS, ...COLLAR_TAG_MAGNETS, ...COLLAR_TAG_SPLIT_RINGS, ...COLLAR_TAG_COLLARS]));
    for (const id of [DEFAULT_CAT_COLLAR_TAG.splitRing, DEFAULT_CAT_COLLAR_TAG.nfcTag, DEFAULT_CAT_COLLAR_TAG.collar, DEFAULT_CAT_COLLAR_TAG.magnet])
      expect(partUsage(findPart(id) ?? (() => { throw new Error(id); })()).map(usage => usage.modelId), id).toContain('cat-collar-tag');
  });

  it('keeps each outline’s free area inside it, with its hanging point on its top', () => {
    for (const shape of COLLAR_TAG_SHAPES) for (const [width, height] of [[20, 14], [30, 22], [45, 30], [60, 40]] as const) {
      const W = width, H = outlineHeight(shape, width, height);
      if (shape === 'bone' && W < 1.4 * H) continue;
      const { box, hang } = shapeGeometry(shape, W, H);
      for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
        // a hair inside the box: its corners may lie exactly on the outline
        const x = box.x + (box.w / 2 - 1e-6) * (i / 5 - 1), y = box.y + (box.h / 2 - 1e-6) * (j / 5 - 1);
        expect(insideShape(shape, W, H, x, y), `${shape} ${W} × ${H}: (${x.toFixed(2)}, ${y.toFixed(2)})`).toBe(true);
      }
      expect(insideShape(shape, W, H, hang[0], hang[1] - 0.05), `${shape} hang`).toBe(true);
      expect(insideShape(shape, W, H, hang[0], hang[1] + 0.05), `${shape} hang`).toBe(false);
      // the outline fills its bounding box sensibly
      expect(shapeArea(shape, W, H)).toBeGreaterThan(box.w * box.h);
      expect(shapeArea(shape, W, H)).toBeLessThan(W * H);
    }
  });

  it('gates the thickness on the embedded item, the pockets and the engravings', () => {
    const t = COLLAR_TAG;
    // an embedded magnet: skin (with the back's engraving) and the magnet, up to a pause on a layer, a cover and the front's engraving
    const magnet = { magnetMount: 'embedded', magnet: 'supermagnete-s-08-02-n' };
    const least = toLayers(toLayers(t.embedSkin + 0.6, 0.2) + 2.1 + t.embedHeadroom, 0.2) + t.coverWall + 0.6;
    expect(layoutFor(magnet).minThickness).toBeCloseTo(least, 6);
    expect(said({ ...magnet, thickness: 4.3 }, 'thickness')).toContain(`at least ${Math.round(least * 10) / 10} mm`);
    expect(said({ ...magnet, thickness: 4.3 }, 'thickness')).toContain('The engravings over and under it add 1.2 mm');
    expect(issues({ ...magnet, thickness: least })).toEqual([]);
    // the same magnet with both faces blank needs 1.2 mm less, and a 1 mm magnet another 1 mm less
    expect(layoutFor({ ...magnet, ...blank }).minThickness).toBeCloseTo(least - 1.2, 6);
    expect(layoutFor({ ...magnet, ...blank, magnet: 'supermagnete-s-08-01-n' }).minThickness).toBeCloseTo(least - 2.2, 6);
    // an NFC tag is thin: embedded in a blank tag it needs 1.4 mm, in a pocket 0.8 mm (thinner than the least tag)
    expect(layoutFor({ nfc: 'embedded', ...blank }).minThickness).toBeCloseTo(1.4, 6);
    expect(said({ nfc: 'embedded', ...blank, thickness: 1.3 }, 'thickness')).toContain('An embedded 0.2 mm NFC tag needs a tag at least 1.4 mm thick');
    expect(issues({ nfc: 'pocket', ...blank, thickness: 1.2, edgeRadius: 0.4 })).toEqual([]);
    // the pause is on a layer boundary at every layer height
    for (const layerHeight of [0.08, 0.12, 0.2, 0.28, 0.32]) {
      const layout = layoutFor({ ...magnet, layerHeight });
      expect(Math.abs(layout.pauseHeight / layerHeight - Math.round(layout.pauseHeight / layerHeight))).toBeLessThan(1e-6);
      expect(layout.pauseHeight - layout.skin).toBeGreaterThanOrEqual(2.1 + t.embedHeadroom - 1e-9);
    }
  });

  it('embeds only one of the NFC tag and the magnets, and keeps open pockets off a marked back', () => {
    expect(said({ nfc: 'embedded', magnetMount: 'embedded', thickness: 4 }, 'magnetMount')).toContain('Only one of the NFC tag and the magnets can be embedded');
    expect(said({ nfc: 'pocket' }, 'backMark')).toContain('Open pockets are in the back');
    expect(said({ magnetMount: 'pocket', thickness: 3 }, 'backMark')).toContain('Open pockets are in the back');
    expect(said({ magnetMount: 'embedded', thickness: 3.4, magnet: 'supermagnete-s-05-01-n' }, 'backMark')).toBe('');
  });

  it('keeps the magnets clear of the NFC tag’s antenna, and both inside the free area', () => {
    const both = { nfc: 'embedded', nfcTag: 'gototags-gml7cqg3v7', magnetMount: 'pocket', magnetCount: 2, magnet: 'supermagnete-s-04-02-n', backMark: 'none', shape: 'rounded-rectangle', height: 36, thickness: 3.4 };
    expect(said({ ...both, width: 45 }, 'magnet')).toContain('5 mm clear of the NFC tag’s antenna');
    expect(issues({ ...both, width: 60 })).toEqual([]);
    const layout = layoutFor({ ...both, width: 60 });
    for (const [x] of layout.magnets) expect(Math.abs(x - layout.area.x) - layout.magnetPocket / 2).toBeGreaterThanOrEqual(11 + COLLAR_TAG.nfcGap - 1e-9);
    expect(said({ nfc: 'embedded', nfcTag: 'gototags-bzkx3zlhxx', thickness: 2.6 }, 'nfcTag')).toContain('NFC tag needs a free area');
    expect(said({ magnetMount: 'embedded', magnetCount: 2, magnet: 'supermagnete-s-10-02-n', thickness: 4.5 }, 'magnetCount')).toContain('Two magnets do not fit side by side');
  });

  it('sizes the bail for the split ring, and checks the ring goes round it and the D-ring', () => {
    const layout = layoutFor({});
    const ring = findPart('avco-kr-9335');
    const a = ring?.dimensions['a']?.value ?? 0, b = ring?.dimensions['b']?.value ?? 0;
    expect(layout.holeD).toBeGreaterThanOrEqual(Math.hypot(a, b) + COLLAR_TAG.holePlay - 1e-9);
    expect(layout.holeD).toBe(3.7);
    // the hole is just above the outline's top, the bail round it
    expect(layout.hole[1] - layout.holeD / 2).toBeCloseTo(15 + COLLAR_TAG.hangGap, 6);
    expect(layout.bounds.y).toBeCloseTo(15 + COLLAR_TAG.hangGap + layout.holeD + 2 + 15, 6);
    // the 9 mm ring cannot go round a thick bail, nor hold a thick D-ring beside it
    expect(said({ splitRing: 'avco-kr-90920', thickness: 5 }, 'splitRing')).toContain('too small to go round the tag’s bail');
    expect(issues({ splitRing: 'avco-kr-90920', thickness: 2.4 })).toEqual([]);
    expect(said({ splitRing: 'avco-kr-90920', thickness: 2.4, dRingWire: 4, bailWall: 4 }, 'splitRing')).toContain('D-ring side by side');
  });

  it('cuts slide-on slots for the chosen collar, with room for the text between them', () => {
    const slideOn = { attachment: 'slide-on', shape: 'rounded-rectangle', width: 45, height: 20, backMark: 'none', frontTextSize: 4 };
    expect(issues(slideOn)).toEqual([]);
    const layout = layoutFor(slideOn);
    expect(layout.slots).toHaveLength(2);
    expect(layout.slotLength).toBeCloseTo(10 + 2 * COLLAR_TAG.slotLengthPlay, 6);
    expect(layout.slotWidth).toBeCloseTo(1.18 + 0.3, 6);
    expect(layout.area.w).toBeGreaterThanOrEqual(COLLAR_TAG.minMiddle);
    // the LupinePet's 1/2" strap needs a taller tag; a narrow tag leaves no room between the slots
    expect(said({ ...slideOn, height: 16, collar: 'lupinepet-original-designs-safety-cat-collar' }, 'height')).toContain('12.7 mm strap needs 13.7 mm slots');
    expect(said({ ...slideOn, width: 22 }, 'width')).toContain('Between the slots only');
    expect(notes(slideOn).join(' ')).toContain('in front of the end bars and behind the middle');
  });

  it('fits each face’s text and logo in the free area', () => {
    expect(said({ frontLine1: 'Mr Whiskers', frontTextSize: 6 }, 'frontLine1')).toMatch(/This front text is about [\d.]+ mm wide/);
    expect(said({ backLine1: 'I', backLine2: 'I', backTextSize: 9 }, 'backTextSize')).toContain('The back text’s lines are');
    expect(said({ frontMark: 'logo', frontLogo: 'M0 0L10 0L10 10Z', frontLogoSize: 25 }, 'frontLogoSize')).toContain('at most 20.2 mm high');
    expect(said({ backMark: 'logo', backLogo: 'not a logo' }, 'backLogo')).not.toBe('');
    // two lines are a pitch apart, plus one line's height
    const block = textBlock('sans', ['a', 'b'], 4);
    expect(block.height).toBeCloseTo(COLLAR_TAG.linePitch * 4 + (1.031 + 0.309) * 4, 6);
    // a blank line is no line, and a blank face is no mark
    expect(layoutFor({ frontLine1: ' ', frontLine2: '' }).frontDepth).toBe(0);
  });

  it('hangs the tag from a clip or a sleeve on the strap, a second part sized for the collar', () => {
    for (const attachment of ['clip', 'sleeve'] as const) {
      expect(issues({ attachment })).toEqual([]);
      expect(activeParts(catCollarTag, { ...defaults, attachment }).map(part => part.id)).toEqual(['tag', attachment]);
      const layout = layoutFor({ attachment });
      // the tag keeps its bail; the carrier's channel takes the strap with the fit on each side, its tab the ring
      expect(layout.hanging).toBe(true);
      const c = layout.carrier ?? (() => { throw new Error('no carrier'); })();
      expect(c.channelW).toBeCloseTo(10 + 2 * 0.2, 6);
      expect(c.channelT).toBeCloseTo(1.18 + 2 * 0.2, 6);
      expect(c.tabR).toBeCloseTo(layout.holeD / 2 + 2, 6);
      expect(c.hole[0] - c.tabR).toBeCloseTo(-1.6, 6);
      expect(c.bounds.z).toBe(8);
    }
    expect(activeParts(catCollarTag, defaults).map(part => part.id)).toEqual(['tag']);
    expect(layoutFor({}).carrier).toBeNull();
    // the clip's lips must leave room for the strap; a wrap sleeve's flaps overlap by the lips and the click
    expect(said({ attachment: 'clip', lipDepth: 4 }, 'lipDepth')).toContain('leave only 2.4 mm between them');
    const wrap = layoutFor({ attachment: 'sleeve', sleeveStyle: 'wrap' }).carrier;
    expect(wrap?.overlap).toBeCloseTo(1.2 + 2 * (COLLAR_TAG.bump + COLLAR_TAG.bumpPlay), 6);
    expect(wrap?.bounds.x).toBeCloseTo(Math.max(1.58 + 3 * 1.6 + COLLAR_TAG.flapGap, (wrap?.tabR ?? NaN) * 2), 6);
    expect(said({ attachment: 'sleeve', sleeveStyle: 'wrap', collar: 'rogz-kiddycat-8mm', lipDepth: 4 }, 'lipDepth')).toBe('');
    // the ring goes round the tag's bail and the tab, and holds both side by side
    expect(said({ attachment: 'clip', bailWall: 4, splitRing: 'avco-kr-90920' }, 'splitRing')).toContain('the clip’s tab side by side');
    expect(issues({ attachment: 'clip', splitRing: 'avco-kr-90920', thickness: 2.4 })).toEqual([]);
    expect(notes({ attachment: 'clip' }).join(' ')).toContain('Snap it onto the strap from the outside');
    expect(notes({ attachment: 'sleeve', sleeveStyle: 'wrap' }).join(' ')).toContain('until it clicks');
    // in the preview the ring hangs from the tab, through the tab's hole at its top and the tag's at its bottom
    const p = { ...defaults, attachment: 'clip' };
    const assembly = catCollarTag.assemblyForParameters(p);
    const ring = catCollarTag.linkedReferences(p).find(reference => reference.id === 'split-ring');
    const layout = layoutFor({ attachment: 'clip' });
    const mean = (17.018 + 12.954) / 4, base = assembly.poses['clip']?.position[2] ?? NaN;
    expect(ring?.pose.position[1]).toBeCloseTo((layout.carrier?.hole[1] ?? NaN) - mean, 6);
    expect(ring?.pose.position[2]).toBeCloseTo(base + COLLAR_TAG.tabThickness / 2, 6);
    const tag = assembly.poses['tag']?.position ?? [];
    expect((tag[1] ?? NaN) + layout.hole[1]).toBeCloseTo((layout.carrier?.hole[1] ?? NaN) - 2 * mean, 6);
    expect(assembly.steps[0]?.parts).toEqual(['clip', 'tag']);
  });

  it('says where to pause and change filament, and what the tag weighs', () => {
    expect(notes({}).join(' ')).toMatch(/A round tag, 30 mm × 36 mm × 2.4 mm with its bail: about \d\.\d g in PLA/);
    expect(notes({ magnetMount: 'embedded', magnetCount: 2, width: 36, thickness: 3.4, magnet: 'supermagnete-s-05-01-n' }).join(' '))
      .toContain('Pause the print at 2.2 mm, before layer 12 at 0.2 mm layers, and drop the 2 magnets into their cavities');
    expect(notes({ nfc: 'embedded', ...blank, thickness: 1.4 }).join(' ')).toContain('Pause the print at 0.8 mm, before layer 5 at 0.2 mm layers, and drop the NFC tag into its cavity');
    expect(notes({ frontStyle: 'emboss' }).join(' ')).toContain('change filament at 2.4 mm, before layer 13');
    expect(notes({ nfc: 'pocket', backMark: 'none', thickness: 1.6 }).join(' ')).toContain('stick the NFC tag into the pocket');
  });

  it('shows the hardware where the generator cuts for it, the ring through the bail and the strap through the slots', () => {
    const at = (parameters: ParameterValues) => {
      const p = { ...defaults, ...parameters };
      return { references: catCollarTag.linkedReferences(p), layout: layoutFor(parameters), base: catCollarTag.assemblyForParameters(p).poses['tag']?.position[2] ?? NaN };
    };
    // hanging: the ring's band passes through the hole's centre; nothing below the floor
    const hanging = at({});
    const ring = hanging.references.find(reference => reference.id === 'split-ring');
    const mean = (17.018 + 12.954) / 4;
    expect(ring?.pose.position[1]).toBeCloseTo(hanging.layout.hole[1] + mean, 6);
    expect(hanging.base).toBeCloseTo(17.018 / 2 - 1.2, 6);
    // slide-on: five pieces of the strap, touching end to end, through the slots
    const slideOn = at({ attachment: 'slide-on', shape: 'rounded-rectangle', width: 45, height: 20, backMark: 'none', frontTextSize: 4 });
    const strap = slideOn.references.filter(reference => reference.id.startsWith('strap'));
    expect(strap.map(reference => reference.id)).toEqual(['strap-left', 'strap-left-slot', 'strap-middle', 'strap-right-slot', 'strap-right']);
    const middle = strap[2];
    expect((middle?.pose.scale?.[0] ?? 0) * 60).toBeCloseTo(2 * slideOn.layout.slotX - 1.18, 6);
    expect(slideOn.base).toBeCloseTo(1.18, 6);
    // embedded magnets at their cavities' floor, pocketed ones pressed in from below
    const embedded = at({ magnetMount: 'embedded', magnetCount: 2, width: 36, thickness: 3.4, magnet: 'supermagnete-s-05-01-n' });
    const magnets = embedded.references.filter(reference => reference.id.startsWith('magnet'));
    expect(magnets.map(magnet => magnet.pose.position)).toEqual(embedded.layout.magnets.map(([x, y]) => [x, y, embedded.layout.skin + embedded.base]));
  });
});
