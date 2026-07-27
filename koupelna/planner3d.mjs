/**
 * Planner 3D viewer — Three.js first-person POV (look around standing point).
 * Spec boxes use clear-floor cm: x→X, y→Z, h→Y (up).
 */
import * as THREE from "three";

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

function applyLook(viewer) {
  viewer.camera.rotation.order = "YXZ";
  viewer.camera.rotation.y = viewer.look.yaw;
  viewer.camera.rotation.x = viewer.look.pitch;
  viewer.camera.rotation.z = 0;
}

function lookAtFromEye(viewer, eye, target) {
  const dx = target.x - eye.x;
  const dy = target.y - eye.y;
  const dz = target.z - eye.z;
  // Three.js default forward is -Z; yaw/pitch in YXZ order
  viewer.look.yaw = Math.atan2(-dx, -dz);
  viewer.look.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  const lim = Math.PI * 0.45;
  viewer.look.pitch = Math.max(-lim, Math.min(lim, viewer.look.pitch));
  applyLook(viewer);
}

export function createViewer(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e8eef3");

  const camera = new THREE.PerspectiveCamera(68, 1, 1, 5000);
  camera.rotation.order = "YXZ";
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";
  container.appendChild(canvas);

  const root = new THREE.Group();
  scene.add(root);

  const hemi = new THREE.HemisphereLight(0xf0f4f8, 0x8a9aaa, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.7);
  dir.position.set(400, 600, 200);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  scene.add(dir);

  const viewer = {
    scene,
    camera,
    renderer,
    root,
    container,
    preset: "sofa",
    cameras: {},
    room: { w: 906, d: 333, h: 210 },
    look: { yaw: 0, pitch: 0 },
    raf: 0,
    _ro: null,
    _drag: null,
  };

  const onDown = (e) => {
    viewer._drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = "grabbing";
  };
  const onUp = () => {
    viewer._drag = null;
    canvas.style.cursor = "grab";
  };
  const onMove = (e) => {
    if (!viewer._drag) return;
    const dx = e.clientX - viewer._drag.x;
    const dy = e.clientY - viewer._drag.y;
    viewer._drag.x = e.clientX;
    viewer._drag.y = e.clientY;
    const sens = 0.0045;
    viewer.look.yaw -= dx * sens;
    viewer.look.pitch -= dy * sens;
    const lim = Math.PI * 0.45;
    viewer.look.pitch = Math.max(-lim, Math.min(lim, viewer.look.pitch));
    applyLook(viewer);
  };
  const onWheel = (e) => {
    e.preventDefault();
    const dirV = new THREE.Vector3();
    camera.getWorldDirection(dirV);
    // scroll = krok vpřed/vzad ve směru pohledu (zůstat zhruba ve výšce očí)
    const step = -e.deltaY * 0.12;
    camera.position.addScaledVector(dirV, step);
    // drž výšku očí
    const eyeY = viewer.cameras?.[viewer.preset]?.eye?.y || 180;
    camera.position.y = eyeY;
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  viewer._disposeInput = () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("wheel", onWheel);
  };

  const tick = () => {
    viewer.raf = requestAnimationFrame(tick);
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
  if (cam.fov) {
    viewer.camera.fov = cam.fov;
    viewer.camera.updateProjectionMatrix();
  }
  lookAtFromEye(viewer, eye, target);
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
  viewer._disposeInput?.();
  clearGroup(viewer.root);
  viewer.renderer.dispose();
  viewer.renderer.domElement.remove();
}
