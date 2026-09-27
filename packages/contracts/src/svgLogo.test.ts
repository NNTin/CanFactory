import { describe, expect, it } from 'vitest';
import { decodeLogo, encodeLogo, LOGO_GRID, LOGO_MAX_POINTS, LOGO_MAX_RINGS, logoScad, parseSvgXml, SVG_MAX_BYTES, SvgError, svgToLogo, type LogoRings } from './svgLogo.ts';

const svg = (body: string, attributes = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${attributes}>${body}</svg>`;
/** The filled area of a logo in grid units² (its rings fill even-odd and do not overlap, so holes count negative). */
const area = (rings: LogoRings) => Math.abs(rings.reduce((sum, ring) => sum + ring.reduce((s, p, i) => {
  const q = ring[(i + 1) % ring.length] ?? p;
  return s + p[0] * q[1] - q[0] * p[1];
}, 0) / 2, 0));
const rings = (source: string) => decodeLogo(svgToLogo(source).logo);
const bounds = (logo: LogoRings) => {
  const points = logo.flat();
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
};

describe('parseSvgXml: a strict reader that interprets nothing but elements and attributes', () => {
  it('refuses entity declarations, so no external entity (XXE) or entity expansion (billion laughs) is possible', () => {
    const xxe = '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg><path d="&xxe;"/></svg>';
    expect(() => parseSvgXml(xxe)).toThrow(/entities/);
    const laughs = '<!DOCTYPE svg [<!ENTITY a "lol"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;">]><svg id="&b;"/>';
    expect(() => parseSvgXml(laughs)).toThrow(SvgError);
    expect(() => parseSvgXml('<svg><path d="&xxe;"/></svg>')).toThrow(/entity "&xxe;"/);
    expect(() => parseSvgXml('<svg><path d="a & b"/></svg>')).toThrow(/stray/);
  });

  it('allows a DOCTYPE without an internal subset (as Illustrator writes it) and never reads it', () => {
    const illustrator = '<?xml version="1.0" encoding="utf-8"?>\n<!-- Generator: Adobe Illustrator -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg><rect width="1" height="1"/></svg>';
    expect(parseSvgXml(illustrator).children[0]?.name).toBe('rect');
    expect(() => parseSvgXml('<svg/><!DOCTYPE svg>')).toThrow(SvgError);
  });

  it('decodes only the predefined entities and character references', () => {
    expect(parseSvgXml('<svg a="&lt;&gt;&amp;&quot;&apos;&#65;&#x42;"/>').attributes['a']).toBe('<>&"\'AB');
    expect(() => parseSvgXml('<svg a="&#0;"/>')).toThrow(SvgError);
    expect(() => parseSvgXml('<svg a="&#xD800;"/>')).toThrow(SvgError);
  });

  it('refuses malformed XML', () => {
    for (const source of ['<svg>', '<svg><g></svg>', '<svg a="1" a="2"/>', '<svg a=1/>', '<svg a="1"b="2"/>', '<svg a="<"/>', '<svg/><svg/>', '<svg><!-- open', 'no markup', '<svg><![CDATA[ open</svg>', '<svg><!ELEMENT x ANY></svg>'])
      expect(() => parseSvgXml(source), source).toThrow(SvgError);
  });

  it('limits the file size, the nesting depth and the number of elements', () => {
    expect(() => parseSvgXml(`<svg>${' '.repeat(SVG_MAX_BYTES)}</svg>`)).toThrow(/larger/);
    expect(() => parseSvgXml(`<svg>${'<g>'.repeat(65)}${'</g>'.repeat(65)}</svg>`)).toThrow(/deep/);
    expect(parseSvgXml(`<svg>${'<g>'.repeat(60)}${'</g>'.repeat(60)}</svg>`).name).toBe('svg');
    expect(() => parseSvgXml(`<svg>${'<g/>'.repeat(20_000)}</svg>`)).toThrow(/elements/);
  });

  it('keeps attribute names that are special in JavaScript as plain data', () => {
    const node = parseSvgXml('<svg __proto__="x" constructor="y"/>');
    expect(node.attributes['__proto__']).toBe('x');
    expect(Object.getPrototypeOf(node.attributes)).toBeNull();
  });
});

describe('svgToLogo: only filled geometry leaves the file', () => {
  it('ignores scripts, event handlers, links, styles, pictures and foreign namespaces: the result is numbers and M, L, Z only', () => {
    const hostile = svg(`<script>alert(1)</script><style>path { fill: none }</style>
      <image href="file:///etc/passwd" width="10" height="10"/><use href="https://example.com/x.svg#a"/>
      <foreignObject><div xmlns="http://www.w3.org/1999/xhtml" onclick="alert(1)">x</div></foreignObject>
      <a href="javascript:alert(1)"><rect width="10" height="10" onclick="alert(1)"/></a>
      <sodipodi:namedview xmlns:sodipodi="x"><rect width="90" height="90"/></sodipodi:namedview>`, ' onload="alert(1)"');
    const logo = svgToLogo(hostile);
    expect(logo.logo).toMatch(/^[MLZ0-9 ]+$/);
    const square = decodeLogo(logo.logo);
    expect(square).toHaveLength(1);
    expect(bounds(square)).toEqual([0, 0, LOGO_GRID, LOGO_GRID]);
    expect(area(square)).toBe(LOGO_GRID * LOGO_GRID);
    expect(logo.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/Style sheets/), expect.stringMatching(/pictures/), expect.stringMatching(/Linked copies/)]));
  });

  it('refuses files that are not SVG, or that have nothing filled, and says what was left out', () => {
    expect(() => svgToLogo('<html><body/></html>')).toThrow(/not an SVG/);
    expect(() => svgToLogo(svg('<text>Hi</text><path d="M0 0L10 0L10 10Z" fill="none" stroke="#000"/>'))).toThrow(/no filled shapes.*convert it to paths.*Stroke to Path/);
    expect(() => svgToLogo(svg('<defs><rect width="10" height="10"/></defs>'))).toThrow(/no filled shapes/);
  });

  it('scales the longest side to the grid, y up, whatever the units and position', () => {
    const logo = rings(svg('<rect x="30" y="40" width="20" height="10"/>'));
    expect(bounds(logo)).toEqual([0, 0, LOGO_GRID, LOGO_GRID / 2]);
    expect(svgToLogo(svg('<rect x="30" y="40" width="20" height="10"/>')).aspect).toBe(2);
    // y points up: a triangle with its apex at the top of the SVG (small y) has its apex at the top of the grid (large y)
    const triangle = rings(svg('<path d="M0 10 L10 10 L5 0 Z"/>'))[0] ?? [];
    expect(triangle).toContainEqual([1000, 2000]);
  });

  it('reads transforms, nested groups and the basic shapes', () => {
    // two unit squares: one translated, one scaled and rotated a quarter turn about its corner, together a 3 x 1 bar with a gap
    const bar = rings(svg('<g transform="translate(10 0)"><rect width="1" height="1"/><g transform="matrix(1 0 0 1 2 0)"><rect transform="rotate(90 0.5 0.5)" width="1" height="1"/></g></g>'));
    expect(bar).toHaveLength(2);
    expect(bounds(bar)).toEqual([0, 0, LOGO_GRID, Math.round(LOGO_GRID / 3)]);
    const circle = rings(svg('<circle cx="50" cy="50" r="40"/>'));
    expect(area(circle) / (Math.PI * 1000 * 1000)).toBeCloseTo(1, 2);
    expect(rings(svg('<ellipse cx="50" cy="50" rx="40" ry="20"/>'))).toHaveLength(1);
    expect(rings(svg('<polygon points="0,0 10,0 5,8"/>'))[0]).toHaveLength(3);
    expect(rings(svg('<polyline points="0 0 10 0 10 10 0 10"/>'))[0]).toHaveLength(4);
    const rounded = rings(svg('<rect width="100" height="50" rx="10"/>'));
    expect(area(rounded) / (2000 * 1000 - (4 - Math.PI) * 200 * 200)).toBeCloseTo(1, 2);
    expect(() => svgToLogo(svg('<rect width="1" height="1" transform="rotate(1 2)"/>'))).toThrow(/transform/);
    expect(() => svgToLogo(svg('<rect width="1" height="1" transform="translate(1) evil()"/>'))).toThrow(/transform/);
  });

  it('reads every path command: relative, shorthand, quadratic and arcs with run-together flags', () => {
    // a 10 x 10 square drawn with H, V and relative moves
    expect(area(rings(svg('<path d="m 0,0 h10 v10 H0 z"/>')))).toBe(LOGO_GRID * LOGO_GRID);
    // a half disc: an arc of radius 5 over a 10 wide chord, flags written together ("a5 5 0 01 ...")
    const half = rings(svg('<path d="M0 5a5 5 0 01 10 0z"/>'));
    expect(area(half) / (Math.PI * 1000 * 1000 / 2)).toBeCloseTo(1, 2);
    for (const d of ['M0 0C0 10 10 10 10 0S20 -10 20 0Z', 'M0 0Q5 10 10 0T20 0Z', 'M0 0L10 0L10 10ZM20 0l5 0l0 5z'])
      expect(rings(svg(`<path d="${d}"/>`)).length, d).toBeGreaterThan(0);
    for (const d of ['M0 0L10', 'M0 0 X 10 10', 'M0 0A5 5 0 2 1 10 0Z', 'L 10 10', 'M0 0L1e999 0 5 5Z'])
      expect(() => svgToLogo(svg(`<path d="${d}"/>`)), d).toThrow(SvgError);
  });

  it('fills as the SVG does: nonzero by default, even-odd when asked, and shapes painted over each other joined', () => {
    // two squares drawn the same way round, one inside the other
    const nested = 'M0 0H10V10H0Z M3 3H7V7H3Z';
    expect(area(rings(svg(`<path d="${nested}"/>`)))).toBe(LOGO_GRID * LOGO_GRID);
    expect(area(rings(svg(`<path d="${nested}" fill-rule="evenodd"/>`)))).toBe(LOGO_GRID * LOGO_GRID * (1 - 0.16));
    expect(area(rings(svg(`<g style="fill-rule:evenodd"><path d="${nested}"/></g>`)))).toBe(LOGO_GRID * LOGO_GRID * (1 - 0.16));
    // the inner square drawn the other way round is a hole under both rules
    expect(area(rings(svg('<path d="M0 0H10V10H0Z M3 3V7H7V3Z"/>')))).toBe(LOGO_GRID * LOGO_GRID * (1 - 0.16));
    // an outline that crosses itself (like a calligraphic stroke) stays filled where it overlaps itself: a pentagram's centre
    const star = 'M5 0 L8.09 9.51 L0 3.63 L10 3.63 L1.91 9.51 Z';
    const nonzero = rings(svg(`<path d="${star}"/>`));
    const evenOdd = rings(svg(`<path d="${star}" fill-rule="evenodd"/>`));
    expect(nonzero).toHaveLength(1);
    expect(evenOdd).toHaveLength(5);
    expect(area(nonzero) / area(evenOdd)).toBeGreaterThan(1.3);
    // two overlapping shapes are joined, not cut out of each other
    const joined = rings(svg('<rect width="10" height="10"/><rect x="5" y="5" width="10" height="10"/>'));
    expect(joined).toHaveLength(1);
    expect(area(joined) / ((LOGO_GRID / 15) ** 2 * (2 * 100 - 25))).toBeCloseTo(1, 3);
  });

  it('follows fill, display, visibility and opacity, inherited from groups', () => {
    const one = (body: string) => rings(svg(`${body}<rect x="90" y="90" width="10" height="10"/>`)).length;
    expect(one('<rect width="10" height="10" fill="none"/>')).toBe(1);
    expect(one('<rect width="10" height="10" style="fill: none !important"/>')).toBe(1);
    expect(one('<g fill="none"><rect width="10" height="10"/></g>')).toBe(1);
    expect(one('<g fill="none"><rect width="10" height="10" fill="red"/></g>')).toBe(2);
    expect(one('<g style="display:none"><rect width="10" height="10" fill="red"/></g>')).toBe(1);
    expect(one('<g visibility="hidden"><rect width="10" height="10"/></g>')).toBe(1);
    expect(one('<g visibility="hidden"><rect width="10" height="10" visibility="visible"/></g>')).toBe(2);
    expect(one('<g opacity="0"><rect width="10" height="10" fill="red"/></g>')).toBe(1);
    expect(one('<rect width="10" height="10" fill-opacity="0"/>')).toBe(1);
    expect(one('<rect width="10" height="10" fill="url(#gradient)"/>')).toBe(2);
  });

  it('simplifies a detailed file to the point limit, and refuses one that stays too detailed', () => {
    const wavy = `M0 0 ${Array.from({ length: 4000 }, (_, i) => `L${i / 40} ${10 + Math.sin(i / 7)}`).join(' ')} L100 0 Z`;
    const simplified = svgToLogo(svg(`<path d="${wavy}"/>`));
    expect(simplified.points).toBeLessThanOrEqual(LOGO_MAX_POINTS);
    const dots = Array.from({ length: LOGO_MAX_RINGS + 1 }, (_, i) => `<circle cx="${(i % 40) * 10}" cy="${Math.floor(i / 40) * 10}" r="3"/>`).join('');
    expect(() => svgToLogo(svg(dots))).toThrow(SvgError);
  });

  it('reads the Inkscape layout: metadata, named views and namespaced attributes are skipped', () => {
    const inkscape = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:svg="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="210mm" height="297mm" viewBox="0 0 744 1052">
  <defs id="defs1" /><sodipodi:namedview id="base" pagecolor="#ffffff" inkscape:zoom="1.4" />
  <metadata><rdf:RDF><dc:title></dc:title></rdf:RDF></metadata>
  <g inkscape:label="Layer 1" inkscape:groupmode="layer" transform="matrix(0.95,0,0,1,269,-45)" style="display:inline;fill:#000000;fill-opacity:1">
    <path inkscape:connector-curvature="0" d="m 107,569 c 1.6,-8.7 1.8,-20.7 -8.2,-20.4 -4.1,0.1 -6.6,3.4 -6.6,6.6 z" />
  </g>
</svg>`;
    expect(rings(inkscape)).toHaveLength(1);
  });
});

describe('the logo string', () => {
  it('round-trips and writes OpenSCAD numbers', () => {
    const logo: LogoRings = [[[0, 0], [2000, 0], [1000, 1500]], [[800, 200], [1200, 200], [1000, 500]]];
    expect(encodeLogo(logo)).toBe('M0 0L2000 0L1000 1500ZM800 200L1200 200L1000 500Z');
    expect(decodeLogo(encodeLogo(logo))).toEqual(logo);
    expect(logoScad(encodeLogo(logo))).toBe('[[[0,0],[2000,0],[1000,1500]],[[800,200],[1200,200],[1000,500]]]');
    expect(decodeLogo('')).toEqual([]);
  });

  it('accepts only exactly what encodeLogo writes', () => {
    for (const logo of ['M0 0L1 0Z', 'M0 0L1 0L1 1', 'M0 0L1 0L1 1Z;', ' M0 0L1 0L1 1Z', 'M0 0L1 0L1 1Z ', 'M0,0L1 0L1 1Z', 'M0 0L1 0L1 1ZZ', 'M01 0L1 0L1 1Z', 'M0 0L2001 0L1 1Z', 'M0 0L99999 0L1 1Z', 'M0 0L-1 0L1 1Z', 'm0 0l1 0l1 1z', 'M0 0L1 0L1 1Z\n', 'M0 0L1.5 0L1 1Z'])
      expect(() => decodeLogo(logo), JSON.stringify(logo)).toThrow(SvgError);
    expect(() => decodeLogo('M0 0L1 0L1 1Z'.repeat(LOGO_MAX_RINGS + 1))).toThrow(/outlines/);
  });
});
