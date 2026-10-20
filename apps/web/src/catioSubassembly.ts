import type { CameraPreset, CatioLayer, CatioSubassembly, CatioView, DesignDecision, AssemblyStep, BomLine, Project, ProjectEvaluation, SubassemblyControl, SubassemblyFact, SubjectOf, V3 } from '@canfactory/catio';
import type * as THREE from 'three';
import type { CatioState } from './catioParts.ts';

/**
 * A sub-assembly's detail view (`#/concepts/catio/<id>`, #117): one instance of the project open in the planner (its window, or its
 * tunnel), fitted to the rest of the project as it is: its pieces staged into an assembly, its joints, steps and parts list, and its
 * construction choices, which are the project's (an edit there is an edit of the project, with undo). `CatioSubassemblyPage`
 * renders any definition; a new sub-assembly is one more definition in catioSubassemblies.ts. The pure parts (its subject in the
 * project, controls, facts, decisions) are in `@canfactory/catio`.
 */

export interface SubassemblyComponent { id: string; group: THREE.Group; step: number; layer?: CatioLayer }
export interface SubassemblyModel {
  root: THREE.Group;
  hinge: THREE.Group;
  components: SubassemblyComponent[];
  update: (state: CatioState) => void;
  dispose: () => void;
  /** What is being fitted at the last `update`, and how, for the caption under the stage; null between moves. */
  caption?: () => string | null;
  /** Where the sub-assembly is, relative to where it is installed (e.g. out on a bench), for the cameras to follow. */
  focusOffset?: () => V3;
}

/** A drawing to make a part by: its title, what it is for, an SVG document at 1:1, and the file name to save it as. */
export interface SubassemblyDrawing { id: string; title: string; caption: string; svg: string; filename: string }
export interface SubassemblyDefinition<C extends object, S> {
  id: CatioSubassembly;
  title: string;
  eyebrow: string;
  heading: string;
  summary: string;
  /** Over the facts and parameters, e.g. "THE INSERT". */
  briefLabel: string;
  /** The heading of the written assembly instructions. */
  assemblyHeading: string;
  /** Labels for the camera presets, where a sub-assembly means something else by one (e.g. Mounting as a support detail). */
  viewLabels?: Partial<Record<CatioView, string>>;
  /** The viewing toggles the view offers besides the exploded view, with their labels; both, as for the window, when absent. */
  toggles?: Partial<Record<'windowOpen' | 'cutaway', string>>;
  /** Labels for the layer buttons, where a sub-assembly's layers hold something else (e.g. feet rather than clamps). */
  layerLabels?: Partial<Record<CatioLayer, string>>;
  /** The stage's scale (scene units per stage unit): larger for a sub-assembly that spans the garden. */
  stageScale?: number;
  /** Its config and what it is fitted to, for an instance of the project (its first window or tunnel when none is named). */
  subject: (project: Project, evaluation: ProjectEvaluation, instance: string | null) => SubjectOf<C, S>;
  /** Choices of how the view shows it, not of the design (which joint the tunnel–tunnel coupling's view shows): kept by the view. */
  viewControls?: SubassemblyControl<C>[];
  validate: (config: C, site: S) => string[];
  /** Stage 0 is the existing context; the slider runs from 0 to `steps.length - 1`. */
  steps: (config: C, site: S) => readonly AssemblyStep[];
  build: (config: C, site: S) => SubassemblyModel;
  bom: (config: C, site: S) => BomLine[];
  views: (config: C, site: S) => Record<CatioView, CameraPreset>;
  /** Short facts for the brief, e.g. the collar size that follows from the chosen clamps. */
  facts: (config: C, site: S) => SubassemblyFact[];
  decisions: DesignDecision[];
  /**
   * The label of the toggle that opens the design's door (a cat port's panel or gate, a side-access panel), or null when this
   * design has none. Checked, the scene shows the door open (`CatioState.door` runs from 0 to 1 as it opens); absent, no toggle.
   */
  doorToggle?: (config: C, site: S) => string | null;
  /** Drawings to make it by, shown beside the parts list with a download: an SVG document at 1:1 in millimetres. */
  drawings?: (config: C, site: S) => SubassemblyDrawing[];
  /** The views that open with the wall cut away; Interior and Mounting when absent. */
  cutawayViews?: CatioView[];
  /** Viewing defaults besides the shared ones, e.g. a toggle that starts off. */
  defaultViewing?: Partial<Pick<SubassemblyViewing, 'windowOpen' | 'cutaway' | 'view'>>;
}

export interface SubassemblyViewing {
  progress: number; exploded: boolean; windowOpen: boolean; cutaway: boolean; hidden: CatioLayer[]; view: CatioView;
  /** The design's door shown open (`doorToggle`). */
  doorOpen: boolean;
}

/** How a view starts: at its last stage, assembled, from outside. */
export function defaultViewing<C extends object, S>(definition: SubassemblyDefinition<C, S>, last: number): SubassemblyViewing {
  return { progress: last, exploded: false, windowOpen: true, cutaway: false, hidden: [], view: 'Exterior', doorOpen: false, ...definition.defaultViewing };
}
