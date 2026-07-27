/**
 * Planner 3D viewer — Three.js first-person POV (look around standing point).
 * Spec boxes use clear-floor cm: x→X, y→Z, h→Y (up).
 * Optional rotX/rotY/rotZ (radians) rotate around box center after placement.
 * Optional matKind: "wood" | "wall" | "floor" | "furniture" | "covering"
 * Optional textures: { wood, wall, floor, furniture, covering } booleans.
 */
import * as THREE from "three";

const TEX_CACHE = new Map();

function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function canvasTex(key, draw, size = 256) {
  if (TEX_CACHE.has(key)) return TEX_CACHE.get(key);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData.cached = true;
  TEX_CACHE.set(key, tex);
  return tex;
}

function woodMap() {
  return canvasTex("wood", (ctx, s) => {
    const img = ctx.createImageData(s, s);
    const data = img.data;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const wobble = Math.sin(x * 0.08) * 3 + Math.sin(x * 0.31) * 1.5;
        const n = hash2(x * 0.04, y * 0.9 + wobble);
        const ring = ((y + wobble * 2) % 18 < 1) ? -0.08 : 0;
        const shade = 0.82 + n * 0.28 + ring;
        const i = (y * s + x) * 4;
        data[i] = Math.floor(160 * shade);
        data[i + 1] = Math.floor(120 * shade);
        data[i + 2] = Math.floor(70 * shade);
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 12; i++) {
      const x0 = (i / 12) * s + hash2(i, 2) * 8;
      ctx.strokeStyle = "#5c3d1e";
      ctx.lineWidth = 1 + hash2(i, 9) * 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      for (let y = 0; y <= s; y += 8) ctx.lineTo(x0 + Math.sin(y * 0.05 + i) * 4, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

function wallMap() {
  return canvasTex("wall", (ctx, s) => {
    ctx.fillStyle = "#d8dde2";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      const x = (hash2(i, 1) * s) | 0;
      const y = (hash2(i, 2) * s) | 0;
      const v = 200 + ((hash2(i, 3) * 40) | 0);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
      ctx.fillRect(x, y, 1 + (hash2(i, 4) > 0.85 ? 1 : 0), 1);
    }
  }, 128);
}

function floorMap() {
  return canvasTex("floor", (ctx, s) => {
    const plank = 28;
    for (let y = 0; y < s; y += plank) {
      const row = (y / plank) | 0;
      for (let x = 0; x < s; x++) {
        const n = hash2(x * 0.07 + row * 3, y * 0.02);
        const base = row % 2 === 0 ? 168 : 155;
        const shade = 0.9 + n * 0.2;
        const r = Math.floor(base * shade);
        const g = Math.floor((base - 35) * shade);
        const b = Math.floor((base - 70) * shade);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, plank - 1);
      }
      ctx.fillStyle = "#6b4f32";
      ctx.fillRect(0, y + plank - 1, s, 1);
    }
    ctx.fillStyle = "rgba(80,50,20,0.12)";
    for (let x = 40; x < s; x += 52) ctx.fillRect(x, 0, 1, s);
  });
}

function furnitureMap() {
  return canvasTex("furniture", (ctx, s) => {
    ctx.fillStyle = "#6d7b88";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = hash2(x * 0.2, y * 0.2);
        if (n > 0.55) {
          const v = 90 + ((n * 50) | 0);
          ctx.fillStyle = `rgb(${v},${v + 8},${v + 12})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i < s; i += 6) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(s, i + 2);
      ctx.stroke();
    }
  }, 128);
}

function coveringMap() {
  return canvasTex("covering", (ctx, s) => {
    ctx.fillStyle = "#6b2a1f";
    ctx.fillRect(0, 0, s, s);
    const rib = 10;
    for (let x = 0; x < s; x += rib) {
      const grad = ctx.createLinearGradient(x, 0, x + rib, 0);
      grad.addColorStop(0, "#5a2218");
      grad.addColorStop(0.35, "#8a3a28");
      grad.addColorStop(0.55, "#4a1a12");
      grad.addColorStop(1, "#5a2218");
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, rib, s);
    }
    ctx.fillStyle = "rgba(255,220,180,0.08)";
    for (let y = 0; y < s; y += 32) ctx.fillRect(0, y, s, 1);
  }, 128);
}

function yardMap() {
  return canvasTex("yard", (ctx, s) => {
    ctx.fillStyle = "#9aa7ad";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 6000; i++) {
      const x = (hash2(i, 5) * s) | 0;
      const y = (hash2(i, 6) * s) | 0;
      const v = 140 + ((hash2(i, 7) * 50) | 0);
      ctx.fillStyle = `rgb(${v},${v + 4},${v - 6})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }, 128);
}

function texForKind(kind) {
  if (kind === "wood") return woodMap();
  if (kind === "wall") return wallMap();
  if (kind === "floor") return floorMap();
  if (kind === "furniture") return furnitureMap();
  if (kind === "covering") return coveringMap();
  if (kind === "yard") return yardMap();
  return null;
}

function cmPerTile(kind) {
  if (kind === "wood") return 45;
  if (kind === "floor") return 55;
  if (kind === "covering") return 35;
  if (kind === "furniture") return 40;
  if (kind === "yard") return 80;
  return 60; // wall
}

function matOptsForKind(kind) {
  if (kind === "wood") return { roughness: 0.72, metalness: 0.02 };
  if (kind === "covering") return { roughness: 0.45, metalness: 0.35 };
  if (kind === "floor") return { roughness: 0.78, metalness: 0.02 };
  if (kind === "furniture") return { roughness: 0.88, metalness: 0.04 };
  if (kind === "yard") return { roughness: 0.95, metalness: 0 };
  return { roughness: 0.9, metalness: 0.02 }; // wall
}

function applyUvRepeat(map, kind, sx, sy) {
  if (!map) return;
  const tile = cmPerTile(kind);
  const mx = map.clone();
  mx.wrapS = THREE.RepeatWrapping;
  mx.wrapT = THREE.RepeatWrapping;
  mx.colorSpace = THREE.SRGBColorSpace;
  mx.repeat.set(Math.max(0.5, sx / tile), Math.max(0.5, sy / tile));
  mx.needsUpdate = true;
  return mx;
}

function mat(color, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0.05,
    transparent: !!opts.opacity && opts.opacity < 1,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
  if (opts.map) {
    m.map = opts.map;
    m.color = new THREE.Color(opts.mapTint || "#ffffff");
  }
  return m;
}

function resolveMaterial(box, textures, sizeHint) {
  const kind = box.matKind;
  const enabled = kind && textures && textures[kind];
  const base = matOptsForKind(kind || "wall");
  const side = box.doubleSide ? THREE.DoubleSide : THREE.FrontSide;
  if (!enabled) {
    return mat(box.color || "#94a3b8", {
      opacity: box.opacity,
      side,
      roughness: base.roughness,
      metalness: base.metalness,
    });
  }
  const src = texForKind(kind);
  const map = applyUvRepeat(src, kind, sizeHint.u, sizeHint.v);
  // Keep a hint of original color via slight tint for furniture variants
  const tint = kind === "furniture" || kind === "wood" ? box.color : "#ffffff";
  return mat(box.color || "#94a3b8", {
    opacity: box.opacity,
    side,
    roughness: base.roughness,
    metalness: base.metalness,
    map,
    mapTint: tint && kind === "furniture" ? tint : "#ffffff",
  });
}

function addBox(group, box, textures) {
  const { x, y, w, d, h, elev, rotX, rotY, rotZ } = box;
  if (w <= 0 || d <= 0 || h <= 0) return;
  // UV: largest face-ish — wall uses height×length
  const sizeHint = { u: Math.max(w, d), v: Math.max(h, d) };
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    resolveMaterial(box, textures, sizeHint)
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
function addOrientedBox(group, box, textures) {
  const { cx, cy, cz, w, h, d, rotX, rotY, rotZ } = box;
  if (w <= 0 || d <= 0 || h <= 0) return;
  const sizeHint = { u: Math.max(w, d), v: Math.max(h, d) };
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    resolveMaterial(box, textures, sizeHint)
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
      const mats = Array.isArray(ch.material) ? ch.material : [ch.material];
      for (const m of mats) {
        if (m.map && !m.map.userData?.cached) {
          try { m.map.dispose(); } catch { /* ignore */ }
        }
        m.dispose();
      }
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

  const hemi = new THREE.HemisphereLight(0xf0f4f8, 0x7a8a98, 0.32);
  scene.add(hemi);
  // Slunce z SZ — sklon střechy + exteriér
  const dir = new THREE.DirectionalLight(0xfff8f0, 0.95);
  dir.position.set(-280, 920, -420);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 50;
  dir.shadow.camera.far = 2500;
  dir.shadow.camera.left = -800;
  dir.shadow.camera.right = 800;
  dir.shadow.camera.top = 800;
  dir.shadow.camera.bottom = -800;
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xdde8f5, 0.18);
  fill.position.set(420, 380, 520);
  scene.add(fill);

  // Interiérové lampy — stíny i pod krytinou (slunce neprojde střešním pláštěm)
  const lampA = new THREE.PointLight(0xfff1dd, 1.15, 780, 1.55);
  lampA.castShadow = true;
  lampA.shadow.mapSize.set(512, 512);
  lampA.shadow.bias = -0.002;
  lampA.shadow.normalBias = 0.8;
  scene.add(lampA);
  const lampB = new THREE.PointLight(0xffe8cc, 0.7, 620, 1.7);
  lampB.castShadow = true;
  lampB.shadow.mapSize.set(512, 512);
  lampB.shadow.bias = -0.002;
  lampB.shadow.normalBias = 0.8;
  scene.add(lampB);

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
    flyY: 180,
    raf: 0,
    _ro: null,
    _drag: null,
    interiorLights: [lampA, lampB],
  };

  const clampHoriz = () => {
    const m = 15;
    const pad = Math.max(0, Number(viewer.room.outsidePad) || 0);
    let x = camera.position.x;
    let z = camera.position.z;
    if (pad > 0) {
      // Volný pohyb kolem celé chaty (včetně dvorku na S/J/Z/V).
      x = Math.min(viewer.room.w + pad - m, Math.max(-pad + m, x));
      z = Math.min(viewer.room.d + pad - m, Math.max(-pad + m, z));
      camera.position.x = x;
      camera.position.z = z;
      return;
    }
    // Legacy: jen před jižním vchodem
    const door = viewer.room.door;
    const outD = Math.max(0, Number(viewer.room.outsideDepth) || 0);
    const outPadX = Math.max(80, Number(viewer.room.outsidePadX) || 180);
    const doorPad = 35;
    const southInside = viewer.room.d - m;
    const inDoorX = door
      && x >= door.x0 - doorPad
      && x <= door.x1 + doorPad;
    const beyondSides = x < m || x > viewer.room.w - m;
    const isOutside = z > southInside || beyondSides;
    if (isOutside && outD > 0) {
      x = Math.min(viewer.room.w + outPadX - m, Math.max(-outPadX + m, x));
      const zMin = inDoorX ? m : southInside;
      z = Math.min(viewer.room.d + outD, Math.max(zMin, z));
    } else {
      x = Math.min(viewer.room.w - m, Math.max(m, x));
      const zMax = (inDoorX && outD > 0) ? viewer.room.d + outD : southInside;
      z = Math.min(zMax, Math.max(m, z));
    }
    camera.position.x = x;
    camera.position.z = z;
  };

  const clampFlyY = () => {
    const yMin = 40;
    const yMax = Math.max(220, (viewer.room.h || 210) + 320);
    viewer.flyY = Math.min(yMax, Math.max(yMin, viewer.flyY));
    camera.position.y = viewer.flyY;
  };

  const moveBy = (forward, strafe, vertical = 0) => {
    if (!forward && !strafe && !vertical) return;
    if (forward || strafe) {
      const forwardV = new THREE.Vector3();
      camera.getWorldDirection(forwardV);
      forwardV.y = 0;
      if (forwardV.lengthSq() < 1e-6) forwardV.set(0, 0, -1);
      forwardV.normalize();
      const rightV = new THREE.Vector3().crossVectors(forwardV, new THREE.Vector3(0, 1, 0)).normalize();
      camera.position.addScaledVector(forwardV, forward);
      camera.position.addScaledVector(rightV, strafe);
      clampHoriz();
    }
    if (vertical) {
      viewer.flyY += vertical;
    }
    clampFlyY();
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
    moveBy(-e.deltaY * 0.12, 0, 0);
  };
  const isTypingTarget = (t) =>
    t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

  const MOVE_KEYS = new Set([
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "w", "W", "a", "A", "s", "S", "d", "D",
    " ", "Control",
  ]);

  const onKeyDown = (e) => {
    if (isTypingTarget(e.target)) return;
    // LCtrl = e.code ControlLeft; Space = " "
    if (e.code === "ControlLeft" || e.code === "Space" || MOVE_KEYS.has(e.key)) {
      e.preventDefault();
      if (e.code === "ControlLeft") viewer.keys.add("ControlLeft");
      else if (e.code === "Space") viewer.keys.add("Space");
      else viewer.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    }
  };
  const onKeyUp = (e) => {
    if (e.code === "ControlLeft") viewer.keys.delete("ControlLeft");
    else if (e.code === "Space") viewer.keys.delete("Space");
    else {
      viewer.keys.delete(e.key);
      if (e.key.length === 1) viewer.keys.delete(e.key.toLowerCase());
    }
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
    const vSpeed = 3.2;
    let fwd = 0;
    let strafe = 0;
    let vert = 0;
    if (viewer.keys.has("ArrowUp") || viewer.keys.has("w")) fwd += speed;
    if (viewer.keys.has("ArrowDown") || viewer.keys.has("s")) fwd -= speed;
    if (viewer.keys.has("ArrowLeft") || viewer.keys.has("a")) strafe -= speed;
    if (viewer.keys.has("ArrowRight") || viewer.keys.has("d")) strafe += speed;
    if (viewer.keys.has("Space")) vert += vSpeed;
    if (viewer.keys.has("ControlLeft")) vert -= vSpeed;
    if (fwd || strafe || vert) moveBy(fwd, strafe, vert);
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
  viewer.flyY = eye.y;
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
  const textures = {
    wood: !!spec.textures?.wood,
    wall: !!spec.textures?.wall,
    floor: !!spec.textures?.floor,
    furniture: !!spec.textures?.furniture,
    covering: !!spec.textures?.covering,
    yard: !!spec.textures?.floor, // yard uses floor toggle
  };
  viewer.room = {
    w: clearW,
    d: clearD,
    h: roomH,
    door: walk.door || null,
    outsidePad: walk.outsidePad || 0,
    outsideDepth: walk.outsideDepth || 0,
    outsidePadX: walk.outsidePadX || 0,
  };
  viewer.cameras = spec.cameras || {};

  // Interiérové lampy podle světlosti místnosti (Z / V zóna)
  const lamps = viewer.interiorLights || [];
  const lampY = Math.max(140, Math.min(roomH - 12, roomH * 0.92));
  if (lamps[0]) lamps[0].position.set(clearW * 0.32, lampY, clearD * 0.48);
  if (lamps[1]) lamps[1].position.set(clearW * 0.72, lampY, clearD * 0.52);

  addBox(viewer.root, {
    x: 0, y: 0, w: clearW, d: clearD, h: 2,
    color: "#dfe6e9",
    matKind: "floor",
  }, textures);

  for (const b of spec.boxes || []) {
    if (b.oriented) {
      addOrientedBox(viewer.root, b, textures);
    } else {
      addBox(viewer.root, b, textures);
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
