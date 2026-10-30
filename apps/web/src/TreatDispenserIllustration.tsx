import { useId } from 'react';
import { DEFAULT_TREAT_DISPENSER, dimensionOf, findPart, posePoint, TREAT_DISPENSER as T, treatBayLayout, treatDispenserLayout, treatFlapPieces, treatFootprint } from '@canfactory/contracts';

type Point = [number, number, number];
type Point2 = [number, number];
const DEG = Math.PI / 180;
/** The generator's STEEP: the outer body's roof slopes and hip. */
const STEEP = Math.tan(50 * DEG);

const P = DEFAULT_TREAT_DISPENSER, L = treatDispenserLayout(P), BAY = treatBayLayout(P);
const [BASE_X0, BASE_X1, BASE_Y0, BASE_Y1] = treatFootprint(P);
const H = L.halfWidth, F = L.front, B = L.back, GH = L.gableHalf, LIP = L.lipZ, Z0 = T.base;
/** The outer body's roof (generator.scad `gable`, `hip`): its front and back eaves, and the right side's hip from just beyond the boss. */
const FRONT_EAVE = LIP - (-GH - F) * STEEP, BACK_EAVE = LIP - (B - GH) * STEEP;
const HIP_X = GH + 2.75, HIP_EAVE = LIP - (H - HIP_X) * STEEP, HIP_FRONT = HIP_X + (LIP - FRONT_EAVE) / STEEP, HIP_BACK = GH + (H - HIP_X);
/** The chute's way out of the front wall, its top pointed. */
const WAY_TOP = L.chuteAt(F) + T.chuteSide, WAY_PEAK = WAY_TOP + (L.chuteOut + 0.5) * STEEP;
/** An inverted 0.5 l PET bottle (r, z): its support ring and neck from the thread's drawing, its body `bottleDiameter` wide and as tall
 * as 0.5 l of it (as `treatFootprint` takes it), its shoulder and base rounded off. */
const BOTTLE_R = P.bottleDiameter / 2, BOTTLE_BODY = 500 / (Math.PI * (BOTTLE_R / 10) ** 2) * 10;
const SHOULDER = L.bossTop + 6 + (BOTTLE_R - L.neck.T / 2) * 1.2;
const BOTTLE: Point2[] = [
  [L.neck.ring / 2, L.bossTop], [L.neck.ring / 2, L.bossTop + 1.5], [L.neck.T / 2, L.bossTop + 1.5], [L.neck.T / 2, L.bossTop + 6],
  [BOTTLE_R * 0.8, SHOULDER - 8], [BOTTLE_R, SHOULDER], [BOTTLE_R, SHOULDER + BOTTLE_BODY], [BOTTLE_R - 7, SHOULDER + BOTTLE_BODY + 6],
];
const FILL_TOP = SHOULDER + BOTTLE_BODY * 0.4;
/** The ULN2003 board's corners (y, z) as it stands off the right leg, and the motor's ears (Kiatronics: 35 apart through the can's axis). */
const DRIVER = findPart('uln2003-stepper-driver-board');
const BOARD = DRIVER ? [posePoint(BAY.driverPose, [0, 0, 0]), posePoint(BAY.driverPose, [dimensionOf(DRIVER, 'L'), dimensionOf(DRIVER, 'W'), 0])] : [];
/** The ESP32-C3 SuperMini case upright in the back wall (its lid flush with the outside), 7.56 deep and 25.8 long. */
const CASE = { y0: B + 0.5 - 7.56, y1: B + 0.5, z0: BAY.caseFrame.position[2] - 12.9, z1: BAY.caseFrame.position[2] + 12.9 };

const pts = (points: Point2[]) => points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
/** A treat seen side on: `length` × `thick`, centred at (u, v) in a view's frame, turned by `angle` (degrees, counter-clockwise). */
const treat = (u: number, v: number, angle: number, length: number, thick: number): Point2[] => {
  const c = Math.cos(angle * DEG), s = Math.sin(angle * DEG);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a = 0, b = 0]): Point2 => [u + a * length / 2 * c - b * thick / 2 * s, v + a * length / 2 * s + b * thick / 2 * c]);
};

/** Dimension-derived schematic. The editor's STL viewer and its physics show the real parts. */
export function TreatDispenserIllustration() {
  const id = useId();

  /** Assembled, seen from the front right and above (the chute towards the viewer's lower left, the motor's side to the right). */
  const assembled = (cx: number, ground: number, scale: number) => {
    const project = ([x, y, z]: Point): Point2 => [cx + (x + 0.5 * y) * scale, ground - (z + 0.3 * y) * scale];
    const polygon = (points: Point[]) => pts(points.map(project));
    // a surface of revolution about Z: its outline is each ring's two points furthest to the sides (a0 from the projection), its top ring's far half
    const a0 = Math.atan2(0.5, 1), ring = (r: number, z: number, from: number, to: number, n = 18) =>
      Array.from({ length: n + 1 }, (_, i): Point => { const a = from + (to - from) * i / n; return [r * Math.cos(a), r * Math.sin(a), z]; });
    const revolve = (profile: Point2[]) => {
      const [rTop = 0, zTop = 0] = profile.at(-1) ?? [], [rBottom = 0, zBottom = 0] = profile[0] ?? [];
      return polygon([
        ...profile.map(([r, z]): Point => [r * Math.cos(a0), r * Math.sin(a0), z]), ...ring(rTop, zTop, a0, a0 + Math.PI),
        ...[...profile].reverse().map(([r, z]): Point => [-r * Math.cos(a0), -r * Math.sin(a0), z]), ...ring(rBottom, zBottom, a0 + Math.PI, a0 + 2 * Math.PI),
      ]);
    };
    const cap = (r: number, z: number) => polygon(ring(r, z, 0, 2 * Math.PI, 36));
    const bottle = revolve(BOTTLE);
    const { chuteIn: ci, chuteOut: co, chuteAt } = L, end = T.chuteEnd;
    const [bottleX0] = project([-BOTTLE_R, 0, 0]), [bottleX1] = project([BOTTLE_R, 0, 0]);
    return <g data-view="assembled" stroke="#35575d" strokeWidth=".55" strokeLinejoin="round">
      <ellipse cx={project([0, 8, 0])[0]} cy={project([0, 8, 0])[1] + 3} rx={64 * scale * 1.15} ry={9} fill="#dce5df" stroke="none" />
      {/* the base plate */}
      <polygon points={polygon([[BASE_X1, BASE_Y0, 0], [BASE_X1, BASE_Y1, 0], [BASE_X1, BASE_Y1, Z0], [BASE_X1, BASE_Y0, Z0]])} fill="#a99f86" />
      <polygon points={polygon([[BASE_X0, BASE_Y0, 0], [BASE_X1, BASE_Y0, 0], [BASE_X1, BASE_Y0, Z0], [BASE_X0, BASE_Y0, Z0]])} fill="#bdb398" />
      <polygon points={polygon([[BASE_X0, BASE_Y0, Z0], [BASE_X1, BASE_Y0, Z0], [BASE_X1, BASE_Y1, Z0], [BASE_X0, BASE_Y1, Z0]])} fill="#d6ceb5" />
      {/* the outer body: its right side, front, front roof slope, hip and flat top */}
      <polygon points={polygon([[H, F, Z0], [H, B, Z0], [H, B, BACK_EAVE], [H, HIP_BACK, HIP_EAVE], [H, F, HIP_EAVE]])} fill="#5f8a84" />
      <polygon points={polygon([[-H, F, Z0], [H, F, Z0], [H, F, HIP_EAVE], [HIP_FRONT, F, FRONT_EAVE], [-H, F, FRONT_EAVE]])} fill="#7ea59d" />
      <polygon points={polygon([[-H, F, FRONT_EAVE], [HIP_FRONT, F, FRONT_EAVE], [HIP_X, -GH, LIP], [-H, -GH, LIP]])} fill="#9dbfb6" />
      <polygon points={polygon([[HIP_X, -GH, LIP], [HIP_FRONT, F, FRONT_EAVE], [H, F, HIP_EAVE], [H, HIP_BACK, HIP_EAVE], [HIP_X, GH, LIP]])} fill="#86aba3" />
      <polygon points={polygon([[-H, -GH, LIP], [HIP_X, -GH, LIP], [HIP_X, GH, LIP], [-H, GH, LIP]])} fill="#b5d0c7" />
      {/* the chute's way out of the front and the chute in it, its end standing out past the front */}
      <polygon points={polygon([[-co - 0.5, F, Z0], [co + 0.5, F, Z0], [co + 0.5, F, WAY_TOP], [0, F, WAY_PEAK], [-co - 0.5, F, WAY_TOP]])} fill="#2f4a4d" />
      <polygon points={polygon([[-ci, end, chuteAt(end)], [ci, end, chuteAt(end)], [ci, F + 4, chuteAt(F + 4)], [-ci, F + 4, chuteAt(F + 4)]])} fill="#d9b874" />
      <polygon points={polygon([[co, end, chuteAt(end) - T.chuteFloor], [co, F, chuteAt(F) - T.chuteFloor], [co, F, chuteAt(F) + T.chuteSide], [co, end, chuteAt(end) + T.chuteSide]])} fill="#b08f52" />
      <polygon points={polygon([
        [-co, end, chuteAt(end) - T.chuteFloor], [co, end, chuteAt(end) - T.chuteFloor], [co, end, chuteAt(end) + T.chuteSide], [ci, end, chuteAt(end) + T.chuteSide],
        [ci, end, chuteAt(end)], [-ci, end, chuteAt(end)], [-ci, end, chuteAt(end) + T.chuteSide], [-co, end, chuteAt(end) + T.chuteSide],
      ])} fill="#c9a764" />
      <polygon points={pts(treat(...project([-1, end + 4, chuteAt(end + 4) + P.treatThickness / 2]), -12, P.treatLength * scale, P.treatThickness * scale * 1.6))} fill="#9a6a3c" stroke="#6e4825" />
      {/* the thread's boss through the top, and the bottle screwed into it, treats down in its neck */}
      <polygon points={revolve([[L.bossR, LIP], [L.bossR, L.bossTop]])} fill="#e5d9bb" />
      <polygon points={cap(L.bossR, L.bossTop)} fill="#f0e7cf" />
      <defs><clipPath id={`${id}-bottle`}><polygon points={bottle} /></clipPath></defs>
      <polygon points={bottle} fill="#dbeaec" stroke="none" />
      <g clipPath={`url(#${id}-bottle)`} fill="#9a6a3c" stroke="#6e4825" strokeWidth=".4">
        {Array.from({ length: Math.ceil((FILL_TOP - L.bossTop) / 8) }, (_, row) => Array.from({ length: 6 }, (_, i) => {
          const [, v] = project([0, -BOTTLE_R * 0.4, L.bossTop + 3 + row * 8]);
          const x = bottleX0 + (i - 0.5 + (row % 2) * 0.5) * (bottleX1 - bottleX0) / 4.6;
          return <polygon key={`${row}:${i}`} points={pts(treat(x, v + ((i * 3) % 4) * 0.6, ((row * 5 + i * 7) % 9 - 4) * 9, P.treatLength * scale, P.treatThickness * scale * 1.3))} />;
        }))}
      </g>
      <polygon points={bottle} fill="#e8f3f4" fillOpacity=".28" stroke="#5f8f9a" strokeWidth=".6" />
      <polygon points={cap(BOTTLE_R - 7, SHOULDER + BOTTLE_BODY + 6)} fill="#cfe3e7" stroke="#5f8f9a" strokeWidth=".6" />
      <path d={`M${project([BOTTLE_R * 0.55, -BOTTLE_R * 0.75, SHOULDER + 10]).join(' ')}V${project([0, 0, SHOULDER + BOTTLE_BODY - 12])[1].toFixed(2)}`} stroke="#fdfefe" strokeWidth="1.6" strokeLinecap="round" opacity=".75" />
      <text x={cx + 4} y={ground + 13} textAnchor="middle" stroke="none" fill="#52665b" fontSize="7" letterSpacing="1">ASSEMBLED</text>
    </g>;
  };

  /** Cut through the rotor's middle (x = 0), seen from the motor's side: the front to the left. The motor and the ULN2003 board stand in
   * the cut-away half, dashed. */
  const section = (cx: number, ground: number, scale: number) => {
    const at = (y: number, z: number): Point2 => [cx + y * scale, ground - z * scale];
    const poly = (points: Point2[]) => pts(points.map(([y, z]) => at(y, z)));
    const rect = (y0: number, y1: number, z0: number, z1: number) => poly([[y0, z0], [y1, z0], [y1, z1], [y0, z1]]);
    const { slot, bore, block, axisZ, blockTop, blockBack, blockSlope, lipR, threadR, bossR, bossTop, drop, cavityR, flap, chuteAt, R, pocket } = L;
    const w = T.wall, s50 = Math.sin(50 * DEG), c50 = Math.cos(50 * DEG);
    const slopeZ = axisZ + (blockSlope - blockBack * s50) / c50, slopeY = (blockSlope - (blockTop - axisZ) * c50) / s50;
    const boss = (bossR - lipR - w) * STEEP;
    // the cavity behind the rotor, from the drop's front edge round to where its arc meets the chute
    const dropTop = axisZ - bore.radius * Math.cos(T.dropFront * DEG);
    const backFoot = axisZ + Math.sqrt(cavityR ** 2 - flap.cavityBack ** 2), roof = Math.asin(flap.cavityBack / cavityR) / DEG;
    let foot = roof;
    while (foot < 180 && axisZ + cavityR * Math.cos(foot * DEG) > chuteAt(cavityR * Math.sin(foot * DEG))) foot += 1;
    const arc = Array.from({ length: 13 }, (_, i): Point2 => { const a = (roof + (foot - roof) * i / 12) * DEG; return [cavityR * Math.sin(a), axisZ + cavityR * Math.cos(a)]; });
    const footY = arc.at(-1)?.[0] ?? blockBack;
    // the chute's way under the block: up to the chute's walls and a peak over them, flat under the bore
    const way = Array.from({ length: 21 }, (_, i): Point2 => { const y = -block.halfY + (blockBack + block.halfY) * i / 20; return [y, Math.min(chuteAt(y) + T.chuteSide + 0.3 + L.legIn * STEEP, axisZ - bore.radius - 0.8)]; });
    // the rotor's pocket, drawn mouth up and turned by `pocket.turn` towards the back (as generator.scad draws it)
    const turn = (q: Point2[]): Point2[] => q.map(([y, z]): Point2 => {
      const a = -pocket.turn * DEG;
      return [y * Math.cos(a) - z * Math.sin(a), axisZ + y * Math.sin(a) + z * Math.cos(a)];
    });
    const pw = pocket.width / 2, ramp = Math.tan(T.pocketRamp * DEG);
    const mouth = turn([[pw, pocket.floor], [pw, R + 1], [-pw - (R + 1 - pocket.floor) * ramp, R + 1], [-pw, pocket.floor]]);
    const inPocket = turn(treat(-0.3, pocket.floor + P.treatThickness / 2 + 0.2, 0, P.treatWidth, P.treatThickness));
    const flapPieces = treatFlapPieces(L).map(piece => Array.from({ length: piece.length / 6 }, (_, i): Point2 => [piece[3 * i + 1] ?? 0, piece[3 * i + 2] ?? 0]));
    const [hx, hy] = at(flap.hinge.y, flap.hinge.z);
    const [mx, my] = at(L.canY, axisZ);
    const end = T.chuteEnd, back = L.chuteBack;
    const VOID = '#faf9f3';
    return <g data-view="section" stroke="#35575d" strokeWidth=".55" strokeLinejoin="round">
      {/* the outer body's inside, its shell (the chute's way through the front, the boss through the top), the base plate */}
      <polygon points={poly([[F, Z0], [B, Z0], [B, BACK_EAVE], [GH, LIP], [-GH, LIP], [F, FRONT_EAVE]])} fill={VOID} stroke="none" />
      <polyline points={poly([[F + 0.8, WAY_PEAK], [F + 0.8, FRONT_EAVE], [-GH, LIP - 0.8], [-bossR - 1, LIP - 0.8]])} fill="none" stroke="#6f968f" strokeWidth={T.shell * scale} />
      <polyline points={poly([[bossR + 1, LIP - 0.8], [GH, LIP - 0.8], [B - 0.8, BACK_EAVE], [B - 0.8, Z0]])} fill="none" stroke="#6f968f" strokeWidth={T.shell * scale} />
      <polygon points={rect(BASE_Y0, BASE_Y1, 0, Z0)} fill="#d6ceb5" />
      {/* the ESP32-C3 SuperMini's case in the back wall, the USB cable under it */}
      <polygon points={rect(CASE.y0, CASE.y1, CASE.z0, CASE.z1)} fill="#497c85" />
      <polygon points={rect(CASE.y1 - 1, CASE.y1, CASE.z0 + 1.6, CASE.z1 - 0.4)} fill="#e5d9bb" />
      {/* the inner body: the rotor's block, the funnel's walls, the thread's boss */}
      <g fill="#e1d1a8">
        <polygon points={poly([[-block.halfY, Z0], [blockBack, Z0], [blockBack, slopeZ], [slopeY, blockTop], [-block.halfY, blockTop]])} />
        <polygon points={poly([[-slot.halfY - w, blockTop - 1], [slot.halfY + w, blockTop - 1], [lipR + w, LIP - w - boss], [bossR, LIP], [bossR, bossTop], [-bossR, bossTop], [-bossR, LIP], [-lipR - w, LIP - w - boss]])} />
      </g>
      {/* what is hollow in it: the thread, the funnel, the slot and the bore, the drop and the cavity behind it, the chute's way */}
      <g fill={VOID} stroke="none">
        <polygon points={rect(-threadR, threadR, LIP, bossTop + 0.6)} />
        <polygon points={poly([[-lipR, LIP + 0.1], [lipR, LIP + 0.1], [slot.halfY, blockTop], [-slot.halfY, blockTop]])} />
        <polygon points={rect(-slot.halfY, slot.halfY, axisZ, blockTop + 0.1)} />
        <circle cx={at(0, axisZ)[0]} cy={at(0, axisZ)[1]} r={bore.radius * scale} />
        <polygon points={poly([[drop.front, chuteAt(drop.front)], [drop.front, dropTop], [0, axisZ], [slot.halfY, flap.hinge.z], [flap.cavityBack, flap.hinge.z], [flap.cavityBack, backFoot], ...arc, [footY, chuteAt(footY)]])} />
        <polygon points={poly([[-block.halfY - 0.1, Z0 + 0.1], ...way, [blockBack + 0.1, Z0 + 0.1]])} />
      </g>
      {/* the chute: its far wall, its floor and its top end */}
      <polygon points={poly([[end, chuteAt(end)], [back, chuteAt(back)], [back, chuteAt(back) + T.chuteSide], [end, chuteAt(end) + T.chuteSide]])} fill="#e3cb94" fillOpacity=".55" stroke="none" />
      <polygon points={poly([[end, chuteAt(end) - T.chuteFloor], [back, chuteAt(back) - T.chuteFloor], [back, chuteAt(back)], [end, chuteAt(end)]])} fill="#d9b874" />
      <polygon points={rect(back - T.chuteWall, back, chuteAt(back) - T.chuteFloor, chuteAt(back) + T.chuteSide)} fill="#d9b874" />
      {/* the rotor and its pocket, a treat in it */}
      <defs><clipPath id={`${id}-rotor`}><circle cx={at(0, axisZ)[0]} cy={at(0, axisZ)[1]} r={R * scale} /></clipPath></defs>
      <circle cx={at(0, axisZ)[0]} cy={at(0, axisZ)[1]} r={R * scale} fill="#eab56a" />
      <polygon points={poly(mouth)} fill={VOID} clipPath={`url(#${id}-rotor)`} />
      <circle cx={at(0, axisZ)[0]} cy={at(0, axisZ)[1]} r={R * scale} fill="none" />
      {/* the flap on its hinge, resting on the rotor, its counterweight behind */}
      <g fill="#6d9aa6">{flapPieces.map((piece, i) => <polygon key={i} points={poly(piece)} />)}</g>
      <circle cx={hx} cy={hy} r={T.flap.hub * scale} fill="#6d9aa6" />
      <circle cx={hx} cy={hy} r={T.flap.hole * scale} fill="#35575d" stroke="none" />
      {/* treats: in the neck, in the funnel, in the pocket and leaving down the chute */}
      <g fill="#9a6a3c" stroke="#6e4825" strokeWidth=".45">
        {[treat(-2, LIP + 8, 28, P.treatLength, P.treatThickness), treat(3, blockTop + 4, -12, P.treatLength, P.treatThickness), inPocket, treat(end + 9, chuteAt(end + 9) + P.treatThickness / 2 + 0.1, T.chuteSlope, P.treatLength, P.treatThickness)]
          .map((q, i) => <polygon key={i} points={poly(q)} />)}
      </g>
      {/* the bottle's neck and shoulder above the boss */}
      <path d={`M${at(-L.neck.ring / 2, bossTop).join(' ')}V${at(0, bossTop + 6).at(1)?.toFixed(2)}l${(-(BOTTLE_R * 0.8 - L.neck.ring / 2) * 0.4 * scale).toFixed(2)} ${(-(SHOULDER - 14 - bossTop) * 0.4 * scale).toFixed(2)}M${at(L.neck.ring / 2, bossTop).join(' ')}V${at(0, bossTop + 6).at(1)?.toFixed(2)}l${((BOTTLE_R * 0.8 - L.neck.ring / 2) * 0.4 * scale).toFixed(2)} ${(-(SHOULDER - 14 - bossTop) * 0.4 * scale).toFixed(2)}`} fill="none" stroke="#5f8f9a" strokeWidth=".7" />
      {/* in the cut-away half: the 28BYJ-48 on the block's right face, the ULN2003 board below it */}
      <g fill="none" stroke="#35575d" strokeWidth=".6" strokeDasharray="2 1.5">
        <circle cx={mx} cy={my} r={L.canR * scale} />
        <path d={`M${at(L.canY - 3.5, axisZ - L.earSpan / 2).join(' ')}V${at(0, axisZ + L.earSpan / 2)[1].toFixed(2)}H${at(L.canY + 3.5, 0)[0].toFixed(2)}V${at(0, axisZ - L.earSpan / 2)[1].toFixed(2)}Z`} />
        {BOARD.length === 2 && <polygon points={rect(Math.min(BOARD[0]?.[1] ?? 0, BOARD[1]?.[1] ?? 0), Math.max(BOARD[0]?.[1] ?? 0, BOARD[1]?.[1] ?? 0), Math.min(BOARD[0]?.[2] ?? 0, BOARD[1]?.[2] ?? 0), Math.max(BOARD[0]?.[2] ?? 0, BOARD[1]?.[2] ?? 0))} />}
      </g>
      <circle cx={at(0, axisZ)[0]} cy={at(0, axisZ)[1]} r={1.6} fill="#35575d" stroke="none" />
      <text x={at(6, 0)[0]} y={ground + 13} textAnchor="middle" stroke="none" fill="#52665b" fontSize="7" letterSpacing="1">SECTION</text>
    </g>;
  };

  return <svg viewBox="0 0 240 195" role="img" aria-label="Treat dispenser: assembled and section views" className="treat-dispenser-illustration">
    <title>Inverted PET bottle on a body with a motor-driven rotor, a counterweighted flap and a chute out of the front</title>
    {assembled(56, 176, 0.46)}{section(174, 176, 0.98)}
  </svg>;
}
