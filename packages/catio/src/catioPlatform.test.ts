import { describe, expect, it } from 'vitest';
import {
  addPlatform, applyEdit, clampPlatform, createHistory, createProject, duplicateInstance, enclosureInside, enclosureLayout, evaluateProject, fastenersAlong,
  moveInstance, MODULAR, platformOrientation, platformRange, platformRangeOf, PLATFORM, PORT_FRAME, projectErrors, resizeInstance, rotateInstance, undo,
  type Project, type PlatformRange, type Transform,
} from './index.ts';

const furnished = () => addPlatform(createProject({ id: 'p1' }), 'enclosure-1').project;
const platform = (project: Project) => {
  const p = project.instances.find(i => i.id === 'platform-1'); if (p?.kind !== 'platform') throw new Error('no platform'); return p;
};
const evaluated = (project: Project) => {
  const p = evaluateProject(project).instances.find(i => i.id === 'platform-1'); if (p?.kind !== 'platform' || !p.layout) throw new Error('no platform layout'); return p.layout;
};
/** The platform's problems that withhold a complete build. */
const errors = (project: Project) => evaluateProject(project).issues.filter(i => i.instanceIds.includes('platform-1') && i.severity === 'error').map(i => i.id);
const members = (project: Project) => project.attachments.filter(a => a.instance === 'platform-1').map(a => [a.id, a.support.member, a.anchor.x]);
const rangeOf = (project: Project) => { const r = platformRangeOf(project, 'platform-1'); if (!r) throw new Error('no range'); return r; };
const turned = () => rotateInstance(furnished(), 'platform-1', 90).project;

// the default 2 × 2 × 2 m enclosure: 40 mm posts, its sole rails' top at 110 mm, its ports' sill at 200 mm and 300 mm high
const room = enclosureLayout({ width: 2000, depth: 2000, height: 2000 }, { id: 'e', tunnelSize: 300, connected: { rear: false, left: false, right: false } });
const inside = enclosureInside(room);
const portTop = MODULAR.sill + 300 + PORT_FRAME;

describe('platformRange', () => {
  const board = { width: 1920, depth: 400, thickness: 18 };

  it('runs a West–East board across the side frames: centred across, sliding North–South, above the cat ports', () => {
    const r = platformRange(board, 0, room, 300);
    expect(r).toEqual({
      orientation: 'west-east', free: 'y', fixed: 'x', across: 0, along: [40 + 200, 1960 - 200], span: 1920, room: 1920,
      // its battens and board stand 45 + 18 mm deep: under a port's band they would sit on the sole rails, so only above it
      heights: [[portTop + 18 + PLATFORM.batten.depth, inside.ceiling]],
    });
    expect(platformRange(board, 180, room, 300)).toEqual(r);
  });

  it('runs a North–South board from rear to front: centred between them, sliding West–East, its bearers on the battens', () => {
    const r = platformRange(board, 90, room, 300);
    expect(r).toEqual({
      orientation: 'north-south', free: 'x', fixed: 'y', across: 1000, along: [-960 + 200, 960 - 200], span: 1920, room: 1920,
      heights: [[portTop + 18 + PLATFORM.batten.depth + PLATFORM.bearer.depth, inside.ceiling]],
    });
    // the nearest quarter turn: a legacy 80° is North–South, 270° too
    expect(platformRange(board, 80, room, 300)).toEqual(r);
    expect(platformRange(board, -90, room, 300)).toEqual(r);
    expect(platformOrientation(80)).toBeNull();
    expect([0, 90, 180, 270, -90].map(platformOrientation)).toEqual(['west-east', 'north-south', 'west-east', 'north-south', 'north-south']);
  });

  it('has no room for a board deeper than the inside, nor heights in a box too low', () => {
    expect(platformRange({ ...board, depth: 2100 }, 0, room, 300).along).toEqual([40 + 1050, 1960 - 1050]);
    const low = enclosureLayout({ width: 2000, depth: 2000, height: 600 }, { id: 'e', tunnelSize: 300, connected: { rear: false, left: false, right: false } });
    expect(platformRange(board, 0, low, 300).heights).toEqual([]);
  });

  it('clamps a move along, across and up and down, and skips a gap in the way it moved', () => {
    const r: PlatformRange = { orientation: 'west-east', free: 'y', fixed: 'x', across: 0, along: [240, 1760], heights: [[200, 300], [600, 1900]], span: 1920, room: 1920 };
    const at = (x: number, y: number, z: number): Transform => ({ x, y, z, yaw: 0 });
    expect(clampPlatform(r, at(300, 5000, 2500))).toEqual(at(0, 1760, 1900));
    expect(clampPlatform(r, at(-300, -5000, 50))).toEqual(at(0, 240, 200));
    expect(clampPlatform(r, at(0, 1000, 450), 300)).toEqual(at(0, 1000, 600));
    expect(clampPlatform(r, at(0, 1000, 450), 600)).toEqual(at(0, 1000, 300));
    expect(clampPlatform(r, at(0, 1000, 500))).toEqual(at(0, 1000, 600));
    expect(clampPlatform(r, at(0, 1000, 1000), 900)).toEqual(at(0, 1000, 1000));
  });
});

describe('moving a platform', () => {
  it('keeps it inside its enclosure: along between the faces, across in the middle, height between its limits; it says where it stopped', () => {
    const project = furnished();
    const r = rangeOf(project);
    const far = moveInstance(project, 'platform-1', { x: 700, y: 9000 });
    expect(platform(far.project).transform).toEqual({ ...platform(project).transform, x: 0, y: r.along[1] });
    expect(far.notes).toEqual([expect.stringContaining('middle West–East'), expect.stringContaining('stops at 176 cm North–South')]);
    const roof = moveInstance(project, 'platform-1', { z: 9000 });
    expect(platform(roof.project).transform.z).toBe(inside.ceiling);
    expect(roof.notes?.[0]).toMatch(/stops at an elevation of 195\.9 cm: its supports allow 60\.3–195\.9 cm/);
    expect(platform(moveInstance(project, 'platform-1', { z: 0 }).project).transform.z).toBe(r.heights[0]?.[0]);
    // a move inside the range is made as asked, without a note
    const inRange = moveInstance(project, 'platform-1', { y: 800, z: 1000 });
    expect(platform(inRange.project).transform).toMatchObject({ x: 0, y: 800, z: 1000 }); expect(inRange.notes).toBeUndefined();
  });

  it('evaluates without a broken attachment or a misfit at every limit, both ways round', () => {
    for (const project of [furnished(), turned()]) {
      const r = rangeOf(project); const [lowest] = r.heights[0] ?? [0];
      for (const along of r.along) for (const z of [lowest, inside.ceiling]) {
        expect(errors(moveInstance(project, 'platform-1', { [r.free]: along, z }).project), `${r.orientation} ${along} ${z}`).toEqual([]);
      }
    }
  });

  it('keeps a duplicate inside too', () => {
    const top = moveInstance(furnished(), 'platform-1', { z: 1900 }).project;
    const copy = duplicateInstance(top, 'platform-1');
    expect(copy.project.instances.find(i => i.id === copy.id)?.transform.z).toBe(inside.ceiling);
  });
});

describe('turning a platform', () => {
  it('runs it North–South in one undoable edit: its board spans rear to front, its ends attached to the cross bearers', () => {
    const project = furnished();
    const result = rotateInstance(project, 'platform-1', 90);
    sound(result.project);
    expect(platform(result.project).transform).toEqual({ x: 0, y: 1000, z: 1200, yaw: 90 });
    expect(platform(result.project).params).toEqual({ width: 1920, depth: 400, thickness: 18 });
    expect(members(result.project)).toEqual([['attachment-1', 'frame-rear', -960], ['attachment-2', 'frame-front', 960]]);
    expect(errors(result.project)).toEqual([]);
    const layout = evaluated(result.project);
    expect(layout.supports.map(s => [s.kind, s.member, s.attachment])).toEqual([
      ['bearer', 'frame-rear', 'attachment-1'], ['bearer', 'frame-front', 'attachment-2'], ['batten', 'side-left', null], ['batten', 'side-right', null],
    ]);
    // the bearers lie on the battens, the board on the bearers, all within the posts
    const [rear, , left] = layout.supports;
    expect(rear?.center).toEqual([0, 40 + 22.5, 1200 - 18 - 22.5]); expect(rear?.size).toEqual([1920, 45, 45]);
    expect(left?.center).toEqual([-960 + 22.5, 1000, 1200 - 18 - 45 - 22.5]);

    const history = applyEdit(createHistory(project), result.project);
    expect(history.past).toHaveLength(1);
    expect(members(undo(history).present)).toEqual(members(project));
    expect(platform(undo(history).present).transform.yaw).toBe(0);
  });

  it('turns in 90° steps (the ring and the yaw field alike); half a turn swaps which frame each end bears on', () => {
    const snapped = rotateInstance(furnished(), 'platform-1', 80);
    expect(platform(snapped.project).transform.yaw).toBe(90);
    expect(snapped.notes?.[0]).toBe('A platform turns in 90° steps: Platform 1 is turned to 90°.');
    const back = rotateInstance(furnished(), 'platform-1', 180).project;
    expect(members(back)).toEqual([['attachment-1', 'side-right', -960], ['attachment-2', 'side-left', 960]]);
    expect(errors(back)).toEqual([]);
    expect(members(rotateInstance(furnished(), 'platform-1', 270).project).map(m => m[1])).toEqual(['frame-front', 'frame-rear']);
  });

  it('spans the other frames when the enclosure is not square, and shortens a board too deep for its new way', () => {
    // 1400 wide inside 1320, 2000 deep inside 1920: a 1500 deep West–East board turned spans 1920 and is 1320 deep
    const oblong = resizeInstance(addPlatform(resizeInstance(createProject({ id: 'p1' }), 'enclosure-1', { width: 1400 }).project, 'enclosure-1').project, 'platform-1', { depth: 1500 }).project;
    expect(platform(oblong).params).toMatchObject({ width: 1320, depth: 1500 });
    const result = rotateInstance(oblong, 'platform-1', 90);
    expect(platform(result.project).params).toMatchObject({ width: 1920, depth: 1320 });
    expect(result.notes?.[0]).toBe('Platform 1 now runs North–South: its board spans 192 cm, and is 132 cm deep to fit.');
    // whole and attached: only the sheet is too small for such a board
    expect(errors(result.project)).toEqual(['geometry:platform-1+enclosure-1:platform-sheet']);
    const across = rotateInstance(oblong, 'platform-1', 0);
    expect(across.project.instances).toEqual(oblong.instances); expect(across.notes).toBeUndefined();
  });

  it('flags a document turned between the quarter turns (an import): the planner itself never makes one', () => {
    const project = furnished();
    const odd = { ...project, instances: project.instances.map(i => i.id === 'platform-1' ? { ...i, transform: { ...i.transform, yaw: 15 } } : i) };
    expect(errors(odd)).toContain('geometry:platform-1+enclosure-1:platform-orientation');
  });
});

describe('the platform’s parts', () => {
  const lines = (project: Project) => evaluateProject(project).bom.filter(l => l.sources[0] === 'platform-1').map(l => [l.id, l.quantity, l.size]);
  const screws = 2 * fastenersAlong(400, PLATFORM.boardScrewPitch);

  it('West–East: the board, a batten along each side frame, two screws into each post and the board screwed into the battens', () => {
    expect(lines(furnished())).toEqual([
      ['platform-board', 1, expect.stringMatching(/^1920 × 400 × 18/)], ['platform-batten', 2, '45 × 45 × 2000'],
      [PLATFORM.hardware.postScrew, 8, 'DIN 7997 6 × 80'], ['din-7997-4x40', screws, 'DIN 7997 4 × 40'],
    ]);
  });

  it('North–South: the same battens, a cross bearer across them under each end screwed down into both, the board into the bearers', () => {
    const bom = evaluateProject(turned()).bom.filter(l => l.sources[0] === 'platform-1');
    expect(bom.map(l => [l.id, l.quantity, l.size])).toEqual([
      ['platform-board', 1, expect.stringMatching(/^1920 × 400 × 18/)], ['platform-batten', 2, '45 × 45 × 2000'], ['platform-bearer', 2, '45 × 45 × 1920'],
      [PLATFORM.hardware.postScrew, 8 + 2 * 2 * PLATFORM.bearerScrews, 'DIN 7997 6 × 80'], ['din-7997-4x40', screws, 'DIN 7997 4 × 40'],
    ]);
    expect(bom.filter(l => l.group === 'Hardware').every(l => l.partId === l.id)).toBe(true);
    expect(bom.at(-1)?.use).toBe('Down through the platform board into its cross bearers');
    // complete: only the span is unverified
    expect(evaluateProject(turned()).issues.filter(i => i.instanceIds.includes('platform-1')).map(i => [i.kind, i.severity])).toEqual([['unverified', 'info']]);
  });
});

describe('resizing', () => {
  it('keeps the platform’s board within its frames and inside, and moves it back inside if its new size needs it', () => {
    const project = moveInstance(furnished(), 'platform-1', { y: 240 }).project;
    const longer = resizeInstance(project, 'platform-1', { width: 3000 });
    expect(platform(longer.project).params.width).toBe(1920);
    expect(longer.notes?.[0]).toContain('192 cm long');
    const deeper = resizeInstance(project, 'platform-1', { depth: 800 });
    expect(platform(deeper.project).transform.y).toBe(40 + 400);
    expect(errors(deeper.project)).toEqual([]);
  });

  it('flags a platform its shrinking enclosure no longer holds, and leaves it where it was, either way round (FR-02.9)', () => {
    for (const [project, size] of [[furnished(), { width: 1600 }], [turned(), { depth: 1600 }]] as const) {
      const shrunk = resizeInstance(project, 'enclosure-1', size).project;
      expect(platform(shrunk)).toEqual(platform(project));
      expect(errors(shrunk)).toEqual(expect.arrayContaining(['geometry:platform-1+enclosure-1:platform-outside', 'connection:platform-1+enclosure-1:platform-unsupported']));
      // resizing its board to the new span fits it again
      expect(errors(resizeInstance(shrunk, 'platform-1', { width: 9999 }).project)).toEqual([]);
    }
  });
});

function sound(project: Project) { expect(projectErrors(JSON.parse(JSON.stringify(project)) as unknown)).toEqual([]); }
