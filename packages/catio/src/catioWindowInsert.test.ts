import { describe, expect, it } from 'vitest';
import { CATIO_MESH_PARTS, catioMesh, dimensionOf, findPart, modelUsage, partUsage, printedCornerBracket, printedCornerBracketFor, printedScreenHook, validateParameters, WINDOW_INSERT_BRACKETS, WINDOW_INSERT_FOOT, WINDOW_INSERT_MEMBER, windowInsertConcept } from '@canfactory/contracts';
import { DOOR_SEATS, fastenerClashes, HOOK_FIT, INSERT, MODULAR_DEFAULT, PAD_HEIGHT, validateWindowInsert, WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DEFAULT, windowFor, windowFrame, windowInsertBom, windowInsertFacts, windowInsertLayout, windowInsertSteps, type WindowInsertConfig } from './index.ts';

const variants = ['direct', 'modular'] as const;
/** Every value of every control, one at a time, from the defaults. */
/** Pressed into the recess by spreader feet, and hung on the window frame (the default). */
const pressed: WindowInsertConfig = { ...WINDOW_INSERT_DEFAULT, attachment: 'spreader-feet' };
const ganter: WindowInsertConfig = { ...pressed, clampPad: 'ganter' };
const hung: WindowInsertConfig = { ...WINDOW_INSERT_DEFAULT, attachment: 'frame-hooks' };
/** Hung on Windhager 03651's bought hooks, bent to the window, and with GAH Alberts' bought steel corner brackets. */
const bought: WindowInsertConfig = { ...hung, screenHook: 'windhager-03651', cornerBracket: 'gah-alberts-stuhlwinkel-100x100x19' };
/** Brackets that would cover a hung insert's screen hooks (too wide, or the head hooks too near the top with 10 mm of overlap): checked on their own. */
const besideHooks = (config: WindowInsertConfig) => config.attachment !== 'frame-hooks' || config.cornerJoint !== 'corner-bracket' || (!/125x125|150x150/.test(config.cornerBracket) && config.frameOverlap > 10);
const configs: WindowInsertConfig[] = ([WINDOW_INSERT_DEFAULT, pressed, ...[WINDOW_INSERT_DEFAULT, pressed].flatMap(base => WINDOW_INSERT_CONTROLS.flatMap(control => control.options.map(option => ({ ...base, [control.key]: option.value })))),
  // the Ganter feet in every size, and the printed pads at their lowest and highest
  ...WINDOW_INSERT_FOOT.diameters.map(footDiameter => ({ ...ganter, footDiameter })), { ...pressed, padHeight: PAD_HEIGHT.min }, { ...pressed, padHeight: PAD_HEIGHT.max, footDiameter: 25 },
  // hung on the window frame: every overlap, the Ganter feet, three feet, the tallest pads, and thin and thick frame lips
  ...[10, 15, 20, 25].map(frameOverlap => ({ ...hung, frameOverlap }) as WindowInsertConfig), { ...hung, clampPad: 'ganter' }, { ...hung, clampsPerSide: 3 },
  { ...hung, padHeight: PAD_HEIGHT.max }, { ...hung, frameLip: 8, sealGap: 4.5 }, { ...hung, frameLip: 35, frameFace: 90, frameDepth: 120 },
  { ...bought, frameLip: 8, sealGap: 4.5 }, { ...bought, frameLip: 12, sealGap: 2.5 }, { ...bought, clampPad: 'ganter' }, { ...hung, frameLip: 12, sealGap: 3 },
  { ...hung, frameOverlap: 10, cornerJoint: 'half-lap' }] as WindowInsertConfig[]).filter(besideHooks)
  // staples alone hold welded mesh only: a net needs the battens
  .map(config => config.meshFixing === 'staples' ? { ...config, mesh: 'welded' as const } : config);

describe('window insert', () => {
  it('sizes the collar from the printed pads’ height', () => {
    const l = windowInsertLayout('direct', pressed, windowFor('direct', pressed, MODULAR_DEFAULT));
    expect(l.pad).toMatchObject({ height: 24.5, diameter: 32, surface: 'grooved' });
    expect(l.gap).toBe(24.5 + INSERT.travel);
    expect(windowInsertLayout('direct', { ...pressed, padHeight: 30 }, windowFor('direct', { ...pressed, padHeight: 30 }, MODULAR_DEFAULT)).W).toBe(1000 - 2 * (30 + INSERT.travel));
    // a spreader screw passes the thrust pad's lip and lock nut, the travel, the member and its own lock nut; a bearing screw fills the insert nut
    expect(l.pad?.spreaderScrew.id).toBe('iso-4017-m8x80');
    expect(dimensionOf(l.pad?.spreaderScrew ?? l.nut, 'l')).toBeGreaterThanOrEqual(3 + 8 + INSERT.travel + INSERT.member + 6.8);
    expect(l.pad?.bearingScrew.id).toBe('iso-4017-m8x30');
    expect(l.pad?.thrustNut.id).toBe('iso-10511-m8');
    expect(windowInsertLayout('direct', { ...WINDOW_INSERT_DEFAULT, attachment: 'folding-wedges' }, windowFor('direct', { ...WINDOW_INSERT_DEFAULT, attachment: 'folding-wedges' }, MODULAR_DEFAULT)).pad).toBeNull();
    // too low a pad cannot hold its lock nut; too narrow cannot hold it with a wall round it
    expect(validateWindowInsert('direct', { ...WINDOW_INSERT_DEFAULT, padHeight: 17 }, windowFor('direct', { ...WINDOW_INSERT_DEFAULT, padHeight: 17 }, MODULAR_DEFAULT))).toEqual([expect.stringContaining('at least 17.5 mm high')]);
  });

  it('sizes the collar from the recess and the chosen Ganter foot', () => {
    const l = windowInsertLayout('direct', ganter, windowFor('direct', ganter, MODULAR_DEFAULT));
    expect(l.pad).toBeNull();
    const foot = findPart('ganter-gn-343-2-32-m8-63-kr'); if (!foot) throw new Error('foot');
    expect(l.spreaderFoot.id).toBe(foot.id);
    expect(l.bearingFoot.id).toBe('ganter-gn-343-2-32-m8-40-kr');
    expect(l.gap).toBe(dimensionOf(foot, 'l3') + INSERT.travel);
    expect([l.W, l.H]).toEqual([1000 - 2 * l.gap, 1000 - 2 * l.gap]);
    expect(windowInsertLayout('direct', { ...ganter, attachment: 'folding-wedges' }, windowFor('direct', { ...ganter, attachment: 'folding-wedges' }, MODULAR_DEFAULT)).W).toBe(1000 - 2 * INSERT.wedgeGap);
    // the spreader stud passes the member, its travel and two nuts
    const nut = findPart('iso-4032-m8'); if (!nut) throw new Error('nut');
    expect(dimensionOf(l.spreaderFoot, 'l1')).toBeGreaterThanOrEqual(INSERT.member + INSERT.travel + 2 * dimensionOf(nut, 'm'));
  });

  it('holds a net’s edge at every mesh: under battens, or stapled mesh by mesh, never by staples a hand apart', () => {
    const net = catioMesh('netting');
    expect(WINDOW_INSERT_DEFAULT.mesh).toBe('netting');
    for (const variant of variants) {
      // staples alone leave a net's edge open between them: only welded mesh may be fixed that way
      expect(validateWindowInsert(variant, { ...WINDOW_INSERT_DEFAULT, meshFixing: 'staples' }, windowFor(variant, { ...WINDOW_INSERT_DEFAULT, meshFixing: 'staples' }, MODULAR_DEFAULT))).toEqual([expect.stringContaining('Soft netting needs the cover battens')]);
      expect(validateWindowInsert(variant, { ...WINDOW_INSERT_DEFAULT, mesh: 'welded', meshFixing: 'staples' }, windowFor(variant, { ...WINDOW_INSERT_DEFAULT, mesh: 'welded', meshFixing: 'staples' }, MODULAR_DEFAULT))).toEqual([]);
      for (const meshFixing of ['staples-and-battens', 'battens'] as const) for (const mesh of ['netting', 'welded'] as const) {
        const l = windowInsertLayout(variant, { ...WINDOW_INSERT_DEFAULT, mesh, meshFixing }, windowFor(variant, { ...WINDOW_INSERT_DEFAULT, mesh, meshFixing }, MODULAR_DEFAULT));
        for (const panel of l.panels) for (const edge of panel.edges) {
          const length = Math.hypot(edge.to[0] - edge.from[0], edge.to[1] - edge.from[1], edge.to[2] - edge.from[2]);
          const staples = l.fasteners.filter(f => f.component === 'staples' && f.use.startsWith(`${panel.name}:`) && Math.abs(Math.hypot(f.at[0] - edge.from[0], f.at[1] - edge.from[1], f.at[2] - edge.from[2]) + Math.hypot(f.at[0] - edge.to[0], f.at[1] - edge.to[1], f.at[2] - edge.to[2]) - length) < 1e-6);
          // an edge no batten covers (the direct sleeve along the threshold): a net gets a staple over every mesh there
          if (!edge.face) expect(length / (staples.length - 1), `${variant} ${mesh} ${panel.id}`).toBeLessThanOrEqual(mesh === 'netting' ? net.opening : WINDOW_INSERT_DEFAULT.fixingPitch);
          // under a batten the staples only hold it while it is pulled taut, at the fixing spacing, whatever the mesh
          else if (meshFixing === 'staples-and-battens' && mesh === 'netting') expect(length / (staples.length - 1)).toBeGreaterThan(net.opening);
        }
      }
    }
    // the same geometry either way: the mesh lies in the same 2 mm layer under the battens
    const boxes = (mesh: WindowInsertConfig['mesh']) => windowInsertLayout('modular', { ...WINDOW_INSERT_DEFAULT, mesh }, windowFor('modular', { ...WINDOW_INSERT_DEFAULT, mesh }, MODULAR_DEFAULT)).timber.map(piece => piece.boxes);
    expect(boxes('netting')).toEqual(boxes('welded'));
    // the steps say how a net is cut and tensioned
    expect(windowInsertSteps('modular', WINDOW_INSERT_DEFAULT, windowFor('modular', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT)).map(step => step.detail).join(' ')).toContain('Cut the net with scissors');
    expect(windowInsertSteps('modular', { ...WINDOW_INSERT_DEFAULT, mesh: 'welded' }, windowFor('modular', { ...WINDOW_INSERT_DEFAULT, mesh: 'welded' }, MODULAR_DEFAULT)).map(step => step.detail).join(' ')).not.toContain('scissors');
  });

  it('lists every piece with real library parts, and changes the cut list with the joint', () => {
    for (const variant of variants) for (const config of configs) {
      const lines = windowInsertBom(variant, config, windowFor(variant, config, MODULAR_DEFAULT));
      for (const line of lines) {
        expect(line.quantity, line.id).toBeGreaterThan(0);
        if (line.partId) expect(findPart(line.partId), line.partId).toBeDefined();
      }
      const l = windowInsertLayout(variant, config, windowFor(variant, config, MODULAR_DEFAULT));
      const count = (id: string) => lines.find(line => line.partId === id)?.quantity ?? 0;
      const printed = lines.filter(line => line.modelId === 'pressure-pad');
      if (config.attachment === 'spreader-feet' && l.pad) {
        expect(printed.map(line => [line.id, line.quantity])).toEqual([['thrust-pads', 3 * config.clampsPerSide], ['foot-pads', config.clampsPerSide]]);
        expect(count(l.pad.spreaderScrew.id)).toBe(3 * config.clampsPerSide);
        expect(count(l.pad.bearingScrew.id)).toBe(config.clampsPerSide);
        expect(count('iso-10511-m8')).toBe(3 * config.clampsPerSide);
        expect(count('iso-4032-m8')).toBe(3 * config.clampsPerSide);
        expect(count('din-7965-m8x18')).toBe(4 * config.clampsPerSide);
        expect(lines.some(line => line.partId?.startsWith('ganter'))).toBe(false);
        expect(printed[0]?.size).toBe(`Ø ${config.footDiameter} × ${config.padHeight} mm · ${config.padSurface} sole · PETG · for an ISO 10511 M8 nut`);
      } else if (config.attachment === 'spreader-feet') {
        expect(printed).toEqual([]);
        expect(count(l.spreaderFoot.id)).toBe(3 * config.clampsPerSide);
        expect(count(l.bearingFoot.id)).toBe(config.clampsPerSide);
        expect(count('din-7965-m8x18')).toBe(4 * config.clampsPerSide);
        expect(count('iso-4032-m8')).toBe(3 * config.clampsPerSide);
      } else if (config.attachment === 'frame-hooks') {
        // feet under the sill rail only, and two long and two short hooks: printed, one screw each (the model's default); bought, two
        expect(count('din-7965-m8x18')).toBe(config.clampsPerSide);
        if (l.pad) expect(printed.map(line => [line.id, line.quantity])).toEqual([['foot-pads', config.clampsPerSide]]);
        else expect(count(l.bearingFoot.id)).toBe(config.clampsPerSide);
        const hooks = lines.filter(line => line.modelId === 'printed-screen-hook');
        if (config.screenHook === 'printed') {
          // printed for this window: two long and two short, linked to the model, with their screws from the library
          expect(hooks.map(line => [line.name, line.quantity])).toEqual([['Printed screen hook, long (head)', 2], ['Printed screen hook, short (sill)', 2]]);
          expect(hooks[0]?.size).toContain(`For a ${config.frameLip} mm frame lip and a ${config.sealGap} mm seal gap`);
          expect(count('din-7997-3x20')).toBe(4);
          expect(hooks[0]?.size).toContain('1 hole for DIN 7997 3 × 20');
          expect(lines.some(line => line.partId?.startsWith('windhager'))).toBe(false);
        } else {
          expect(hooks).toEqual([]);
          expect([count('windhager-03651-5a'), count('windhager-03651-5b'), count('din-7997-3x16')]).toEqual([2, 2, 8]);
        }
        expect(lines.some(line => line.name === 'Pressure pad, thrust pad' || line.partId === 'iso-10511-m8')).toBe(false);
      } else expect(lines.find(line => line.id === 'folding-wedges')?.quantity).toBe(8 * config.clampsPerSide);
      if (config.attachment !== 'frame-hooks') expect(lines.some(line => line.partId?.startsWith('windhager'))).toBe(false);
      // the direct sleeve's threshold edges are always stapled; the modular port's mesh lies only on faces a batten can cover
      expect(count('din-1159-2-5x25') > 0).toBe(variant === 'direct' || config.meshFixing !== 'battens');
      expect(count('din-7997-4x35') > 0).toBe(true);
      expect(lines.some(line => line.name.startsWith('Cover batten'))).toBe(config.meshFixing !== 'staples');
      // three panels, cut from one roll of the chosen mesh: a library part, so that it links to a shop
      expect(lines.filter(line => line.group === 'Mesh' && !line.partId)).toHaveLength(3);
      expect(lines.filter(line => line.group === 'Mesh' && line.partId)).toMatchObject([{ id: 'mesh-roll', quantity: 1, partId: CATIO_MESH_PARTS[config.mesh] }]);
      // the corner brackets: printed (linked to the model) or bought (from the library), four either way
      const brackets = lines.filter(line => line.modelId === 'printed-corner-bracket');
      if (config.cornerJoint !== 'corner-bracket') expect(brackets).toEqual([]);
      else if (config.cornerBracket === 'printed') {
        expect(brackets.map(line => line.quantity)).toEqual([4]);
        expect(lines.some(line => line.partId?.startsWith('gah-alberts'))).toBe(false);
      } else expect([brackets.length, count(config.cornerBracket)]).toEqual([0, 4]);
      // every model it prints names this page under “Used by”
      for (const line of lines) if (line.modelId) expect(modelUsage(line.modelId).map(use => use.pageId), line.modelId).toContain('catio/window-insert');
    }
    const lap = windowInsertLayout('direct', { ...WINDOW_INSERT_DEFAULT, cornerJoint: 'half-lap' }, windowFor('direct', { ...WINDOW_INSERT_DEFAULT, cornerJoint: 'half-lap' }, MODULAR_DEFAULT)); const butt = windowInsertLayout('direct', { ...WINDOW_INSERT_DEFAULT, cornerJoint: 'butt-screwed' }, windowFor('direct', { ...WINDOW_INSERT_DEFAULT, cornerJoint: 'butt-screwed' }, MODULAR_DEFAULT));
    expect(lap.timber.find(piece => piece.id === 'collar-head')?.length).toBe(lap.W);
    expect(butt.timber.find(piece => piece.id === 'collar-head')?.length).toBe(butt.W - 2 * INSERT.member);
    expect(lap.fasteners.filter(f => f.component === 'corner-screws').every(f => f.partId === 'din-7997-4x50')).toBe(true);
    expect(butt.fasteners.filter(f => f.component === 'corner-screws').every(f => f.partId === 'din-7997-5x70')).toBe(true);
  });

  it('links every library part it can use back to this page in the parts library', () => {
    expect(INSERT.member).toBe(WINDOW_INSERT_FOOT.member);
    expect(WINDOW_INSERT_CONTROLS.find(control => control.key === 'footDiameter')?.options.map(option => option.value)).toEqual([...WINDOW_INSERT_FOOT.diameters]);
    const used = new Set(variants.flatMap(variant => configs.flatMap(config => windowInsertBom(variant, config, windowFor(variant, config, MODULAR_DEFAULT)).flatMap(line => line.partId ? [line.partId] : []))));
    expect([...used].sort()).toEqual([...new Set(windowInsertConcept.parts.map(link => link.partId))].sort());
    for (const id of used) {
      const part = findPart(id); if (!part) throw new Error(id);
      expect(partUsage(part).filter(use => use.kind === 'concept').map(use => use.modelId), id).toContain('catio/window-insert');
    }
  });

  it('gives the modular port the tunnel’s clear size between real timber edges', () => {
    const l = windowInsertLayout('modular', WINDOW_INSERT_DEFAULT, windowFor('modular', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT));
    expect(l.port).toMatchObject({ width: 300, height: 300 });
    for (const panel of l.panels) expect(panel.edges.length, panel.id).toBeGreaterThan(0);
    // only infill on the port frame's face: the passage beyond it is the tunnel coupling's docking frame, not insert mesh
    expect(l.panels.map(panel => panel.id)).toEqual(['infill-left', 'infill-right', 'infill-top']);
    // the floor the tunnel and the coupling start from, shown here where the clamps set it
    expect(windowInsertFacts('modular', WINDOW_INSERT_DEFAULT, windowFor('modular', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT)).find(f => f.label === 'Cat port floor · above the grass')?.value).toBe(`${Number((l.floor / 10).toFixed(1))} cm`);
    expect(windowInsertFacts('direct', WINDOW_INSERT_DEFAULT, windowFor('direct', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT)).some(f => f.label.startsWith('Cat port floor'))).toBe(false);
    for (const panel of l.panels) expect(panel.plane, panel.id).toBe('xz');
    const tight = { ...windowFor('modular', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT), tunnel: { width: 450, height: 450 }, sashWidth: 600, sashHeight: 600, openingWidth: 690, openingHeight: 690 };
    expect(validateWindowInsert('modular', WINDOW_INSERT_DEFAULT, tight).length).toBeGreaterThan(0);
  });

});

describe('window insert hung on the window frame', () => {
  const l = windowInsertLayout('direct', hung, windowFor('direct', hung, MODULAR_DEFAULT));
  const frame = windowFrame(l.window);

  it('lies on the frame’s face, overlapping it beyond the lip, and stands on its feet under the sill rail', () => {
    expect(validateWindowInsert('direct', hung, windowFor('direct', hung, MODULAR_DEFAULT))).toEqual([]);
    expect(l.yIn).toBe(frame.face);
    expect(l.W).toBe(854 + 2 * hung.frameOverlap);
    expect(l.z0 + l.H).toBe(frame.lip.top + hung.frameOverlap);
    expect(l.z0).toBe(l.window.recessFloor + 24.5 + INSERT.travel);
    expect(l.clamps.map(c => `${c.side} ${c.kind}`)).toEqual(['sill bearing', 'sill bearing']);
    // the floor the tunnel starts from does not change: the same feet set it
    expect(l.floor).toBe(windowInsertLayout('direct', WINDOW_INSERT_DEFAULT, windowFor('direct', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT)).floor);
  });

  it('reaches behind the lip at the head and the sill, its barbs in the seal gap so that the sash closes over them', () => {
    for (const config of [hung, bought, { ...hung, frameLip: 8, sealGap: 4.5 }, { ...bought, frameLip: 8, sealGap: 4.5 }]) {
    const l = windowInsertLayout('direct', config, windowFor('direct', config, MODULAR_DEFAULT)); const frame = windowFrame(l.window);
    const fit = l.hookFit; if (!fit) throw new Error('no hooks');
    if (config.screenHook === 'printed') {
      expect(l.hooks.map(h => `${h.side} ${h.end} ${h.title}`).sort()).toEqual(['left head Printed screen hook, long (head)', 'left sill Printed screen hook, short (sill)', 'right head Printed screen hook, long (head)', 'right sill Printed screen hook, short (sill)']);
      // made for the window: the barb in the middle of the seal gap, nothing to bend; the model's own default reach behind the lip
      expect(fit.bend).toBeNull();
      for (const h of l.hooks) expect((frame.lipBack - h.barb.outer) - (h.barb.inner - frame.sashFace)).toBeCloseTo(0, 9);
      expect(fit.engage).toEqual({ head: printedScreenHook.defaults['engage'], sill: printedScreenHook.defaults['engage'] });
    } else {
      expect(l.hooks.map(h => `${h.side} ${h.end} ${h.part?.id}`).sort()).toEqual(['left head windhager-03651-5a', 'left sill windhager-03651-5b', 'right head windhager-03651-5a', 'right sill windhager-03651-5b']);
      // bent at the lip plus half the spare seal gap, to 0.5 mm: 15.5 + (3.5 - 0.8) / 2 - 0.8 = 16.05, so 16
      if (config.frameLip === 15.5) expect(fit.bend).toBe(16);
    }
    for (const h of l.hooks) {
      expect(h.barb.outer).toBeLessThanOrEqual(frame.lipBack - HOOK_FIT.gap);
      expect(h.barb.inner).toBeGreaterThanOrEqual(frame.sashFace + HOOK_FIT.gap);
      expect(h.barb.engage).toBeGreaterThanOrEqual(HOOK_FIT.engage);
      // over the lip's opening, in front of the sash, on the stile's part beside it
      expect(Math.abs(h.x)).toBeLessThan(frame.lip.width / 2);
      expect(Math.abs(h.x)).toBeGreaterThan(l.Wi / 2);
      const barb = h.boxes[2]; if (!barb) throw new Error('barb');
      const [bottom, top] = [barb.center[2] - barb.size[2] / 2, barb.center[2] + barb.size[2] / 2];
      if (h.end === 'head') expect(top - frame.lip.top).toBeCloseTo(h.barb.engage, 6);
      else expect(frame.lip.bottom - bottom).toBeCloseTo(h.barb.engage, 6);
    }
    // lifted to hang it, the short hooks clear the sill lip while the long ones stay below the head lip's tip
    expect(fit.lift).toBeCloseTo(fit.engage.sill + HOOK_FIT.clearance, 6);
    expect(fit.headClear).toBeGreaterThan(fit.lift);
    // one screw in each printed hook (the model's default), two in each bought one, from the room side into the stile
    expect(l.fasteners.filter(f => f.component === 'hook-screws').map(f => f.direction)).toEqual(Array(config.screenHook === 'printed' ? 4 : 8).fill([0, 1, 0]));
    expect(validateWindowInsert('direct', config, windowFor('direct', config, MODULAR_DEFAULT))).toEqual([]);
    }
  });

  it('places the printed hooks as the model makes them for this window, and lists them with the window’s settings', () => {
    for (const config of [hung, { ...hung, frameLip: 8, sealGap: 4.5 }, { ...hung, frameLip: 35, frameFace: 90 }]) {
      const l = windowInsertLayout('direct', config, windowFor('direct', config, MODULAR_DEFAULT)); const fit = l.hookFit; if (!fit) throw new Error('no hooks');
      const parameters = fit.spec.parameters; if (!parameters) throw new Error('printed');
      // the model, set to this window, is valid, and its barbs are where the layout draws them
      expect(parameters).toMatchObject({ ...printedScreenHook.defaults, frameLip: config.frameLip, sealGap: config.sealGap });
      expect(validateParameters(printedScreenHook, parameters)).toEqual([]);
      const head = l.hooks.find(h => h.end === 'head'); const sill = l.hooks.find(h => h.end === 'sill'); if (!head || !sill) throw new Error('hooks');
      const height = (h: typeof head, k: number) => h.boxes[k]?.size[2] ?? 0;
      expect(height(head, 2) - Number(parameters['turnThickness'])).toBeCloseTo(fit.spec.rise.head, 9);
      expect(height(sill, 2) - Number(parameters['turnThickness'])).toBeCloseTo(fit.spec.rise.sill, 9);
      expect(fit.spec.rise.head).toBeCloseTo(2 * (Number(parameters['engage']) + Number(parameters['clearance'])), 9);
      expect(head.boxes[0]?.size).toEqual([parameters['width'], parameters['legThickness'], parameters['legLength']]);
      expect(l.yIn - head.barb.outer).toBeCloseTo(config.frameLip + (config.sealGap - Number(parameters['barbThickness'])) / 2, 9);
      expect(new Set(l.fasteners.filter(f => f.component === 'hook-screws').map(f => f.partId))).toEqual(new Set([parameters['woodScrew']]));
    }
  });

  it('refuses a window the hooks cannot fit, or whose sash would not close over them', () => {
    expect(validateWindowInsert('direct', { ...bought, sealGap: 1.5 }, windowFor('direct', { ...bought, sealGap: 1.5 }, MODULAR_DEFAULT)).join(' ')).toMatch(/seal gap \(1.5 mm\) is too narrow for the hooks’ 0.8 mm strip/);
    expect(validateWindowInsert('direct', { ...bought, frameLip: 4 }, windowFor('direct', { ...bought, frameLip: 4 }, MODULAR_DEFAULT)).join(' ')).toMatch(/hooks bend for a frame lip 5–35 mm thick, not 4 mm/);
    expect(validateWindowInsert('direct', { ...hung, frameLip: 4 }, windowFor('direct', { ...hung, frameLip: 4 }, MODULAR_DEFAULT)).join(' ')).toMatch(/hooks are made for a frame lip 5–35 mm thick, not 4 mm/);
    // the printed barb is 2 mm: a seal gap under 3 mm is too narrow for it, but not for the bought strip
    expect(validateWindowInsert('direct', { ...hung, sealGap: 2.5 }, windowFor('direct', { ...hung, sealGap: 2.5 }, MODULAR_DEFAULT)).join(' ')).toMatch(/seal gap \(2.5 mm\) is too narrow for the printed hooks’ 2 mm barb.*Choose the bought hooks/);
    expect(validateWindowInsert('direct', { ...bought, sealGap: 2.5 }, windowFor('direct', { ...bought, sealGap: 2.5 }, MODULAR_DEFAULT))).toEqual([]);
    // a sliding cat gate's latch stands 12 mm behind the collar's back, in front of the sash: a thin lip leaves too little room. A
    // removable panel is set into the port, its buttons and pull within the collar's depth: it never reaches the sash
    const thin = { ...bought, frameLip: 5, sealGap: 2.5 };
    expect(validateWindowInsert('modular', thin, { ...windowFor('modular', thin, MODULAR_DEFAULT), closure: 'sliding-gate' }).join(' ')).toMatch(/gate’s latch needs 13 mm/);
    expect(validateWindowInsert('modular', thin, { ...windowFor('modular', thin, MODULAR_DEFAULT), closure: 'removable-panel' })).toEqual([]);
    const thinner = { ...bought, frameLip: 5, sealGap: 0 };
    expect(validateWindowInsert('modular', thinner, { ...windowFor('modular', thinner, MODULAR_DEFAULT), closure: 'removable-panel' }).join(' ')).not.toMatch(/panel/);
    for (const seat of DOOR_SEATS) { const l = windowInsertLayout('modular', thinner, { ...windowFor('modular', thinner, MODULAR_DEFAULT), closure: 'removable-panel', seat }); expect((l.door?.frame.origin[1] ?? 0) - (l.door?.panel.depth ?? 0)).toBeGreaterThan(l.yIn); }
    expect(validateWindowInsert('direct', { ...bought, frameLip: 5, sealGap: 2.5 }, windowFor('direct', { ...bought, frameLip: 5, sealGap: 2.5 }, MODULAR_DEFAULT))).toEqual([]);
    expect(validateWindowInsert('direct', { ...hung, frameLip: 5, sealGap: 3 }, windowFor('direct', { ...hung, frameLip: 5, sealGap: 3 }, MODULAR_DEFAULT))).toEqual([]);
  });

describe('window insert collar corners with flat corner brackets', () => {
  it('sizes the printed bracket, the default, from the collar’s member, as the model’s defaults are', () => {
    expect(WINDOW_INSERT_DEFAULT.cornerBracket).toBe('printed');
    expect(WINDOW_INSERT_MEMBER).toBe(INSERT.member);
    const size = printedCornerBracketFor(INSERT.member);
    expect(Object.fromEntries(Object.keys(size).map(key => [key, printedCornerBracket.defaults[key]]))).toEqual(size);
    const [bracket] = windowInsertLayout('direct', WINDOW_INSERT_DEFAULT, windowFor('direct', WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT)).brackets; if (!bracket) throw new Error('bracket');
    expect(bracket.spec).toMatchObject({ part: null, a: size.legA, b: size.legB, c: size.width, t: size.thickness });
    expect(bracket.spec.screw.id).toBe(printedCornerBracket.defaults['woodScrew']);
    expect(validateParameters(printedCornerBracket, printedCornerBracket.defaults)).toEqual([]);
    // every hole lies past the joint, on the member its leg runs along
    for (const hole of bracket.spec.holes) expect(hole.along).toBeGreaterThan(INSERT.member);
  });

  it('lets a flat corner bracket, printed or bought, into the room-side face of each butt joint, screwed through every hole', () => {
    for (const variant of variants) for (const [config, id, screw, holes] of [[WINDOW_INSERT_DEFAULT, null, 'din-7997-4x35', 6], [pressed, null, 'din-7997-4x35', 6], [bought, 'gah-alberts-stuhlwinkel-100x100x19', 'din-7997-5x35', 6], [{ ...pressed, cornerBracket: 'gah-alberts-stuhlwinkel-100x100x19' }, 'gah-alberts-stuhlwinkel-100x100x19', 'din-7997-5x35', 6]] as const) {
      const l = windowInsertLayout(variant, config, windowFor(variant, config, MODULAR_DEFAULT));
      expect(l.brackets.map(b => b.spec.part?.id ?? null)).toEqual(Array(4).fill(id));
      for (const b of l.brackets) for (const plate of b.boxes) {
        // flush in the room-side face, within the collar's outline, at most the 40 mm member wide across it
        expect(plate.center[1] - plate.size[1] / 2).toBe(l.yIn);
        expect(Math.abs(plate.center[0]) + plate.size[0] / 2).toBeLessThanOrEqual(l.W / 2 + 1e-9);
        expect(Math.min(plate.size[0], plate.size[2])).toBeLessThanOrEqual(INSERT.member);
      }
      const screws = l.fasteners.filter(f => f.component === 'bracket-screws');
      expect(screws).toHaveLength(4 * holes);
      expect(new Set(screws.map(f => f.partId))).toEqual(new Set([screw]));
      // the corner screws stay, through the stiles into the rails' end grain, and nothing runs into another
      expect(l.fasteners.filter(f => f.component === 'corner-screws').every(f => f.partId === 'din-7997-5x70')).toBe(true);
      expect(fastenerClashes(screws, l.fasteners.filter(f => f.component !== 'bracket-screws'), 6)).toEqual([]);
      expect(validateWindowInsert(variant, config, windowFor(variant, config, MODULAR_DEFAULT))).toEqual([]);
    }
  });

  it('keeps the brackets clear of a hung insert’s hooks, and offers the larger ones pressed into the recess', () => {
    for (const cornerBracket of WINDOW_INSERT_BRACKETS) {
      expect(validateWindowInsert('direct', { ...pressed, cornerBracket }, windowFor('direct', { ...pressed, cornerBracket }, MODULAR_DEFAULT))).toEqual([]);
      const errors = validateWindowInsert('direct', { ...hung, cornerBracket }, windowFor('direct', { ...hung, cornerBracket }, MODULAR_DEFAULT));
      if (/125x125|150x150/.test(cornerBracket)) expect(errors.join(' ')).toMatch(/would lie over the screen hooks/);
      else expect(errors).toEqual([]);
    }
    // with only 10 mm on the frame, the head hooks turn in 17 mm (printed: 18 mm) below the collar's top, under any bracket's rail leg
    expect(validateWindowInsert('direct', { ...hung, frameOverlap: 10 }, windowFor('direct', { ...hung, frameOverlap: 10 }, MODULAR_DEFAULT)).join(' ')).toMatch(/more overlap on the frame/);
    expect(validateWindowInsert('direct', { ...bought, frameOverlap: 10 }, windowFor('direct', { ...bought, frameOverlap: 10 }, MODULAR_DEFAULT)).join(' ')).toMatch(/more overlap on the frame/);
    expect(validateWindowInsert('direct', { ...hung, frameOverlap: 10, cornerJoint: 'half-lap' }, windowFor('direct', { ...hung, frameOverlap: 10, cornerJoint: 'half-lap' }, MODULAR_DEFAULT))).toEqual([]);
  });

});
});
