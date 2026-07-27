/**
 * Planner 3D viewer — Three.js first-person POV (look around standing point).
 * Spec boxes use clear-floor cm: x→X, y→Z, h→Y (up).
 * Optional rotX/rotY/rotZ (radians) rotate around box center after placement.
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

function addBox(group, { x, y, w, d, h, color, opacity, elev, rotX, rotY, rotZ }) {
  if (w <= 0 || d <= 0 || h <= 0) return;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat(color || "#94a3b8", { opacity })
  );
  const y0 = Number(elev) || 0;
  mesh.position.set(x + w / 2, y0 + h / 2, y + d / 2);
  if (rotX) mesh.rotation.x = rotX;
  if (rotY) mesh.rotation.y = rotY;
  if (rotZ) mesh.rotation.z = rotZ;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

/**
 * Oriented timber: center at (cx, cy, cz), local size w×h×d along local axes,
 * then Euler YXZ rotation (radians).
 */
function addOrientedBox(group, { cx, cy, cz, w, h, d, color, opacity, rotX, rotY, rotZ }) {
  if (w <= 0 || d <= 0 || h <= 0) return;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat(color || "#94a3b8", { opacity })
  );
  mesh.position.set(cx, cy, cz);
  mesh.rotation.order = "YXZ";
  if (rotY) mesh.rotation.y = rotY;
  if (rotX) mesh.rotation.x = rotX;
  if (rotZ) mesh.rotation.z = rotZ;
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
  const lim = Math.PI * 0.48;
  viewer.look.pitch = Math.max(-lim, Math.min(lim, viewer.look.pitch));
  applyLook(viewer);
}

export function createViewer(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#e8eef3");

  const camera = new THREE.PerspectiveCamera(68, 1, 1, 8000);
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

  const hemi = new THREE.HemisphereLight(0xf0f4f8, 0x8a9aaa, 0.95);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.75);
  dir.position.set(400, 800, 200);
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
    keys: new Set(),
    raf: 0,
    _ro: null,
    _drag: null,
  };

  const eyeY = () => viewer.cameras?.[viewer.preset]?.eye?.y || 180;

  const moveBy = (forward, strafe) => {
    if (!forward && !strafe) return;
    const forwardV = new THREE.Vector3();
    camera.getWorldDirection(forwardV);
    forwardV.y = 0;
    if (forwardV.lengthSq() < 1e-6) forwardV.set(0, 0, -1);
    forwardV.normalize();
    const rightV = new THREE.Vector3().crossVectors(forwardV, new THREE.Vector3(0, 1, 0)).normalize();
    camera.position.addScaledVector(forwardV, forward);
    camera.position.addScaledVector(rightV, strafe);
    camera.position.y = eyeY();
    // světlost uvnitř; venku před jižní stěnou — širší plocha kolem vchodu
    const m = 15;
    const door = viewer.room.door;
    const outD = Math.max(0, Number(viewer.room.outsideDepth) || 0);
    const outPadX = Math.max(80, Number(viewer.room.outsidePadX) || 180);
    let x = camera.position.x;
    let z = camera.position.z;
    const doorPad = 35;
    const southInside = viewer.room.d - m;
    const inDoorX = door
      && x >= door.x0 - doorPad
      && x <= door.x1 + doorPad;
    const isOutside = z > southInside;
    if (isOutside && outD > 0) {
      // venku — celá šířka chaty + boční přesahy
      x = Math.min(viewer.room.w + outPadX - m, Math.max(-outPadX + m, x));
      z = Math.min(viewer.room.d + outD, Math.max(southInside, z));
    } else {
      x = Math.min(viewer.room.w - m, Math.max(m, x));
      const zMax = (inDoorX && outD > 0) ? viewer.room.d + outD : southInside;
      z = Math.min(zMax, Math.max(m, z));
    }
    camera.position.x = x;
    camera.position.z = z;
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
    const lim = Math.PI * 0.48;
    viewer.look.pitch = Math.max(-lim, Math.min(lim, viewer.look.pitch));
    applyLook(viewer);
  };
  const onWheel = (e) => {
    e.preventDefault();
    moveBy(-e.deltaY * 0.12, 0);
  };
  const isTypingTarget = (t) =>
    t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
  const onKeyDown = (e) => {
    if (isTypingTarget(e.target)) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      viewer.keys.add(e.key);
    }
  };
  const onKeyUp = (e) => {
    viewer.keys.delete(e.key);
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  viewer._disposeInput = () => {
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("wheel", onWheel);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };

  const tick = () => {
    viewer.raf = requestAnimationFrame(tick);
    const speed = 4.2; // cm / frame @60fps ≈ 2.5 m/s
    let fwd = 0;
    let strafe = 0;
    if (viewer.keys.has("ArrowUp")) fwd += speed;
    if (viewer.keys.has("ArrowDown")) fwd -= speed;
    if (viewer.keys.has("ArrowLeft")) strafe -= speed;
    if (viewer.keys.has("ArrowRight")) strafe += speed;
    if (fwd || strafe) moveBy(fwd, strafe);
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
  const walk = spec.walk || {};
  viewer.room = {
    w: clearW,
    d: clearD,
    h: roomH,
    door: walk.door || null,
    outsideDepth: walk.outsideDepth || 0,
    outsidePadX: walk.outsidePadX || 0,
  };
  viewer.cameras = spec.cameras || {};

  addBox(viewer.root, {
    x: 0, y: 0, w: clearW, d: clearD, h: 2,
    color: "#dfe6e9",
  });

  for (const b of spec.boxes || []) {
    if (b.oriented) {
      addOrientedBox(viewer.root, b);
    } else {
      addBox(viewer.root, b);
    }
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
