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
// Claude v1 is a flat-backed inlay: its pillowed top follows the head sphere, so no flat seat
// shows round the symbol. The pocket floor sits below the head surface at the star's tips.
INLAY = CLAUDE && ROUND;
INLAY_H = 3.5 * S;
INLAY_FLOOR = -10.5 * S;
T = ROUND ? (CODEX ? 7 : 3)*S : CODEX ? 26*S : max(8,8*S);
FACE_X = INLAY ? HEAD_X - HEAD_R : ROUND ? -34 * S : (CODEX ? -14 : -24) * S;
FACE_Z = (ROUND ? 61 : 70) * S;
GLYPH_T = 2.8 * S;
GLYPH_Z = T - 0.6 * S;

assert(CLAUDE || CODEX || ANTHROPIC || OPENAI, "Unknown duck version");
assert(BODY_LENGTH >= 70 && BODY_LENGTH <= 120, "Body length must be 70-120 mm");
assert(CLEARANCE >= 0.1 && CLEARANCE <= 0.25, "Clearance must be 0.10-0.25 mm per side");
assert(PART == "body" || PART == "face" || PART == "chevron" || PART == "bar", "Unknown part");

// [face X, face Y, radius]. Unequal peg diameters key the orientation.
FACE_PINS = INLAY ? [[0,-4.5*S,1.5],[0,4.5*S,1.8]] : ANTHROPIC ? [[-10*S,-8*S,1.5],[4*S,-8*S,1.8]] : OPENAI ? [[-9.5*S,2*S,1],[3.5*S,12.5*S,1.15]] : [[-5*S,0,1.5],[5*S,0,1.8]];
BAR_PINS = CODEX ? [[5*S,-7*S,1],[10*S,-7*S,1.15]] : [[14*S,-4*S,1],[14*S,4*S,1.15]];
CHEVRON_PINS = [[-8*S,6*S,1],[-8*S,-4*S,1.15]];
NECK_PINS = [[-5*S,2.2],[5*S,2.6]];

module ellipsoid(p, r) { translate(p) scale(r) sphere(1); }
module stroke(points, r) { for (i=[0:len(points)-2]) hull() { translate(points[i]) circle(r); translate(points[i+1]) circle(r); } }
module rr(w,h,r) { offset(r=r) square([w-2*r,h-2*r],center=true); }

// A gently bevelled extrusion: flat face gives small inserts a stable print surface.
module soft_extrude(h, r) {
    hull() {
        linear_extrude(E) offset(delta=-r) children();
        translate([0,0,r]) linear_extrude(max(E,h-2*r)) children();
        translate([0,0,h-E]) linear_extrude(E) offset(delta=-r) children();
    }
}
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
// Neck peg axes are -Z in the assembled body frame, or -Y in the face frame.
module neck_connections(holes=false) {
    for (p=NECK_PINS) translate([p[0],-22*S,T/2]) rotate([-90,0,0])
        if (holes) socket(p[1],5); else peg(p[1],5);
}

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
                if (ROUND) difference() {
                    // A thick, short neck flows into the round head.
                    hull() {
                        ellipsoid([HEAD_X,0,HEAD_Z],[HEAD_R,HEAD_R,HEAD_R],$fn=96);
                        ellipsoid([HEAD_X+2*S,0,42*S],[14*S,17*S,7*S]);
                    }
                    // Faces other than the inlay sit on a flat seat.
                    if (!INLAY) translate([-100*S,-50*S,0]) cube([100*S+FACE_X,100*S,100*S]);
                } else intersection() {
                    ellipsoid([-27*S,0,38*S],[14*S,15*S,19*S]);
                    translate([-60*S,-30*S,0]) cube([70*S,60*S,48*S]);
                }
            }
            translate([-100*S,-100*S,0]) cube([200*S,200*S,150*S]);
        }
        if (INLAY) face_frame() inlay_pocket();
        else if (ROUND) {
            face_frame() {
                pins(FACE_PINS,4,true);
                if (ANTHROPIC) pins(BAR_PINS,3,true);
            }
        } else face_frame() neck_connections(true);
    }
    if (INLAY) face_frame() translate([0,0,INLAY_FLOOR]) mirror([0,0,1]) pins(FACE_PINS,4);
}

module star() {
    if (INLAY) {
        // Ten thick, tapering rays with rounded tips round a broad hub.
        lengths=[18.8,16.4,18.2,16.8,18.6,16.2,18.4,16.6,18.0,16.5];
        circle(7);
        for (i=[0:9]) let(a=-90+i*36, l=lengths[i]-2.3) hull() {
            translate([4*cos(a),4*sin(a)]) circle(3.2);
            translate([l*cos(a),l*sin(a)]) circle(2.3);
        }
    } else {
        lengths=[18,15.8,17.8,16.2,18.1,15.7,17.3,16.1,18,16.3,17.6,16];
        circle(7);
        for (i=[0:11]) let(a=-90+i*30, l=lengths[i]-2.4)
            stroke([[0,0],[l*cos(a),l*sin(a)]],2.4);
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
module knot() {
    scale([1/2000,1/2000]) translate([-1000,-1000])
        difference() {
            polygon(OPENAI_RINGS[0]);
            for (i=[1:len(OPENAI_RINGS)-1]) polygon(OPENAI_RINGS[i]);
        }
}
module face_outline() {
    intersection() {
    if (!ROUND) translate([-100*S,-22*S]) square([200*S,150*S]);
    scale([S,S]) {
        // The mounting foot is united in 2D before beveling, avoiding coincident layer faces.
        if (!ROUND && !CODEX) translate([0,-18]) rr(18,8,0.7);
        if (CLAUDE) scale(ROUND ? 1 : 1.28) star();
        if (CODEX) rr(ROUND ? 36 : 42,ROUND ? 34 : 44,ROUND ? 6 : 7);
        if (ANTHROPIC) {
            if (ROUND) letter_a();
            else union() {
                scale([1.27,1.3]) letter_a();
                translate([18,0]) rr(7,44,1.2);
                translate([0,-18]) rr(43,8,1.2);
            }
        }
        if (OPENAI) offset(r=0.4) scale(ROUND ? 36 : 46) knot();
    }
    }
}
module chevron_outline() { scale([S,S]) stroke([[-10,8],[-1,1],[-10,-6]],2.5); }
module bar_outline() {
    scale([S,S]) if (CODEX) translate([7.5,-7]) rr(13,4.4,1.4);
        else translate([14,0]) rr(4.8,30,0.7);
}
module glyph_shape(which) { if (which == "chevron") chevron_outline(); else bar_outline(); }

// Face frame, with the head sphere centred at Z = -HEAD_R. The inlay's top is the head
// surface raised by INLAY_H, its edges rounded by stacking insets under smaller spheres.
module inlay() {
    re = 1.6*S;
    difference() {
        union() for (i=[0:6]) let(a=i*15) intersection() {
            translate([0,0,INLAY_FLOOR]) linear_extrude(INLAY_H-INLAY_FLOOR+E) offset(delta=-re*(1-cos(a))) face_outline();
            translate([0,0,-HEAD_R]) sphere(HEAD_R+INLAY_H-re+re*sin(a),$fn=128);
        }
        translate([0,0,INLAY_FLOOR]) mirror([0,0,1]) pins(FACE_PINS,4,true);
    }
}
module inlay_pocket() {
    translate([0,0,INLAY_FLOOR]) linear_extrude(-INLAY_FLOOR+INLAY_H+2*S) offset(delta=CLEARANCE) face_outline();
}

module face() {
    difference() {
        union() {
            if (CODEX) soft_extrude(T,(ROUND ? 1.2 : 3)*S) face_outline();
            else relief(T,0.45*S) face_outline();
            if (!ROUND) {
                // The foot in the outline joins both neck pegs without closing the central openings.
                neck_connections();
            } else pins(FACE_PINS,4);
        }
        if (CODEX) translate([0,0,GLYPH_Z]) {
            // A shallow outline recess locates each white insert, with generous lateral play.
            linear_extrude(2*S) offset(delta=CLEARANCE) { chevron_outline(); bar_outline(); }
            pins(CHEVRON_PINS,3,true);
            pins(BAR_PINS,3,true);
        }
    }
}
module glyph(which) {
    h = CODEX ? GLYPH_T : T;
    union() {
        relief(h,0.3*S) glyph_shape(which);
        pins(which == "chevron" ? CHEVRON_PINS : BAR_PINS,3);
    }
}

if (PART == "body") body();
else if (PART == "face") {
    // The inlay prints on its flat back; the others print face down.
    if (INLAY) translate([0,0,-INLAY_FLOOR]) inlay();
    else translate([0,0,T]) rotate([180,0,0]) face();
}
else {
    assert(CODEX || (ANTHROPIC && ROUND && PART == "bar"), "This version has no such insert");
    translate([0,0,CODEX ? GLYPH_T : T]) rotate([180,0,0]) glyph(PART);
}
