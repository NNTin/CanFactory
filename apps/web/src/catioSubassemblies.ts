import type { CatioSubassembly } from './route.ts';
import type { SubassemblyDefinition } from './catioSubassembly.ts';
import { createWindowInsertScene } from './catioWindowInsertScene.ts';
import {
  parseWindowInsert, validateWindowInsert, WINDOW_INSERT_CONTROLS, WINDOW_INSERT_DECISIONS, WINDOW_INSERT_DEFAULT, windowInsertBom, windowInsertFacts,
  windowInsertSteps, windowInsertViews, type WindowInsertConfig,
} from './catioWindowInsert.ts';

export const windowInsertDefinition: SubassemblyDefinition<WindowInsertConfig> = {
  id: 'window-insert', title: 'Window insert', eyebrow: 'CATIO SUB-ASSEMBLY · WINDOW INSERT',
  heading: 'Held by the window, not fixed to it.',
  summary: 'The removable timber collar that sits in the exterior recess: its pieces, the joints between them, how the mesh is held, and the padded clamps that grip the recess without a single hole in the wall.',
  defaults: WINDOW_INSERT_DEFAULT, controls: WINDOW_INSERT_CONTROLS, parse: parseWindowInsert,
  validate: (variant, config) => validateWindowInsert(variant, config),
  steps: windowInsertSteps, build: createWindowInsertScene, bom: (variant, config) => windowInsertBom(variant, config),
  views: windowInsertViews, facts: windowInsertFacts, decisions: WINDOW_INSERT_DECISIONS,
};

/** Every sub-assembly page, for links and breadcrumbs. The tunnel and the enclosure are next; `CatioSubassemblyRoute` picks the definition. */
export const CATIO_SUBASSEMBLY_TITLES: Record<CatioSubassembly, string> = { 'window-insert': windowInsertDefinition.title };
