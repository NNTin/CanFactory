import { findPart } from '@canfactory/contracts';
import { enclosureInside, type EnclosureLayout } from './catioEnclosure.ts';
import { PORT_FRAME } from './catioModularDesign.ts';
import { applyTransform, type Attachment, type PlatformParams, type Point3, type ProjectIssue, type Transform } from './catioProject.ts';
import { fastenersAlong, type BomLine, type V3 } from './catioSubassembly.ts';

/**
 * A frame-mounted platform (FR-05, the platform row's minimal recipe): an exterior plywood board across an enclosure from one side
 * frame to the other, each end resting on a support batten. A batten runs along a side frame from its rear post to its front post,
 * lapping both posts' inner faces, and is screwed into each. Millimetres, in the enclosure's frame (catioEnclosure.ts); the board's
 * own frame has its top face's centre at the origin, X across its `width`.
 *
 * Each supported end is an attachment (catioProject.ts) to a side frame, `side-left` or `side-right`, anchored at the middle of the
 * end's underside. The span and load are not verified: the planner says so, and geometric checks are no structural certificate.
 * An access opening and stock packing come later.
 */
export const PLATFORM = {
  batten: { width: 45, depth: 45 },
  /** Screws down through the board into each batten, no further apart than this. */
  boardScrewPitch: 200,
  /** Screws through each batten's end into a post. */
  postScrews: 2,
  hardware: { postScrew: 'din-7997-6x80', boardScrew: 'din-7997-4x40' },
  /** The generic sheet the board is cut from (products.md P04: 2500 × 1250 × 18 mm, film-faced exterior plywood). */
  sheet: { width: 2500, length: 1250, thickness: 18, example: 'e.g. Garnica Laudio Wire Xtra Plus, BAUHAUS 28517690' },
  /** How far an anchor may be from its member's face and still bear on it. */
  tolerance: 1,
} as const;

export const PLATFORM_MEMBERS = ['side-left', 'side-right'] as const;
export type PlatformMember = typeof PLATFORM_MEMBERS[number];
/** The elevation a new platform starts at: its board's top above the enclosure's ground. */
export const PLATFORM_ELEVATION_DEFAULT = 1200;
export const PLATFORM_DEPTH_DEFAULT = 400;
export const PLATFORM_SHEET = 'exterior-plywood';

/** A new platform's board: across the whole inside of its enclosure, from one side frame to the other. */
export function platformDefaults(layout: Pick<EnclosureLayout, 'size' | 'floor' | 'bearers' | 'frame'>): { params: PlatformParams; transform: Transform; anchors: Record<PlatformMember, Point3> } {
  const inside = enclosureInside(layout);
  const params: PlatformParams = { width: inside.width, depth: PLATFORM_DEPTH_DEFAULT, thickness: PLATFORM.sheet.thickness };
  return { params, transform: { x: (inside.minX + inside.maxX) / 2, y: (inside.minY + inside.maxY) / 2, z: PLATFORM_ELEVATION_DEFAULT, yaw: 0 }, anchors: platformAnchors(params) };
}
/** Where each end of a board bears on its batten, in the board's frame: the middle of the end's underside. */
export const platformAnchors = (p: PlatformParams): Record<PlatformMember, Point3> => ({
  'side-left': { x: -p.width / 2, y: 0, z: -p.thickness }, 'side-right': { x: p.width / 2, y: 0, z: -p.thickness },
});

type Issue = Omit<ProjectIssue, 'id' | 'instanceIds'> & { code: string };
export interface PlatformBatten { member: PlatformMember; attachment: string; center: V3; size: V3 }

/**
 * The platform as placed (`transform`, in its enclosure's frame) in its enclosure: the board, a batten under each attached end, the
 * checks of its fit and of each attachment, and its parts. A broken attachment keeps its batten in the parts (the draft is what
 * was drawn) and is reported.
 */
export function platformLayout(params: PlatformParams, transform: Transform, enclosure: Pick<EnclosureLayout, 'size' | 'floor' | 'bearers' | 'frame' | 'sides' | 'landingDepth'>, attachments: Attachment[], tunnelSize: number) {
  const inside = enclosureInside(enclosure);
  const issues: Issue[] = [];
  const { width: w, depth: d, thickness: t } = params;
  const top = transform.z; const under = top - t;
  const corners = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sy]) => applyTransform(transform, { x: sx * w / 2, y: sy * d / 2, z: 0 }));
  const tol = PLATFORM.tolerance;
  if (corners.some(c => c.x < inside.minX - tol || c.x > inside.maxX + tol || c.y < inside.minY - tol || c.y > inside.maxY + tol))
    issues.push({ code: 'outside', kind: 'geometry', severity: 'error', message: `The platform's board (${w} × ${d} mm) does not fit inside the enclosure's frame (${inside.width} × ${inside.depth} mm inside).` });
  if (top > inside.ceiling + tol) issues.push({ code: 'above', kind: 'geometry', severity: 'error', message: `The platform's top (${top} mm) is above the enclosure's lowest member overhead (${inside.ceiling} mm).` });
  if (under - PLATFORM.batten.depth < inside.soleTop - tol) issues.push({ code: 'below', kind: 'geometry', severity: 'error', message: `The platform is too low for its support battens: they must sit above the sole rails (${inside.soleTop} mm); its top must be at least ${inside.soleTop + PLATFORM.batten.depth + t} mm up.` });
  if (!fitsSheet(w, d)) issues.push({ code: 'sheet', kind: 'geometry', severity: 'error', message: `A ${w} × ${d} mm board does not fit a ${PLATFORM.sheet.width} × ${PLATFORM.sheet.length} mm sheet either way round; it needs other stock or a supported joint.` });

  // each attachment: its anchor on its side frame's inner face, between the posts, where a batten can be fixed
  const battens: PlatformBatten[] = [];
  const faceX: Record<PlatformMember, number> = { 'side-left': inside.minX, 'side-right': inside.maxX };
  const valid = new Set<PlatformMember>();
  for (const a of attachments) {
    const member = a.support.member as PlatformMember;
    if (!PLATFORM_MEMBERS.includes(member)) { issues.push({ code: `member-${a.id}`, kind: 'connection', severity: 'error', message: `Attachment ${a.id} names ${a.support.member}, which is not a side frame of the enclosure.` }); continue; }
    const at = applyTransform(transform, a.anchor);
    const inward = member === 'side-left' ? 1 : -1;
    battens.push({ member, attachment: a.id, size: [PLATFORM.batten.width, enclosure.size.depth, PLATFORM.batten.depth], center: [faceX[member] + inward * PLATFORM.batten.width / 2, enclosure.size.depth / 2, at.z - PLATFORM.batten.depth / 2] });
    const off = Math.abs(at.x - faceX[member]);
    if (off > tol) issues.push({ code: `detached-${a.id}`, kind: 'connection', severity: 'error', message: `The platform's end no longer reaches the ${member === 'side-left' ? 'left' : 'right'} side frame (${Math.round(off)} mm off its face): its attachment ${a.id} is broken.` });
    else if (at.y < inside.minY - tol || at.y > inside.maxY + tol) issues.push({ code: `detached-${a.id}`, kind: 'connection', severity: 'error', message: `The platform's end is beyond the ${member === 'side-left' ? 'left' : 'right'} side frame's posts: its attachment ${a.id} is broken.` });
    else valid.add(member);
  }
  if (valid.size < 2) issues.push({ code: 'unsupported', kind: 'connection', severity: 'error', message: `The platform needs both ends on a side frame's batten; ${valid.size ? 'one is' : 'none is'}. It stays a draft until both are attached.` });

  // a batten runs the side frame's whole depth: it must keep clear of that side's cat port and the port's frame
  for (const side of enclosure.sides) {
    const member: PlatformMember = side.side === 'left' ? 'side-left' : 'side-right';
    const low = side.port.face.at[2] - PORT_FRAME; const high = side.port.face.at[2] + tunnelSize + PORT_FRAME;
    if (battens.some(b => b.member === member && b.center[2] + PLATFORM.batten.depth / 2 > low && b.center[2] - PLATFORM.batten.depth / 2 < high))
      issues.push({ code: `port-${member}`, kind: 'geometry', severity: 'error', message: `The ${side.side} support batten would cross the ${side.side} cat port (${Math.round(low)}–${Math.round(high)} mm up). Raise the platform.` });
  }
  issues.push({ code: 'span', kind: 'unverified', severity: 'info', message: `The platform's ${w} mm span of ${t} mm plywood on two battens, and the load it carries, are not verified: the checks are geometric, not structural.` });

  const bom = platformBom(params, battens);
  return { params, transform, top, under, corners, battens, issues, bom };
}
export type PlatformLayout = ReturnType<typeof platformLayout>;

/** Whether a board this size can be cut from the sheet, turned either way. */
export const fitsSheet = (w: number, d: number) => (w <= PLATFORM.sheet.width && d <= PLATFORM.sheet.length) || (d <= PLATFORM.sheet.width && w <= PLATFORM.sheet.length);

function platformBom(params: PlatformParams, battens: PlatformBatten[]): BomLine[] {
  const { width: w, depth: d, thickness: t } = params;
  const sheet = PLATFORM.sheet;
  const lines: BomLine[] = [
    { id: 'platform-board', group: 'Timber', name: 'Exterior film-faced plywood board (generic)', quantity: 1,
      size: `${w} × ${d} × ${t}, cut from a ${sheet.width} × ${sheet.length} × ${t} sheet${t === sheet.thickness ? ` (${sheet.example})` : ''}`,
      use: 'The platform: round its corners and seal every cut edge' },
  ];
  if (!battens.length) return lines;
  const length = Math.max(...battens.map(b => b.size[1]));
  lines.push({ id: 'platform-batten', group: 'Timber', name: 'Support batten, planed exterior timber (generic)', quantity: battens.length,
    size: `${PLATFORM.batten.width} × ${PLATFORM.batten.depth} × ${length}`, use: 'Under each end of the platform, along a side frame from its rear post to its front post' });
  const screw = (partId: string, quantity: number, use: string) => {
    const part = findPart(partId);
    lines.push({ id: partId, group: 'Hardware', name: part?.title ?? partId, quantity, size: part?.designation ?? '', use, partId });
  };
  screw(PLATFORM.hardware.postScrew, battens.length * 2 * PLATFORM.postScrews, 'Through each support batten into the side frame’s posts');
  screw(PLATFORM.hardware.boardScrew, battens.length * fastenersAlong(d, PLATFORM.boardScrewPitch), 'Down through the platform board into its battens');
  return lines;
}
