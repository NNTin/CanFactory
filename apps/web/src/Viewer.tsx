import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Box, Eye, EyeOff, Grid2X2, RotateCcw } from 'lucide-react';
import { assemblyOffset, assemblyState, assemblyStops, type Assembly, type AssemblyState } from '@canfactory/contracts';
import { unzipSync } from 'fflate';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import type { ReferenceObject } from './referenceObjects.ts';
import { createStage } from './stage.ts';

/**
 * One mesh to show: STL `bytes`, or a `geometry` built from a library part's dimensions (e.g. a magnet). `reference` marks a
 * real-world object from the assembly (e.g. a lighter), shown in its own colour: it is not printed.
 */
type Part = { name: string; reference?: boolean } & ({ bytes: ArrayBuffer } | { geometry: THREE.BufferGeometry });

interface SceneController {
  /**
   * Replaces every mesh with one per part, auto-arranged in a grid. A single part sits centred, exactly as before. With an
   * assembly, the grid is where the assembly slider starts (see `setProgress`).
   */
  setParts: (parts: Part[], assembly?: Assembly) => LoadedPart[];
  /** Hides the parts with these ids and shows every other one (parts load visible); kept for the parts loaded later. */
  setHidden: (hidden: ReadonlySet<string>) => void;
  /** Places the parts for the assembly slider at `t` (0 = print bed, 1 = assembled); no-op without an assembly. */
  setProgress: (t: number) => void;
  reset: () => void;
  wireframe: (enabled: boolean) => void;
}

/** A part as the viewer shows it, for the parts list: its id (the STL name without `.stl`) and whether it is a reference object. */
interface LoadedPart { id: string; reference: boolean }

const GRID_ROTATION = new THREE.Quaternion();

/** One part's mesh: where it lies on the print bed, and how the assembly slider moves it from there. */
class Placement {
  private readonly rotation = new THREE.Quaternion();
  private readonly position = new THREE.Vector3();
  constructor(readonly id: string, readonly mesh: THREE.Mesh, private readonly grid: THREE.Vector3) {}

  /** Blends from the print bed to the part's (offset) assembled pose while the parts are lifted, then follows the steps. */
  apply(assembly: Assembly, state: AssemblyState) {
    const pose = assembly.poses[this.id];
    if (!pose) { this.mesh.position.copy(this.grid); this.mesh.quaternion.identity(); return; }
    const [rx, ry, rz] = (pose.rotation ?? [0, 0, 0]).map(THREE.MathUtils.degToRad) as [number, number, number];
    this.rotation.setFromEuler(new THREE.Euler(rx, ry, rz, 'ZYX'));
    this.position.fromArray(pose.position).add(new THREE.Vector3().fromArray(assemblyOffset(assembly, this.id, state)));
    this.mesh.quaternion.slerpQuaternions(GRID_ROTATION, this.rotation, state.arrange);
    this.mesh.position.lerpVectors(this.grid, this.position, state.arrange);
  }
}

/** Splits a fetched ZIP into its STL entries, in archive order. Throws if it contains no entries. */
function partsFromZip(bytes: ArrayBuffer): Part[] {
  const entries = unzipSync(new Uint8Array(bytes));
  const parts = Object.entries(entries).map(([name, data]): Part => ({ name, bytes: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) }));
  if (parts.length === 0) throw new Error('The preview archive contained no parts.');
  return parts;
}

/** The caption for slider value `t`: the movement that is playing, or that has just finished at a stop. */
function assemblyCaption(assembly: Assembly, t: number): string {
  if (t <= 0) return 'Parts as printed';
  if (t >= 1) return 'Assembled';
  const segment = Math.ceil(t * (assembly.steps.length + 1) - 1e-6);
  const step = assembly.steps[segment - 2];
  return step ? `Step ${segment - 1} of ${assembly.steps.length} · ${step.title}` : 'Lift and lay out the parts';
}

/**
 * Displays the actual downloadable file(s). Camera controls do not change model dimensions. With an assembly, a slider takes the
 * parts from the print bed to the finished assembly, together with its reference objects (`references`), which are not in the file.
 * Every part is shown by default; the parts list under the slider hides or shows each one (`partTitles` names them).
 */
export function Viewer({ url, format, assembly, references = [], partTitles = {}, onError, onLoaded }: { url: string | null; format: 'stl' | 'zip'; assembly?: Assembly | undefined; references?: ReferenceObject[]; partTitles?: Record<string, string>; onError: (message: string) => void; onLoaded: (url: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneController | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadedParts, setLoadedParts] = useState<LoadedPart[]>([]);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const assemblyRef = useRef(assembly); assemblyRef.current = assembly;
  const referencesRef = useRef(references); referencesRef.current = references;
  const onErrorRef = useRef(onError); onErrorRef.current = onError;
  const onLoadedRef = useRef(onLoaded); onLoadedRef.current = onLoaded;

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const stage = createStage(element, 'Interactive STL preview. Drag to orbit, scroll to zoom, right-drag to pan.');
    if (!stage) { setUnsupported(true); onErrorRef.current('3D preview requires WebGL. Enable browser hardware acceleration and reload.'); return; }
    const { group } = stage;
    const material = new THREE.MeshStandardMaterial({ color: 0xc76743, metalness: 0.06, roughness: 0.58, side: THREE.DoubleSide });
    const referenceMaterial = new THREE.MeshStandardMaterial({ color: 0x3f6ea6, metalness: 0.2, roughness: 0.45, side: THREE.DoubleSide });
    let placements: Placement[] = []; let currentAssembly: Assembly | undefined; let sliderValue = 0;
    let hiddenIds: ReadonlySet<string> = new Set();
    // The visible parts, also on the container (`data-visible-parts`), so the page's tests can see what the scene shows.
    const showParts = () => {
      for (const placement of placements) placement.mesh.visible = !hiddenIds.has(placement.id);
      element.dataset['visibleParts'] = placements.filter(placement => placement.mesh.visible).map(placement => placement.id).join(' ');
    };
    const place = (t: number) => {
      sliderValue = t;
      if (!currentAssembly) return;
      const state = assemblyState(currentAssembly, t);
      for (const placement of placements) placement.apply(currentAssembly, state);
    };
    let geometries: THREE.BufferGeometry[] = [];
    scene.current = {
      reset: stage.reset,
      wireframe(enabled) { material.wireframe = enabled; referenceMaterial.wireframe = enabled; },
      setParts(parts, assembly) {
        group.clear();
        for (const geometry of geometries) geometry.dispose();
        geometries = [];
        const prepared = parts.map(part => {
          const geometry = 'geometry' in part ? part.geometry : new STLLoader().parse(part.bytes);
          geometry.computeVertexNormals(); geometry.computeBoundingBox();
          const bounds = geometry.boundingBox;
          if (!bounds) { geometry.dispose(); return null; }
          return { id: part.name.replace(/\.stl$/i, ''), reference: part.reference === true, geometry, bounds, size: bounds.getSize(new THREE.Vector3()) };
        }).filter(part => part !== null);
        if (prepared.length === 0) throw new Error('The preview contains no visible geometry.');
        geometries = prepared.map(part => part.geometry);
        // Arrange parts on an auto-sized grid, one cell per part, each centred in its cell and standing on the floor (z = 0
        // in the parts' frame); a single part sits centred at the origin.
        const columns = Math.ceil(Math.sqrt(prepared.length));
        const rows = Math.ceil(prepared.length / columns);
        const cell = Math.max(...prepared.map(part => Math.max(part.size.x, part.size.y))) * 1.4;
        const footprintX = columns * cell; const footprintY = rows * cell;
        placements = prepared.map((part, index) => {
          const column = index % columns; const row = Math.floor(index / columns);
          const partMesh = new THREE.Mesh(part.geometry, part.reference ? referenceMaterial : material); partMesh.castShadow = true;
          const grid = new THREE.Vector3(
            (column + 0.5) * cell - footprintX / 2 - (part.bounds.min.x + part.bounds.max.x) / 2,
            footprintY / 2 - (row + 0.5) * cell - (part.bounds.min.y + part.bounds.max.y) / 2,
            -part.bounds.min.z);
          partMesh.position.copy(grid);
          group.add(partMesh);
          return new Placement(part.id, partMesh, grid);
        });
        currentAssembly = assembly;
        // Frame every layout the slider passes through, so that no part leaves the view while scrubbing.
        const frame = new THREE.Box3();
        for (const t of assembly ? [0, 1 / (assemblyStops(assembly) - 1), 1] : [0]) { place(t); group.updateMatrixWorld(true); frame.union(new THREE.Box3().setFromObject(group)); }
        place(sliderValue);
        const frameSize = frame.getSize(new THREE.Vector3());
        const focus = new THREE.Vector3();
        if (assembly) { frame.getCenter(focus); focus.y = 0; }
        stage.frame(Math.max(footprintX, footprintY, frameSize.x, frameSize.y, frameSize.z), frame.max.y, focus);
        showParts();
        return prepared.map(part => ({ id: part.id, reference: part.reference }));
      },
      setProgress: place,
      setHidden(ids) { hiddenIds = ids; showParts(); },
    };
    return () => {
      scene.current = null;
      for (const geometry of geometries) geometry.dispose();
      material.dispose(); referenceMaterial.dispose(); stage.dispose();
    };
  }, []);

  useEffect(() => {
    if (!url) return;
    const abort = new AbortController();
    // Reference objects are static files, or built from their part's dimensions: one that cannot be loaded is left out rather
    // than failing the preview.
    const loadReference = async (reference: ReferenceObject): Promise<Part[]> => {
      if (!('url' in reference)) { const geometry = reference.geometry(); return geometry ? [{ name: reference.id, geometry, reference: true }] : []; }
      const response = await fetch(reference.url, { signal: abort.signal });
      return response.ok ? [{ name: `${reference.id}.stl`, bytes: await response.arrayBuffer(), reference: true }] : [];
    };
    const loadReferences = format === 'zip' && assemblyRef.current
      ? Promise.all(referencesRef.current.map(reference => loadReference(reference).catch((): Part[] => []))).then(loaded => loaded.flat()) : Promise.resolve([]);
    void fetch(url, { signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error('The preview file is unavailable. Generate it again.');
      const bytes = await response.arrayBuffer();
      const extra = await loadReferences;
      if (abort.signal.aborted) return;
      const loaded = scene.current?.setParts(format === 'zip' ? [...partsFromZip(bytes), ...extra] : [{ name: 'model', bytes }], format === 'zip' ? assemblyRef.current : undefined);
      if (loaded) setLoadedParts(format === 'zip' ? loaded : []);
      if (scene.current) onLoadedRef.current(url);
    }).catch((error: unknown) => {
      if (!abort.signal.aborted) onErrorRef.current(error instanceof Error ? error.message : 'Could not load the preview.');
    });
    return () => abort.abort();
  }, [url, format]);

  useEffect(() => { scene.current?.setProgress(progress); }, [progress]);
  useEffect(() => { scene.current?.setHidden(hidden); }, [hidden]);
  const toggle = (id: string) => setHidden(current => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const stops = assembly ? assemblyStops(assembly) - 1 : 1;
  // Arrow keys and Page Up/Down jump between the stops; Home and End keep their native meaning.
  const stepSlider = (event: KeyboardEvent<HTMLInputElement>) => {
    const direction = { ArrowRight: 1, ArrowUp: 1, PageUp: 1, ArrowLeft: -1, ArrowDown: -1, PageDown: -1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    const stop = direction > 0 ? Math.floor(progress * stops + 1e-6) + 1 : Math.ceil(progress * stops - 1e-6) - 1;
    setProgress(Math.min(stops, Math.max(0, stop)) / stops);
  };

  return <>
    <div className="viewer-content">
      <div ref={container} className="canvas-container" data-testid="stl-viewer" />
      {!url && !unsupported && <div className="viewer-placeholder"><Box size={32} strokeWidth={1} /><span>Preparing your first preview</span></div>}
      {unsupported && <div className="viewer-placeholder"><span>3D preview is unavailable in this browser.</span></div>}
      <div className="viewer-tools">
        <button type="button" onClick={() => scene.current?.reset()} title="Reset camera" aria-label="Reset camera"><RotateCcw size={17} /></button>
        <button type="button" aria-label="Toggle wireframe" aria-pressed={wireframe} title="Toggle wireframe" onClick={() => { setWireframe(value => !value); scene.current?.wireframe(!wireframe); }}><Grid2X2 size={17} /></button>
      </div>
      <div className="viewer-instructions"><span>Drag to orbit</span><i /><span>Scroll to zoom</span><i /><span>Right-drag to pan</span></div>
      <div className="axis-label"><span className="axis-x">X</span><span className="axis-y">Y</span><span className="axis-z">Z</span></div>
    </div>
    {assembly && format === 'zip' && url && <div className="assembly-bar">
      <div className="assembly-caption"><span>ASSEMBLY</span><strong aria-hidden="true">{assemblyCaption(assembly, progress)}</strong></div>
      <div className="assembly-track">
        <input type="range" min={0} max={1} step={0.001} value={progress} aria-label="Assembly" aria-valuetext={assemblyCaption(assembly, progress)}
          onChange={event => setProgress(Number(event.currentTarget.value))} onKeyDown={stepSlider} />
        <div className="assembly-stops" aria-hidden="true">{Array.from({ length: stops + 1 }, (_, index) => <i key={index} className={progress * stops >= index - 1e-6 ? 'reached' : ''} />)}</div>
      </div>
    </div>}
    {assembly && format === 'zip' && url && loadedParts.length > 0 && <div className="assembly-parts" role="group" aria-label="Visible parts">
      <span>PARTS</span>
      <div>{loadedParts.map(part => {
        const visible = !hidden.has(part.id);
        const title = partTitles[part.id] ?? part.id;
        return <button key={part.id} type="button" className={part.reference ? 'reference' : undefined} aria-pressed={visible}
          title={`${visible ? 'Hide' : 'Show'} ${title}`} onClick={() => toggle(part.id)}>
          {visible ? <Eye size={13} aria-hidden="true" /> : <EyeOff size={13} aria-hidden="true" />}{title}
        </button>;
      })}</div>
    </div>}
  </>;
}
