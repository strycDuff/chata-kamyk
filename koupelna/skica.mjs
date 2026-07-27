/**
 * Skica — freestyle layout explorer (separate from parametric planner).
 * Plan edit + 3D validation. No electro.
 */
import * as LM from "./layout-model.mjs";
import { DEFAULT_LAYOUT } from "./default-layout.mjs";

const STORAGE_KEY = "chata-kamyk-skica-v2";
const CLEAR = { w: 906, h: 333 };
const WALL = 10;
const PART = LM.PART_THICK;
const INNER = { x: WALL, y: WALL, w: CLEAR.w, h: CLEAR.h };
const OUTER = { w: CLEAR.w + 2 * WALL, h: CLEAR.h + 2 * WALL };
const NS = "http://www.w3.org/2000/svg";
const HANDLE = 14; // end-handle hit size (plan px ≈ cm)
const PART_LEN_MIN = 40;

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
  const seeded = LM.seedFromParametric({
    ...DEFAULT_LAYOUT,
    clearW: CLEAR.w,
    clearH: CLEAR.h,
  });
  const extras = (DEFAULT_LAYOUT.furnitureLayers || []).map((f) =>
    LM.normalizeFurnitureLayer({ ...f, kind: f.kind || "generic" }),
  );
  const sofa = seeded.furnitureLayers.find((l) => l.kind === "sofa");
  if (sofa) {
    sofa.w = Number(DEFAULT_LAYOUT.sofaNorthW) || sofa.w;
    sofa.d = Number(DEFAULT_LAYOUT.sofaWestD) || sofa.d;
    sofa.armW = Number(DEFAULT_LAYOUT.sofaArmW) || sofa.armW;
    sofa.armD = Number(DEFAULT_LAYOUT.sofaArmD) || sofa.armD;
  }
  return {
    mode: "plan", // plan | view3d
    partitions: seeded.partitions,
    openings: seeded.openings,
    furnitureLayers: [...seeded.furnitureLayers, ...extras],
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

function furnMinSize(layer) {
  // TV is a thin panel (~8 cm); WC/sink can also be under 40 cm.
  if (layer.kind === "tv") return { w: 4, d: 4 };
  if (layer.kind === "sink") return { w: 18, d: 18 };
  if (layer.kind === "wc") return { w: 15, d: 15 };
  return { w: 20, d: 20 };
}

function clampFurn(layer) {
  const min = furnMinSize(layer);
  layer.w = Math.min(CLEAR.w, Math.max(min.w, layer.w));
  layer.d = Math.min(CLEAR.h, Math.max(min.d, layer.d));
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

/** Door leaf in clear coords — delegates to layout-model. */
function doorLeafBox(op, part) {
  return LM.openingLeafBox(op, part);
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
      "data-part-act": "move",
      class: "skica-part",
    }));
  }
  for (const layer of state.furnitureLayers) {
    const sel = layer.id === state.furnSelectedId;
    if (layer.kind === "sofa") {
      const arms = LM.sofaArmsFromLayer(layer);
      for (const a of [arms.west, arms.north]) {
        g.appendChild(el("rect", {
          x: absX(a.x), y: absY(a.y), width: a.w, height: a.d,
          fill: "#eaeaea", stroke: sel ? "#1f4e6b" : "#7f8c8d",
          "stroke-width": sel ? 2.2 : 1.5, rx: 6,
          "data-furn": layer.id, class: "skica-furn",
        }));
      }
      const t = el("text", {
        x: absX(layer.x) + 8, y: absY(layer.y) + 16,
        fill: "#7f8c8d", "font-size": 9, "pointer-events": "none",
      });
      t.textContent = `${Math.round(layer.w)}×${Math.round(layer.d)}`;
      g.appendChild(t);
    } else if (layer.kind === "bed") {
      const parts = LM.bedPartsFromLayer(layer);
      const box = furnAbs(layer);
      g.appendChild(el("rect", {
        x: box.x, y: box.y, width: box.w, height: box.d,
        fill: "#f5cd79", stroke: sel ? "#1f4e6b" : "#e67e22",
        "stroke-width": sel ? 2.2 : 1.5, rx: 3,
        "data-furn": layer.id, class: "skica-furn",
      }));
      g.appendChild(el("rect", {
        x: absX(parts.mattress.x), y: absY(parts.mattress.y),
        width: parts.mattress.w, height: parts.mattress.d,
        fill: "rgba(255,255,255,0.35)", stroke: "#d35400", "stroke-width": 1,
        "pointer-events": "none",
      }));
      const t = el("text", {
        x: box.x + box.w / 2, y: box.y + box.d / 2,
        fill: "#e67e22", "font-size": 9, "text-anchor": "middle",
        "dominant-baseline": "middle", "pointer-events": "none",
      });
      t.textContent = `Postel ${parts.matW}`;
      g.appendChild(t);
    } else {
      const box = furnAbs(layer);
      const colors = {
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
    if (sel) {
      const hs = 12;
      const box = furnAbs(layer);
      g.appendChild(el("rect", {
        class: "furn-se",
        "data-furn": layer.id,
        "data-furn-act": "se",
        x: box.x + box.w - hs, y: box.y + box.d - hs, width: hs, height: hs,
        fill: "#1a5276", stroke: "#fff", "stroke-width": 1,
      }));
    }
  }
  // Openings above furniture so they stay draggable
  for (const op of state.openings) {
    const part = state.partitions.find((p) => p.id === op.partitionId);
    if (!part) continue;
    const box = openingAbs(op, part);
    const sel = op.id === state.openingSelectedId;
    g.appendChild(el("rect", {
      x: box.x, y: box.y, width: box.w, height: box.d,
      fill: "#fff", stroke: sel ? "#b8860b" : "#d4a017",
      "stroke-width": sel ? 2.5 : 1.5,
      "data-opening": op.id,
      class: "skica-opening",
    }));
    const leaf = doorLeafBox(op, part);
    g.appendChild(el("rect", {
      x: absX(leaf.x), y: absY(leaf.y), width: leaf.w, height: leaf.d,
      fill: op.leafOpen ? "rgba(225,177,44,0.55)" : "#e1b12c",
      stroke: "#8a6d00", "stroke-width": 1,
      "pointer-events": "none",
    }));
    // Hinge / slide cue
    if (op.kind === "door") {
      const vert = LM.isVerticalPartition(part);
      const hx = vert
        ? box.x + box.w / 2
        : (op.hinge === "end" ? box.x + box.w - 3 : box.x + 3);
      const hy = vert
        ? (op.hinge === "end" ? box.y + box.d - 3 : box.y + 3)
        : box.y + box.d / 2;
      g.appendChild(el("circle", {
        cx: hx, cy: hy, r: 3.5,
        fill: "#8a6d00", "pointer-events": "none",
      }));
    }
    const t = el("text", {
      x: box.x + box.w / 2, y: box.y + box.d / 2,
      fill: "#8a6d00", "font-size": 9, "text-anchor": "middle",
      "dominant-baseline": "middle", "pointer-events": "none",
    });
    t.textContent = op.leafOpen ? "O" : (op.kind === "door" ? "D" : (op.kind === "pocket" ? "P" : "S"));
    g.appendChild(t);
  }
  // Length handles when editing partition (not when dragging a door)
  if (!state.openingSelectedId) {
    const p = state.partitions.find((x) => x.id === state.partSelectedId);
    if (p) {
      const box = partAbs(p);
      const vert = LM.isVerticalPartition(p);
      const hx = vert ? box.x + box.w / 2 - HANDLE / 2 : box.x - HANDLE / 2;
      const hy = vert ? box.y - HANDLE / 2 : box.y + box.d / 2 - HANDLE / 2;
      const hx2 = vert ? box.x + box.w / 2 - HANDLE / 2 : box.x + box.w - HANDLE / 2;
      const hy2 = vert ? box.y + box.d - HANDLE / 2 : box.y + box.d / 2 - HANDLE / 2;
      for (const [act, x, y] of [["len-a", hx, hy], ["len-b", hx2, hy2]]) {
        g.appendChild(el("rect", {
          x, y, width: HANDLE, height: HANDLE,
          fill: "#1a5276", stroke: "#fff", "stroke-width": 1.5, rx: 2,
          "data-part": p.id,
          "data-part-act": act,
          class: vert ? "skica-part-len-ns" : "skica-part-len-ew",
        }));
      }
      const midX = box.x + box.w / 2;
      const midY = box.y + box.d / 2;
      const lenLab = el("text", {
        x: midX, y: midY - (vert ? 0 : 14),
        fill: "#1a5276", "font-size": 10, "font-weight": "700",
        "text-anchor": "middle", "dominant-baseline": "middle",
        "pointer-events": "none",
      });
      lenLab.textContent = `${Math.round(LM.partitionLength(p))} cm`;
      g.appendChild(lenLab);
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
        boxes.push({ ...doorLeafBox(o.op, p), h: leafH, color: "#e1b12c", matKind: "wood" });
        cursor = o.ob.y + o.ob.d;
      }
      if (end > cursor + 0.5) boxes.push({ x: box.x, y: cursor, w: box.w, d: end - cursor, h: roomH, color: "#95a5a6", matKind: "wall" });
    } else {
      let cursor = box.x;
      const end = box.x + box.w;
      for (const o of ops.map((op) => ({ op, ob: LM.openingBox(op, p) })).sort((a, b) => a.ob.x - b.ob.x)) {
        if (o.ob.x > cursor + 0.5) boxes.push({ x: cursor, y: box.y, w: o.ob.x - cursor, d: box.d, h: roomH, color: "#95a5a6", matKind: "wall" });
        boxes.push({ x: o.ob.x, y: box.y, w: o.ob.w, d: box.d, h: roomH - doorH, elev: doorH, color: "#95a5a6", matKind: "wall" });
        boxes.push({ ...doorLeafBox(o.op, p), h: leafH, color: "#e1b12c", matKind: "wood" });
        cursor = o.ob.x + o.ob.w;
      }
      if (end > cursor + 0.5) boxes.push({ x: cursor, y: box.y, w: end - cursor, d: box.d, h: roomH, color: "#95a5a6", matKind: "wall" });
    }
  }

  for (const layer of state.furnitureLayers) {
    if (layer.kind === "sofa") {
      const arms = LM.sofaArmsFromLayer(layer);
      for (const b of LM.sofa3dBoxes(arms.west, arms.north)) boxes.push(b);
    } else if (layer.kind === "bed") {
      const parts = LM.bedPartsFromLayer(layer);
      const matH = 20;
      const baseH = 25;
      boxes.push({ ...parts.frame, h: baseH, color: "#d35400", matKind: "wood" });
      boxes.push({ ...parts.mattress, h: matH, elev: baseH, color: "#f5cd79", matKind: "furniture" });
    } else if (layer.kind === "kitchen") {
      boxes.push({ x: layer.x, y: layer.y, w: layer.w, d: layer.d, h: layer.h || 86, color: "#27ae60", matKind: "furniture" });
    } else if (layer.kind === "shower") {
      boxes.push({ x: layer.x, y: layer.y, w: layer.w, d: layer.d, h: 5, color: "#3498db", matKind: "furniture" });
    } else if (layer.kind === "wc") {
      boxes.push({ x: layer.x, y: layer.y, w: layer.w, d: layer.d, h: 40, color: "#ecf0f1", matKind: "furniture" });
    } else if (layer.kind === "sink") {
      const cabH = layer.h || 57;
      const basinH = layer.basinH || 10;
      const baseElev = layer.baseElev || 0;
      boxes.push({
        x: layer.x, y: layer.y, w: layer.w, d: layer.d,
        h: cabH, elev: baseElev, color: "#bdc3c7", matKind: "furniture",
      });
      boxes.push({
        x: layer.x, y: layer.y, w: layer.w, d: layer.d,
        h: basinH, elev: baseElev + cabH, color: "#ecf0f1", matKind: "furniture",
      });
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

  function setDoorWidth(op, w) {
    const pr = state.partitions.find((p) => p.id === op.partitionId);
    const len = pr ? LM.partitionLength(pr) : 999;
    op.width = Math.min(Math.max(40, Math.round(w) || 70), Math.min(120, len));
    op.offset = Math.min(Math.max(0, op.offset), Math.max(0, len - op.width));
  }

  /** Compass-ish labels for hinge/side relative to partition orientation. */
  function doorDirLabels(part) {
    if (part && LM.isVerticalPartition(part)) {
      return {
        hingeStart: "Severní pant",
        hingeEnd: "Jižní pant",
        sidePos: "Na východ",
        sideNeg: "Na západ",
        slideNeg: "Na sever",
        slidePos: "Na jih",
        hingeLab: "Pant (levé / pravé podél S–J)",
        sideLab: "Otevírání (dovnitř / ven = V / Z)",
        slideLab: "Směr posunu (S / J)",
        slideSideLab: "Líc posuvu (V / Z)",
      };
    }
    return {
      hingeStart: "Západní pant",
      hingeEnd: "Východní pant",
      sidePos: "Na jih",
      sideNeg: "Na sever",
      slideNeg: "Na západ",
      slidePos: "Na východ",
      hingeLab: "Pant (levé / pravé podél Z–V)",
      sideLab: "Otevírání (dovnitř / ven = J / S)",
      slideLab: "Směr posunu (Z / V)",
      slideSideLab: "Líc posuvu (J / S)",
    };
  }

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
            <div id="skica-door-cfg" hidden>
              <label>Typ</label>
              <div class="row seg" id="skica-door-kind" style="margin-bottom:8px;flex-wrap:wrap">
                <button type="button" data-v="door">Klasické</button>
                <button type="button" data-v="pocket">Pouzdro</button>
                <button type="button" data-v="slide">Posuv po stěně</button>
              </div>
              <label>Šířka otvoru</label>
              <div class="row seg" id="skica-door-width" style="margin-bottom:6px">
                <button type="button" data-v="60">60</button>
                <button type="button" data-v="70">70</button>
                <button type="button" data-v="80">80</button>
                <button type="button" data-v="90">90</button>
              </div>
              <input type="number" id="skica-door-width-n" min="40" max="120" step="1" value="70" style="width:100%;margin-bottom:8px">
              <div id="skica-door-hinged">
                <label id="skica-door-hinge-lab">Pant (levé / pravé)</label>
                <div class="row seg" id="skica-door-hinge" style="margin-bottom:8px">
                  <button type="button" data-v="start">Levé</button>
                  <button type="button" data-v="end">Pravé</button>
                </div>
                <label id="skica-door-side-lab">Otevírání (dovnitř / ven)</label>
                <div class="row seg" id="skica-door-side" style="margin-bottom:8px">
                  <button type="button" data-v="pos">Strana +</button>
                  <button type="button" data-v="neg">Strana −</button>
                </div>
              </div>
              <div id="skica-door-sliding" hidden>
                <label id="skica-door-slide-lab">Směr posunu</label>
                <div class="row seg" id="skica-door-pocket-dir" style="margin-bottom:8px">
                  <button type="button" data-v="neg">−</button>
                  <button type="button" data-v="pos">+</button>
                </div>
                <div id="skica-door-slide-side-wrap">
                  <label id="skica-door-slide-side-lab">Líc posuvu</label>
                  <div class="row seg" id="skica-door-slide-side" style="margin-bottom:8px">
                    <button type="button" data-v="pos">Strana +</button>
                    <button type="button" data-v="neg">Strana −</button>
                  </div>
                </div>
              </div>
              <div class="row" style="margin-bottom:8px;gap:6px">
                <button type="button" class="btn" id="skica-door-toggle" style="flex:1">Otevřít / Zavřít</button>
                <button type="button" class="btn" id="skica-door-del" style="flex:1">Smazat</button>
              </div>
            </div>
            <p class="hint">Vyber dveře · táhni po příčce. Klasické: pant + strana otevírání. Posuv: pouzdro ve stěně nebo po vnějším líci.</p>
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
            <div id="skica-size-wrap" hidden style="margin-bottom:8px">
              <label id="skica-furn-wd-lab">Šířka (V–Z) / Délka (S–J)</label>
              <div class="row" style="gap:6px;margin-top:4px">
                <input type="number" id="skica-furn-w" min="4" max="400" step="1" style="flex:1">
                <input type="number" id="skica-furn-d" min="4" max="400" step="1" style="flex:1">
              </div>
              <div id="skica-furn-h-wrap" hidden style="margin-top:6px">
                <label>Výška H (do 3D)</label>
                <input type="number" id="skica-furn-h" min="10" max="280" step="1" style="width:100%;margin-top:4px">
                <p class="hint" style="margin-top:4px">Např. vysoká skříň 180–210 cm · u umyvadla = výška skříňky.</p>
              </div>
              <div id="skica-sink-extra" hidden style="margin-top:6px">
                <label>Umyvadlo (nad skříňkou) / odstup ode země</label>
                <div class="row" style="gap:6px;margin-top:4px">
                  <input type="number" id="skica-sink-basinh" min="5" max="20" step="1" style="flex:1" title="Výška umyvadla">
                  <input type="number" id="skica-sink-base" min="0" max="40" step="1" style="flex:1" title="Odstup skříňky ode země">
                </div>
              </div>
              <div id="skica-sofa-arms" hidden style="margin-top:6px">
                <label>Hloubka ramen (Z / S)</label>
                <div class="row" style="gap:6px;margin-top:4px">
                  <input type="number" id="skica-sofa-armw" min="40" max="160" step="1" style="flex:1" title="Západní rameno">
                  <input type="number" id="skica-sofa-armd" min="40" max="160" step="1" style="flex:1" title="Severní rameno">
                </div>
              </div>
              <p class="hint" style="margin-top:4px">Nebo táhni úchyt v JV rohu vybraného kusu.</p>
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
        offset: 40, width: 70, kind: "door",
        hinge: "start", side: "pos", pocketDir: "pos",
        leafOpen: false,
      });
      state.openings.push(op);
      state.openingSelectedId = op.id;
      persist();
      render();
    });
    const selectedDoor = () => state.openings.find((o) => o.id === state.openingSelectedId);

    panel.querySelector("#skica-door-kind")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-v]");
      const op = selectedDoor();
      if (!btn || !op) return;
      op.kind = btn.dataset.v;
      persist();
      render();
    });
    panel.querySelector("#skica-door-width")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-v]");
      const op = selectedDoor();
      if (!btn || !op) return;
      setDoorWidth(op, Number(btn.dataset.v));
      persist();
      render();
    });
    const widthN = panel.querySelector("#skica-door-width-n");
    const onWidthN = () => {
      const op = selectedDoor();
      if (!op || !widthN) return;
      setDoorWidth(op, Number(widthN.value));
      persist();
      render();
    };
    widthN?.addEventListener("change", onWidthN);
    widthN?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); onWidthN(); }
    });
    panel.querySelector("#skica-door-hinge")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-v]");
      const op = selectedDoor();
      if (!btn || !op) return;
      op.hinge = btn.dataset.v === "end" ? "end" : "start";
      persist();
      render();
    });
    panel.querySelector("#skica-door-side")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-v]");
      const op = selectedDoor();
      if (!btn || !op) return;
      op.side = btn.dataset.v === "neg" ? "neg" : "pos";
      persist();
      render();
    });
    panel.querySelector("#skica-door-pocket-dir")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-v]");
      const op = selectedDoor();
      if (!btn || !op) return;
      op.pocketDir = btn.dataset.v === "neg" ? "neg" : "pos";
      persist();
      render();
    });
    panel.querySelector("#skica-door-slide-side")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-v]");
      const op = selectedDoor();
      if (!btn || !op) return;
      op.side = btn.dataset.v === "neg" ? "neg" : "pos";
      persist();
      render();
    });
    panel.querySelector("#skica-door-toggle")?.addEventListener("click", () => {
      const op = selectedDoor();
      if (!op) { alert("Nejdřív vyber dveře na půdorysu nebo v seznamu."); return; }
      op.leafOpen = !op.leafOpen;
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
    const onFurnSize = () => {
      const layer = state.furnitureLayers.find((l) => l.id === state.furnSelectedId);
      if (!layer) return;
      const min = furnMinSize(layer);
      const wEl = panel.querySelector("#skica-furn-w");
      const dEl = panel.querySelector("#skica-furn-d");
      const hEl = panel.querySelector("#skica-furn-h");
      const awEl = panel.querySelector("#skica-sofa-armw");
      const adEl = panel.querySelector("#skica-sofa-armd");
      if (wEl) {
        const raw = Number(wEl.value);
        if (Number.isFinite(raw)) layer.w = Math.min(400, Math.max(min.w, raw));
      }
      if (dEl) {
        const raw = Number(dEl.value);
        if (Number.isFinite(raw)) layer.d = Math.min(400, Math.max(min.d, raw));
      }
      if (hEl && !hEl.closest("#skica-furn-h-wrap")?.hidden) {
        const raw = Number(hEl.value);
        if (Number.isFinite(raw)) layer.h = Math.min(280, Math.max(10, raw));
      }
      if (layer.kind === "sink") {
        const bh = panel.querySelector("#skica-sink-basinh");
        const be = panel.querySelector("#skica-sink-base");
        if (bh && Number.isFinite(Number(bh.value))) layer.basinH = Math.min(20, Math.max(5, Number(bh.value)));
        if (be && Number.isFinite(Number(be.value))) layer.baseElev = Math.min(40, Math.max(0, Number(be.value)));
      }
      if (layer.kind === "sofa") {
        if (awEl) layer.armW = Math.min(layer.w, Math.max(40, Number(awEl.value) || layer.armW || 95));
        if (adEl) layer.armD = Math.min(layer.d, Math.max(40, Number(adEl.value) || layer.armD || 90));
      }
      clampFurn(layer);
      persist();
      render();
    };
    for (const id of ["skica-furn-w", "skica-furn-d", "skica-furn-h", "skica-sink-basinh", "skica-sink-base", "skica-sofa-armw", "skica-sofa-armd"]) {
      const eln = panel.querySelector(`#${id}`);
      eln?.addEventListener("change", onFurnSize);
      eln?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); onFurnSize(); }
      });
    }
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
      if (!confirm("Obnovit výchozí skicu (aktuální vestavěné rozložení)?")) return;
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
        const part = state.partitions.find((p) => p.id === o.partitionId);
        const partName = part?.name || o.partitionId;
        li.textContent = `${o.name || "Dveře"} · ${LM.openingKindLabel(o.kind)} ${Math.round(o.width)} · ${partName} · ${o.leafOpen ? "otevřeno" : "zavřeno"}`;
        li.onclick = () => { state.openingSelectedId = o.id; state.partSelectedId = o.partitionId; persist(); render(); };
        doorList.appendChild(li);
      }
    }
    const op = state.openings.find((o) => o.id === state.openingSelectedId);
    const part = op && state.partitions.find((p) => p.id === op.partitionId);
    const cfg = panel.querySelector("#skica-door-cfg");
    if (cfg) cfg.hidden = !op;
    if (op) {
      const labs = doorDirLabels(part);
      const hinged = op.kind === "door";
      const sliding = !hinged;
      const hingWrap = panel.querySelector("#skica-door-hinged");
      const slidWrap = panel.querySelector("#skica-door-sliding");
      if (hingWrap) hingWrap.hidden = !hinged;
      if (slidWrap) slidWrap.hidden = !sliding;
      const slideSideWrap = panel.querySelector("#skica-door-slide-side-wrap");
      if (slideSideWrap) slideSideWrap.hidden = op.kind !== "slide";
      const setLab = (id, text) => { const n = panel.querySelector(`#${id}`); if (n) n.textContent = text; };
      setLab("skica-door-hinge-lab", labs.hingeLab);
      setLab("skica-door-side-lab", labs.sideLab);
      setLab("skica-door-slide-lab", labs.slideLab);
      setLab("skica-door-slide-side-lab", labs.slideSideLab);
      const markSeg = (rootId, value) => {
        panel.querySelectorAll(`#${rootId} button`).forEach((b) => {
          b.classList.toggle("active", b.dataset.v === String(value));
        });
      };
      markSeg("skica-door-kind", op.kind);
      markSeg("skica-door-width", String(Math.round(op.width)));
      markSeg("skica-door-hinge", op.hinge === "end" ? "end" : "start");
      markSeg("skica-door-side", op.side);
      markSeg("skica-door-pocket-dir", op.pocketDir);
      markSeg("skica-door-slide-side", op.side);
      const hingeBtns = panel.querySelectorAll("#skica-door-hinge button");
      if (hingeBtns[0]) hingeBtns[0].textContent = labs.hingeStart;
      if (hingeBtns[1]) hingeBtns[1].textContent = labs.hingeEnd;
      const sideBtns = panel.querySelectorAll("#skica-door-side button");
      if (sideBtns[0]) sideBtns[0].textContent = labs.sidePos;
      if (sideBtns[1]) sideBtns[1].textContent = labs.sideNeg;
      const slideBtns = panel.querySelectorAll("#skica-door-pocket-dir button");
      if (slideBtns[0]) slideBtns[0].textContent = labs.slideNeg;
      if (slideBtns[1]) slideBtns[1].textContent = labs.slidePos;
      const slideSideBtns = panel.querySelectorAll("#skica-door-slide-side button");
      if (slideSideBtns[0]) slideSideBtns[0].textContent = labs.sidePos;
      if (slideSideBtns[1]) slideSideBtns[1].textContent = labs.sideNeg;
      const widthN = panel.querySelector("#skica-door-width-n");
      if (widthN && document.activeElement !== widthN) widthN.value = String(Math.round(op.width));
    }
    const toggleBtn = panel.querySelector("#skica-door-toggle");
    if (toggleBtn) {
      toggleBtn.textContent = !op ? "Otevřít / Zavřít" : (op.leafOpen ? "Zavřít dveře" : "Otevřít dveře");
      toggleBtn.disabled = !op;
    }
    const furnList = panel.querySelector("#skica-furn-list");
    if (furnList) {
      furnList.innerHTML = "";
      for (const layer of state.furnitureLayers) {
        const li = document.createElement("li");
        if (layer.id === state.furnSelectedId) li.classList.add("selected");
        li.textContent = `${LM.FURN_KINDS[layer.kind]?.label || layer.kind}: ${layer.name} (${Math.round(layer.w)}×${Math.round(layer.d)}${layer.kind === "generic" || layer.kind === "kitchen" || layer.kind === "tv" ? `×${Math.round(layer.h || 75)}` : ""})`;
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
    const sizeWrap = panel.querySelector("#skica-size-wrap");
    const armsWrap = panel.querySelector("#skica-sofa-arms");
    const hWrap = panel.querySelector("#skica-furn-h-wrap");
    if (sizeWrap) {
      if (!layer) sizeWrap.hidden = true;
      else {
        sizeWrap.hidden = false;
        const wEl = panel.querySelector("#skica-furn-w");
        const dEl = panel.querySelector("#skica-furn-d");
        const min = furnMinSize(layer);
        if (wEl) {
          wEl.min = String(min.w);
          if (document.activeElement !== wEl) wEl.value = String(Math.round(layer.w));
        }
        if (dEl) {
          dEl.min = String(min.d);
          if (document.activeElement !== dEl) dEl.value = String(Math.round(layer.d));
        }
        const wdLab = panel.querySelector("#skica-furn-wd-lab");
        if (wdLab) {
          wdLab.textContent = layer.kind === "tv"
            ? "Tloušťka (V–Z) / šířka panelu (S–J)"
            : "Šířka (V–Z) / Délka (S–J)";
        }
        const showH = layer.kind === "generic" || layer.kind === "kitchen" || layer.kind === "tv" || layer.kind === "sink";
        if (hWrap) {
          hWrap.hidden = !showH;
          if (showH) {
            const hEl = panel.querySelector("#skica-furn-h");
            if (hEl && document.activeElement !== hEl) hEl.value = String(Math.round(layer.h || 75));
          }
        }
        const sinkExtra = panel.querySelector("#skica-sink-extra");
        if (sinkExtra) {
          sinkExtra.hidden = layer.kind !== "sink";
          if (layer.kind === "sink") {
            const bh = panel.querySelector("#skica-sink-basinh");
            const be = panel.querySelector("#skica-sink-base");
            if (bh && document.activeElement !== bh) bh.value = String(Math.round(layer.basinH || 10));
            if (be && document.activeElement !== be) be.value = String(Math.round(layer.baseElev || 0));
          }
        }
        if (armsWrap) {
          armsWrap.hidden = layer.kind !== "sofa";
          if (layer.kind === "sofa") {
            const aw = panel.querySelector("#skica-sofa-armw");
            const ad = panel.querySelector("#skica-sofa-armd");
            if (aw && document.activeElement !== aw) aw.value = String(Math.round(layer.armW || 95));
            if (ad && document.activeElement !== ad) ad.value = String(Math.round(layer.armD || 90));
          }
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
      if (state.tool === "part-draw") {
        hint.textContent = "Táhni osa-aligned příčku na půdorysu…";
      } else if (state.openingSelectedId) {
        const op = state.openings.find((o) => o.id === state.openingSelectedId);
        hint.textContent = op
          ? `Dveře · ${LM.openingKindLabel(op.kind)} ${Math.round(op.width)} cm · táhni po příčce · ${op.leafOpen ? "otevřeno" : "zavřeno"}`
          : "Vyber dveře";
      } else if (state.partSelectedId) {
        const pr = state.partitions.find((p) => p.id === state.partSelectedId);
        const len = pr ? Math.round(LM.partitionLength(pr)) : 0;
        hint.textContent = `Vybraná příčka ${len} cm · táhni tělo = posun · úchyty na koncích = délka`;
      } else {
        hint.textContent = `${state.partitions.length} příček · ${state.openings.length} dveří · ${state.furnitureLayers.length} kusů · dveře táhni po příčce`;
      }
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
      const act = furn.getAttribute("data-furn-act") || "move";
      const layer = state.furnitureLayers.find((l) => l.id === id);
      if (layer) {
        state.furnSelectedId = id;
        state.openingSelectedId = null;
        state.drag = {
          type: act === "se" ? "furn-se" : "furn-move",
          id, start: p,
          ox: layer.x, oy: layer.y, ow: layer.w, od: layer.d,
        };
        evt.preventDefault();
        render();
        return;
      }
    }
    const open = t.closest?.("[data-opening]");
    if (open) {
      const id = open.getAttribute("data-opening");
      const op = state.openings.find((o) => o.id === id);
      if (op) {
        state.openingSelectedId = id;
        state.partSelectedId = op.partitionId;
        state.furnSelectedId = null;
        state.drag = {
          type: "opening-move",
          id,
          start: p,
          oOffset: op.offset,
        };
        evt.preventDefault();
        render();
        return;
      }
    }
    const part = t.closest?.("[data-part]");
    if (part) {
      const id = part.getAttribute("data-part");
      const act = part.getAttribute("data-part-act") || "move";
      const pr = state.partitions.find((x) => x.id === id);
      if (pr) {
        state.partSelectedId = id;
        state.openingSelectedId = null;
        state.drag = {
          type: act === "len-a" || act === "len-b" ? `part-${act}` : "part-move",
          id, start: p,
          ox1: pr.x1, oy1: pr.y1, ox2: pr.x2, oy2: pr.y2,
        };
        evt.preventDefault();
        render();
      }
    }
  }

  /** Keep doors inside shortened partitions. */
  function clampOpeningsOnPartition(partId) {
    const pr = state.partitions.find((x) => x.id === partId);
    if (!pr) return;
    const len = LM.partitionLength(pr);
    for (const op of state.openings) {
      if (op.partitionId !== partId) continue;
      op.width = Math.min(op.width, Math.max(40, len));
      op.offset = Math.min(Math.max(0, op.offset), Math.max(0, len - op.width));
    }
  }

  /** When the geometric min end moves, keep openings fixed in world space. */
  function shiftOpeningOffsets(partId, dMin) {
    if (!dMin) return;
    for (const op of state.openings) {
      if (op.partitionId !== partId) continue;
      op.offset -= dMin;
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
    if (state.drag.type === "furn-se") {
      const layer = state.furnitureLayers.find((l) => l.id === state.drag.id);
      if (layer) {
        const min = furnMinSize(layer);
        layer.w = Math.max(min.w, state.drag.ow + dx);
        layer.d = Math.max(min.d, state.drag.od + dy);
        if (layer.kind === "sofa") {
          layer.armW = Math.min(layer.w, layer.armW || 95);
          layer.armD = Math.min(layer.d, layer.armD || 90);
        }
        clampFurn(layer);
      }
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderPlanOnly(); });
      return;
    }
    if (state.drag.type === "opening-move") {
      const op = state.openings.find((o) => o.id === state.drag.id);
      const pr = op && state.partitions.find((x) => x.id === op.partitionId);
      if (op && pr) {
        const len = LM.partitionLength(pr);
        const along = LM.isVerticalPartition(pr) ? dy : dx;
        op.offset = Math.min(
          Math.max(0, state.drag.oOffset + along),
          Math.max(0, len - op.width),
        );
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
      return;
    }
    if (state.drag.type === "part-len-a" || state.drag.type === "part-len-b") {
      const pr = state.partitions.find((x) => x.id === state.drag.id);
      if (pr) {
        const dragMin = state.drag.type === "part-len-a"; // visual handle at geometric min end
        if (LM.isVerticalPartition(pr)) {
          const startMin = Math.min(state.drag.oy1, state.drag.oy2);
          const startMax = Math.max(state.drag.oy1, state.drag.oy2);
          const oldMin = Math.min(pr.y1, pr.y2);
          let yMin = startMin;
          let yMax = startMax;
          if (dragMin) yMin = Math.min(startMax - PART_LEN_MIN, Math.max(0, startMin + dy));
          else yMax = Math.max(startMin + PART_LEN_MIN, Math.min(CLEAR.h, startMax + dy));
          pr.y1 = yMin;
          pr.y2 = yMax;
          shiftOpeningOffsets(pr.id, yMin - oldMin);
        } else {
          const startMin = Math.min(state.drag.ox1, state.drag.ox2);
          const startMax = Math.max(state.drag.ox1, state.drag.ox2);
          const oldMin = Math.min(pr.x1, pr.x2);
          let xMin = startMin;
          let xMax = startMax;
          if (dragMin) xMin = Math.min(startMax - PART_LEN_MIN, Math.max(0, startMin + dx));
          else xMax = Math.max(startMin + PART_LEN_MIN, Math.min(CLEAR.w, startMax + dx));
          pr.x1 = xMin;
          pr.x2 = xMax;
          shiftOpeningOffsets(pr.id, xMin - oldMin);
        }
        clampOpeningsOnPartition(pr.id);
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
