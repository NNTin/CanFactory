import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { addPlatform, createProject, evaluateProject } from '@canfactory/catio';
import { createPlannerScene } from './catioPlannerScene.ts';

describe('the planner scene', () => {
  it('draws every instance as its own group, each mesh picking its instance', () => {
    const project = addPlatform(createProject(), 'enclosure-1').project;
    const scene = createPlannerScene(project, evaluateProject(project));
    for (const i of project.instances) {
      const d = scene.drawn.get(i.id);
      let meshes = 0; d?.group.traverse(o => { if (o instanceof THREE.Mesh) meshes++; });
      expect(meshes, i.id).toBeGreaterThan(0);
      // a platform stands in its enclosure's group, the tunnel in its window's, so that each moves with its parent
      expect(d?.group.parent?.name).toBe(i.parent ?? 'catio-planner');
      if (d && i.kind !== 'window') expect(scene.localBounds(d).isEmpty()).toBe(false);
    }
    scene.dispose();
  });

  it('draws the tunnel as its parts list builds it: its doors, couplings, fixings and the docking frame on the window', () => {
    const project = createProject();
    const evaluation = evaluateProject(project);
    const tunnel = evaluation.instances.find(i => i.kind === 'tunnel');
    if (tunnel?.kind !== 'tunnel' || !tunnel.layout) throw new Error('no tunnel');
    const { layout } = tunnel;
    const scene = createPlannerScene(project, evaluation);
    const part = (name: string) => scene.drawn.get('tunnel-1')?.group.getObjectByName(`tunnel-1-${name}`);
    const children = (name: string) => part(name)?.children.length ?? 0;
    // the default tunnel's four closure panels, each its own door
    expect(layout.doors).toHaveLength(4);
    expect(children('doors')).toBe(layout.doors.length);
    expect(children('door-mesh')).toBe(layout.doors.length);
    // every coupling: each bolt with its nut, each latch with its catch, their screws and the seal
    expect(layout.couplings.length).toBeGreaterThan(0);
    const latchScrews = layout.fasteners.filter(f => f.component === 'latch-screws' || f.component === 'catch-screws').length;
    expect(children('couplings')).toBe(layout.couplings.reduce((n, c) => n + 2 * c.bolts.length + 2 * c.latches.length + (c.seal ? 1 : 0), 0) + latchScrews);
    // the sections' screws and staples, the screws up into the flanges, and the coupling's docking frame on the insert's port
    const built = ['rail-screws', 'floor-screws', 'cleat-screws', 'staples', 'flange-screws'];
    expect(children('section-fasteners')).toBe(layout.fasteners.filter(f => built.includes(f.component)).length);
    // every support's insert nuts and feet, and its bearer's screws (the default fixes the tunnel with screws, so no hold)
    expect(children('support-hardware')).toBe(layout.supports.reduce((n, s) => n + 2 * s.feet.length + (s.kind === 'trestle' ? 4 : 0), 0));
    expect(children('docking-frame')).toBeGreaterThan(0);
    expect(children('docking-hardware')).toBeGreaterThan(0);
    scene.dispose();
  });
});
