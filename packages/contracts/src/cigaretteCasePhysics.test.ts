import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BIC_J25, CIGARETTE_BOX, CIGARETTE_LID, HOLDER_DOME, cigaretteBoxPieces, cigaretteCasePhysics, holderPieces, lidPieces, lighterPieces } from './cigaretteCasePhysics.ts';
import { cigaretteCase } from './models.ts';
import { isConvex, offsetConvex, signedArea } from './physicsPieces.ts';

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const lighter = read('parts/everyday-objects/bic-j25-mini-lighter.scad');
const box = read('models/cigarette-case/reference/11_v11.3__-_honeycomb_-_box.scad');
const holder = read('models/cigarette-case/reference/11_-_Honeycomb_-_minibox.scad');
const lid = read('models/cigarette-case/reference/11_v11.3__-_honeycomb_-_top.scad');
const number = (source: string, name: string) => Number(new RegExp(`^${name} *= *([-\\d.]+);`, 'm').exec(source)?.[1]);
const array = (source: string, name: string) => JSON.parse(new RegExp(`^${name} *= (\\[[\\s\\S]*?\\]\\]);`, 'm').exec(source)?.[1] ?? 'null') as unknown;

describe('cigarette case physics', () => {
  it('copies the lighter’s, the box’s and the holder’s values from their SCAD files', () => {
    expect([number(lighter, 'HEIGHT'), number(lighter, 'WIDTH'), number(lighter, 'THICKNESS'), number(lighter, 'PROFILE_N'), number(lighter, 'BODY_H'), number(lighter, 'BASE_ROUND'), number(lighter, 'TOP_ROUND'), number(lighter, 'HOOD_WALL'), number(lighter, 'WHEEL_D'), number(lighter, 'WHEEL_Y'), number(lighter, 'LEVER_W')])
      .toEqual([BIC_J25.height, BIC_J25.width, BIC_J25.thickness, BIC_J25.profileN, BIC_J25.bodyH, BIC_J25.baseRound, BIC_J25.topRound, BIC_J25.hoodWall, BIC_J25.wheelD, BIC_J25.wheelY, BIC_J25.leverW]);
    expect(lighter).toMatch(/^HOOD_Z0 = BODY_H - 1\.5;/m);
    expect(BIC_J25.hoodZ0).toBe(BIC_J25.bodyH - 1.5);
    expect(lighter).toMatch(/^LEVER_Y = \[3\.4, 9\];/m);
    expect(lighter).toMatch(/^LEVER_TOP = BODY_H \+ 5;/m);
    expect(BIC_J25.leverTop).toBe(BIC_J25.bodyH + 5);
    expect([number(box, 'TOP_Z'), number(box, 'TAB_CHORD'), number(box, 'HOLDER_BAY_X'), number(box, 'LIGHTER_LEAD')])
      .toEqual([CIGARETTE_BOX.topZ, CIGARETTE_BOX.tabChord, CIGARETTE_BOX.holderBayX, CIGARETTE_BOX.lighterLead]);
    expect(CIGARETTE_BOX.tabTop - 34.91).toBeCloseTo(number(box, 'TAB_STEP'), 12);
    expect(array(box, 'BAY_ROUND')).toEqual(CIGARETTE_BOX.bayRound);
    expect(array(holder, 'BAY_ROUND')).toEqual(CIGARETTE_BOX.bayRound);
    expect(array(holder, 'DOME_OUT')).toEqual(HOLDER_DOME);
    // the tab's lowest and highest slices
    const heights = [...box.matchAll(/^ {2}\[([\d.]+), \[\[/gm)].map(match => Number(match[1]));
    expect([Math.min(...heights), Math.max(...heights)]).toEqual([CIGARETTE_BOX.tabBottom, 34.91]);
  });

  it('closes the lid where the assembly does, and slides the mini box off with it', () => {
    expect([number(lid, 'CAVITY_TOP'), number(lid, 'BASE_TOP'), number(box, 'BASE_TOP')]).toEqual([CIGARETTE_LID.ceiling, CIGARETTE_LID.capTop, CIGARETTE_LID.closedZ]);
    const poses = cigaretteCase.assembly.poses;
    expect(poses['case-lid']?.position[2]).toBe(CIGARETTE_LID.closedZ);
    const off = cigaretteCasePhysics(0.2).scenarios?.find(scenario => scenario.id === 'open')?.poses ?? {};
    const lift = (off['case-lid']?.position[2] ?? 0) - CIGARETTE_LID.closedZ;
    for (const id of ['mini-box', 'mini-lid']) {
      expect(off[id]?.position).toEqual(poses[id]?.position.map((value, axis) => axis === 2 ? expect.closeTo(value + lift, 9) as number : value));
      expect(off[id]?.rotation).toEqual(poses[id]?.rotation);
    }
  });

  it('builds convex pieces of four or more points', () => {
    for (const pieces of [lighterPieces(), cigaretteBoxPieces(0.2), holderPieces(0.2), lidPieces(0.2)]) for (const piece of pieces) {
      expect(piece.length % 3).toBe(0);
      expect(piece.length).toBeGreaterThanOrEqual(12);
      expect(piece.every(Number.isFinite)).toBe(true);
    }
  });

  it('offsets a convex outline by its distance', () => {
    const square: [number, number][] = [[0, 0], [2, 0], [2, 2], [0, 2]];
    const out = offsetConvex(square, 0.5);
    expect(isConvex(out)).toBe(true);
    expect(signedArea(out) / 2).toBeCloseTo(9, 9);
  });
});
