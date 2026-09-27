import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** The 3D scene both previews share: lights, the floor with its grid, an orbit camera, and `group`, which holds the meshes. */
export interface Stage {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  /** Meshes keep their SCAD frame (Z up) inside `group`, which turns it to the scene's Y up. */
  group: THREE.Group;
  /**
   * Frames content `extent` wide and `height` tall around `focus`: the camera moves only the first time, or when the size
   * changes a lot, so that small changes keep the user's view.
   */
  frame: (extent: number, height: number, focus: THREE.Vector3) => void;
  reset: () => void;
  dispose: () => void;
}

/** Sets up the stage in `element` and keeps it sized to it; null when WebGL is unavailable. */
export function createStage(element: HTMLElement, label: string): Stage | null {
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0xf0f0e9, 1);
  renderer.domElement.setAttribute('aria-label', label);
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
  const group = new THREE.Group(); group.rotation.x = -Math.PI / 2; world.add(group);
  const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.1 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), floorMaterial);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.06; floor.receiveShadow = true; world.add(floor);
  const grid = new THREE.GridHelper(600, 60, 0xd1d4c9, 0xe1e2d9); grid.position.y = -0.1; world.add(grid);
  let extent = 100; let height = 60; let first = true; const focus = new THREE.Vector3();
  const reset = () => {
    camera.position.set(focus.x + extent * 1.55, extent * 1.18, focus.z + extent * 1.85);
    controls.target.set(focus.x, height * 0.42, focus.z); controls.update();
  };
  reset();
  const resize = new ResizeObserver(() => {
    const width = element.clientWidth; const clientHeight = element.clientHeight;
    if (!width || !clientHeight) return;
    renderer.setSize(width, clientHeight); camera.aspect = width / clientHeight; camera.updateProjectionMatrix();
  });
  resize.observe(element);
  let animation = 0;
  const loop = () => { animation = requestAnimationFrame(loop); controls.update(); renderer.render(world, camera); };
  loop();
  return {
    renderer, camera, group, reset,
    frame(nextExtent, nextHeight, nextFocus) {
      const oldExtent = extent; extent = nextExtent; height = nextHeight; focus.copy(nextFocus);
      if (first || extent > oldExtent * 1.5 || extent < oldExtent / 2) reset();
      first = false;
    },
    dispose() {
      resize.disconnect(); cancelAnimationFrame(animation); controls.dispose();
      floor.geometry.dispose(); floorMaterial.dispose(); grid.geometry.dispose(); grid.material.dispose();
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
