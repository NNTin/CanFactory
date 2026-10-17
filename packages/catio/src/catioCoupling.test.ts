import { describe, expect, it } from 'vitest';
import { COUPLING_LATCH, dimensionOf, findPart, insertTunnelCouplingConcept, partUsage, toggleLatchMechanism as TL } from '@canfactory/contracts';
import { COUPLING, COUPLING_CONTROLS, COUPLING_DECISIONS, COUPLING_DEFAULT, couplingBom, couplingFacts, couplingLayout, fastenerClashes, INSERT, latchHeights, MODULAR_DEFAULT, PRINTED_LATCH, TUNNEL, TUNNEL_COUPLING_DEFAULT, TUNNEL_DEFAULT, tunnelBom, tunnelSiteFor, validateCoupling, WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DEFAULT, type CouplingConfig, type CouplingSite } from './index.ts';

const base = tunnelSiteFor(WINDOW_INSERT_DEFAULT, MODULAR_DEFAULT);
const site: CouplingSite = { tunnel: TUNNEL_DEFAULT, joint: TUNNEL_COUPLING_DEFAULT, site: base };
/** The insert with each of its mesh fixings: the docking frame is rebated over cover battens only where there are battens. */
// every mesh fixing, pressed into the recess and hung on the window frame (its collar then lies deeper, on the frame's face)
/** Staples alone hold welded mesh only: a net needs the battens (the window insert page). */
const meshFor = (meshFixing: string) => meshFixing === 'staples' ? 'welded' as const : 'netting' as const;
const sites: CouplingSite[] = (['spreader-feet', 'frame-hooks'] as const).flatMap(attachment => (['staples-and-battens', 'staples', 'battens'] as const)
  .map(meshFixing => ({ tunnel: TUNNEL_DEFAULT, joint: TUNNEL_COUPLING_DEFAULT, site: { ...base, insert: { ...WINDOW_INSERT_DEFAULT, attachment, meshFixing, mesh: meshFor(meshFixing) } } })));
/** Every option of every control, one at a time, from the defaults. */
const configs: CouplingConfig[] = [COUPLING_DEFAULT, ...COUPLING_CONTROLS.flatMap(control => control.options.map(option => ({ ...COUPLING_DEFAULT, [control.key]: option.value })))];

describe('insert–tunnel coupling', () => {
  it('frames the cat port with a docking frame that sits on the insert’s own faces and keeps the port’s clear size', () => {
    for (const s of sites) for (const config of configs) {
      const l = couplingLayout(config, s);
      expect(l.errors, JSON.stringify(config)).toEqual([]);
      const boxes = l.frame.flatMap(member => member.boxes.map(b => ({ member: member.id, min: b.center.map((c, i) => c - (b.size[i] ?? 0) / 2), max: b.center.map((c, i) => c + (b.size[i] ?? 0) / 2) })));
      const battens = s.site.insert.meshFixing !== 'staples';
      // on the threshold, round the clear opening, its face flat at 6 mm short of the flange, its back on the battens or the mesh
      expect(Math.min(...boxes.map(b => b.min[2] ?? 0))).toBeCloseTo(l.floor, 9);
      for (const b of boxes) {
        expect(b.max[1], b.member).toBeCloseTo(TUNNEL.wallGap - (config.latch === 'printed' ? COUPLING.printed.gap : COUPLING.gap), 9);
        expect([l.meshFace, l.meshFace + (battens ? INSERT.batten.thickness : 0)].some(y => Math.abs((b.min[1] ?? 0) - y) < 1e-9), b.member).toBe(true);
        const inside = (b.min[0] ?? 0) >= l.w / 2 - 1e-9 || (b.max[0] ?? 0) <= -l.w / 2 + 1e-9 || (b.min[2] ?? 0) >= l.transomZ - 1e-9;
        expect(inside, `${b.member} keeps out of the port`).toBe(true);
      }
      expect(l.meshFace).toBeCloseTo(l.insert.yOut + INSERT.mesh.layer, 9);
      expect(l.frame.every(member => member.cut.includes('rebated') === battens)).toBe(true);
      // the outline above the floor is the tunnel flange's
      expect(Math.max(...boxes.map(b => b.max[0] ?? 0))).toBeCloseTo(l.w / 2 + TUNNEL.flange.width, 9);
      expect(Math.max(...boxes.map(b => b.max[2] ?? 0))).toBeCloseTo(l.transomZ + TUNNEL.flange.width, 9);
    }
  });

  it('screws the docking frame 23 mm into the jambs and transom (26 mm with GN 831 latches), whatever the mesh fixing', () => {
    for (const s of sites) for (const latch of ['printed', 'gn-831'] as const) {
      const l = couplingLayout({ ...COUPLING_DEFAULT, latch }, s);
      const screws = l.fasteners.filter(f => f.component === 'frame-screws');
      expect(screws.length).toBeGreaterThan(4);
      for (const f of screws) {
        const screw = findPart(f.partId); if (!screw) throw new Error(f.partId);
        const length = dimensionOf(screw, 'l');
        expect(f.direction).toEqual([0, -1, 0]);
        // pressed into the recess, a 5 × 60 bites 23 (26) mm; hung on the window frame, the thicker frame takes a 6 × 90
        const hung = s.site.insert.attachment === 'frame-hooks';
        expect(f.partId).toBe(hung ? 'din-7997-6x90' : 'din-7997-5x60');
        expect(length - (f.at[1] - l.insert.yOut), `${f.use} bite`).toBeCloseTo((latch === 'printed' ? 23 : 26) + (hung ? 2.5 : 0), 9);
      }
    }
  });

  it('shows on its own page whether the insert has cover battens, and that the window insert page sets it', () => {
    for (const s of sites) {
      const fact = couplingFacts('modular', COUPLING_DEFAULT, s).find(f => f.label === 'Cover battens at the port');
      const battens = s.site.insert.meshFixing !== 'staples';
      expect(fact?.value, s.site.insert.meshFixing).toBe(battens ? `Yes · frame rebated ${INSERT.batten.thickness} mm over them` : 'None · frame flat on the mesh');
      expect(fact?.from).toEqual({ page: 'window-insert', settings: ['meshFixing'] });
    }
  });

  it('keeps every docking frame screw clear of the insert’s batten screws and staples, for every way the insert is set', () => {
    const insertConfigs = [WINDOW_INSERT_DEFAULT, ...WINDOW_INSERT_CONTROLS.flatMap(control => control.options.map(option => ({ ...WINDOW_INSERT_DEFAULT, [control.key]: option.value })))];
    for (const insert of insertConfigs) for (const meshFixing of ['staples-and-battens', 'staples', 'battens'] as const) {
      const s: CouplingSite = { tunnel: TUNNEL_DEFAULT, joint: TUNNEL_COUPLING_DEFAULT, site: { ...base, insert: { ...insert, meshFixing, mesh: meshFor(meshFixing) } } };
      const l = couplingLayout(COUPLING_DEFAULT, s);
      const frame = l.fasteners.filter(f => f.component === 'frame-screws');
      const face = l.insert.fasteners.filter(f => f.component === 'batten-screws' || f.component === 'staples');
      expect(fastenerClashes(frame, face, COUPLING.screwClearance), JSON.stringify(s.site.insert)).toEqual([]);
      expect(l.errors).toEqual([]);
      // still into the jambs and transom, not off their ends
      for (const f of frame) if (f.use.includes('stiles')) expect(f.at[2] > l.floor && f.at[2] < l.transomZ).toBe(true);
    }
    // the defaults put a batten screw on a stile's middle: that frame screw is moved off it
    const l = couplingLayout(COUPLING_DEFAULT, site);
    expect(l.fasteners.filter(f => f.component === 'frame-screws')).toHaveLength(10);
  });

  it('builds its decisions from the sizes it uses', () => {
    const l = couplingLayout(COUPLING_DEFAULT, site);
    const text = COUPLING_DECISIONS.map(d => `${d.choice} ${d.why}`).join(' ');
    expect(text).toContain(`${Math.round(l.thickness)} × ${TUNNEL.flange.width} stiles`);
    expect(text).toContain(`the joint is ${Math.round(l.flangeFront - l.meshFace)} mm deep`);
    expect(text).toContain(`lies ${Math.round(-l.meshFace)} mm inside the recess`);
    expect(text).toContain(`with ${l.fasteners.find(f => f.component === 'frame-screws')?.partId === 'din-7997-6x90' ? 'DIN 7997 6 × 90' : 'DIN 7997 5 × 60'} screws`);
    expect(COUPLING_DECISIONS.find(d => d.title === 'A docking frame on the insert')?.from).toEqual({ page: 'window-insert', settings: ['meshFixing', 'fixingPitch'] });
  });

  it('carries nothing of the tunnel on the insert: the wall support holds the flange, only the seal and the latches cross the gap', () => {
    for (const config of configs) {
      const l = couplingLayout(config, site);
      const s = l.wallSupport; const first = l.first; if (!s || !first) throw new Error('no wall support');
      expect(first.start.at).toEqual([0, TUNNEL.wallGap, l.floor]);
      // the bearer is under the first flange and meets its underside
      expect(s.top).toBeCloseTo(l.floor - TUNNEL.flange.width, 6);
      expect(s.at[1] - TUNNEL.bearer.width / 2).toBeCloseTo(TUNNEL.wallGap, 6);
      // a real gap between the frame and the flange, filled by the seal squashed from its free height
      expect(l.flangeBack - l.front).toBe(l.gap);
      expect(l.gap).toBe(config.latch === 'printed' ? COUPLING.printed.gap : COUPLING.gap);
      expect(l.seal.height).toBeGreaterThan(l.gap);
      expect([l.seal.y0, l.seal.y1]).toEqual([l.front, l.flangeBack]);
      // the floor lip only lies on the threshold, which ends at the wall face
      if (l.lip) { expect(l.lip.z).toBe(l.floor); expect(l.lip.y0).toBeLessThan(0); expect(l.lip.y1).toBe(l.flangeFront); }
      expect(l.lip === null).toBe(config.floorLip === 'none');
    }
  });

  it('puts every latch body on the flange’s side and its catch on the docking frame’s, within the hook’s range', () => {
    for (const type of COUPLING_LATCH.types) for (const latchesPerSide of [1, 2] as const) {
      const l = couplingLayout({ ...COUPLING_DEFAULT, latch: 'gn-831', latchType: type, latchesPerSide }, site);
      const p = l.latchPart; if (!p) throw new Error('GN 831');
      expect(p.attributes['length']).toBe('Short (2)');
      expect(l.latches).toHaveLength(2 * latchesPerSide);
      const [b3, b4, length, w2] = (['b3', 'b4', 'l1', 'w2'] as const).map(key => dimensionOf(p, key)) as [number, number, number, number];
      for (const q of l.latches) {
        expect(Math.abs(q.faceX)).toBe(l.w / 2 + TUNNEL.flange.width);
        expect(q.baseY).toBeGreaterThanOrEqual(l.flangeBack); expect(q.hingeY).toBeLessThanOrEqual(l.flangeFront); expect(q.hingeY - q.baseY).toBe(b3);
        expect(q.catchY).toBeGreaterThanOrEqual(l.meshFace); expect(q.catchY + b4).toBeLessThanOrEqual(l.front);
        // set to the middle of its range: the joint may end up w2/2 nearer or further and still close
        expect(q.hingeY - q.catchY - length).toBeCloseTo(w2 / 2, 9);
        expect(q.z).toBeGreaterThan(l.floor); expect(q.z).toBeLessThan(l.transomZ + TUNNEL.flange.width);
      }
      expect(l.tolerance).toBe(w2 / 2);
    }
    // the long type's catch, even where the insert is pressed into the recess (the shallower joint), stays in front of the mesh now
    // that the tunnel's end frame is 40 mm deep
    const long = findPart('ganter-gn-831-100-a-ni-1'); if (!long) throw new Error('long latch');
    const pressed = sites.find(s => s.site.insert.attachment === 'spreader-feet'); if (!pressed) throw new Error('pressed');
    const l = couplingLayout(COUPLING_DEFAULT, pressed);
    expect(l.flangeFront - COUPLING.latchInset - dimensionOf(long, 'l1') - dimensionOf(long, 'w2') / 2).toBeGreaterThan(l.meshFace);
  });

  it('can close the joint with the printed toggle latch instead, at its lock’s spacing: the tunnel’s first flange a standard port, its base plates on its left, catch plates on its right', () => {
    for (const s of sites) for (const latchesPerSide of [1, 2] as const) {
      const l = couplingLayout({ ...COUPLING_DEFAULT, latch: 'printed', latchesPerSide }, s);
      expect(l.errors).toEqual([]);
      expect(l.latchPart).toBeNull();
      // the frame comes to 3 mm of the flange, sealed with the thin E-profile
      expect(l.gap).toBe(3); expect(l.front).toBe(l.flangeBack - 3);
      expect(l.seal).toMatchObject({ profile: 'E-profile', height: 4 });
      // locked, the plates stand as far apart as the mechanism's over-centre lock sets them; each reaches as far into the gap
      expect(PRINTED_LATCH.locked).toBeCloseTo(-TL.tautLink(TL.CLOSED).offset, 9);
      expect(PRINTED_LATCH.locked).toBeCloseTo(1.311, 3);
      expect(l.latches).toHaveLength(2 * latchesPerSide);
      for (const q of l.latches) {
        const seam = q.printed?.seam ?? NaN;
        // seen from outside (from the window), the flange's left is −X: there the base is on the flange, on the right on the frame
        const onFlange = q.printed?.baseOn === 'flange';
        expect(onFlange).toBe(q.side < 0);
        if (onFlange) { expect(l.flangeBack - seam).toBeCloseTo(PRINTED_LATCH.overhang, 9); expect(seam - PRINTED_LATCH.locked - l.front).toBeCloseTo(PRINTED_LATCH.overhang, 9); }
        else { expect(seam - l.front).toBeCloseTo(PRINTED_LATCH.overhang, 9); expect(l.flangeBack - (seam + PRINTED_LATCH.locked)).toBeCloseTo(PRINTED_LATCH.overhang, 9); }
        expect(q.printed?.mount.pull).toEqual([0, onFlange ? 1 : -1, 0]);
        // at the standard port's stations, up the opening's height
        expect((q.z - l.floor) / l.h).toBeCloseTo(latchHeights(latchesPerSide)[Number(q.id.at(-1))] ?? NaN, 9);
        expect(Math.min(q.baseY, q.catchY)).toBeGreaterThanOrEqual(l.meshFace - 1e-9); expect(Math.max(q.baseY, q.catchY)).toBeLessThanOrEqual(l.flangeFront + 1e-9);
        expect(q.z - PRINTED_LATCH.length / 2).toBeGreaterThanOrEqual(l.floor); expect(q.z + PRINTED_LATCH.length / 2).toBeLessThanOrEqual(l.transomZ + TUNNEL.flange.width);
      }
      // two screws through each plate, heads on the plate, into the flange or the frame at least 5 mm in from its edge
      const screws = l.fasteners.filter(f => f.component === 'latch-screws' || f.component === 'catch-screws');
      expect(screws).toHaveLength(4 * l.latches.length);
      for (const f of screws) {
        const q = l.latches.find(latch => latch.id === f.of); if (!q) throw new Error(f.of);
        expect(f.partId).toBe('din-7997-4x25');
        expect(f.at[0]).toBeCloseTo(q.faceX + q.side * PRINTED_LATCH.plate, 9); expect(f.direction).toEqual([-q.side, 0, 0]);
        const inFlange = (f.component === 'latch-screws') === (q.printed?.baseOn === 'flange');
        const inside = inFlange ? f.at[1] - l.flangeBack : l.front - f.at[1];
        expect(inside, f.use).toBeGreaterThan(5);
        expect(Math.abs(Math.abs(f.at[2] - q.z) - 13.2)).toBeLessThan(0.05);
      }
      expect(l.tolerance).toBeGreaterThan(1.5);
    }
  });

  it('explains what cannot be built', () => {
    const tall: CouplingSite = { tunnel: TUNNEL_DEFAULT, joint: TUNNEL_COUPLING_DEFAULT, site: { ...base, window: { ...base.window, tunnel: { width: 300, height: 800 } }, h: 800 } };
    expect(validateCoupling('modular', COUPLING_DEFAULT, tall).join(' ')).toMatch(/head rail/);
    const wide: CouplingSite = { tunnel: TUNNEL_DEFAULT, joint: TUNNEL_COUPLING_DEFAULT, site: { ...base, window: { ...base.window, tunnel: { width: 760, height: 300 } }, w: 760 } };
    expect(validateCoupling('modular', COUPLING_DEFAULT, wide).join(' ')).toMatch(/does not fit between the collar stiles/);
  });
});

describe('insert–tunnel coupling parts list', () => {
  it('counts every latch, screw and seal from the layout, all from the parts library', () => {
    for (const s of sites) for (const config of configs) {
      const l = couplingLayout(config, s);
      const lines = couplingBom('modular', config, s);
      const count = (id: string) => lines.find(line => line.partId === id)?.quantity ?? 0;
      for (const line of lines) {
        expect(line.quantity, line.id).toBeGreaterThan(0);
        if (line.partId) expect(findPart(line.partId), line.partId).toBeDefined();
      }
      if (l.latchPart) {
        expect(count(l.latchPart.id)).toBe(2 * config.latchesPerSide);
        expect(l.latchPart.id).toBe(`ganter-gn-831-100-${config.latchType.toLowerCase()}-${config.latchMaterial.toLowerCase()}-2`);
      } else {
        // the printed latch links to its model, not to the parts library
        const printed = lines.find(line => line.modelId === 'toggle-latch');
        expect(printed).toMatchObject({ quantity: 2 * config.latchesPerSide, name: 'Toggle latch, printed' });
        expect(printed?.partId).toBeUndefined();
        expect(lines.some(line => line.partId?.startsWith('ganter-gn-831'))).toBe(false);
        expect(lines.find(line => line.id === 'seal')?.name).toMatch(/E-profile/);
      }
      expect(count('din-7997-5x60') + count('din-7997-6x90')).toBe(l.fasteners.filter(f => f.component === 'frame-screws').length);
      // two screws in each latch body and each catch, and three through the lip
      expect(count('din-7997-4x25')).toBe(4 * l.latches.length + (l.lip ? 3 : 0));
      expect(lines.find(line => line.id === 'frame-stile')?.quantity).toBe(2);
      expect(lines.find(line => line.id === 'frame-head')?.quantity).toBe(1);
      // hung on the window frame, the port frame lies 27.5 mm deeper and the docking frame is that much thicker
      const deeper = s.site.insert.attachment === 'frame-hooks' ? 27.5 : 0;
      expect(lines.find(line => line.id === 'frame-stile')?.size).toMatch(new RegExp(`^${Math.round((config.latch === 'printed' ? 35 : 32) + deeper)} × 40 · 300 long`));
      expect(lines.some(line => line.id === 'floor-lip')).toBe(config.floorLip === 'rubber-lip');
      expect(lines.find(line => line.id === 'seal')?.size).toContain(`${Math.ceil(l.seal.length / 10) * 10} long`);
    }
  });

  it('links every library part it can use back to this page in the parts library', () => {
    const used = new Set(configs.flatMap(config => [...COUPLING_LATCH.types].flatMap(latchType => [...COUPLING_LATCH.materials].flatMap(latchMaterial =>
      [site, ...sites].flatMap(s => couplingBom('modular', { ...config, latchType, latchMaterial }, s).flatMap(line => line.partId ? [line.partId] : []))))));
    expect([...used].sort()).toEqual([...new Set(insertTunnelCouplingConcept.parts.map(link => link.partId))].sort());
    for (const id of used) {
      const p = findPart(id); if (!p) throw new Error(id);
      expect(partUsage(p).filter(use => use.kind === 'concept').map(use => use.modelId), id).toContain('catio/insert-tunnel-coupling');
    }
  });

  it('leaves the old foam strip out of the tunnel’s parts list: the coupling closes the window end now', () => {
    expect(tunnelBom('modular', TUNNEL_DEFAULT, base, TUNNEL_COUPLING_DEFAULT).some(line => /foam/i.test(line.name))).toBe(false);
  });
});
