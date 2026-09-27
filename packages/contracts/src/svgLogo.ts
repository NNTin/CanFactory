/**
 * An SVG file as an outline that OpenSCAD can engrave (the cigarette case's underside logo, docs/cigarette-case-text.md).
 *
 * The SVG never reaches the server or OpenSCAD. The editor reads the file in the browser and `svgToLogo` turns it into a
 * *logo string*: filled outlines only, as integer points on a 0..LOGO_GRID grid, in a tiny subset of SVG path data
 * (`M x yL x y…Z`, rings that fill even-odd). That string is the parameter the API receives.
 * The server accepts nothing else: `decodeLogo` checks it character by character, with limits on its size, and `logoScad`
 * writes it for `-D LOGO=` as a vector of numbers. So a hostile file can at most spoil the user's own preview, and a hostile
 * API caller can only send numbers.
 *
 * Reading the file is strict too: `parseSvgXml` is a small XML reader of its own, with no DTDs, no entities beyond the five
 * predefined ones and character references, no external references, and limits on size, depth and element count. Only
 * geometry is read (paths, basic shapes, groups, transforms, fill); scripts, styles, links, images, text and anything in a
 * foreign namespace are never interpreted.
 */
import ClipperLib from 'clipper-lib';

/** The logo's longest side is scaled to this many grid units: every coordinate is an integer from 0 to LOGO_GRID. */
export const LOGO_GRID = 2000;
/** Most points in a logo, over all its rings; beyond this the outline is simplified further, or refused. */
export const LOGO_MAX_POINTS = 2500;
/** Most rings (outlines and holes) in a logo. */
export const LOGO_MAX_RINGS = 1000;
/** Longest logo string: every point at its longest ("L2000 2000") and a "Z" per ring. */
export const LOGO_MAX_LENGTH = LOGO_MAX_POINTS * 10 + LOGO_MAX_RINGS;
/** Largest SVG file the editor reads. */
export const SVG_MAX_BYTES = 1_000_000;

const MAX_DEPTH = 64;
const MAX_ELEMENTS = 20_000;

/** A problem with an SVG file or a logo string, in words for the user. */
export class SvgError extends Error {}

type Point = [number, number];
/** A logo: rings of [x, y] grid points (y up) that fill even-odd; simple outlines and holes that do not overlap. */
export type LogoRings = Point[][];

// ---------------------------------------------------------------------------------------------------------------------------
// XML

export interface SvgNode { name: string; attributes: Record<string, string>; children: SvgNode[] }

const NAME = /[A-Za-z_:][-A-Za-z0-9_:.]*/y;
const SPACE = /[ \t\r\n]*/y;
const PREDEFINED: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

function decodeEntities(text: string): string {
  return text.replace(/&([^;&\s]{0,12});?/g, (match, name: string) => {
    if (!match.endsWith(';')) throw new SvgError('The SVG has a stray "&". It is not a valid SVG file.');
    const predefined = PREDEFINED[name];
    if (predefined !== undefined) return predefined;
    const code = /^#x[0-9a-fA-F]{1,6}$/.test(name) ? parseInt(name.slice(2), 16) : /^#[0-9]{1,7}$/.test(name) ? parseInt(name.slice(1), 10) : Number.NaN;
    if (Number.isNaN(code)) throw new SvgError(`The SVG uses the entity "&${name};". Entities are not allowed, apart from the five that XML predefines.`);
    if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) throw new SvgError('The SVG has an invalid character reference.');
    return String.fromCodePoint(code);
  });
}

/**
 * A strict reader for the XML of an SVG file: elements and their attributes, nothing else. Comments, processing instructions
 * (such as the `<?xml ?>` declaration), CDATA and text are skipped. A document type declaration is allowed only without an
 * internal subset (as Illustrator writes it) and is never read; one with an internal subset, where entities are declared, is
 * refused. Throws `SvgError` with a message for the user.
 */
export function parseSvgXml(source: string): SvgNode {
  if (source.length > SVG_MAX_BYTES) throw new SvgError(`The SVG file is larger than ${SVG_MAX_BYTES / 1_000_000} MB.`);
  const text = source.startsWith('﻿') ? source.slice(1) : source;
  const stack: SvgNode[] = [];
  let root: SvgNode | undefined;
  let elements = 0;
  let at = 0;
  const skipTo = (marker: string, what: string) => {
    const end = text.indexOf(marker, at);
    if (end < 0) throw new SvgError(`The SVG has an unterminated ${what}.`);
    at = end + marker.length;
  };
  const name = (): string => {
    NAME.lastIndex = at;
    const match = NAME.exec(text);
    if (!match) throw new SvgError('The SVG is not well-formed XML (a tag name is missing).');
    at = NAME.lastIndex;
    return match[0];
  };
  const space = () => { SPACE.lastIndex = at; SPACE.exec(text); at = SPACE.lastIndex; };
  while (at < text.length) {
    const open = text.indexOf('<', at);
    if (open < 0) break;
    at = open;
    if (text.startsWith('<!--', at)) { skipTo('-->', 'comment'); continue; }
    if (text.startsWith('<?', at)) { skipTo('?>', 'processing instruction'); continue; }
    if (text.startsWith('<![CDATA[', at)) { skipTo(']]>', 'CDATA section'); continue; }
    if (text.startsWith('<!', at)) {
      if (!/^<!DOCTYPE\s/i.test(text.slice(at, at + 10))) throw new SvgError('The SVG has a declaration that is not allowed.');
      const end = text.indexOf('>', at);
      if (end < 0) throw new SvgError('The SVG has an unterminated document type declaration.');
      if (text.slice(at, end).includes('[')) throw new SvgError('The SVG declares its own entities (a DOCTYPE with an internal subset), which is not allowed.');
      if (root || stack.length) throw new SvgError('The SVG has a document type declaration after its first element.');
      at = end + 1;
      continue;
    }
    if (text.startsWith('</', at)) {
      at += 2;
      const closing = name();
      space();
      if (text[at] !== '>') throw new SvgError('The SVG is not well-formed XML (a closing tag is not closed).');
      at += 1;
      const node = stack.pop();
      if (!node || node.name !== closing) throw new SvgError(`The SVG is not well-formed XML (</${closing}> does not match the open element).`);
      continue;
    }
    at += 1;
    const node: SvgNode = { name: name(), attributes: Object.create(null) as Record<string, string>, children: [] };
    if (++elements > MAX_ELEMENTS) throw new SvgError(`The SVG has more than ${MAX_ELEMENTS} elements.`);
    for (;;) {
      const before = at;
      space();
      if (text.startsWith('/>', at)) { at += 2; break; }
      if (text[at] === '>') { at += 1; stack.push(node); break; }
      if (at === before) throw new SvgError('The SVG is not well-formed XML (attributes must be separated by spaces).');
      const attribute = name();
      space();
      if (text[at] !== '=') throw new SvgError(`The SVG is not well-formed XML (attribute "${attribute}" has no value).`);
      at += 1;
      space();
      const quote = text[at];
      if (quote !== '"' && quote !== "'") throw new SvgError(`The SVG is not well-formed XML (the value of "${attribute}" is not quoted).`);
      const end = text.indexOf(quote, at + 1);
      if (end < 0) throw new SvgError('The SVG is not well-formed XML (an attribute value is not closed).');
      const value = text.slice(at + 1, end);
      if (value.includes('<')) throw new SvgError('The SVG is not well-formed XML ("<" in an attribute value).');
      if (Object.prototype.hasOwnProperty.call(node.attributes, attribute)) throw new SvgError(`The SVG is not well-formed XML (attribute "${attribute}" appears twice).`);
      node.attributes[attribute] = decodeEntities(value);
      at = end + 1;
    }
    const parent = stack[stack.length - (stack.at(-1) === node ? 2 : 1)];
    if (parent) parent.children.push(node);
    else if (root) throw new SvgError('The SVG is not well-formed XML (it has more than one root element).');
    else root = node;
    if (stack.length > MAX_DEPTH) throw new SvgError(`The SVG nests elements more than ${MAX_DEPTH} deep.`);
  }
  if (stack.length) throw new SvgError(`The SVG is not well-formed XML (<${stack.at(-1)?.name}> is never closed).`);
  if (!root) throw new SvgError('This file has no XML elements. Choose an SVG file.');
  return root;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Geometry

/** An affine transform [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f (SVG's matrix()). */
type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: Matrix, p: Point): Point => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const SEPARATOR = /[\s,]*/y;

/** Reads SVG numbers (and, for arcs, flags, which may run together: "a1 1 0 01 5 5"). */
class Numbers {
  at = 0;
  constructor(private readonly text: string) {}
  skip(): void { SEPARATOR.lastIndex = this.at; SEPARATOR.exec(this.text); this.at = SEPARATOR.lastIndex; }
  done(): boolean { this.skip(); return this.at >= this.text.length; }
  startsNumber(): boolean { this.skip(); return /[-+.\d]/.test(this.text[this.at] ?? ''); }
  number(): number {
    this.skip();
    NUMBER.lastIndex = this.at;
    const match = NUMBER.exec(this.text);
    if (!match) throw new SvgError('The SVG has a path or shape with a malformed number.');
    this.at = NUMBER.lastIndex;
    const value = Number(match[0]);
    if (!Number.isFinite(value) || Math.abs(value) > 1e9) throw new SvgError('The SVG has a number that is too large.');
    return value;
  }
  flag(): boolean {
    this.skip();
    const char = this.text[this.at];
    if (char !== '0' && char !== '1') throw new SvgError('The SVG has an arc with a malformed flag.');
    this.at += 1;
    return char === '1';
  }
}

function parseTransform(value: string): Matrix {
  let matrix = IDENTITY;
  const rest = value.replace(/\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^()]*)\)\s*,?/g, (_match, kind: string, list: string) => {
    const reader = new Numbers(list);
    const args: number[] = [];
    while (!reader.done()) args.push(reader.number());
    const [a = 0, b, c, d, e, f] = args;
    const rad = (degrees: number) => degrees * Math.PI / 180;
    let step: Matrix | undefined;
    if (kind === 'matrix' && args.length === 6) step = [a, b ?? 0, c ?? 0, d ?? 0, e ?? 0, f ?? 0];
    else if (kind === 'translate' && args.length >= 1 && args.length <= 2) step = [1, 0, 0, 1, a, b ?? 0];
    else if (kind === 'scale' && args.length >= 1 && args.length <= 2) step = [a, 0, 0, b ?? a, 0, 0];
    else if (kind === 'rotate' && (args.length === 1 || args.length === 3)) {
      const [cos, sin] = [Math.cos(rad(a)), Math.sin(rad(a))];
      const [cx, cy] = [b ?? 0, c ?? 0];
      step = multiply(multiply([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
    } else if (kind === 'skewX' && args.length === 1) step = [1, 0, Math.tan(rad(a)), 1, 0, 0];
    else if (kind === 'skewY' && args.length === 1) step = [1, Math.tan(rad(a)), 0, 1, 0, 0];
    if (!step) throw new SvgError(`The SVG has a malformed transform: ${kind}(${list.trim().slice(0, 40)}).`);
    matrix = multiply(matrix, step);
    return '';
  });
  if (rest.trim() !== '') throw new SvgError(`The SVG has a transform that cannot be read: "${value.trim().slice(0, 60)}".`);
  return matrix;
}

/** A subpath in final coordinates: its start and, per segment, a line to a point or a cubic Bézier (two controls, end). */
interface Subpath { start: Point; segments: (Point | [Point, Point, Point])[] }

/** Collects subpaths, applying a transform. Quadratic curves and arcs are converted to cubics before transforming, which is exact
 * for affine transforms (an arc's cubic approximation is within 0.03 % of its radius). */
class Builder {
  subpaths: Subpath[] = [];
  private current: Subpath | undefined;
  constructor(private readonly matrix: Matrix) {}
  move(p: Point): void { this.current = { start: apply(this.matrix, p), segments: [] }; this.subpaths.push(this.current); }
  line(p: Point): void { this.current?.segments.push(apply(this.matrix, p)); }
  cubic(c1: Point, c2: Point, p: Point): void { this.current?.segments.push([apply(this.matrix, c1), apply(this.matrix, c2), apply(this.matrix, p)]); }
  /** An elliptical arc from `from` (SVG's endpoint parameterisation, section F.6 of SVG 1.1), as cubic Béziers of at most 90°. */
  arc(from: Point, rx: number, ry: number, angle: number, large: boolean, sweep: boolean, to: Point): void {
    rx = Math.abs(rx); ry = Math.abs(ry);
    if (rx === 0 || ry === 0 || (from[0] === to[0] && from[1] === to[1])) { this.line(to); return; }
    const phi = angle * Math.PI / 180;
    const [cos, sin] = [Math.cos(phi), Math.sin(phi)];
    const dx = (from[0] - to[0]) / 2, dy = (from[1] - to[1]) / 2;
    const x1 = cos * dx + sin * dy, y1 = -sin * dx + cos * dy;
    const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
    if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
    const numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
    const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
    const cx1 = factor * rx * y1 / ry, cy1 = -factor * ry * x1 / rx;
    const cx = cos * cx1 - sin * cy1 + (from[0] + to[0]) / 2, cy = sin * cx1 + cos * cy1 + (from[1] + to[1]) / 2;
    const vectorAngle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const theta = vectorAngle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
    let delta = vectorAngle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
    if (!sweep && delta > 0) delta -= 2 * Math.PI;
    if (sweep && delta < 0) delta += 2 * Math.PI;
    const count = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
    const step = delta / count;
    const k = 4 / 3 * Math.tan(step / 4);
    const point = (t: number): Point => {
      const [ex, ey] = [Math.cos(t), Math.sin(t)];
      return [cx + cos * rx * ex - sin * ry * ey, cy + sin * rx * ex + cos * ry * ey];
    };
    const derivative = (t: number): Point => {
      const [ex, ey] = [-Math.sin(t), Math.cos(t)];
      return [cos * rx * ex - sin * ry * ey, sin * rx * ex + cos * ry * ey];
    };
    for (let i = 0; i < count; i++) {
      const t0 = theta + i * step, t1 = t0 + step;
      const p0 = point(t0), p1 = i === count - 1 ? to : point(t1);
      const d0 = derivative(t0), d1 = derivative(t1);
      this.cubic([p0[0] + k * d0[0], p0[1] + k * d0[1]], [p1[0] - k * d1[0], p1[1] - k * d1[1]], p1);
    }
  }
}

/** SVG path data (the `d` attribute), all commands, into the builder. */
function readPath(d: string, out: Builder): void {
  const reader = new Numbers(d);
  let current: Point = [0, 0], start: Point = [0, 0];
  let lastControl: Point | undefined, lastQuad: Point | undefined;
  let command = '';
  for (;;) {
    reader.skip();
    if (reader.at >= d.length) break;
    const char = d[reader.at] ?? '';
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(char)) { command = char; reader.at += 1; }
    else if (!command || command === 'z' || command === 'Z' || !reader.startsNumber()) throw new SvgError('The SVG has a path with malformed data.');
    else if (command === 'M') command = 'L';
    else if (command === 'm') command = 'l';
    const relative = command === command.toLowerCase();
    const at = (x: number, y: number): Point => relative ? [current[0] + x, current[1] + y] : [x, y];
    let control: Point | undefined, quad: Point | undefined;
    switch (command.toUpperCase()) {
      case 'M': current = at(reader.number(), reader.number()); start = current; out.move(current); break;
      case 'L': current = at(reader.number(), reader.number()); out.line(current); break;
      case 'H': { const x = reader.number(); current = [relative ? current[0] + x : x, current[1]]; out.line(current); break; }
      case 'V': { const y = reader.number(); current = [current[0], relative ? current[1] + y : y]; out.line(current); break; }
      case 'C': { const c1 = at(reader.number(), reader.number()); control = at(reader.number(), reader.number()); const p = at(reader.number(), reader.number()); out.cubic(c1, control, p); current = p; break; }
      case 'S': {
        const c1: Point = lastControl ? [2 * current[0] - lastControl[0], 2 * current[1] - lastControl[1]] : current;
        control = at(reader.number(), reader.number()); const p = at(reader.number(), reader.number()); out.cubic(c1, control, p); current = p; break;
      }
      case 'Q': case 'T': {
        quad = command.toUpperCase() === 'Q' ? at(reader.number(), reader.number()) : lastQuad ? [2 * current[0] - lastQuad[0], 2 * current[1] - lastQuad[1]] : current;
        const p = at(reader.number(), reader.number());
        const q = quad;
        out.cubic([current[0] + 2 / 3 * (q[0] - current[0]), current[1] + 2 / 3 * (q[1] - current[1])], [p[0] + 2 / 3 * (q[0] - p[0]), p[1] + 2 / 3 * (q[1] - p[1])], p);
        current = p; break;
      }
      case 'A': {
        const rx = reader.number(), ry = reader.number(), angle = reader.number(), large = reader.flag(), sweep = reader.flag();
        const p = at(reader.number(), reader.number());
        out.arc(current, rx, ry, angle, large, sweep, p); current = p; break;
      }
      case 'Z': current = start; break;
    }
    lastControl = control; lastQuad = quad;
    // After Z, a following number starts nothing; a command letter must come next (checked above).
  }
}

const length = (value: string | undefined): number | undefined => {
  if (value === undefined) return undefined;
  const match = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(px|mm|cm|in|pt|pc)?\s*$/.exec(value);
  if (!match) return undefined;
  const scale: Record<string, number> = { px: 1, mm: 96 / 25.4, cm: 96 / 2.54, in: 96, pt: 96 / 72, pc: 16 };
  return Number(match[1]) * (match[2] ? scale[match[2]] ?? 1 : 1);
};

/** A basic shape's outline, in the builder. Returns false if the element has no area (e.g. a zero-width rect). */
function readShape(node: SvgNode, name: string, out: Builder): boolean {
  const a = node.attributes;
  const num = (key: string) => length(a[key]) ?? 0;
  const KAPPA = 0.5522847498307936;
  const ellipse = (cx: number, cy: number, rx: number, ry: number) => {
    if (rx <= 0 || ry <= 0) return false;
    out.move([cx + rx, cy]);
    out.cubic([cx + rx, cy + KAPPA * ry], [cx + KAPPA * rx, cy + ry], [cx, cy + ry]);
    out.cubic([cx - KAPPA * rx, cy + ry], [cx - rx, cy + KAPPA * ry], [cx - rx, cy]);
    out.cubic([cx - rx, cy - KAPPA * ry], [cx - KAPPA * rx, cy - ry], [cx, cy - ry]);
    out.cubic([cx + KAPPA * rx, cy - ry], [cx + rx, cy - KAPPA * ry], [cx + rx, cy]);
    return true;
  };
  switch (name) {
    case 'path': readPath(a['d'] ?? '', out); return true;
    case 'circle': return ellipse(num('cx'), num('cy'), num('r'), num('r'));
    case 'ellipse': return ellipse(num('cx'), num('cy'), num('rx'), num('ry'));
    case 'rect': {
      const [x, y, w, h] = [num('x'), num('y'), num('width'), num('height')];
      if (w <= 0 || h <= 0) return false;
      let rx = length(a['rx']), ry = length(a['ry']);
      rx = Math.min(w / 2, Math.max(0, rx ?? ry ?? 0)); ry = Math.min(h / 2, Math.max(0, ry ?? rx));
      if (rx === 0 || ry === 0) { out.move([x, y]); out.line([x + w, y]); out.line([x + w, y + h]); out.line([x, y + h]); return true; }
      out.move([x + rx, y]); out.line([x + w - rx, y]); out.arc([x + w - rx, y], rx, ry, 0, false, true, [x + w, y + ry]);
      out.line([x + w, y + h - ry]); out.arc([x + w, y + h - ry], rx, ry, 0, false, true, [x + w - rx, y + h]);
      out.line([x + rx, y + h]); out.arc([x + rx, y + h], rx, ry, 0, false, true, [x, y + h - ry]);
      out.line([x, y + ry]); out.arc([x, y + ry], rx, ry, 0, false, true, [x + rx, y]);
      return true;
    }
    case 'polygon': case 'polyline': {
      const reader = new Numbers(a['points'] ?? '');
      const points: Point[] = [];
      while (!reader.done()) points.push([reader.number(), reader.number()]);
      const [first, ...rest] = points;
      if (!first) return false;
      out.move(first);
      for (const p of rest) out.line(p);
      return true;
    }
  }
  return false;
}

interface Style { fill: boolean; evenOdd: boolean; visible: boolean }

/** The declarations of a `style` attribute (CSS `property: value;` pairs), lower-cased property names. */
function styleOf(node: SvgNode): Record<string, string> {
  const declarations: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [key, value] of Object.entries(node.attributes)) if (!key.includes(':')) declarations[key.toLowerCase()] = value.trim();
  for (const declaration of (node.attributes['style'] ?? '').split(';')) {
    const colon = declaration.indexOf(':');
    if (colon > 0) declarations[declaration.slice(0, colon).trim().toLowerCase()] = declaration.slice(colon + 1).replace(/!important/i, '').trim();
  }
  return declarations;
}

const WARNINGS = {
  text: 'Text in the SVG was left out: convert it to paths first (in Inkscape: Path > Object to Path).',
  image: 'Embedded pictures were left out: only filled shapes are used.',
  use: 'Linked copies (<use>) were left out: unlink them first (in Inkscape: Edit > Clone > Unlink Clone).',
  stroke: 'Shapes with only an outline (a stroke) and no fill were left out: convert strokes to paths first (in Inkscape: Path > Stroke to Path).',
  css: 'Style sheets (<style>) are ignored: only fill set on the shapes themselves counts.',
  clip: 'Clip paths and masks are ignored: the shapes are used whole.',
} as const;
type Warning = keyof typeof WARNINGS;

const CONTAINERS = new Set(['svg', 'g', 'a']);
const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline']);
const SKIPPED: Partial<Record<string, Warning>> = { text: 'text', image: 'image', use: 'use', style: 'css', clipPath: 'clip', mask: 'clip', foreignObject: 'image' };

interface RawShape { subpaths: Subpath[]; evenOdd: boolean }

function collect(node: SvgNode, matrix: Matrix, inherited: Style, shapes: RawShape[], warnings: Set<Warning>, root: boolean): void {
  // Elements in other namespaces (Inkscape's sodipodi:namedview, RDF metadata, …) are editor data, never geometry.
  const colon = node.name.indexOf(':');
  if (colon >= 0 && node.name.slice(0, colon) !== 'svg') return;
  const name = colon >= 0 ? node.name.slice(colon + 1) : node.name;
  const skipped = SKIPPED[name];
  if (skipped) { warnings.add(skipped); return; }
  if (!CONTAINERS.has(name) && !SHAPES.has(name)) return;   // defs, symbol, marker, pattern, metadata, title, script, …
  const style = styleOf(node);
  if (style['display'] === 'none' || parseFloat(style['opacity'] ?? '') === 0) return;
  const fill = style['fill'];
  const noFill = fill === 'none' || fill === 'transparent' || parseFloat(style['fill-opacity'] ?? '') === 0;
  const own: Style = {
    fill: noFill ? false : fill !== undefined && fill !== 'inherit' ? true : inherited.fill,
    evenOdd: style['fill-rule'] === 'evenodd' ? true : style['fill-rule'] === 'nonzero' ? false : inherited.evenOdd,
    visible: style['visibility'] === 'hidden' || style['visibility'] === 'collapse' ? false : style['visibility'] === 'visible' ? true : inherited.visible,
  };
  let local = matrix;
  if (node.attributes['transform'] !== undefined) local = multiply(local, parseTransform(node.attributes['transform']));
  if (name === 'svg' && !root) local = multiply(local, [1, 0, 0, 1, length(node.attributes['x']) ?? 0, length(node.attributes['y']) ?? 0]);
  if (CONTAINERS.has(name)) {
    for (const child of node.children) collect(child, local, own, shapes, warnings, false);
    return;
  }
  if (!own.visible) return;
  if (!own.fill) { if (style['stroke'] !== undefined && style['stroke'] !== 'none') warnings.add('stroke'); return; }
  const builder = new Builder(local);
  if (readShape(node, name, builder)) shapes.push({ subpaths: builder.subpaths, evenOdd: own.evenOdd });
}

/** A cubic's points after its start, enough to stay within `tolerance` of the curve (Wang's formula). */
function flattenCubic(p0: Point, c1: Point, c2: Point, p3: Point, tolerance: number, out: Point[]): void {
  const dd = Math.max(Math.hypot(p0[0] - 2 * c1[0] + c2[0], p0[1] - 2 * c1[1] + c2[1]), Math.hypot(c1[0] - 2 * c2[0] + p3[0], c1[1] - 2 * c2[1] + p3[1]));
  const n = Math.min(100, Math.max(1, Math.ceil(Math.sqrt(0.75 * dd / tolerance))));
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]]);
  }
}

/** Ramer–Douglas–Peucker on a closed ring: drops points that lie within `epsilon` of the line through their neighbours. */
function simplifyRing(ring: Point[], epsilon: number): Point[] {
  if (ring.length <= 3 || epsilon <= 0) return ring;
  // Split at the two points farthest apart, so that each half is an open polyline.
  let far = 0, best = -1;
  const first = ring[0] as Point;
  ring.forEach((p, i) => { const d = Math.hypot(p[0] - first[0], p[1] - first[1]); if (d > best) { best = d; far = i; } });
  const keep = new Uint8Array(ring.length);
  keep[0] = 1; keep[far] = 1;
  const stack: [number, number][] = [[0, far], [far, ring.length]];
  while (stack.length) {
    const [from, to] = stack.pop() as [number, number];
    const a = ring[from] as Point, b = ring[to % ring.length] as Point;
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const span = Math.hypot(dx, dy);
    let index = -1, distance = epsilon;
    for (let i = from + 1; i < to; i++) {
      const p = ring[i] as Point;
      const d = span === 0 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs(dx * (a[1] - p[1]) - dy * (a[0] - p[0])) / span;
      if (d > distance) { distance = d; index = i; }
    }
    if (index >= 0) { keep[index] = 1; stack.push([from, index], [index, to]); }
  }
  return ring.filter((_, i) => keep[i]);
}

export interface Logo {
  /** The logo string: the parameter value. */
  logo: string;
  rings: number;
  points: number;
  /** The width / height of the outline. */
  aspect: number;
  /** Parts of the file that were left out, in words for the user. */
  warnings: string[];
}

const toClipper = (ring: Point[]): ClipperLib.Path => ring.map(([X, Y]) => ({ X, Y }));

/**
 * An SVG file's filled shapes as a logo string (see the top of this file). Strokes, text, images, clip paths, masks and style
 * sheets are left out, with a warning each. Each shape is filled by its own fill rule (nonzero or even-odd, including rings that
 * cross themselves) and the shapes are joined, with Clipper, the polygon library OpenSCAD itself uses: the result is simple,
 * non-overlapping outlines and holes, which fill even-odd exactly as the SVG. The outline is scaled so that its longest side is
 * LOGO_GRID, flipped so that y points up, and simplified until it has at most LOGO_MAX_POINTS points. Throws `SvgError` with a
 * message for the user.
 */
export function svgToLogo(source: string): Logo {
  const root = parseSvgXml(source);
  if (root.name !== 'svg' && root.name !== 'svg:svg') throw new SvgError('This is not an SVG file: its root element is not <svg>.');
  const raw: RawShape[] = [];
  const warnings = new Set<Warning>();
  collect(root, IDENTITY, { fill: true, evenOdd: false, visible: true }, raw, warnings, true);
  const leftOut = () => warnings.size ? ` ${[...warnings].map(w => WARNINGS[w]).join(' ')}` : '';
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const shape of raw) for (const subpath of shape.subpaths) for (const p of [subpath.start, ...subpath.segments.flatMap(s => typeof s[0] === 'number' ? [s as Point] : s as Point[])]) {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  }
  const size = Math.max(maxX - minX, maxY - minY);
  if (!Number.isFinite(size) || size <= 0) throw new SvgError(`The SVG has no filled shapes to engrave.${leftOut()}`);
  const scale = LOGO_GRID / size;
  // Into grid units, y up: every later step works on the grid, so tolerances are in grid units too. The control points' box
  // holds the curves, so every point lands in 0..LOGO_GRID.
  const toGrid = (p: Point): Point => [(p[0] - minX) * scale, (maxY - p[1]) * scale];
  for (let tolerance = 0.5; ; tolerance *= 1.6) {
    const clipper = new ClipperLib.Clipper();
    for (const shape of raw) {
      const rings: ClipperLib.Paths = [];
      for (const subpath of shape.subpaths) {
        const curve: Point[] = [toGrid(subpath.start)];
        for (const segment of subpath.segments) {
          const previous = curve.at(-1) as Point;
          if (typeof segment[0] === 'number') curve.push(toGrid(segment as Point));
          else { const [c1, c2, p] = segment as [Point, Point, Point]; flattenCubic(previous, toGrid(c1), toGrid(c2), toGrid(p), tolerance / 2, curve); }
        }
        const ring = simplifyRing(curve, tolerance / 2).map(([x, y]): Point => [Math.round(x), Math.round(y)]);
        if (ring.length >= 3) rings.push(toClipper(ring));
      }
      // The shape filled by its own rule, as simple outlines (counter-clockwise) and holes (clockwise) ...
      const filled = ClipperLib.Clipper.SimplifyPolygons(rings, shape.evenOdd ? ClipperLib.PolyFillType.pftEvenOdd : ClipperLib.PolyFillType.pftNonZero);
      clipper.AddPaths(filled, ClipperLib.PolyType.ptSubject, true);
    }
    // ... which join nonzero, as the SVG paints one shape over another.
    const joined: ClipperLib.Paths = [];
    clipper.Execute(ClipperLib.ClipType.ctUnion, joined, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    const rings = ClipperLib.Clipper.CleanPolygons(joined, 1)
      .filter(ring => ring.length >= 3 && Math.abs(ClipperLib.Clipper.Area(ring)) >= 1)
      .map(ring => ring.map(({ X, Y }): Point => [X, Y]));
    const points = rings.reduce((sum, ring) => sum + ring.length, 0);
    if (rings.length === 0) throw new SvgError(`The SVG has no filled shapes large enough to engrave.${leftOut()}`);
    if (rings.length > LOGO_MAX_RINGS)
      throw new SvgError(`The SVG has ${rings.length} separate outlines and holes; at most ${LOGO_MAX_RINGS} can be engraved. Simplify it first.`);
    if (points <= LOGO_MAX_POINTS) {
      const all = rings.flat();
      const extent = (axis: 0 | 1) => Math.max(...all.map(p => p[axis])) - Math.min(...all.map(p => p[axis]));
      return { logo: encodeLogo(rings), rings: rings.length, points, aspect: extent(0) / Math.max(1, extent(1)), warnings: [...warnings].map(w => WARNINGS[w]) };
    }
    // Too detailed at this tolerance: simplify further, up to 1 % of the logo's size (0.35 mm at the largest).
    if (tolerance > LOGO_GRID / 100) throw new SvgError(`The SVG is too detailed to engrave: it still has ${points} points after simplifying, and at most ${LOGO_MAX_POINTS} are allowed. Simplify it first (in Inkscape: Path > Simplify).`);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// The logo string

export function encodeLogo(rings: LogoRings): string {
  return rings.map(ring => ring.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('') + 'Z').join('');
}

/**
 * Reads a logo string strictly: only `M`, `L`, `Z`, digits and single spaces, in exactly the form `encodeLogo` writes, with every
 * coordinate an integer from 0 to LOGO_GRID, every ring at least three points, and the limits on points and rings. Throws
 * `SvgError` otherwise. The empty string is no logo.
 */
export function decodeLogo(logo: string): LogoRings {
  if (logo.length > LOGO_MAX_LENGTH) throw new SvgError('The logo is too long.');
  const rings: LogoRings = [];
  let at = 0, points = 0;
  const fail = (): never => { throw new SvgError(`The logo is malformed at character ${at + 1}. Load the SVG file again.`); };
  const integer = (): number => {
    const from = at;
    while (at < logo.length && at - from < 5 && logo.charCodeAt(at) >= 48 && logo.charCodeAt(at) <= 57) at++;
    if (at === from || (logo[from] === '0' && at - from > 1)) fail();
    const value = Number(logo.slice(from, at));
    if (value > LOGO_GRID) throw new SvgError(`The logo has a coordinate above ${LOGO_GRID}. Load the SVG file again.`);
    return value;
  };
  while (at < logo.length) {
    if (logo[at] !== 'M') fail();
    const ring: Point[] = [];
    do {
      at++;
      const x = integer();
      if (logo[at] !== ' ') fail();
      at++;
      ring.push([x, integer()]);
    } while (logo[at] === 'L');
    if (logo[at] !== 'Z' || ring.length < 3) fail();
    at++;
    rings.push(ring);
    points += ring.length;
    if (rings.length > LOGO_MAX_RINGS || points > LOGO_MAX_POINTS) throw new SvgError(`The logo has more than ${LOGO_MAX_POINTS} points or ${LOGO_MAX_RINGS} outlines.`);
  }
  return rings;
}

/** The logo as an OpenSCAD vector for `-D LOGO=`: rings of [x, y]. Only numbers and brackets; throws if the logo is invalid. */
export const logoScad = (logo: string): string => JSON.stringify(decodeLogo(logo));
