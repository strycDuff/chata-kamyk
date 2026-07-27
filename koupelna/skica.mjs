/**
 * Skica — freestyle layout explorer (separate from parametric planner).
 * Plan edit + 3D validation. No electro.
 */
import * as LM from "./layout-model.mjs";

const STORAGE_KEY = "chata-kamyk-skica-v1";
const CLEAR = { w: 906, h: 333 };
const WALL = 10;
const PART = LM.PART_THICK;
const INNER = { x: WALL, y: WALL, w: CLEAR.w, h: CLEAR.h };
const OUTER = { w: CLEAR.w + 2 * WALL, h: CLEAR.h + 2 * WALL };
const NS = "http://www.w3.org/2000/svg";

const NORTH_SEGS = [
  { t: "wall", l: 220 }, { t: "win", l: 96.5 }, { t: "wall", l: 120 },
  { t: "win", l: 90.5 }, { t: "wall", l: 99 }, { t: "win", l: 56.5 }, { t: "wall", l: 224 },
];
const SOUTH_SEGS = [
  { t: "wall", l: 204 }, { t: "door", l: 103 }, { t: "wall", l: 79 },
  { t: "win", l: 87 }, { t: "wall", l: 434.5 },
];
const WEST_SEGS = [
  { t: "wall", l: 56 }, { t: "win", l: 83 }, { t: "wall", l: 50 },
  { t: "win", l: 83 }, { t: "wall", l: 61 },
];
const EAST_SEGS = [
  { t: "wall", l: 124 }, { t: "win", l: 85 }, { t: "wall", l: 124 },
];

function el(name, attrs = {}, children = []) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "textContent") node.textContent = v;
    else node.setAttribute(k, String(v));
  }
  for (const c of children) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return node;
}

function absX(cx) { return INNER.x + cx; }
function absY(cy) { return INNER.y + cy; }

function defaultState() {
  const seeded = LM.seedFromParametric({ clearW: CLEAR.w, clearH: CLEAR.h });
  return {
    mode: "plan", // plan | view3d
    partitions: seeded.partitions,
    openings: seeded.openings,
    furnitureLayers: seeded.furnitureLayers,
    livingBoundaryId: seeded.livingBoundaryId,
    partSelectedId: null,
    openingSelectedId: null,
    furnSelectedId: null,
    tool: null, // null | part-draw | furn-draw
    draw: null,
    drag: null,
  };
}

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || typeof raw !== "object") return defaultState();
    const base = defaultState();
    return {
      ...base,
      mode: raw.mode === "view3d" ? "view3d" : "plan",
      partitions: (raw.partitions || []).map(LM.normalizePartition),
      openings: (raw.openings || []).map(LM.normalizeOpening),
      furnitureLayers: (raw.furnitureLayers || []).map(LM.normalizeFurnitureLayer),
      livingBoundaryId: raw.livingBoundaryId || "tv-west",
    };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    mode: state.mode,
    partitions: state.partitions,
    openings: state.openings,
    furnitureLayers: state.furnitureLayers,
    livingBoundaryId: state.livingBoundaryId,
    savedAt: Date.now(),
  }));
}

function clampFurn(layer) {
  layer.w = Math.min(CLEAR.w, Math.max(20, layer.w));
  layer.d = Math.min(CLEAR.h, Math.max(20, layer.d));
  layer.x = Math.min(CLEAR.w - layer.w, Math.max(0, layer.x));
  layer.y = Math.min(CLEAR.h - layer.d, Math.max(0, layer.y));
  layer.h = Math.min(280, Math.max(10, Number(layer.h) || 75));
  return layer;
}

function partAbs(p) {
  const c = LM.partitionBox(p);
  return { x: absX(c.x), y: absY(c.y), w: c.w, d: c.d };
}

function openingAbs(op, part) {
  const c = LM.openingBox(op, part);
  return { x: absX(c.x), y: absY(c.y), w: c.w, d: c.d };
}

function furnAbs(layer) {
  return { x: absX(layer.x), y: absY(layer.y), w: layer.w, d: layer.d };
}

function drawOpenings(g, wall, segs) {
  let c = 0;
  for (const s of segs) {
    if (s.t === "win" || s.t === "door") {
      let x, y, w, h;
      if (wall === "north") { x = absX(c); y = 0; w = s.l; h = WALL; }
      else if (wall === "south") { x = absX(c); y = INNER.y + CLEAR.h; w = s.l; h = WALL; }
      else if (wall === "west") { x = 0; y = absY(c); w = WALL; h = s.l; }
      else { x = INNER.x + CLEAR.w; y = absY(c); w = WALL; h = s.l; }
      g.appendChild(el("rect", {
        x, y, width: w, height: h,
        fill: s.t === "door" ? "#ffe8a3" : "#b8e0ff",
        stroke: s.t === "door" ? "#b8860b" : "#1a73e8",
        "stroke-width": 1.2,
      }));
    }
    c += s.l;
  }
}

function buildPlanSvg(state, onPointer) {
  const pad = 36;
  const svg = el("svg", {
    viewBox: `${-pad} ${-pad} ${OUTER.w + pad * 2} ${OUTER.h + pad * 2}`,
    id: "skica-svg",
    style: "width:100%;height:100%;touch-action:none",
  });
  const g = el("g");
  g.appendChild(el("rect", {
    x: 0, y: 0, width: OUTER.w, height: OUTER.h,
    fill: "#f4f1ea", stroke: "#2c3e50", "stroke-width": 2.5,
  }));
  g.appendChild(el("rect", {
    x: INNER.x, y: INNER.y, width: CLEAR.w, height: CLEAR.h,
    fill: "#fafafa", stroke: "none",
  }));
  drawOpenings(g, "north", NORTH_SEGS);
  drawOpenings(g, "south", SOUTH_SEGS);
  drawOpenings(g, "west", WEST_SEGS);
  drawOpenings(g, "east", EAST_SEGS);

  for (const p of state.partitions) {
    const box = partAbs(p);
    const sel = p.id === state.partSelectedId;
    g.appendChild(el("rect", {
      x: box.x, y: box.y, width: box.w, height: box.d,
      fill: sel ? "#aeb6bf" : "#d1d8e0",
      stroke: sel ? "#1a5276" : "#2c3e50",
      "stroke-width": sel ? 2.5 : 2,
      "data-part": p.id,
      class: "skica-part",
    }));
  }
  for (const op of state.openings) {
    const part = state.partitions.find((p) => p.id === op.partitionId);
    if (!part) continue;
    const box = openingAbs(op, part);
    const sel = op.id === state.openingSelectedId;
    g.appendChild(el("rect", {
      x: box.x, y: box.y, width: box.w, height: box.d,
      fill: "#fff", stroke: sel ? "#b8860b" : "#d4a017",
      "stroke-width": sel ? 2 : 1.5,
      "data-opening": op.id,
    }));
    const t = el("text", {
      x: box.x + box.w / 2, y: box.y + box.d / 2,
      fill: "#8a6d00", "font-size": 9, "text-anchor": "middle",
      "dominant-baseline": "middle", "pointer-events": "none",
    });
    t.textContent = "D";
    g.appendChild(t);
  }
  for (const layer of state.furnitureLayers) {
    const sel = layer.id === state.furnSelectedId;
    if (layer.kind === "sofa") {
      const arms = LM.sofaArmsFromLayer(layer);
      for (const a of [arms.west, arms.north]) {
        g.appendChild(el("rect", {
          x: absX(a.x), y: absY(a.y), width: a.w, height: a.d,
          fill: "#eaeaea", stroke: "#7f8c8d", "stroke-width": 1.5, rx: 6,
          "data-furn": layer.id, class: "skica-furn",
        }));
      }
    } else {
      const box = furnAbs(layer);
      const colors = {
        bed: ["#f5cd79", "#e67e22"],
        kitchen: ["#f1f2f6", "#27ae60"],
        shower: ["rgba(0,168,255,0.2)", "#2980b9"],
        wc: ["#fff", "#2980b9"],
        sink: ["#fff", "#00a8a8"],
        tv: ["#2c3e50", "#111"],
        generic: ["rgba(52,152,219,0.22)", "#2980b9"],
      };
      const [fill, stroke] = colors[layer.kind] || colors.generic;
      g.appendChild(el("rect", {
        x: box.x, y: box.y, width: box.w, height: box.d,
        fill, stroke: sel ? "#1f4e6b" : stroke,
        "stroke-width": sel ? 2.2 : 1.5, rx: 3,
        "data-furn": layer.id, class: "skica-furn",
      }));
      const t = el("text", {
        x: box.x + box.w / 2, y: box.y + box.d / 2,
        fill: stroke, "font-size": 9, "text-anchor": "middle",
        "dominant-baseline": "middle", "pointer-events": "none",
      });
      t.textContent = layer.name || layer.kind;
      g.appendChild(t);
    }
  }
  if (state.draw) {
    const { x0, y0, x1, y1 } = state.draw;
    g.appendChild(el("rect", {
      x: Math.min(x0, x1), y: Math.min(y0, y1),
      width: Math.abs(x1 - x0), height: Math.abs(y1 - y0),
      fill: "rgba(52,152,219,0.12)", stroke: "#2980b9",
      "stroke-width": 1.2, "stroke-dasharray": "4,3",
    }));
  }
  svg.appendChild(g);
  if (onPointer) {
    svg.addEventListener("pointerdown", onPointer.down);
    svg.addEventListener("pointermove", onPointer.move);
    svg.addEventListener("pointerup", onPointer.up);
    svg.addEventListener("pointerleave", onPointer.up);
  }
  return svg;
}

function livingX1(state) {
  return LM.livingBoundaryX(state.partitions, state.livingBoundaryId, 324);
}

function build3dSpec(state) {
  const roomH = 210;
  const boxes = [];
  const pushWall = (segs, wall) => {
    let c = 0;
    for (const s of segs) {
      if (s.t === "wall") {
        if (wall === "north") boxes.push({ x: c, y: -WALL, w: s.l, d: WALL, h: roomH, color: "#ecf0f1", matKind: "wall" });
        else if (wall === "south") boxes.push({ x: c, y: CLEAR.h, w: s.l, d: WALL, h: roomH, color: "#ecf0f1", matKind: "wall" });
        else if (wall === "west") boxes.push({ x: -WALL, y: c, w: WALL, d: s.l, h: roomH, color: "#ecf0f1", matKind: "wall" });
        else boxes.push({ x: CLEAR.w, y: c, w: WALL, d: s.l, h: roomH, color: "#ecf0f1", matKind: "wall" });
      } else if (s.t === "win") {
        const sill = 90, openH = 83;
        if (wall === "north") {
          boxes.push({ x: c, y: -WALL, w: s.l, d: WALL, h: sill, color: "#bdc3c7", matKind: "wall" });
          boxes.push({ x: c, y: -WALL, w: s.l, d: WALL, h: roomH - sill - openH, elev: sill + openH, color: "#bdc3c7", matKind: "wall" });
        } else if (wall === "south") {
          boxes.push({ x: c, y: CLEAR.h, w: s.l, d: WALL, h: sill, color: "#bdc3c7", matKind: "wall" });
          boxes.push({ x: c, y: CLEAR.h, w: s.l, d: WALL, h: roomH - sill - openH, elev: sill + openH, color: "#bdc3c7", matKind: "wall" });
        } else if (wall === "west") {
          boxes.push({ x: -WALL, y: c, w: WALL, d: s.l, h: sill, color: "#bdc3c7", matKind: "wall" });
          boxes.push({ x: -WALL, y: c, w: WALL, d: s.l, h: roomH - sill - openH, elev: sill + openH, color: "#bdc3c7", matKind: "wall" });
        } else {
          boxes.push({ x: CLEAR.w, y: c, w: WALL, d: s.l, h: sill, color: "#bdc3c7", matKind: "wall" });
          boxes.push({ x: CLEAR.w, y: c, w: WALL, d: s.l, h: roomH - sill - openH, elev: sill + openH, color: "#bdc3c7", matKind: "wall" });
        }
      } else if (s.t === "door") {
        const doorH = 200;
        if (wall === "south") {
          boxes.push({ x: c, y: CLEAR.h, w: s.l, d: WALL, h: roomH - doorH, elev: doorH, color: "#bdc3c7", matKind: "wall" });
        }
      }
      c += s.l;
    }
  };
  pushWall(NORTH_SEGS, "north");
  pushWall(SOUTH_SEGS, "south");
  pushWall(WEST_SEGS, "west");
  pushWall(EAST_SEGS, "east");

  const doorH = 200;
  const leafH = 190;
  for (const p of state.partitions) {
    const box = LM.partitionBox(p);
    const ops = state.openings.filter((o) => o.partitionId === p.id);
    if (!ops.length) {
      boxes.push({ ...box, h: roomH, color: "#95a5a6", matKind: "wall" });
      continue;
    }
    if (LM.isVerticalPartition(p)) {
      let cursor = box.y;
      const end = box.y + box.d;
      for (const o of ops.map((op) => ({ op, ob: LM.openingBox(op, p) })).sort((a, b) => a.ob.y - b.ob.y)) {
        if (o.ob.y > cursor + 0.5) boxes.push({ x: box.x, y: cursor, w: box.w, d: o.ob.y - cursor, h: roomH, color: "#95a5a6", matKind: "wall" });
        boxes.push({ x: box.x, y: o.ob.y, w: box.w, d: o.ob.d, h: roomH - doorH, elev: doorH, color: "#95a5a6", matKind: "wall" });
        boxes.push({ x: box.x + (box.w - 3.5) / 2, y: o.ob.y, w: 3.5, d: o.ob.d, h: leafH, color: "#e1b12c", matKind: "wood" });
        cursor = o.ob.y + o.ob.d;
      }
      if (end > cursor + 0.5) boxes.push({ x: box.x, y: cursor, w: box.w, d: end - cursor, h: roomH, color: "#95a5a6", matKind: "wall" });
    } else {
      let cursor = box.x;
      const end = box.x + box.w;
      for (const o of ops.map((op) => ({ op, ob: LM.openingBox(op, p) })).sort((a, b) => a.ob.x - b.ob.x)) {
        if (o.ob.x > cursor + 0.5) boxes.push({ x: cursor, y: box.y, w: o.ob.x - cursor, d: box.d, h: roomH, color: "#95a5a6", matKind: "wall" });
        boxes.push({ x: o.ob.x, y: box.y, w: o.ob.w, d: box.d, h: roomH - doorH, elev: doorH, color: "#95a5a6", matKind: "wall" });
        boxes.push({ x: o.ob.x, y: box.y + (box.d - 3.5) / 2, w: o.ob.w, d: 3.5, h: leafH, color: "#e1b12c", matKind: "wood" });
        cursor = o.ob.x + o.ob.w;
      }
      if (end > cursor + 0.5) boxes.push({ x: cursor, y: box.y, w: end - cursor, d: box.d, h: roomH, color: "#95a5a6", matKind: "wall" });
    }
  }

  for (const layer of state.furnitureLayers) {
    if (layer.kind === "sofa") {
      const arms = LM.sofaArmsFromLayer(layer);
      boxes.push({ ...arms.west, h: 42, color: "#8e9eab", matKind: "furniture" });
      boxes.push({ ...arms.north, h: 78, color: "#5d6d7e", matKind: "furniture" });
    } else if (layer.kind === "bed") {
      const matW = layer.matW || 160;
      boxes.push({ x: layer.x, y: layer.y, w: layer.w, d: layer.d, h: 25, color: "#d35400", matKind: "wood" });
      boxes.push({
        x: layer.x + (layer.w - matW) / 2, y: layer.y + (layer.d - 200) / 2,
        w: matW, d: 200, h: 20, elev: 25, color: "#f5cd79", matKind: "furniture",
      });
    } else if (layer.kind === "kitchen") {
      boxes.push({ x: layer.x, y: layer.y, w: layer.w, d: layer.d, h: layer.h || 86, color: "#27ae60", matKind: "furniture" });
    } else if (layer.kind === "shower") {
      boxes.push({ x: layer.x, y: layer.y, w: layer.w, d: layer.d, h: 5, color: "#3498db", matKind: "furniture" });
    } else if (layer.kind === "wc") {
      boxes.push({ x: layer.x, y: layer.y, w: layer.w, d: layer.d, h: 40, color: "#ecf0f1", matKind: "furniture" });
    } else if (layer.kind === "sink") {
      boxes.push({ x: layer.x, y: layer.y, w: layer.w, d: layer.d, h: 16, elev: 70, color: "#ecf0f1", matKind: "furniture" });
    } else if (layer.kind === "tv") {
      boxes.push({ x: layer.x, y: layer.y, w: layer.w, d: layer.d, h: layer.h || 70, elev: 100, color: "#111", matKind: "furniture" });
    } else {
      boxes.push({ x: layer.x, y: layer.y, w: layer.w, d: layer.d, h: layer.h || 75, color: "#2980b9", matKind: "furniture" });
    }
  }

  boxes.push({
    x: -200, y: -200, w: CLEAR.w + 400, d: CLEAR.h + 400,
    h: 1.5, color: "#cfd8dc", opacity: 0.95, matKind: "yard",
  });

  const lx = livingX1(state);
  const door = SOUTH_SEGS.reduce((acc, s) => {
    if (acc.found) return acc;
    if (s.t === "door") return { found: true, x0: acc.c, x1: acc.c + s.l };
    return { ...acc, c: acc.c + s.l };
  }, { c: 0, found: false, x0: 204, x1: 307 });

  return {
    roomH,
    clearW: CLEAR.w,
    clearH: CLEAR.h,
    boxes,
    cameras: {
      sofa: { eye: { x: 80, y: 180, z: 120 }, target: { x: lx - 40, y: 140, z: 70 }, fov: 70 },
      door: { eye: { x: (door.x0 + door.x1) / 2, y: 180, z: CLEAR.h - 28 }, target: { x: (door.x0 + door.x1) / 2, y: 140, z: CLEAR.h * 0.35 }, fov: 72 },
      fridge: { eye: { x: lx + 40, y: 180, z: CLEAR.h - 90 }, target: { x: 80, y: 140, z: 100 }, fov: 70 },
    },
    textures: { wood: false, wall: false, floor: false, furniture: false, covering: false },
    interiorLights: true,
    walk: { door: { x0: door.x0, x1: door.x1 }, outsidePad: 200, outsideDepth: 200, outsidePadX: 200 },
  };
}

function svgPoint(svg, evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

/**
 * Mount freestyle sketcher into planner chrome.
 * @param {{ panel: HTMLElement, wrap: HTMLElement, importPlanner3d: () => Promise<any> }} opts
 */
export function createSkica(opts) {
  const { panel, wrap, importPlanner3d } = opts;
  let state = loadState();
  let active = false;
  let viewer = null;
  let modCache = null;
  let raf = 0;

  function persist() { saveState(state); }

  function fillPanel() {
    panel.innerHTML = `
      <p class="hint">Explorace alternativ — <strong>neovlivní</strong> hlavní půdorys / elektro. Obálka chaty je fixní.</p>
      <div class="row seg" id="skica-mode" style="margin-bottom:10px">
        <button type="button" data-v="plan" class="${state.mode === "plan" ? "active" : ""}">Půdorys</button>
        <button type="button" data-v="view3d" class="${state.mode === "view3d" ? "active" : ""}">3D náhled</button>
      </div>
      <div id="skica-plan-tools">
        <details class="side-block" open>
          <summary>Příčky</summary>
          <div class="side-block-body">
            <div class="row" style="margin-bottom:8px;gap:6px">
              <button type="button" class="btn" id="skica-part-draw" style="flex:1">＋ Kreslit příčku</button>
              <button type="button" class="btn" id="skica-part-del" style="flex:1">Smazat</button>
            </div>
            <ul class="furn-list" id="skica-part-list"></ul>
            <label>Living boundary (pro orientaci)</label>
            <select id="skica-living" style="width:100%;margin-top:4px"></select>
          </div>
        </details>
        <details class="side-block" open>
          <summary>Dveře na příčce</summary>
          <div class="side-block-body">
            <button type="button" class="btn" id="skica-door-add" style="width:100%;margin-bottom:8px">＋ Dveře na vybranou příčku</button>
            <button type="button" class="btn" id="skica-door-del" style="width:100%;margin-bottom:8px">Smazat dveře</button>
            <ul class="furn-list" id="skica-door-list"></ul>
          </div>
        </details>
        <details class="side-block" open>
          <summary>Nábytek</summary>
          <div class="side-block-body">
            <div class="row seg" id="skica-kinds" style="flex-wrap:wrap;gap:4px;margin-bottom:8px">
              ${Object.entries(LM.FURN_KINDS).map(([k, v]) =>
                `<button type="button" data-kind="${k}">${v.label}</button>`).join("")}
            </div>
            <div class="row" style="margin-bottom:8px;gap:6px">
              <button type="button" class="btn" id="skica-furn-rotate" style="flex:1">Otočit 90°</button>
              <button type="button" class="btn" id="skica-furn-del" style="flex:1">Smazat kus</button>
            </div>
            <div id="skica-presets-wrap" hidden>
              <label>Preset</label>
              <div class="row seg" id="skica-presets"></div>
            </div>
            <ul class="furn-list" id="skica-furn-list"></ul>
          </div>
        </details>
        <div class="row" style="margin-top:10px;gap:6px">
          <button type="button" class="btn" id="skica-reseed" style="flex:1">Obnovit výchozí skicu</button>
          <button type="button" class="btn" id="skica-save" style="flex:1">Uložit skicu</button>
        </div>
        <p class="hint" id="skica-hint" style="margin-top:8px"></p>
      </div>
      <div id="skica-3d-tools" hidden>
        <p class="hint">Prohlížení freestyle layoutu. Úpravy dělej v režimu Půdorys.</p>
        <div class="row seg" id="skica-cam">
          <button type="button" data-v="sofa" class="active">Z gauče</button>
          <button type="button" data-v="door">Ze vchodu</button>
          <button type="button" data-v="fridge">Od středu</button>
        </div>
      </div>
    `;
    bindPanel();
    refreshLists();
  }

  function bindPanel() {
    panel.querySelector("#skica-mode")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-v]");
      if (!btn) return;
      state.mode = btn.dataset.v;
      persist();
      render();
    });
    panel.querySelector("#skica-part-draw")?.addEventListener("click", () => {
      state.tool = state.tool === "part-draw" ? null : "part-draw";
      state.draw = null;
      render();
    });
    panel.querySelector("#skica-part-del")?.addEventListener("click", () => {
      if (!state.partSelectedId) return;
      const id = state.partSelectedId;
      state.partitions = state.partitions.filter((p) => p.id !== id);
      state.openings = state.openings.filter((o) => o.partitionId !== id);
      state.partSelectedId = null;
      persist();
      render();
    });
    panel.querySelector("#skica-living")?.addEventListener("change", (e) => {
      state.livingBoundaryId = e.target.value;
      persist();
      render();
    });
    panel.querySelector("#skica-door-add")?.addEventListener("click", () => {
      if (!state.partSelectedId) { alert("Nejdřív vyber příčku."); return; }
      const op = LM.normalizeOpening({
        partitionId: state.partSelectedId,
        name: `Dveře ${state.openings.length + 1}`,
        offset: 40, width: 70, kind: "door", side: "pos",
      });
      state.openings.push(op);
      state.openingSelectedId = op.id;
      persist();
      render();
    });
    panel.querySelector("#skica-door-del")?.addEventListener("click", () => {
      if (!state.openingSelectedId) return;
      state.openings = state.openings.filter((o) => o.id !== state.openingSelectedId);
      state.openingSelectedId = null;
      persist();
      render();
    });
    panel.querySelector("#skica-kinds")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-kind]");
      if (!btn) return;
      const kind = btn.dataset.kind;
      const meta = LM.FURN_KINDS[kind];
      const layer = LM.normalizeFurnitureLayer({
        kind, name: meta.label, x: 40, y: 40, w: 60, d: 80, h: meta.defaultH,
      });
      const presets = LM.FURN_PRESETS[kind];
      if (presets?.[0]) LM.applyFurnPreset(layer, presets[0].id);
      clampFurn(layer);
      state.furnitureLayers.push(layer);
      state.furnSelectedId = layer.id;
      persist();
      render();
    });
    panel.querySelector("#skica-furn-rotate")?.addEventListener("click", () => {
      const layer = state.furnitureLayers.find((l) => l.id === state.furnSelectedId);
      if (!layer) return;
      LM.rotateFurniture90(layer);
      clampFurn(layer);
      persist();
      render();
    });
    panel.querySelector("#skica-furn-del")?.addEventListener("click", () => {
      if (!state.furnSelectedId) return;
      state.furnitureLayers = state.furnitureLayers.filter((l) => l.id !== state.furnSelectedId);
      state.furnSelectedId = null;
      persist();
      render();
    });
    panel.querySelector("#skica-presets")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-v]");
      if (!btn) return;
      const layer = state.furnitureLayers.find((l) => l.id === state.furnSelectedId);
      if (!layer) return;
      LM.applyFurnPreset(layer, btn.dataset.v);
      clampFurn(layer);
      persist();
      render();
    });
    panel.querySelector("#skica-reseed")?.addEventListener("click", () => {
      if (!confirm("Obnovit výchozí skicu (U-koupelna + TV + nábytek)?")) return;
      state = defaultState();
      persist();
      fillPanel();
      render();
    });
    panel.querySelector("#skica-save")?.addEventListener("click", () => {
      persist();
      const hint = panel.querySelector("#skica-hint");
      if (hint) hint.textContent = "Skica uložena do tohoto prohlížeče.";
    });
    panel.querySelector("#skica-cam")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-v]");
      if (!btn || !viewer || !modCache) return;
      panel.querySelectorAll("#skica-cam button").forEach((b) => b.classList.toggle("active", b === btn));
      viewer.preset = btn.dataset.v;
      modCache.setCameraView(viewer, btn.dataset.v);
    });
  }

  function refreshLists() {
    const partList = panel.querySelector("#skica-part-list");
    if (partList) {
      partList.innerHTML = "";
      for (const p of state.partitions) {
        const li = document.createElement("li");
        if (p.id === state.partSelectedId) li.classList.add("selected");
        li.textContent = `${p.name || p.id} · ${Math.round(LM.partitionLength(p))} cm`;
        li.onclick = () => { state.partSelectedId = p.id; state.openingSelectedId = null; persist(); render(); };
        partList.appendChild(li);
      }
    }
    const living = panel.querySelector("#skica-living");
    if (living) {
      living.innerHTML = "";
      for (const p of state.partitions.filter(LM.isVerticalPartition)) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name || p.id;
        if (p.id === state.livingBoundaryId) opt.selected = true;
        living.appendChild(opt);
      }
    }
    const doorList = panel.querySelector("#skica-door-list");
    if (doorList) {
      doorList.innerHTML = "";
      for (const o of state.openings) {
        const li = document.createElement("li");
        if (o.id === state.openingSelectedId) li.classList.add("selected");
        li.textContent = `${o.name || o.id} @ ${o.partitionId}`;
        li.onclick = () => { state.openingSelectedId = o.id; state.partSelectedId = o.partitionId; persist(); render(); };
        doorList.appendChild(li);
      }
    }
    const furnList = panel.querySelector("#skica-furn-list");
    if (furnList) {
      furnList.innerHTML = "";
      for (const layer of state.furnitureLayers) {
        const li = document.createElement("li");
        if (layer.id === state.furnSelectedId) li.classList.add("selected");
        li.textContent = `${LM.FURN_KINDS[layer.kind]?.label || layer.kind}: ${layer.name} (${Math.round(layer.w)}×${Math.round(layer.d)})`;
        li.onclick = () => { state.furnSelectedId = layer.id; persist(); render(); };
        furnList.appendChild(li);
      }
    }
    const wrapP = panel.querySelector("#skica-presets-wrap");
    const rootP = panel.querySelector("#skica-presets");
    const layer = state.furnitureLayers.find((l) => l.id === state.furnSelectedId);
    const presets = layer ? LM.FURN_PRESETS[layer.kind] : null;
    if (wrapP && rootP) {
      if (!presets?.length) wrapP.hidden = true;
      else {
        wrapP.hidden = false;
        rootP.innerHTML = "";
        for (const p of presets) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.dataset.v = p.id;
          btn.textContent = p.label;
          if (layer.preset === p.id) btn.classList.add("active");
          rootP.appendChild(btn);
        }
      }
    }
    const planTools = panel.querySelector("#skica-plan-tools");
    const tools3d = panel.querySelector("#skica-3d-tools");
    if (planTools) planTools.hidden = state.mode !== "plan";
    if (tools3d) tools3d.hidden = state.mode !== "view3d";
    panel.querySelectorAll("#skica-mode button").forEach((b) => {
      b.classList.toggle("active", b.dataset.v === state.mode);
    });
    const drawBtn = panel.querySelector("#skica-part-draw");
    if (drawBtn) drawBtn.classList.toggle("active", state.tool === "part-draw");
    const hint = panel.querySelector("#skica-hint");
    if (hint && state.mode === "plan") {
      hint.textContent = state.tool === "part-draw"
        ? "Táhni osa-aligned příčku na půdorysu…"
        : `${state.partitions.length} příček · ${state.openings.length} dveří · ${state.furnitureLayers.length} kusů nábytku`;
    }
  }

  function onPointerDown(evt) {
    if (state.mode !== "plan") return;
    const svg = wrap.querySelector("#skica-svg");
    if (!svg) return;
    const p = svgPoint(svg, evt);
    const t = evt.target;
    if (state.tool === "part-draw") {
      state.drag = { type: "part-draw", start: p };
      state.draw = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
      evt.preventDefault();
      return;
    }
    const furn = t.closest?.("[data-furn]");
    if (furn) {
      const id = furn.getAttribute("data-furn");
      const layer = state.furnitureLayers.find((l) => l.id === id);
      if (layer) {
        state.furnSelectedId = id;
        state.drag = { type: "furn-move", id, start: p, ox: layer.x, oy: layer.y };
        evt.preventDefault();
        render();
        return;
      }
    }
    const open = t.closest?.("[data-opening]");
    if (open) {
      state.openingSelectedId = open.getAttribute("data-opening");
      state.partSelectedId = state.openings.find((o) => o.id === state.openingSelectedId)?.partitionId || null;
      persist();
      render();
      return;
    }
    const part = t.closest?.("[data-part]");
    if (part) {
      const id = part.getAttribute("data-part");
      const pr = state.partitions.find((x) => x.id === id);
      if (pr) {
        state.partSelectedId = id;
        state.drag = {
          type: "part-move", id, start: p,
          ox1: pr.x1, oy1: pr.y1, ox2: pr.x2, oy2: pr.y2,
        };
        evt.preventDefault();
        render();
      }
    }
  }

  function onPointerMove(evt) {
    if (!state.drag || state.mode !== "plan") return;
    const svg = wrap.querySelector("#skica-svg");
    if (!svg) return;
    const p = svgPoint(svg, evt);
    const dx = p.x - state.drag.start.x;
    const dy = p.y - state.drag.start.y;
    if (state.drag.type === "part-draw") {
      let x1 = p.x, y1 = p.y;
      const x0 = state.drag.start.x, y0 = state.drag.start.y;
      if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) y1 = y0;
      else x1 = x0;
      state.draw = { x0, y0, x1, y1 };
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderPlanOnly(); });
      return;
    }
    if (state.drag.type === "furn-move") {
      const layer = state.furnitureLayers.find((l) => l.id === state.drag.id);
      if (layer) {
        layer.x = state.drag.ox + dx;
        layer.y = state.drag.oy + dy;
        clampFurn(layer);
      }
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderPlanOnly(); });
      return;
    }
    if (state.drag.type === "part-move") {
      const pr = state.partitions.find((x) => x.id === state.drag.id);
      if (pr) {
        if (LM.isVerticalPartition(pr)) {
          let nx = Math.min(CLEAR.w - PART, Math.max(0, state.drag.ox1 + dx));
          pr.x1 = nx; pr.x2 = nx;
        } else {
          let ny = Math.min(CLEAR.h - PART, Math.max(0, state.drag.oy1 + dy));
          pr.y1 = ny; pr.y2 = ny;
        }
      }
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderPlanOnly(); });
    }
  }

  function onPointerUp() {
    if (!state.drag) return;
    if (state.drag.type === "part-draw" && state.draw) {
      const { x0, y0, x1, y1 } = state.draw;
      const cx0 = Math.min(x0, x1) - INNER.x;
      const cy0 = Math.min(y0, y1) - INNER.y;
      const cx1 = Math.max(x0, x1) - INNER.x;
      const cy1 = Math.max(y0, y1) - INNER.y;
      const len = Math.hypot(cx1 - cx0, cy1 - cy0);
      if (len >= 40) {
        const vertical = Math.abs(cx1 - cx0) < 1;
        const part = LM.normalizePartition({
          name: `Příčka ${state.partitions.length + 1}`,
          x1: vertical ? cx0 : cx0,
          y1: vertical ? cy0 : cy0,
          x2: vertical ? cx0 : cx1,
          y2: vertical ? cy1 : cy0,
        });
        state.partitions.push(part);
        state.partSelectedId = part.id;
      }
      state.draw = null;
      state.tool = null;
    }
    state.drag = null;
    persist();
    render();
  }

  function renderPlanOnly() {
    if (!active || state.mode !== "plan") return;
    wrap.classList.remove("view3d-host");
    wrap.innerHTML = "";
    wrap.appendChild(buildPlanSvg(state, {
      down: onPointerDown,
      move: onPointerMove,
      up: onPointerUp,
    }));
  }

  async function render3d() {
    wrap.classList.add("view3d-host");
    try {
      const mod = await importPlanner3d();
      modCache = mod;
      const spec = build3dSpec(state);
      const first = !viewer;
      if (!viewer) {
        wrap.innerHTML = "";
        viewer = mod.createViewer(wrap);
      } else if (!wrap.contains(viewer.renderer.domElement)) {
        wrap.innerHTML = "";
        wrap.appendChild(viewer.renderer.domElement);
      }
      viewer.preset = viewer.preset || "sofa";
      mod.rebuild(viewer, spec, { applyCamera: first });
    } catch (err) {
      wrap.classList.remove("view3d-host");
      wrap.innerHTML = "";
      const p = document.createElement("p");
      p.className = "hint";
      p.style.padding = "24px";
      p.textContent = `3D skici se nepodařilo načíst: ${err.message || err}`;
      wrap.appendChild(p);
    }
  }

  function disposeViewer() {
    if (!viewer || !modCache) {
      viewer = null;
      return;
    }
    try { modCache.dispose(viewer); } catch { /* ignore */ }
    viewer = null;
  }

  function render() {
    if (!active) return;
    refreshLists();
    if (state.mode === "view3d") {
      render3d();
    } else {
      disposeViewer();
      renderPlanOnly();
    }
  }

  return {
    activate() {
      active = true;
      fillPanel();
      render();
    },
    deactivate() {
      active = false;
      disposeViewer();
      wrap.classList.remove("view3d-host");
    },
    isActive: () => active,
    render,
  };
}
