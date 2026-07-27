# Elektro Auto-Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick circuit points, propose a wall-following trunk+stubs route from the panel (draft → accept/discard), with power slots 12/16/20/24 and data at ~200 cm; add elev strip zoom/pan so 4-wall views stay usable.

**Architecture:** Pure routing logic lives in `koupelna/autoroute.mjs` (wall graph, slot pick, MST-style trunk, stub derivation). `koupelna/index.html` owns UI/state/snapshot and calls the module. Elev zoom is a small SVG pan/zoom layer on the existing strip. Tests use Node’s built-in test runner against the pure module.

**Tech Stack:** Vanilla JS (ESM), Node `node:test` + `node:assert`, existing planner state in `koupelna/index.html`, Cloudflare Pages deploy via `./scripts/deploy.sh`.

**Spec:** `docs/2026-07-27-planner-electro-autoroute-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `koupelna/autoroute.mjs` | Wall graph, slot allocation, propose trunk polyline, stub segs, length helper |
| `koupelna/autoroute.test.mjs` | Unit tests for autoroute (no DOM) |
| `koupelna/index.html` | State fields, UI (checkboxes, propose/accept/discard), normalize/snapshot, call autoroute, elev zoom/pan, version bump |
| `docs/2026-07-27-planner-electro-autoroute-design.md` | Already written — update only if implementation forces a rule change |

---

### Task 1: Autoroute module — wall graph + projections

**Files:**
- Create: `koupelna/autoroute.mjs`
- Create: `koupelna/autoroute.test.mjs`

- [ ] **Step 1: Write failing tests for wall projection and graph length**

```js
// koupelna/autoroute.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { projectPointToWalls, buildWallGraph, shortestPath } from "./autoroute.mjs";

const CLEAR = { w: 906, h: 333 };
const walls = [
  { id: "north", x0: 0, y0: 0, x1: 906, y1: 0 },
  { id: "east", x0: 906, y0: 0, x1: 906, y1: 333 },
  { id: "south", x0: 906, y0: 333, x1: 0, y1: 333 },
  { id: "west", x0: 0, y0: 333, x1: 0, y1: 0 },
];

describe("projectPointToWalls", () => {
  it("projects a near-north point onto north wall", () => {
    const p = projectPointToWalls({ x: 100, y: 5 }, walls);
    assert.equal(p.wall, "north");
    assert.ok(Math.abs(p.along - 100) < 1);
  });
});

describe("shortestPath", () => {
  it("walks north then east around a corner", () => {
    const g = buildWallGraph(walls);
    const path = shortestPath(g, { wall: "north", along: 100 }, { wall: "east", along: 50 });
    assert.ok(path.length >= 2);
    assert.equal(path[0].wall, "north");
    assert.equal(path[path.length - 1].wall, "east");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

Run: `cd /Users/david.vopicka/Documents/chata-kamyk && node --test koupelna/autoroute.test.mjs`  
Expected: FAIL cannot find module / exports

- [ ] **Step 3: Implement minimal graph helpers in `autoroute.mjs`**

```js
// koupelna/autoroute.mjs
/** @typedef {{ id: string, x0: number, y0: number, x1: number, y1: number }} WallSeg */
/** @typedef {{ wall: string, along: number }} WallPos */

export function projectPointToWalls(pt, walls) {
  let best = null;
  for (const w of walls) {
    const len = Math.hypot(w.x1 - w.x0, w.y1 - w.y0) || 1;
    const ux = (w.x1 - w.x0) / len, uy = (w.y1 - w.y0) / len;
    let t = ((pt.x - w.x0) * ux + (pt.y - w.y0) * uy);
    t = Math.max(0, Math.min(len, t));
    const qx = w.x0 + ux * t, qy = w.y0 + uy * t;
    const d = Math.hypot(pt.x - qx, pt.y - qy);
    if (!best || d < best.d) best = { wall: w.id, along: t, d, x: qx, y: qy };
  }
  return best;
}

export function buildWallGraph(walls) {
  // nodes: `${wallId}:${alongRounded}` at endpoints + shared corners by coordinates
  // edges: along each wall segment; corner edges between walls that share an endpoint (dist < 1)
  // return { nodes: Map, neighbors: (id) => [{id, cost}] }
}

export function shortestPath(graph, from, to) {
  // Dijkstra; return WallPos[] including corners as wall changes
}
```

Implement `buildWallGraph` / `shortestPath` fully (no stubs). Corner join: if endpoint of wall A is within 1 cm of endpoint of wall B, add zero-cost (or tiny) link transferring between walls.

- [ ] **Step 4: Run tests — expect PASS**

Run: `node --test koupelna/autoroute.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add koupelna/autoroute.mjs koupelna/autoroute.test.mjs
git commit -m "feat: wall graph helpers for electro autoroute"
```

---

### Task 2: Slot picker + proposeRoute

**Files:**
- Modify: `koupelna/autoroute.mjs`
- Modify: `koupelna/autoroute.test.mjs`

- [ ] **Step 1: Add failing tests**

```js
import { pickTrunkSlot, proposeRoute } from "./autoroute.mjs";

describe("pickTrunkSlot", () => {
  it("picks first free power slot", () => {
    assert.equal(pickTrunkSlot("sockets", [12, 16]), 20);
  });
  it("uses ~200 for data", () => {
    assert.equal(pickTrunkSlot("data", [200]), 200); // still 200; collision only among data if needed
  });
});

describe("proposeRoute", () => {
  it("builds trunk from panel to one socket with stub height", () => {
    const walls = [/* same 4 outer walls */];
    const route = proposeRoute({
      kind: "sockets",
      walls,
      panel: { x: 548, y: 2 },
      points: [{ id: "p1", x: 200, y: 5, h: 30 }],
      occupiedSlots: [],
    });
    assert.equal(route.trunkH, 12);
    assert.equal(route.cableType, "cyky25");
    assert.ok(route.points.length >= 2);
    assert.deepEqual(route.pointIds, ["p1"]);
    assert.equal(route.status, "draft");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `node --test koupelna/autoroute.test.mjs`  
Expected: FAIL missing exports

- [ ] **Step 3: Implement**

```js
export const POWER_SLOTS = [12, 16, 20, 24];
export const DATA_TRUNK_H = 200;
export const KIND_CABLE = { sockets: "cyky25", lights: "cyky15", data: "slaboproud" };

export function pickTrunkSlot(kind, occupiedPowerSlots = [], occupiedData = false) {
  if (kind === "data") return DATA_TRUNK_H;
  for (const s of POWER_SLOTS) {
    if (!occupiedPowerSlots.includes(s)) return s;
  }
  return POWER_SLOTS[POWER_SLOTS.length - 1];
}

export function proposeRoute({ kind, walls, panel, points, occupiedSlots }) {
  const cableType = KIND_CABLE[kind] || "cyky25";
  const trunkH = pickTrunkSlot(kind, occupiedSlots);
  const graph = buildWallGraph(walls);
  const panelPos = projectPointToWalls(panel, walls);
  const targets = points.map((p) => ({
    id: p.id,
    pos: projectPointToWalls(p, walls),
    h: p.h,
  }));
  // Greedy: order targets by path length from panel; build polyline merging paths
  // All trunk vertices use h: trunkH
  // Return { cableType, trunkH, points: WallPos&{h}[], pointIds, status: "draft" }
}
```

Path merge algorithm (v1): sort targets by `shortestPath` length from panel; start polyline = path to first; for each next target, append path from nearest existing trunk node (recompute shortest from that node). Deduplicate consecutive equal `(wall,along)`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add koupelna/autoroute.mjs koupelna/autoroute.test.mjs
git commit -m "feat: proposeRoute with power slots and draft trunk"
```

---

### Task 3: Wire walls + occupied slots from planner state

**Files:**
- Modify: `koupelna/index.html` (add helpers near electro section; bump `APP_VERSION` to `3.15.0`)

- [ ] **Step 1: Add `buildElecWallSegs()` using existing geometry**

Clear-space segments for:
- Outer N/E/S/W (`0..CLEAR.w` / `0..CLEAR.h`)
- Bath partitions from `bathPartitionBoxes()` converted via `absToClearBox` to horizontal/vertical segs with ids `bath-west`, `bath-east`, `bath-south`
- TV partition from `tvBox()` → `tv-west` (living face) as vertical seg at `tv.x`

Return `WallSeg[]` compatible with `autoroute.mjs`.

- [ ] **Step 2: Add `occupiedPowerSlots(roomKey)`**

Filter `state.elecElevRuns` where `status !== "draft"` (treat missing status as accepted), circuit in same room, kind sockets|lights → collect `trunkH` that match `POWER_SLOTS`.

- [ ] **Step 3: Dynamic import autoroute like planner3d**

```js
let autorouteMod = null;
async function ensureAutoroute() {
  if (!autorouteMod) autorouteMod = await import("./autoroute.mjs");
  return autorouteMod;
}
```

- [ ] **Step 4: Manual smoke in browser later — for now commit helpers**

```bash
git add koupelna/index.html
git commit -m "feat: wall segs and slot occupancy for autoroute"
```

---

### Task 4: Normalize / snapshot fields

**Files:**
- Modify: `koupelna/index.html` — `normalizeElecElevRuns`, `snapshot()` elev mapping

- [ ] **Step 1: Extend normalize**

For each run:
- `status`: `"draft" | "accepted"` (default `"accepted"`)
- `pointIds`: `string[]` (default `[]`)
- `trunkH`: number (default from cable/kind or 15)

- [ ] **Step 2: Extend snapshot map** to persist `status`, `pointIds`, `trunkH`

- [ ] **Step 3: Commit**

```bash
git add koupelna/index.html
git commit -m "feat: persist autoroute draft status and pointIds"
```

---

### Task 5: UI — select points + propose / accept / discard

**Files:**
- Modify: `koupelna/index.html` — `renderElecActivePoints`, elev list / run detail, CSS

- [ ] **Step 1: State**

```js
elecRoutePointIds: [], // selection for next propose
elecDraftRunId: null,
```

- [ ] **Step 2: In points panel** — checkbox per point; buttons:

```html
<button id="btn-elec-propose-route">Navrhnout trasu</button>
<button id="btn-elec-accept-route" hidden>Přijmout</button>
<button id="btn-elec-discard-route" hidden>Zahodit</button>
```

- [ ] **Step 3: Propose handler**

```js
async function proposeElecRoute() {
  const circ = activeCircuit();
  const panel = state.elecPoints.find((p) => p.type === "panel");
  if (!circ || !panel) { alert("…"); return; }
  const ids = state.elecRoutePointIds.filter(/* same circuit */);
  if (!ids.length) { alert("Vyber aspoň jeden bod."); return; }
  // remove previous draft for this circuit if any
  const mod = await ensureAutoroute();
  const walls = buildElecWallSegs();
  const pts = ids.map((id) => findElecPoint(id)).filter(Boolean);
  const draft = mod.proposeRoute({
    kind: circ.kind,
    walls,
    panel: { x: panel.x, y: panel.y },
    points: pts.map((p) => ({ id: p.id, x: p.x, y: p.y, h: p.h })),
    occupiedSlots: occupiedPowerSlots(circuitRoomKey(circ)),
  });
  const run = {
    id: newElecId("er"),
    circuitId: circ.id,
    cableType: draft.cableType,
    name: circ.name || "",
    pointIds: draft.pointIds,
    trunkH: draft.trunkH,
    points: draft.points,
    status: "draft",
    excludePointIds: [],
    includePointIds: [],
  };
  state.elecElevRuns.push(run);
  state.elecDraftRunId = run.id;
  state.elecSelectedId = run.id;
  state.elecSelectedKind = "elev-run";
  render();
}
```

Accept: set `status = "accepted"`, clear draft id.  
Discard: filter out draft run.

- [ ] **Step 4: Elev draw** — draft runs use dashed stroke / orange; stubs from `pointIds` via existing stub helper updated to use `pointIds` when present (fallback to auto socket attach for legacy).

Update `attachedSockets` / stub logic:
- If `run.pointIds?.length`, stubs for those point ids (any type with wall projection).
- Else keep previous socket auto/hybrid behavior for legacy.

- [ ] **Step 5: Commit**

```bash
git add koupelna/index.html
git commit -m "feat: propose/accept/discard electro routes UI"
```

---

### Task 6: Elev zoom + pan

**Files:**
- Modify: `koupelna/index.html` — `renderElevationView`, elev bar UI, pointer handlers

- [ ] **Step 1: State**

```js
elevView: { scale: 1, panX: 0, panY: 0 },
```

- [ ] **Step 2: Wrap elev SVG content in `<g id="elev-zoom-layer" transform="translate(pan) scale(s)">`** or set `viewBox` dynamically from scale/pan.

Prefer **viewBox** update on wheel (ctrl/meta or always when elev tab): zoom toward cursor; middle-drag or space+drag pans.

- [ ] **Step 3: Buttons on `#elev-wall-bar` or view3d-style bar when elev active:** `Fit pás` (reset), `Fit stěna` (zoom to selected wall panel bounds).

- [ ] **Step 4: Commit**

```bash
git add koupelna/index.html
git commit -m "feat: zoom and pan on electro elevation strip"
```

---

### Task 7: Verification + deploy

- [ ] **Step 1: Run unit tests**

Run: `node --test koupelna/autoroute.test.mjs`  
Expected: all PASS

- [ ] **Step 2: Syntax-check planner script**

Run: `node -e "const fs=require('fs'); const h=fs.readFileSync('koupelna/index.html','utf8'); new Function(h.match(/<script>([\\s\\S]*)<\\/script>/)[1]); console.log('OK')"`  
Expected: `OK`

- [ ] **Step 3: Manual checklist (browser)**

- [ ] Create kitchen sockets + “zásuvky–sporák”; place points; propose two routes → two slots (12 and 16)
- [ ] Accept one, discard one; discarded slot free again
- [ ] Stubs rise to socket h; data circuit trunk ~200
- [ ] 4 walls selected: zoom/pan usable; Fit works

- [ ] **Step 4: Deploy**

```bash
git push -u origin HEAD && ./scripts/deploy.sh
```

Bump already at 3.15.0 in Task 3.

---

## Spec coverage check

| Spec item | Task |
|-----------|------|
| Room/circuit/point/route + pointIds | 4, 5 |
| Hybrid draft → accept/discard | 5 |
| Start at panel | 2, 5 |
| Along walls only | 1, 2 |
| Slots 12/16/20/24 + data ~200 | 2 |
| Cable by kind | 2 |
| Stubs vertical | 2, 5 (derive) |
| Elev zoom/pan | 6 |
| Partition faces as elev cards | Out of v1 (graph still includes partitions for routing) |

## Placeholder / consistency check

- No TBD steps; `buildWallGraph` / merge algorithm specified in Tasks 1–2.
- Names: `proposeRoute`, `pickTrunkSlot`, `POWER_SLOTS`, `status: draft|accepted`, `pointIds` consistent across tasks.
