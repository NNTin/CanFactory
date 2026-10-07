import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Value } from 'typebox/value';
import { activeParts, artifactFormat, findModel, linkedPartData, modelSourcePaths, partUsage, scadDefines, springBallDetent, validateParameters, type ParameterValues } from './models.ts';
import { resolveAssembly } from './assembly.ts';
import { modelBom, RenderRequestSchema } from './index.ts';
import { dimensionOf, findPart, parts } from './parts/index.ts';
import {
  DETENT, DETENT_BALLS, DETENT_SET_SCREWS, DETENT_SPRINGS, DETENT_THREADS, HEX_KEYS, lipOverlap, protrusionRange, SPRING_BALL_DETENT_DEFAULT,
  springBallDetentLayout, type SpringBallDetentSize,
} from './springBallDetent.ts';

const part = (id: string) => findPart(id) ?? (() => { throw new Error(`Missing ${id}`); })();
const scad = readFileSync(new URL('../../../models/spring-ball-detent/generator.scad', import.meta.url), 'utf8');
const escape = (literal: string) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const defaults = springBallDetent.defaults;
const fields = (overrides: ParameterValues) => validateParameters(springBallDetent, { ...defaults, ...overrides }).map(issue => issue.field);
const layoutOf = (overrides: ParameterValues = {}) => {
  const p = { ...defaults, ...overrides } as unknown as SpringBallDetentSize & { ball: string; spring: string; setScrew: string };
  return springBallDetentLayout(p, { ball: part(p.ball), spring: part(p.spring), setScrew: part(p.setScrew) });
};

describe('spring ball detent contract', () => {
  it('is a registered body-and-cap assembly whose cap is only printed for the press cap', () => {
    expect(findModel('spring-ball-detent')).toBe(springBallDetent);
    expect(artifactFormat(springBallDetent)).toBe('zip');
    expect(modelSourcePaths(springBallDetent)).toEqual(Array(2).fill('models/spring-ball-detent/generator.scad'));
    expect(springBallDetent.license).toBe('CC BY 4.0');
    expect(defaults).toEqual(SPRING_BALL_DETENT_DEFAULT);
    expect(validateParameters(springBallDetent, defaults)).toEqual([]);
    expect(activeParts(springBallDetent, defaults).map(p => p.id)).toEqual(['body', 'cap']);
    expect(activeParts(springBallDetent, { ...defaults, retention: 'set-screw' }).map(p => p.id)).toEqual(['body']);
    expect(Value.Check(RenderRequestSchema, { modelId: 'spring-ball-detent', modelVersion: '1', parameters: defaults })).toBe(true);
    expect(Value.Check(RenderRequestSchema, { modelId: 'spring-ball-detent', modelVersion: '1', parameters: { ...defaults, thread: 'M5' } })).toBe(false);
  });

  it('offers every ball, spring and set screw of the library, and links them', () => {
    expect([...DETENT_BALLS]).toEqual(parts.filter(p => p.family === 'ball').map(p => p.id));
    expect([...DETENT_SPRINGS]).toEqual(parts.filter(p => p.family === 'spring').map(p => p.id));
    expect([...DETENT_SET_SCREWS]).toEqual(parts.filter(p => p.family === 'set-screw').map(p => p.id));
    for (const id of [defaults['ball'], defaults['spring'], defaults['setScrew']])
      expect(partUsage(part(String(id))).map(use => use.modelId)).toContain('spring-ball-detent');
    expect(linkedPartData(springBallDetent).map(entry => entry.id)).toEqual([...DETENT_BALLS, ...DETENT_SPRINGS, ...DETENT_SET_SCREWS]);
  });

  it('keeps every SCAD default equal to the contract default it is mapped from, and the fixed rules equal', () => {
    for (const piece of springBallDetent.parts)
      for (const [name, literal] of scadDefines(springBallDetent, piece, defaults)) if (name !== 'PART') expect(scad, name).toMatch(new RegExp(`^${name} = ${escape(literal)};`, 'm'));
    const rules: [string, number][] = [['WALL', DETENT.wall], ['LIP_EDGE', DETENT.lipEdge], ['MIN_PRELOAD', DETENT.minPreload.mm], ['MIN_PRELOAD_SHARE', DETENT.minPreload.share],
      ['PRELOAD_SHARE', DETENT.preloadShare], ['CAP_MIN', DETENT.capMin], ['CAP_PLAY', DETENT.capPlay], ['CAP_RIB_COUNT', DETENT.capRibs], ['CAP_RIB_WIDTH', DETENT.capRibWidth], ['KEY_PLAY', DETENT.keyPlay]];
    for (const [name, value] of rules) expect(scad, name).toMatch(new RegExp(`^${name} = ${value};`, 'm'));
    expect(scad).toMatch(new RegExp(`^HEX_KEYS = \\[${HEX_KEYS.join(', ')}\\];`, 'm'));
  });

  it('lays the default out: the ball 0.8 mm out of a 4.85 mm bore, the spring preloaded and short of its least length when pushed in', () => {
    const l = layoutOf();
    expect(l.bore).toBeCloseTo(4.5475 + 0.3, 6);
    expect(l.centre + l.r - Number(defaults['bodyLength'])).toBeCloseTo(0.8, 9);
    // the lip reaches the least overlap over the smallest ball, or more
    expect((dimensionOf(part('steel-ball-4-5-g100'), 'd', 'min') - l.opening) / 2).toBeGreaterThanOrEqual(lipOverlap(part('steel-ball-4-5-g100')));
    expect(l.installed).toBeGreaterThan(l.shortest); expect(l.installed).toBeLessThan(l.longest);
    expect(l.installed - Number(defaults['travel'])).toBeGreaterThan(l.least);
    expect(l.force.out).toBeCloseTo(4.559 * (9.6 - l.installed), 9);
    expect(l.force.in - l.force.out).toBeCloseTo(4.559, 9);
    expect(l.tool).toMatchObject({ kind: 'slot', width: 2, depth: 2.5 });
    expect(l.cap.length + l.tool.depth).toBeCloseTo(l.seat, 9);
    // the hex socket takes the smallest key that passes the cap's ribs: 5 mm, 5 mm deep
    expect(layoutOf({ toolFeature: 'hex' }).tool).toMatchObject({ kind: 'hex', key: 5, depth: 5 });
    expect(springBallDetent.derived(defaults).notes?.[1]).toContain('Press the 9.6 mm cap in');
  });

  it('refuses each infeasible choice with the parameter to change', () => {
    expect(fields({ thread: 'M6' })).toEqual(['ball']); // a 4.5 mm ball leaves no wall in an M6 body
    expect(fields({ ball: 'steel-ball-3-g100', protrusion: 0.3, travel: 0.5 })).toEqual(['spring']); // D-107 is wider than a 3 mm ball's bore
    expect(fields({ ball: 'steel-ball-6-g100', spring: 'gutekunst-d-024' })).toEqual(['spring']); // a 2.25 mm spring wanders in a 6.35 mm bore
    expect(fields({ protrusion: 1 })).toEqual(['protrusion']);
    expect(fields({ protrusion: 0.2, travel: 0.2 })).toEqual(['protrusion']);
    expect(fields({ travel: 0.5 })).toEqual(['travel']);
    expect(fields({ travel: 4 })).toEqual(['travel']); // D-107 deflects 4.32 mm, less 0.43 mm of preload
    expect(fields({ bodyLength: 14 })).toEqual(['bodyLength']);
    expect(fields({ retention: 'set-screw', setScrew: 'iso-4026-m4x4' })).toEqual(['setScrew']); // its 3.3 mm tap hole does not pass the ball
    expect(fields({ retention: 'set-screw', setScrew: 'iso-4026-m8x8', bodyLength: 30 })).toEqual(['setScrew']); // M8 leaves no wall in M10
    expect(fields({ retention: 'set-screw', bodyLength: 20 })).toEqual(['bodyLength']);
    expect(fields({ retention: 'set-screw', toolFeature: 'hex', bodyLength: 30 })).toEqual(['toolFeature']);
    expect(validateParameters(springBallDetent, { ...defaults, retention: 'set-screw' })).toEqual([]);
    expect(validateParameters(springBallDetent, { ...defaults, toolFeature: 'hex' })).toEqual([]);
    expect(validateParameters(springBallDetent, { ...defaults, thread: 'M12', retention: 'set-screw', toolFeature: 'hex', bodyLength: 28 })).toEqual([]);
  });

  it('has a working ball and spring for every thread, and every valid choice keeps its walls and its spring short of solid', () => {
    for (const thread of DETENT_THREADS) {
      let valid = 0;
      for (const ball of DETENT_BALLS) for (const spring of DETENT_SPRINGS) for (const retention of ['press-cap', 'set-screw']) for (const toolFeature of ['slot', 'hex']) {
        const range = protrusionRange(part(ball));
        const protrusion = Math.ceil(range.min * 20) / 20;
        const overrides = { thread, ball, spring, retention, toolFeature, protrusion, travel: protrusion, bodyLength: 40, setScrew: 'iso-4026-m3x3' };
        if (validateParameters(springBallDetent, { ...defaults, ...overrides }).length > 0) continue;
        valid++;
        const l = layoutOf(overrides);
        expect(l.bore, `${thread} ${ball}`).toBeLessThanOrEqual(l.thread.maxHole + 1e-9);
        expect(l.installed - protrusion, `${thread} ${ball} ${spring}`).toBeGreaterThanOrEqual(l.least - 1e-9);
        expect(dimensionOf(part(spring), 'De', 'max'), `${ball} ${spring}`).toBeLessThanOrEqual(l.bore + 1e-9);
      }
      expect(valid, thread).toBeGreaterThan(0);
    }
  });

  it('puts the ball up into the bore onto the lip, then the press cap or the set screw at its nominal preload', () => {
    const assembly = resolveAssembly(springBallDetent, springBallDetent.assembly, defaults);
    expect(assembly?.steps.map(step => step.title)).toEqual(['Drop the ball into the back, then the spring', 'Press the cap in, flush with the slot’s floor']);
    const l = layoutOf();
    expect(assembly?.poses['cap']).toEqual({ position: [0, 0, 2.5] });
    expect(assembly?.poses['ball']?.position[2]).toBeCloseTo(l.centre - 4.5475 / 2, 9);
    const screwed = resolveAssembly(springBallDetent, undefined, { ...defaults, retention: 'set-screw' });
    expect(screwed?.steps.map(step => step.parts)).toEqual([['ball'], ['set-screw']]);
    expect(screwed?.poses['set-screw']).toEqual({ position: [0, 0, layoutOf({ retention: 'set-screw' }).seat], rotation: [180, 0, 0] });
    expect(screwed?.references?.map(reference => reference.part)).toEqual(['steel-ball-4-5-g100', 'gutekunst-d-107', 'iso-4026-m6x6']);
    // the hardware list: the ball, the spring and the set screw
    expect(modelBom(springBallDetent, { ...defaults, retention: 'set-screw' }).map(line => line.partId)).toEqual(['steel-ball-4-5-g100', 'gutekunst-d-107', 'iso-4026-m6x6']);
  });
});
