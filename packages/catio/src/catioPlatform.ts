import { dimensionOf, findPart, partsOfFamily, type Part } from '@canfactory/contracts';
import { enclosureInside, type EnclosureLayout } from './catioEnclosure.ts';
import { PORT_FRAME } from './catioModularDesign.ts';
import { applyTransform, type Attachment, type PlatformParams, type Point3, type ProjectIssue, type Transform } from './catioProject.ts';
import { fastenersAlong, type BomLine, type V3 } from './catioSubassembly.ts';

/**
 * A frame-mounted platform (FR-05, the platform row's recipes): an exterior plywood board across an enclosure, one way or the other.
 * Millimetres, in the enclosure's frame (catioEnclosure.ts); the board's own frame has its top face's centre at the origin, X along
 * its `width` (its span, from one support to the other) and Y across its `depth`.
 *
 * - **West–East** (yaw 0° or 180°): the board spans from one side frame to the other, each end resting on a support batten. A batten
 *   runs along a side frame from its rear post to its front post, lapping both posts' inner faces, and is screwed into each.
 * - **North–South** (yaw 90° or 270°): the board spans from the rear posts to the front posts, each end resting on a cross bearer.
 *   The side frames carry the same two battens; a bearer lies across both, against the rear (or the front) posts' inner faces, and
 *   is screwed down into each. Nothing is fixed to the rear or the front frame, so the rear cat port, its landing and the
 *   maintenance door (which swings outward) stay clear.
 *
 * Each supported end is an attachment (catioProject.ts) to the member it bears on (`side-left` or `side-right` West–East, the
 * `frame-rear` or `frame-front` cross bearer North–South), anchored at the middle of the end's underside. A board spans its
 * frames, so it only slides along its free axis (across its span) and up and down: `platformRange` is where its recipe holds, and
 * every move is clamped to it (`clampPlatform`). The span and load are not verified: the planner says so, and geometric checks are
 * no structural certificate. An access opening and stock packing come later.
 */
export const PLATFORM = {
  batten: { width: 45, depth: 45 },
  /** A North–South board's cross bearers, lying on the side battens: the battens' own section. */
  bearer: { width: 45, depth: 45 },
  /** Screws down through the board into each batten (or bearer) under it, no further apart than this. */
  boardScrewPitch: 200,
  /** Screws through each batten's end into a post. */
  postScrews: 2,
  /** Screws down through each end of a cross bearer into the batten under it: the post screw, 35 mm into the batten. */
  bearerScrews: 2,
  hardware: { postScrew: 'din-7997-6x80' },
  /**
   * The board's screws, chosen for its thickness (`boardScrewFor`): DIN 7997 countersunk screws of these diameters, thinnest then
   * shortest first, with at least `grip` of the screw's length in the batten and its point at least `cover` short of the batten's
   * underside.
   */
  boardScrew: { diameters: [4, 5, 6], grip: 0.5, cover: 5 },
  /** The generic sheet the board is cut from (products.md P04: 2500 × 1250 × 18 mm, film-faced exterior plywood). */
  sheet: { width: 2500, length: 1250, thickness: 18, example: 'e.g. Garnica Laudio Wire Xtra Plus, BAUHAUS 28517690' },
  /** How far an anchor may be from its member's face and still bear on it. */
  tolerance: 1,
} as const;

export const PLATFORM_ORIENTATIONS = ['west-east', 'north-south'] as const;
export type PlatformOrientation = typeof PLATFORM_ORIENTATIONS[number];
/** Each orientation's recipe: the members its ends bear on, how deep its supports stand under the board, and its name. */
export const PLATFORM_RECIPES = {
  'west-east': { members: ['side-left', 'side-right'], support: PLATFORM.batten.depth, title: 'West–East' },
  'north-south': { members: ['frame-rear', 'frame-front'], support: PLATFORM.batten.depth + PLATFORM.bearer.depth, title: 'North–South' },
} as const;
/** The yaw each orientation is turned to from the other. */
export const ORIENTATION_YAW: Record<PlatformOrientation, number> = { 'west-east': 0, 'north-south': 90 };
export const PLATFORM_MEMBERS = ['side-left', 'side-right', 'frame-rear', 'frame-front'] as const;
export type PlatformMember = typeof PLATFORM_MEMBERS[number];
const MEMBER_TITLES: Record<PlatformMember, string> = { 'side-left': 'left side frame', 'side-right': 'right side frame', 'frame-rear': 'rear cross bearer', 'frame-front': 'front cross bearer' };
/** The elevation a new platform starts at: its board's top above the enclosure's ground. */
export const PLATFORM_ELEVATION_DEFAULT = 1200;
export const PLATFORM_DEPTH_DEFAULT = 400;
export const PLATFORM_SHEET = 'exterior-plywood';

/** A yaw in whole quarter turns: the nearest. */
export const platformYaw = (yaw: number) => Math.round(yaw / 90) * 90 + 0;
/** The way a platform at `yaw` runs, or null when it is not turned by whole quarter turns. */
export function platformOrientation(yaw: number): PlatformOrientation | null {
  if (Math.abs(yaw - platformYaw(yaw)) > 1e-6) return null;
  return Math.abs(platformYaw(yaw) / 90) % 2 === 1 ? 'north-south' : 'west-east';
}

/** Each end of a board at `yaw` (its −X end, then its +X end): where it bears, in the board's frame, and on what. */
export function platformEnds(p: PlatformParams, yaw: number): { member: PlatformMember; anchor: Point3 }[] {
  return ([-1, 1] as const).map(sign => {
    const out = applyTransform({ x: 0, y: 0, z: 0, yaw: platformYaw(yaw) }, { x: sign, y: 0, z: 0 });
    const member: PlatformMember = Math.abs(out.x) > Math.abs(out.y) ? (out.x < 0 ? 'side-left' : 'side-right') : out.y < 0 ? 'frame-rear' : 'frame-front';
    return { member, anchor: { x: sign * p.width / 2, y: 0, z: -p.thickness } };
  });
}
/** `attachments` with those of `instance` aimed at its board's ends at `yaw` (an attachment's end is its anchor's side): after a turn or a resize. */
export function platformAttachments(attachments: Attachment[], instance: string, p: PlatformParams, yaw: number): Attachment[] {
  const [minus, plus] = platformEnds(p, yaw);
  return attachments.map(a => {
    const end = a.anchor.x < 0 ? minus : plus;
    return a.instance === instance && end ? { ...a, support: { ...a.support, member: end.member }, anchor: end.anchor } : a;
  });
}

type Room = Pick<EnclosureLayout, 'size' | 'floor' | 'bearers' | 'frame' | 'ports'>;
export type Interval = [number, number];
/** Where a platform's recipe holds in its enclosure (`platformRange`), in the enclosure's frame. */
export interface PlatformRange {
  orientation: PlatformOrientation;
  /** The enclosure's axis the board slides along (across its span), and the one it spans, on which its centre is fixed. */
  free: 'x' | 'y'; fixed: 'x' | 'y';
  /** Its centre on the fixed axis: midway between the frames it spans. */
  across: number;
  /** Its centre on the free axis: from one inside face to the other, less half its depth. Empty (min > max) when it is too deep. */
  along: Interval;
  /**
   * Its top's heights, ascending: its supports above the sole rails, the board under the lowest member overhead, and the board and
   * its supports clear of every cat port and its frame. None when there is no room.
   */
  heights: Interval[];
  /** The board's span: the clear width between the frames it spans. */
  span: number;
  /** The deepest board that fits along the free axis. */
  room: number;
}

/** Each cat port's height, with its frame round it: what no support may cross. */
const portBands = (enclosure: Pick<EnclosureLayout, 'ports'>, tunnelSize: number) =>
  enclosure.ports.map(p => ({ side: p.side, band: [p.face.at[2] - PORT_FRAME, p.face.at[2] + tunnelSize + PORT_FRAME] as Interval }));

/**
 * Where a board of `params` turned to `yaw` (the nearest quarter turn) can stand in its enclosure with its recipe intact: centred
 * between the frames it spans, sliding between the inside faces on its free axis, and at the heights its supports allow. The move
 * command and the viewport's drag both clamp to it (`clampPlatform`), so that a preview never shows what the command would not do.
 */
export function platformRange(params: PlatformParams, yaw: number, enclosure: Room, tunnelSize: number): PlatformRange {
  const inside = enclosureInside(enclosure);
  const orientation = platformOrientation(platformYaw(yaw)) ?? 'west-east';
  const westEast = orientation === 'west-east';
  const [lo, hi] = westEast ? [inside.minY, inside.maxY] : [inside.minX, inside.maxX];
  const t = params.thickness; const support = PLATFORM_RECIPES[orientation].support;
  const lowest = inside.soleTop + support + t;
  let heights: Interval[] = lowest <= inside.ceiling ? [[lowest, inside.ceiling]] : [];
  // the board and its supports stand from z − t − support up to z: wholly under a port's band, or wholly over it
  for (const { band: [low, high] } of portBands(enclosure, tunnelSize)) {
    heights = heights.flatMap(([a, b]): Interval[] => ([[a, Math.min(b, low)], [Math.max(a, high + t + support), b]] as Interval[]).filter(([c, d]) => c <= d));
  }
  return {
    orientation, free: westEast ? 'y' : 'x', fixed: westEast ? 'x' : 'y', across: westEast ? (inside.minX + inside.maxX) / 2 : (inside.minY + inside.maxY) / 2,
    along: [lo + params.depth / 2, hi - params.depth / 2], heights, span: westEast ? inside.width : inside.depth, room: hi - lo,
  };
}

/**
 * `to` (a platform's transform in its enclosure) within `range`: centred on its fixed axis, between the limits on its free axis,
 * and at the nearest height its recipe allows. A height in a gap (a cat port's band) carries on past it the way it moved from
 * `from`, so that Page Up under a port lands above it; with no way given, to the nearer side. Its yaw is left as it is.
 */
export function clampPlatform(range: PlatformRange, to: Transform, from?: number): Transform {
  const [min, max] = range.along;
  const along = min > max ? (min + max) / 2 : Math.min(max, Math.max(min, to[range.free]));
  return { ...to, [range.fixed]: range.across, [range.free]: along, z: clampHeight(range.heights, to.z, from) } as Transform;
}
function clampHeight(heights: Interval[], z: number, from?: number): number {
  if (!heights.length || heights.some(([a, b]) => z >= a && z <= b)) return z;
  const below = heights.filter(([, b]) => b < z).at(-1)?.[1]; const above = heights.find(([a]) => a > z)?.[0];
  if (below === undefined || above === undefined) return below ?? above ?? z;
  if (from !== undefined && from !== z) return z > from ? above : below;
  return z - below <= above - z ? below : above;
}

/** A new platform's board: West–East across the whole inside of its enclosure, from one side frame to the other. */
export function platformDefaults(layout: Room, tunnelSize: number): { params: PlatformParams; transform: Transform; ends: ReturnType<typeof platformEnds> } {
  const inside = enclosureInside(layout);
  const params: PlatformParams = { width: inside.width, depth: PLATFORM_DEPTH_DEFAULT, thickness: PLATFORM.sheet.thickness };
  const transform = clampPlatform(platformRange(params, 0, layout, tunnelSize), { x: 0, y: (inside.minY + inside.maxY) / 2, z: PLATFORM_ELEVATION_DEFAULT, yaw: 0 });
  return { params, transform, ends: platformEnds(params, 0) };
}

type Issue = Omit<ProjectIssue, 'id' | 'instanceIds'> & { code: string };
/** A timber under the board: a batten along a side frame, or (North–South) a cross bearer on the battens under one end. */
export interface PlatformSupport { kind: 'batten' | 'bearer'; member: PlatformMember; attachment: string | null; center: V3; size: V3 }

/**
 * The platform as placed (`transform`, in its enclosure's frame) in its enclosure: the board, its supports, the checks of its fit
 * and of each attachment, and its parts. A broken attachment keeps its support in the parts (the draft is what was drawn) and is
 * reported; the limits the checks apply are `platformRange`'s.
 */
export function platformLayout(params: PlatformParams, transform: Transform, enclosure: Room, attachments: Attachment[], tunnelSize: number) {
  const inside = enclosureInside(enclosure);
  const range = platformRange(params, transform.yaw, enclosure, tunnelSize);
  const recipe = PLATFORM_RECIPES[range.orientation]; const westEast = range.orientation === 'west-east';
  const issues: Issue[] = [];
  const { width: w, depth: d, thickness: t } = params;
  const top = transform.z; const under = top - t;
  const corners = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sy]) => applyTransform(transform, { x: sx * w / 2, y: sy * d / 2, z: 0 }));
  const tol = PLATFORM.tolerance;
  if (!platformOrientation(transform.yaw))
    issues.push({ code: 'orientation', kind: 'geometry', severity: 'error', message: `The platform is turned ${Math.round(transform.yaw)}°: it runs West–East or North–South, so it turns in 90° steps.` });
  if (corners.some(c => c.x < inside.minX - tol || c.x > inside.maxX + tol || c.y < inside.minY - tol || c.y > inside.maxY + tol))
    issues.push({ code: 'outside', kind: 'geometry', severity: 'error', message: `The platform's board (${w} × ${d} mm) does not fit inside the enclosure's frame (${inside.width} × ${inside.depth} mm inside).` });
  if (top > inside.ceiling + tol) issues.push({ code: 'above', kind: 'geometry', severity: 'error', message: `The platform's top (${top} mm) is above the enclosure's lowest member overhead (${inside.ceiling} mm).` });
  if (under - recipe.support < inside.soleTop - tol) issues.push({ code: 'below', kind: 'geometry', severity: 'error', message: `The platform is too low for its supports: they must sit above the sole rails (${inside.soleTop} mm); its top must be at least ${inside.soleTop + recipe.support + t} mm up.` });
  if (!fitsSheet(w, d)) issues.push({ code: 'sheet', kind: 'geometry', severity: 'error', message: `A ${w} × ${d} mm board does not fit a ${PLATFORM.sheet.width} × ${PLATFORM.sheet.length} mm sheet either way round; it needs other stock or a supported joint.` });

  // each attachment: its anchor on its member's face, within the member's ends, where the support under it can be fixed
  const faces: Record<PlatformMember, { axis: 'x' | 'y'; at: number; inward: number }> = {
    'side-left': { axis: 'x', at: inside.minX, inward: 1 }, 'side-right': { axis: 'x', at: inside.maxX, inward: -1 },
    'frame-rear': { axis: 'y', at: inside.minY, inward: 1 }, 'frame-front': { axis: 'y', at: inside.maxY, inward: -1 },
  };
  const ends: Record<'x' | 'y', Interval> = { x: [inside.minX, inside.maxX], y: [inside.minY, inside.maxY] };
  const supports: PlatformSupport[] = [];
  const batten = (member: PlatformMember, attachment: string | null, z: number): PlatformSupport =>
    ({ kind: 'batten', member, attachment, size: [PLATFORM.batten.width, enclosure.size.depth, PLATFORM.batten.depth], center: [faces[member].at + faces[member].inward * PLATFORM.batten.width / 2, enclosure.size.depth / 2, z - PLATFORM.batten.depth / 2] });
  const valid = new Set<PlatformMember>();
  for (const a of attachments) {
    const member = a.support.member as PlatformMember;
    if (!(recipe.members as readonly string[]).includes(member)) {
      issues.push({ code: `member-${a.id}`, kind: 'connection', severity: 'error', message: `Attachment ${a.id} names ${a.support.member}, which is not what the end of a ${recipe.title} platform bears on (${recipe.members.join(' or ')}).` });
      continue;
    }
    const at = applyTransform(transform, a.anchor); const face = faces[member]; const title = MEMBER_TITLES[member];
    supports.push(westEast ? batten(member, a.id, at.z)
      : { kind: 'bearer', member, attachment: a.id, size: [inside.width, PLATFORM.bearer.width, PLATFORM.bearer.depth], center: [(inside.minX + inside.maxX) / 2, face.at + face.inward * PLATFORM.bearer.width / 2, at.z - PLATFORM.bearer.depth / 2] });
    const off = Math.abs(at[face.axis] - face.at); const [from, to] = ends[face.axis === 'x' ? 'y' : 'x']; const along = at[face.axis === 'x' ? 'y' : 'x'];
    if (off > tol) issues.push({ code: `detached-${a.id}`, kind: 'connection', severity: 'error', message: `The platform's end no longer reaches the ${title} (${Math.round(off)} mm off its face): its attachment ${a.id} is broken.` });
    else if (along < from - tol || along > to + tol) issues.push({ code: `detached-${a.id}`, kind: 'connection', severity: 'error', message: `The platform's end is beyond the ${title}'s ends: its attachment ${a.id} is broken.` });
    else valid.add(member);
  }
  // North–South: the cross bearers lie on a batten along each side frame
  if (!westEast && supports.length) {
    const z = Math.min(...supports.map(s => s.center[2] - s.size[2] / 2));
    supports.push(batten('side-left', null, z), batten('side-right', null, z));
  }
  if (valid.size < 2) issues.push({ code: 'unsupported', kind: 'connection', severity: 'error', message: `The platform needs both ends on its ${westEast ? 'side frames’ battens' : 'cross bearers'}; ${valid.size ? 'one is' : 'none is'}. It stays a draft until both are attached.` });

  // the supports run in front of the cat ports: they, and the board on them, must keep clear of each port and its frame
  const bottom = under - recipe.support;
  if (supports.length) for (const { side, band: [low, high] } of portBands(enclosure, tunnelSize)) {
    if (top > low + tol && bottom < high - tol)
      issues.push({ code: `port-${side}`, kind: 'geometry', severity: 'error', message: `The platform's supports would cross the ${side} cat port (${Math.round(low)}–${Math.round(high)} mm up). Raise the platform to ${Math.round(high + t + recipe.support)} mm or more.` });
  }
  const boardScrew = boardScrewFor(t);
  if (!boardScrew) issues.push({ code: 'board-screw', kind: 'geometry', severity: 'error', message: `No wood screw fixes a ${t} mm board to its ${PLATFORM.batten.depth} mm ${westEast ? 'battens' : 'bearers'}: one long enough to hold in them would come out under them. Choose a thinner board.` });
  issues.push({ code: 'span', kind: 'unverified', severity: 'info', message: `The platform's ${w} mm span of ${t} mm plywood on two ${westEast ? 'battens' : 'cross bearers'}, and the load it carries, are not verified: the checks are geometric, not structural.` });

  const bom = platformBom(params, supports, boardScrew);
  return { params, transform, range, top, under, corners, supports, issues, bom };
}
export type PlatformLayout = ReturnType<typeof platformLayout>;

/**
 * The screw that fixes a board `thickness` mm thick down into its battens (`PLATFORM.boardScrew`), or null when no screw in the
 * parts library reaches far enough into a batten without coming out under it.
 */
export function boardScrewFor(thickness: number): Part | null {
  const { diameters, grip, cover } = PLATFORM.boardScrew;
  const screws = partsOfFamily('wood-screw').filter(p => p.standard === 'din-7997' && (diameters as readonly number[]).includes(dimensionOf(p, 'd')))
    .sort((a, b) => dimensionOf(a, 'd') - dimensionOf(b, 'd') || dimensionOf(a, 'l') - dimensionOf(b, 'l'));
  return screws.find(p => {
    const l = dimensionOf(p, 'l'); const into = l - thickness;
    return into >= grip * l && into <= PLATFORM.batten.depth - cover;
  }) ?? null;
}

/** Whether a board this size can be cut from the sheet, turned either way. */
export const fitsSheet = (w: number, d: number) => (w <= PLATFORM.sheet.width && d <= PLATFORM.sheet.length) || (d <= PLATFORM.sheet.width && w <= PLATFORM.sheet.length);

function platformBom(params: PlatformParams, supports: PlatformSupport[], boardScrew: Part | null): BomLine[] {
  const { width: w, depth: d, thickness: t } = params;
  const sheet = PLATFORM.sheet;
  const lines: BomLine[] = [
    { id: 'platform-board', group: 'Timber', name: 'Exterior film-faced plywood board (generic)', quantity: 1,
      size: `${w} × ${d} × ${t}, cut from a ${sheet.width} × ${sheet.length} × ${t} sheet${t === sheet.thickness ? ` (${sheet.example})` : ''}`,
      use: 'The platform: round its corners and seal every cut edge' },
  ];
  const battens = supports.filter(s => s.kind === 'batten'); const bearers = supports.filter(s => s.kind === 'bearer');
  if (!battens.length) return lines;
  const length = Math.max(...battens.map(b => b.size[1]));
  lines.push({ id: 'platform-batten', group: 'Timber', name: 'Support batten, planed exterior timber (generic)', quantity: battens.length,
    size: `${PLATFORM.batten.width} × ${PLATFORM.batten.depth} × ${length}`, use: `${bearers.length ? 'Under the cross bearers' : 'Under each end of the platform'}, along a side frame from its rear post to its front post` });
  if (bearers.length) lines.push({ id: 'platform-bearer', group: 'Timber', name: 'Cross bearer, planed exterior timber (generic)', quantity: bearers.length,
    size: `${PLATFORM.bearer.width} × ${PLATFORM.bearer.depth} × ${Math.max(...bearers.map(b => b.size[0]))}`, use: 'Under each end of the platform, across both side battens against the rear or the front posts' });
  const screw = (partId: string, quantity: number, use: string) => {
    const part = findPart(partId);
    lines.push({ id: partId, group: 'Hardware', name: part?.title ?? partId, quantity, size: part?.designation ?? '', use, partId });
  };
  screw(PLATFORM.hardware.postScrew, battens.length * 2 * PLATFORM.postScrews + bearers.length * 2 * PLATFORM.bearerScrews,
    `Through each support batten into the side frame’s posts${bearers.length ? ', and down through each end of a cross bearer into its batten' : ''}`);
  // (no screw fits the board: the issue says so, and no screw is listed that would not hold it)
  if (boardScrew) screw(boardScrew.id, (bearers.length || battens.length) * fastenersAlong(d, PLATFORM.boardScrewPitch), `Down through the platform board into its ${bearers.length ? 'cross bearers' : 'battens'}`);
  return lines;
}
