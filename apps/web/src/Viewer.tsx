import { useEffect, useRef, useState } from 'react';
import { Box, Grid2X2, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

interface SceneController {
  setGeometry: (bytes: ArrayBuffer) => void;
  reset: () => void;
  wireframe: (enabled: boolean) => void;
}

/** Displays the actual downloadable STL. Camera controls do not change model dimensions. */
export function Viewer({ url, onError, onLoaded }: { url: string | null; onError: (message: string) => void; onLoaded: (url: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneController | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const onErrorRef = useRef(onError); onErrorRef.current = onError;
  const onLoadedRef = useRef(onLoaded); onLoadedRef.current = onLoaded;

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setUnsupported(true); onErrorRef.current('3D preview requires WebGL. Enable browser hardware acceleration and reload.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0xf0f0e9, 1);
    renderer.domElement.setAttribute('aria-label', 'Interactive STL preview. Drag to orbit, scroll to zoom, right-drag to pan.');
    renderer.domElement.setAttribute('role', 'img');
    element.appendChild(renderer.domElement);
    const world = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 10000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.075;
    controls.minDistance = 10; controls.maxDistance = 2000;
    const ambient = new THREE.HemisphereLight(0xffffff, 0xa1a797, 2.3); world.add(ambient);
    const light = new THREE.DirectionalLight(0xfff7ec, 3.5);
    light.position.set(-120, 200, 100); light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -250; light.shadow.camera.right = 250;
    light.shadow.camera.top = 250; light.shadow.camera.bottom = -250;
    light.shadow.camera.far = 1000; light.shadow.bias = -0.0005;
    world.add(light);
    const fill = new THREE.DirectionalLight(0xffffff, 1.5); fill.position.set(120, 40, -100); world.add(fill);
    const material = new THREE.MeshStandardMaterial({ color: 0xc76743, metalness: 0.06, roughness: 0.58, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material); mesh.castShadow = true; world.add(mesh);
    const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), floorMaterial);
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.06; floor.receiveShadow = true; world.add(floor);
    const grid = new THREE.GridHelper(600, 60, 0xd1d4c9, 0xe1e2d9); grid.position.y = -0.1; world.add(grid);
    let extent = 100; let height = 60; let first = true;
    const reset = () => {
      camera.position.set(extent * 1.55, extent * 1.18, extent * 1.85);
      controls.target.set(0, height * 0.42, 0); controls.update();
    };
    reset();
    scene.current = {
      reset,
      wireframe(enabled) { material.wireframe = enabled; },
      setGeometry(bytes) {
        const geometry = new STLLoader().parse(bytes);
        geometry.rotateX(-Math.PI / 2); geometry.computeVertexNormals(); geometry.computeBoundingBox();
        const bounds = geometry.boundingBox;
        if (!bounds) { geometry.dispose(); throw new Error('The STL contains no visible geometry.'); }
        const size = bounds.getSize(new THREE.Vector3());
        geometry.translate(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
        mesh.geometry.dispose(); mesh.geometry = geometry;
        const oldExtent = extent; extent = Math.max(size.x, size.y, size.z); height = size.y;
        if (first || extent > oldExtent * 1.5 || extent < oldExtent / 2) reset();
        first = false;
      },
    };
    const resize = new ResizeObserver(() => {
      const width = element.clientWidth; const height = element.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
    });
    resize.observe(element);
    let animation = 0;
    const frame = () => { animation = requestAnimationFrame(frame); controls.update(); renderer.render(world, camera); };
    frame();
    return () => {
      scene.current = null; resize.disconnect(); cancelAnimationFrame(animation); controls.dispose();
      mesh.geometry.dispose(); material.dispose(); floor.geometry.dispose(); floorMaterial.dispose(); grid.geometry.dispose();
      grid.material.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    if (!url) return;
    const abort = new AbortController();
    void fetch(url, { signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error('The preview file is unavailable. Generate it again.');
      const bytes = await response.arrayBuffer();
      if (abort.signal.aborted) return;
      scene.current?.setGeometry(bytes);
      if (scene.current) onLoadedRef.current(url);
    }).catch((error: unknown) => {
      if (!abort.signal.aborted) onErrorRef.current(error instanceof Error ? error.message : 'Could not load the STL preview.');
    });
    return () => abort.abort();
  }, [url]);

  return <div className="viewer-content">
    <div ref={container} className="canvas-container" data-testid="stl-viewer" />
    {!url && !unsupported && <div className="viewer-placeholder"><Box size={32} strokeWidth={1} /><span>Preparing your first preview</span></div>}
    {unsupported && <div className="viewer-placeholder"><span>3D preview is unavailable in this browser.</span></div>}
    <div className="viewer-tools">
      <button type="button" onClick={() => scene.current?.reset()} title="Reset camera" aria-label="Reset camera"><RotateCcw size={17} /></button>
      <button type="button" aria-label="Toggle wireframe" aria-pressed={wireframe} title="Toggle wireframe" onClick={() => { setWireframe(value => !value); scene.current?.wireframe(!wireframe); }}><Grid2X2 size={17} /></button>
    </div>
    <div className="viewer-instructions"><span>Drag to orbit</span><i /><span>Scroll to zoom</span><i /><span>Right-drag to pan</span></div>
    <div className="axis-label"><span className="axis-x">X</span><span className="axis-y">Y</span><span className="axis-z">Z</span></div>
  </div>;
}
