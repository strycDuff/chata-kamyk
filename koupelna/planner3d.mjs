/**
 * Planner 3D viewer — Three.js + OrbitControls (CDN ESM).
 * Spec boxes use clear-floor cm: x→X, y→Z, h→Y (up).
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.05,
    transparent: !!opts.opacity && opts.opacity < 1,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

function addBox(group, { x, y, w, d, h, color, opacity, elev }) {
  if (w <= 0 || d <= 0 || h <= 0) return;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat(color || "#94a3b8", { opacity })
  );
  const y0 = Number(elev) || 0;
  mesh.position.set(x + w / 2, y0 + h / 2, y + d / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function clearGroup(group) {
  while (group.children.length) {
    const ch = group.children[0];
    group.remove(ch);
    ch.geometry?.dispose?.();
    if (ch.material) {
      if (Array.isArray(ch.material)) ch.material.forEach((m) => m.dispose());
      else ch.material.dispose();
    }
  }
}

export function createViewer(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e8eef3");

  const camera = new THREE.PerspectiveCamera(50, 1, 1, 5000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const root = new THREE.Group();
  scene.add(root);

  const hemi = new THREE.HemisphereLight(0xf0f4f8, 0x8a9aaa, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(400, 600, 200);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 10;
  dir.shadow.camera.far = 2500;
  dir.shadow.camera.left = -600;
  dir.shadow.camera.right = 600;
  dir.shadow.camera.top = 600;
  dir.shadow.camera.bottom = -600;
  scene.add(dir);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 40;
  controls.maxDistance = 2200;

  const viewer = {
    scene,
    camera,
    renderer,
    controls,
    root,
    container,
    preset: "sofa",
    cameras: {},
    room: { w: 906, d: 333, h: 210 },
    raf: 0,
    _ro: null,
  };

  const tick = () => {
    viewer.raf = requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
  };
  tick();

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  viewer._ro = new ResizeObserver(resize);
  viewer._ro.observe(container);
  resize();

  return viewer;
}

/** eye/target: {x, y, z} in Three space (Y up). */
export function setCameraView(viewer, name) {
  const cam = viewer.cameras?.[name] || viewer.cameras?.sofa;
  if (!cam?.eye || !cam?.target) return;
  viewer.preset = name;
  const { eye, target } = cam;
  viewer.camera.position.set(eye.x, eye.y, eye.z);
  viewer.controls.target.set(target.x, target.y, target.z);
  if (cam.fov) {
    viewer.camera.fov = cam.fov;
    viewer.camera.updateProjectionMatrix();
  }
  viewer.controls.update();
}

export function rebuild(viewer, spec, { applyCamera = false } = {}) {
  clearGroup(viewer.root);
  const roomH = spec.roomH || 210;
  const clearW = spec.clearW || 906;
  const clearD = spec.clearH || 333;
  viewer.room = { w: clearW, d: clearD, h: roomH };
  viewer.cameras = spec.cameras || {};

  addBox(viewer.root, {
    x: 0, y: 0, w: clearW, d: clearD, h: 2,
    color: "#dfe6e9",
  });

  for (const b of spec.boxes || []) {
    addBox(viewer.root, b);
  }

  if (applyCamera) setCameraView(viewer, viewer.preset || "sofa");
}

export function dispose(viewer) {
  if (!viewer) return;
  cancelAnimationFrame(viewer.raf);
  viewer._ro?.disconnect();
  viewer.controls.dispose();
  clearGroup(viewer.root);
  viewer.renderer.dispose();
  viewer.renderer.domElement.remove();
}
