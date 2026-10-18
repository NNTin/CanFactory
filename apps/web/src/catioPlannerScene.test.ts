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
});
