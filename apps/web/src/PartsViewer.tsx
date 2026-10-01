import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Box, RotateCcw } from 'lucide-react';
import type { Part } from '@canfactory/contracts';
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { partGeometry } from './partGeometry.ts';
import { partStlUrl } from './referenceObjects.ts';
import { createStage, smoothNormals } from './stage.ts';

/** At most this many parts are shown at once; the page asks to filter for more. */
export const VIEWER_LIMIT = 48;

const HOVER = new THREE.Color(0xbd5839);
const SELECTED = new THREE.Color(0x6e7f58);

interface Scene {
  setParts: (parts: { part: Part; geometry: THREE.BufferGeometry }[]) => void;
  /** Lights up the hovered part (strongly) and the selected one (softly). */
  highlight: (hovered: string | null, selected: string | null) => void;
  /** The id of the part under this point of the canvas (client coordinates), if any. */
  pick: (x: number, y: number) => string | null;
  reset: () => void;
}

/** Loads a part's geometry: built from its dimensions, or its bundled STL. */
async function load(part: Part, signal: AbortSignal): Promise<THREE.BufferGeometry | null> {
  const built = partGeometry(part);
  if (built) return built;
  const url = partStlUrl(part);
  if (!url) return null;
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  return smoothNormals(new STLLoader().parse(await response.arrayBuffer()));
}

/**
 * The parts library's live preview: every listed part side by side, true to size. Hovering one (here or in the list, through
 * `hovered`) highlights it and names it: its title and description show beside the pointer and under the preview, so that it is
 * always clear which exact part is being looked at. Clicking one selects it.
 */
export function PartsViewer({ parts, hovered, selected, onHover, onSelect }: {
  parts: Part[]; hovered: string | null; selected: string | null; onHover: (id: string | null) => void; onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const down = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const stage = createStage(element, 'Interactive preview of the listed parts, true to size. Hover a part to see what it is; drag to orbit, scroll to zoom.');
    if (!stage) { setUnsupported(true); return; }
    let meshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
    const raycaster = new THREE.Raycaster();
    const clear = () => {
      for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose(); }
      stage.group.clear(); meshes = [];
    };
    scene.current = {
      reset: stage.reset,
      setParts(loaded) {
        clear();
        const prepared = loaded.map(({ part, geometry }) => {
          geometry.computeBoundingBox();
          const bounds = geometry.boundingBox ?? new THREE.Box3();
          return { part, geometry, bounds, size: bounds.getSize(new THREE.Vector3()) };
        });
        // Side by side on a grid in list order, each standing on the floor, one cell per part; one part sits at the centre.
        const columns = Math.ceil(Math.sqrt(prepared.length));
        const rows = Math.ceil(prepared.length / columns);
        const cell = Math.max(4, ...prepared.map(item => Math.max(item.size.x, item.size.y))) * 1.5;
        meshes = prepared.map(({ part, geometry, bounds }, index) => {
          const reference = part.preview.kind === 'stl';
          const material = new THREE.MeshStandardMaterial({
            vertexColors: !reference, color: reference ? 0x3f6ea6 : 0xffffff, metalness: reference ? 0.2 : 0.35, roughness: 0.45, side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true; mesh.name = part.id;
          mesh.position.set(
            ((index % columns) + 0.5) * cell - columns * cell / 2 - (bounds.min.x + bounds.max.x) / 2,
            rows * cell / 2 - (Math.floor(index / columns) + 0.5) * cell - (bounds.min.y + bounds.max.y) / 2,
            -bounds.min.z);
          stage.group.add(mesh);
          return mesh;
        });
        stage.group.updateMatrixWorld(true);
        const frame = new THREE.Box3().setFromObject(stage.group);
        const size = frame.getSize(new THREE.Vector3());
        // A little further back than the model preview: a single tall part (a lighter) must fit under the heading.
        stage.frame(Math.max(size.x, size.y, size.z * 1.3, 12), Math.max(frame.max.y, 4), new THREE.Vector3());
        element.dataset['parts'] = meshes.map(mesh => mesh.name).join(' ');
      },
      highlight(hoveredId, selectedId) {
        for (const mesh of meshes) {
          const [color, intensity] = mesh.name === hoveredId ? [HOVER, 0.55] : mesh.name === selectedId ? [SELECTED, 0.35] : [null, 0];
          mesh.material.emissive.copy(color ?? new THREE.Color(0)); mesh.material.emissiveIntensity = intensity;
        }
        element.dataset['highlighted'] = hoveredId ?? '';
      },
      pick(x, y) {
        const rect = stage.renderer.domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        raycaster.setFromCamera(new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1), stage.camera);
        return raycaster.intersectObjects(meshes, false)[0]?.object.name ?? null;
      },
    };
    return () => { scene.current = null; clear(); stage.dispose(); };
  }, []);

  const ids = parts.map(part => part.id).join(' ');
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    void Promise.all(parts.map(async part => {
      const geometry = await load(part, abort.signal).catch(() => null);
      return geometry ? [{ part, geometry }] : [];
    })).then(loaded => {
      if (abort.signal.aborted) { for (const { geometry } of loaded.flat()) geometry.dispose(); return; }
      scene.current?.setParts(loaded.flat()); setLoading(false);
    });
    return () => abort.abort();
    // `ids` stands for `parts`: the scene is rebuilt only when the listed parts change.
  }, [ids]);
  useEffect(() => { scene.current?.highlight(hovered, selected); }, [hovered, selected, ids, loading]);

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 0) return;
    const id = scene.current?.pick(event.clientX, event.clientY) ?? null;
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer(id ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
    if (id !== hovered) onHover(id);
  };
  const leave = () => { setPointer(null); if (hovered) onHover(null); };
  const release = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = down.current; down.current = null;
    // A click, not the end of a drag that orbited the camera.
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return;
    const id = scene.current?.pick(event.clientX, event.clientY);
    if (id) onSelect(id);
  };
  const shown = parts.find(part => part.id === hovered) ?? parts.find(part => part.id === selected);

  return <div className="parts-viewer">
    <div className="viewer-content" onPointerMove={move} onPointerLeave={leave} onPointerDown={event => { down.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={release}>
      <div ref={container} className="canvas-container" data-testid="parts-viewer" />
      {unsupported && <div className="viewer-placeholder"><span>3D preview is unavailable in this browser.</span></div>}
      {!unsupported && loading && <div className="viewer-placeholder"><Box size={32} strokeWidth={1} /><span>Preparing the parts</span></div>}
      <div className="viewer-tools">
        <button type="button" onClick={() => scene.current?.reset()} title="Reset camera" aria-label="Reset camera"><RotateCcw size={17} /></button>
      </div>
      {pointer && hovered && shown?.id === hovered && <div className="part-tooltip" role="tooltip" style={{ left: pointer.x, top: pointer.y }}>
        <strong>{shown.title}</strong><span>{shown.designation}</span><p>{shown.description}</p>
      </div>}
    </div>
    <div className="part-caption" aria-live="polite" data-testid="part-caption">
      {shown ? <><strong>{shown.title} <span>{shown.designation}</span></strong><p>{shown.description}</p></>
        : <p>Hover a part, here or in the list, to see exactly what it is. Click it for its dimensions and sources.</p>}
    </div>
  </div>;
}
