// AI rubber ducks: original CanFactory geometry, CC BY 4.0. See ATTRIBUTION.md.
// Self-contained: PART selects one physical piece. All exports sit on the print bed.
// Body frame: breast toward -X, wings along Y, Z up. Body length includes the tail.
// Face frame: X across the face, Y up, Z out. All positions below are nominal mm at
// BODY_LENGTH=90; appearance scales with S, but pegs, clearance and ribs do not.
VARIANT = "claude-v1-round";
BODY_LENGTH = 90;
CLEARANCE = 0.2;
PART = "body";
// Diagnostic only: remove ribs when proving that all other mating surfaces clear.
RIBS = true;

$fn = 64;
E = 0.02;
S = BODY_LENGTH / 90;
ROUND = VARIANT == "claude-v1-round" || VARIANT == "codex-v1-round" || VARIANT == "anthropic-v1-round" || VARIANT == "openai-v1-round";
CLAUDE = VARIANT == "claude-v1-round" || VARIANT == "claude-v2-sculpted";
CODEX = VARIANT == "codex-v1-round" || VARIANT == "codex-v2-sculpted";
ANTHROPIC = VARIANT == "anthropic-v1-round" || VARIANT == "anthropic-v2-sculpted";
OPENAI = VARIANT == "openai-v1-round" || VARIANT == "openai-v2-sculpted";
// Round heads (proportions read off the concept sheets, see docs/concepts/ai-rubber-ducks/):
// a 24 mm sphere whose top is 85 mm up, centred 26 mm behind the breast.
HEAD_X = -19 * S;
HEAD_Z = 61 * S;
HEAD_R = 24 * S;
// Round faces are flat-backed inlays whose pillowed top follows the head sphere, so no flat
// seat shows round the symbol: [pocket floor, height above the head, edge radius]. Each floor
// sits about 1.2 mm below the head surface at the symbol's widest point.
INLAY = CLAUDE ? [-10.5,3.5,1.6] : CODEX ? [-11.6,1.5,1.2] : ANTHROPIC ? [-10.4,3.5,0.9] : [-11.2,3,1.2];
INLAY_FLOOR = INLAY[0] * S;
INLAY_H = INLAY[1] * S;
INLAY_RE = INLAY[2] * S;
// Codex v1's white glyphs inlay the same way into its visor.
GLYPH_FLOOR = -5.8 * S;
GLYPH_H = 3 * S;
GLYPH_RE = 0.7 * S;
// Sculpted heads are the symbol itself, sitting on the shoulders: [back X, centre Z, depth,
// front edge radius, seat below centre, back edge radius]. Sizes follow the concept sheets
// (a 60 mm star, a 42 x 46 mm terminal, 54 mm wide letters, a 62 mm knot); the seat is a flat
// cut sunk into the body.
HEAD2 = CLAUDE ? [-14,62,16,5,-26,3] : CODEX ? [-10,60,34,6,-22,6] : ANTHROPIC ? [-14,58,18,3,-19,2.5] : [-12,63,18,4.5,-27,2];
T = HEAD2[2] * S;
SEAT_Y = HEAD2[4] * S;
FACE_X = ROUND ? HEAD_X - HEAD_R : HEAD2[0] * S;
FACE_Z = ROUND ? HEAD_Z : HEAD2[1] * S;
GLYPH_T = 2.8 * S;
GLYPH_Z = T - 0.6 * S;

assert(CLAUDE || CODEX || ANTHROPIC || OPENAI, "Unknown duck version");
assert(BODY_LENGTH >= 70 && BODY_LENGTH <= 120, "Body length must be 70-120 mm");
assert(CLEARANCE >= 0.1 && CLEARANCE <= 0.25, "Clearance must be 0.10-0.25 mm per side");
assert(PART == "body" || PART == "face" || PART == "chevron" || PART == "bar", "Unknown part");

// [face X, face Y, radius] in nominal mm. Unequal peg diameters key the orientation.
function scaled(points) = [for (p=points) [p[0]*S,p[1]*S,p[2]]];
FACE_PINS = scaled(CLAUDE ? [[0,-4.5,1.5],[0,4.5,1.8]] : CODEX ? [[-13,-11,1.5],[9,7,1.8]]
    : ANTHROPIC ? [[-9.7,-6.4,1.5],[2.9,-6.4,1.8]] : [[-10.7,10.2,1],[10.7,-11.2,1.15]]);
BAR_PINS = scaled(CODEX ? [[5,-7,1],[10,-7,1.15]] : [[12,-3.2,1],[12,3.2,1.15]]);
CHEVRON_PINS = scaled([[-8,6,1],[-8,-4,1.15]]);
// Sculpted heads: [face X, depth from the back, radius] on the seat, inside the symbol's
// lowest stroke that rests on the body (Claude's downward ray, the A's right leg, the knot's
// bottom strand; the outer A leg and the I overhang the shoulders, as on the concept).
SEAT_PINS = CLAUDE ? [[0,3.5,1.2],[0,10,1.5]] : CODEX ? [[-8,17,2.2],[8,17,2.6]]
    : ANTHROPIC ? [[6.4,5,1.8],[6.4,13,2.2]] : [[-5.2,6,1],[-5.2,12,1.15]];

module ellipsoid(p, r) { translate(p) scale(r) sphere(1); }
module stroke(points, r) { for (i=[0:len(points)-2]) hull() { translate(points[i]) circle(r); translate(points[i+1]) circle(r); } }
module rr(w,h,r) { offset(r=r) square([w-2*r,h-2*r],center=true); }

// Unlike hull(), this stepped bevel preserves holes and the concave logo outlines.
module relief(h, r) {
    for (i=[0:5]) let(z=i*r/5, d=r*(1-sqrt(max(0,1-pow(1-i/5,2))))) {
        translate([0,0,z]) linear_extrude(max(E,h-2*z)) offset(delta=-d) children();
    }
}

// Male pegs point backwards, into the socket (-Z). Core-to-socket gap is CLEARANCE.
// Only the 0.30 mm crush ribs intentionally interfere (0.05-0.20 mm radially).
module peg(r,h) {
    translate([0,0,-h]) cylinder(h=0.6,r1=r-0.4,r2=r);
    translate([0,0,-h+0.6-E]) cylinder(h=h-0.6+2*E,r=r);
    if (RIBS) for (a=[0,120,240]) rotate([0,0,a]) rotate([90,0,0])
        linear_extrude(0.4,center=true) polygon([[r-0.15,-h+0.5],[r+0.30,-h+1],[r+0.30,-1.2],[r-0.15,-0.7]]);
}
// Socket opens at Z=0 and extends backwards; extra depth stops the shoulder, not the tip.
module socket(r,h) {
    translate([0,0,-h-0.5]) cylinder(h=h+0.5+E,r=r+CLEARANCE);
    translate([0,0,-0.5]) cylinder(h=0.5+E,r1=r+CLEARANCE,r2=r+CLEARANCE+0.45);
}
module pins(points,h,holes=false) { for (p=points) translate([p[0],p[1],0]) if (holes) socket(p[2],h); else peg(p[2],h); }
module face_frame() { translate([FACE_X,0,FACE_Z]) rotate([90,0,-90]) children(); }
// Torso surface half-width at nominal (x, z): wing pieces sit on it rather than float.
function torso_y(x,z) = 33*sqrt(max(0,1-pow(x/45,2)-pow((z-20)/26,2)));
// An ellipsoid of nominal radii r standing `proud` mm off the torso surface at nominal (x, z).
module on_torso(sign,x,z,r,proud) ellipsoid([x*S,sign*(torso_y(x,z)+proud-r[1])*S,z*S],r*S);
// One low-relief wing, as on the concept: a rounded shoulder and three stacked feather bands
// pointing back, the top one longest. Shallow grooves form where the bands round off.
module wing(sign) {
    // [mid x, mid z, tip x, tip z, tip radius]
    for (b=[[6,29.5,22,32,4],[6,22.5,20.5,23.5,3.8],[3,15,15,16,3.4]]) hull() {
        on_torso(sign,-9,20,[13,6,12.5],3.8);
        on_torso(sign,b[0],b[1],[8,6,4.5],3.6);
        on_torso(sign,b[2],b[3],[b[4],5,b[4]],3);
    }
}

// Body proportions were measured from the silhouettes of the LEFT SIDE and FRONT views in
// docs/concepts/ai-rubber-ducks/claude-v1-round.png, scaled so breast to tail is 90 mm:
// 85 mm tall, back 42-46 mm and tail tip 50 mm high, belly flat from 10 to 70 mm behind
// the breast, 66 mm wide (82 mm across the wings).
// Breast-to-back body, flattened by the bed into a stable belly.
module torso() ellipsoid([0,0,20*S],[45*S,33*S,26*S]);

module body() {
    difference() {
        intersection() {
            union() {
                torso();
                // The rump rises into a short, upturned tail. Hulling it with the rear of the
                // body keeps one smooth surface instead of a separate bulb.
                hull() {
                    intersection() { torso(); translate([28*S,-50*S,0]) cube([50*S,100*S,100*S]); }
                    ellipsoid([39*S,0,46*S],[6*S,9*S,5*S]);
                }
                for (sign=[-1,1]) wing(sign);
                // A thick, short neck flows into the round head.
                if (ROUND) hull() {
                    ellipsoid([HEAD_X,0,HEAD_Z],[HEAD_R,HEAD_R,HEAD_R],$fn=96);
                    ellipsoid([HEAD_X+2*S,0,42*S],[14*S,17*S,7*S]);
                }
            }
            translate([-100*S,-100*S,0]) cube([200*S,200*S,150*S]);
        }
        face_frame() if (ROUND) {
            pocket(INLAY_FLOOR,INLAY_H) face_outline();
            if (ANTHROPIC) pocket(INLAY_FLOOR,INLAY_H) bar_outline();
        } else seat_cavity();
    }
    face_frame() if (ROUND) {
        floor_pins(INLAY_FLOOR,FACE_PINS,4);
        if (ANTHROPIC) floor_pins(INLAY_FLOOR,BAR_PINS,3);
    } else seat_pins();
}

// Ten thick, tapering rays with rounded tips round a broad hub; the sculpted head's are fatter.
module star() {
    lengths=[18.8,16.4,18.2,16.8,18.6,16.2,18.4,16.6,18.0,16.5];
    root = ROUND ? 3.2 : 4;
    tip = ROUND ? 2.3 : 3;
    circle(7);
    for (i=[0:9]) let(a=-90+i*36, l=lengths[i]-tip) hull() {
        translate([4*cos(a),4*sin(a)]) circle(root);
        translate([l*cos(a),l*sin(a)]) circle(tip);
    }
}
module letter_a() {
    difference() {
        polygon([[-17,-15],[-6,15],[0,15],[11,-15],[4,-15],[1,-7],[-7,-7],[-10,-15]]);
        polygon([[-3,6],[-6,-1],[0,-1]]);
    }
}
// OpenAI outline sampled from Simple Icons 13.0.0, normalized to a 2000-unit square.
// Original SVG, source URL and conversion instructions are preserved in reference/.
OPENAI_RINGS = [[[1102,1],[1162,4],[1221,15],[1277,33],[1304,44],[1355,71],[1403,104],[1426,122],[1467,163],[1486,185],[1520,233],[1548,285],[1560,313],[1570,342],[1627,357],[1655,367],[1682,379],[1733,408],[1781,442],[1803,461],[1843,504],[1878,551],[1908,603],[1921,630],[1932,658],[1948,715],[1957,772],[1959,830],[1958,859],[1950,916],[1936,972],[1915,1026],[1902,1053],[1871,1103],[1853,1127],[1833,1150],[1849,1207],[1854,1236],[1858,1295],[1856,1353],[1846,1411],[1839,1440],[1819,1495],[1792,1548],[1759,1598],[1720,1643],[1699,1664],[1654,1701],[1605,1732],[1553,1757],[1498,1776],[1470,1783],[1412,1792],[1383,1794],[1353,1794],[1294,1788],[1264,1783],[1243,1805],[1197,1845],[1172,1863],[1120,1893],[1093,1906],[1037,1926],[1008,1934],[918,1946],[858,1944],[827,1941],[767,1928],[709,1908],[682,1896],[629,1866],[581,1830],[538,1789],[518,1766],[483,1717],[454,1664],[431,1607],[402,1600],[346,1581],[293,1556],[268,1541],[221,1507],[178,1467],[158,1445],[123,1397],[107,1372],[80,1318],[60,1262],[47,1205],[41,1147],[42,1089],[45,1060],[56,1003],[64,975],[86,921],[113,869],[148,820],[167,797],[152,739],[144,681],[143,622],[149,564],[162,507],[171,479],[195,425],[225,373],[242,348],[280,303],[301,283],[347,246],[371,229],[421,201],[475,179],[531,164],[560,158],[618,153],[648,153],[707,158],[737,164],[757,142],[802,103],[850,70],[902,43],[957,22],[985,14],[1043,4]],[[701,903],[535,1000],[534,1454],[538,1506],[542,1531],[557,1581],[578,1627],[591,1649],[621,1690],[657,1726],[677,1743],[698,1758],[744,1783],[768,1794],[818,1809],[843,1814],[894,1818],[945,1815],[995,1805],[1043,1788],[1067,1777],[1111,1750],[1132,1734],[725,1498],[712,1484],[704,1467],[701,1448]],[[790,1198],[792,1392],[1184,1618],[1231,1641],[1280,1656],[1331,1665],[1382,1666],[1432,1660],[1457,1655],[1506,1638],[1530,1628],[1575,1601],[1596,1585],[1634,1549],[1666,1509],[1680,1488],[1702,1442],[1719,1394],[1728,1344],[1730,1292],[1729,1266],[1725,1238],[1327,1471],[1309,1478],[1290,1479],[1272,1475],[1263,1471]],[[742,584],[351,810],[308,839],[271,873],[254,891],[225,931],[202,974],[192,997],[178,1043],[170,1091],[169,1140],[174,1189],[186,1238],[205,1285],[231,1328],[262,1368],[299,1403],[340,1433],[385,1456],[409,1466],[410,996],[415,978],[433,956],[912,679],[748,584]],[[1595,479],[1594,949],[1588,967],[1577,982],[1562,993],[1090,1268],[1256,1363],[1650,1136],[1694,1107],[1732,1072],[1749,1053],[1778,1012],[1791,990],[1802,967],[1819,919],[1825,894],[1832,843],[1831,790],[1828,764],[1816,714],[1808,689],[1786,643],[1773,621],[1742,581],[1725,562],[1686,529],[1665,514],[1620,489]],[[790,852],[790,1095],[1001,1217],[1212,1095],[1212,852],[1001,730]],[[1102,128],[1052,132],[1002,142],[955,159],[932,170],[889,197],[869,212],[1276,448],[1289,462],[1297,479],[1300,498],[1300,1044],[1463,949],[1467,945],[1466,466],[1458,416],[1444,368],[1425,323],[1399,281],[1368,244],[1333,211],[1293,182],[1250,159],[1203,142],[1179,136],[1128,129]],[[625,280],[576,285],[529,296],[483,313],[461,324],[420,350],[382,382],[348,420],[319,462],[297,508],[281,556],[273,606],[271,656],[272,681],[276,707],[675,476],[693,469],[711,468],[721,469],[738,476],[1212,749],[1211,557],[817,329],[771,306],[723,291],[674,282]]];
module knot(filled=false) {
    scale([1/2000,1/2000]) translate([-1000,-1000])
        difference() {
            polygon(OPENAI_RINGS[0]);
            if (!filled) for (i=[1:len(OPENAI_RINGS)-1]) polygon(OPENAI_RINGS[i]);
        }
}
module face_outline(filled=false) scale([S,S]) {
    if (CLAUDE) scale(ROUND ? 1 : 1.6) star();
    if (CODEX) rr(ROUND ? 36 : 42,ROUND ? 30 : 46,9);
    // Anthropic v1's I is a separate piece (bar_outline); v2's head joins both letters.
    if (ANTHROPIC) {
        if (ROUND) scale(0.8) translate([-1.25,0]) letter_a();
        else translate([-3.35,0]) {
            scale(1.4) letter_a();
            translate([26,0]) rr(9,42,1.2);
            // A low link along the baseline keeps the I, which overhangs the shoulder, in one piece.
            translate([18.35,-17.5]) rr(12,7,1);
        }
    }
    // The sculpted knot's strands are thickened towards the concept's tubes.
    if (OPENAI) offset(r=ROUND ? 0.4 : 0.9) scale(ROUND ? 39 : 62) knot(filled);
}
module chevron_outline() { scale([S,S]) stroke([[-10,8],[-1,1],[-10,-6]],2.5); }
module bar_outline() {
    scale([S,S]) if (CODEX) translate([7.5,-7]) rr(13,5,1.4);
        else scale(0.8) translate([15,0]) rr(6.5,30,0.8);
}
module glyph_shape(which) { if (which == "chevron") chevron_outline(); else bar_outline(); }

// Round faces, in the face frame with the head sphere centred at Z = -HEAD_R: the outline,
// extruded from a flat back at `floor`, under the head surface raised by h. Its edges are
// rounded by stacking insets under smaller spheres.
// Rounded edges are stacked in these steps (degrees round the edge): uneven, so that no step
// is a sliver narrower or lower than about a tenth of the radius.
STEPS = [0,25,45,65,90];
module dome_inlay(floor, h, re) {
    // Only the outermost layer reaches the back; the others start inside it.
    for (a=STEPS) intersection() {
        translate([0,0,a == 0 ? floor : floor/2]) linear_extrude(h-(a == 0 ? floor : floor/2)+E)
            offset(delta=-re*(1-cos(a))) children();
        translate([0,0,-HEAD_R]) sphere(HEAD_R+h-re+re*sin(a),$fn=128);
    }
}
module pocket(floor, h) translate([0,0,floor]) linear_extrude(h-floor+2*S) offset(delta=CLEARANCE) children();
// Pegs stand on a pocket floor and point out of it (+Z); the inlay's sockets open on its back.
module floor_pins(floor, points, h, holes=false) translate([0,0,floor]) mirror([0,0,1]) pins(points,h,holes);

module round_face() {
    difference() {
        dome_inlay(INLAY_FLOOR,INLAY_H,INLAY_RE) face_outline();
        floor_pins(INLAY_FLOOR,FACE_PINS,4,true);
        if (CODEX) pocket(GLYPH_FLOOR,GLYPH_H) { chevron_outline(); bar_outline(); }
    }
    if (CODEX) { floor_pins(GLYPH_FLOOR,CHEVRON_PINS,3); floor_pins(GLYPH_FLOOR,BAR_PINS,3); }
}
module bar_inlay() difference() {
    dome_inlay(INLAY_FLOOR,INLAY_H,INLAY_RE) bar_outline();
    floor_pins(INLAY_FLOOR,BAR_PINS,3,true);
}

// Sculpted heads, in the face frame: back at Z = 0, front at Z = t, the front edges rounded by
// ref and the back ones by reb. The flat middle of the back (or of the Codex front) is the
// print bed. `grow` offsets the whole shape, for the body's cavity.
module pillow(t, ref, reb, grow=0) {
    lo = reb - grow;
    hi = t - ref + grow;
    q = (hi - lo) / 4;
    m = (lo + hi) / 2;
    translate([0,0,lo]) linear_extrude(hi-lo) offset(delta=grow) children();
    // The rounded layers overlap inside the core, so none shares a face with it.
    for (a=STEPS) if (a > 0) {
        translate([0,0,m-q]) linear_extrude(hi-m+q+ref*sin(a)) offset(delta=grow-ref*(1-cos(a))) children();
        translate([0,0,lo-reb*sin(a)]) linear_extrude(m+q-lo+reb*sin(a)) offset(delta=grow-reb*(1-cos(a))) children();
    }
}
module head_shape(grow=0) pillow(T,HEAD2[3]*S,HEAD2[5]*S,grow) children();
module above_seat() intersection() { children(); translate([-100*S,SEAT_Y,-50*S]) cube(200*S); }
// The head drops straight down into its cavity, so the cavity holds every place the head passes
// through on the way: below the top of the body (6 mm above the seat), the outline is swept up,
// making room for strokes that flare out at the foot, like the A's legs. The knot's openings
// are filled, so no island of body stands in the way of the strand that passes through it.
module sweep_up(d, top) {
    children();
    minkowski() {
        intersection() { children(); translate([-100*S,-100*S]) square([200*S,100*S+top]); }
        translate([-E/2,0]) square([E,d]);
    }
}
module seat_cavity() above_seat() head_shape(CLEARANCE) sweep_up(6*S,SEAT_Y+6*S) face_outline(filled=true);

// Seat pegs stand on the cavity floor and point up (+Y in the face frame) into the head.
module seat_pins(holes=false) for (p=SEAT_PINS) translate([p[0]*S,SEAT_Y,p[1]*S]) rotate([90,0,0])
    if (holes) socket(p[2],5); else peg(p[2],5);

module sculpted_head() difference() {
    above_seat() head_shape() face_outline();
    seat_pins(true);
    if (CODEX) translate([0,0,GLYPH_Z]) {
        // A shallow outline recess locates each white insert, with generous lateral play.
        linear_extrude(2*S) offset(delta=CLEARANCE) { chevron_outline(); bar_outline(); }
        pins(CHEVRON_PINS,3,true);
        pins(BAR_PINS,3,true);
    }
}
module glyph(which) {
    points = which == "chevron" ? CHEVRON_PINS : BAR_PINS;
    if (ROUND) difference() {
        dome_inlay(GLYPH_FLOOR,GLYPH_H,GLYPH_RE) glyph_shape(which);
        floor_pins(GLYPH_FLOOR,points,3,true);
    } else union() {
        relief(GLYPH_T,0.3*S) glyph_shape(which);
        pins(points,3);
    }
}

// Inlays and pillow heads print on their flat backs; the Codex terminal head and its
// inserts print face down.
if (PART == "body") body();
else if (PART == "face") {
    if (ROUND) translate([0,0,-INLAY_FLOOR]) round_face();
    else if (CODEX) translate([0,0,T]) rotate([180,0,0]) sculpted_head();
    else sculpted_head();
} else {
    assert(CODEX || (ANTHROPIC && ROUND && PART == "bar"), "This version has no such insert");
    if (CODEX && ROUND) translate([0,0,-GLYPH_FLOOR]) glyph(PART);
    else if (CODEX) translate([0,0,GLYPH_T]) rotate([180,0,0]) glyph(PART);
    else translate([0,0,-INLAY_FLOOR]) bar_inlay();
}
