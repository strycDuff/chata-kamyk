/** @typedef {{ id: string, x0: number, y0: number, x1: number, y1: number }} WallSeg */
/** @typedef {{ wall: string, along: number }} WallPos */

/** @param {{ x: number, y: number }} pt @param {WallSeg[]} walls */
export function projectPointToWalls(pt, walls) {
  let best = null;
  for (const w of walls) {
    const len = Math.hypot(w.x1 - w.x0, w.y1 - w.y0) || 1;
    const ux = (w.x1 - w.x0) / len;
    const uy = (w.y1 - w.y0) / len;
    let t = (pt.x - w.x0) * ux + (pt.y - w.y0) * uy;
    t = Math.max(0, Math.min(len, t));
    const qx = w.x0 + ux * t;
    const qy = w.y0 + uy * t;
    const d = Math.hypot(pt.x - qx, pt.y - qy);
    if (!best || d < best.d) best = { wall: w.id, along: t, d, x: qx, y: qy };
  }
  return best;
}

function nodeId(wall, along) {
  return `${wall}:${Math.round(along * 100) / 100}`;
}

/** @param {WallSeg[]} walls */
export function buildWallGraph(walls) {
  /** @type {Map<string, WallPos>} */
  const nodes = new Map();
  /** @type {Map<string, { id: string, cost: number }[]>} */
  const adj = new Map();

  function addNode(wall, along) {
    const id = nodeId(wall, along);
    if (!nodes.has(id)) {
      nodes.set(id, { wall, along });
      adj.set(id, []);
    }
    return id;
  }

  function addEdge(a, b, cost) {
    adj.get(a).push({ id: b, cost });
    adj.get(b).push({ id: a, cost });
  }

  /** @type {{ wall: string, along: number, x: number, y: number, nodeId: string }[]} */
  const endpoints = [];

  for (const w of walls) {
    const len = Math.hypot(w.x1 - w.x0, w.y1 - w.y0) || 1;
    const id0 = addNode(w.id, 0);
    const id1 = addNode(w.id, len);
    addEdge(id0, id1, len);
    endpoints.push(
      { wall: w.id, along: 0, x: w.x0, y: w.y0, nodeId: id0 },
      { wall: w.id, along: len, x: w.x1, y: w.y1, nodeId: id1 }
    );
  }

  for (let i = 0; i < endpoints.length; i++) {
    for (let j = i + 1; j < endpoints.length; j++) {
      const a = endpoints[i];
      const b = endpoints[j];
      if (a.wall === b.wall) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 1) addEdge(a.nodeId, b.nodeId, 0);
    }
  }

  return {
    nodes,
    neighbors: (id) => adj.get(id) ?? [],
  };
}

/** @param {ReturnType<typeof buildWallGraph>} graph @param {WallPos} from @param {WallPos} to @param {Set<string>} [forbidden] @returns {{ path: WallPos[], cost: number }} */
function findShortestPath(graph, from, to, forbidden = new Set()) {
  const nodes = new Map(graph.nodes);
  /** @type {Map<string, { id: string, cost: number }[]>} */
  const adj = new Map();
  for (const [id, n] of nodes) {
    adj.set(id, graph.neighbors(id).map((e) => ({ ...e })));
  }

  function ensureNode(wall, along) {
    const id = nodeId(wall, along);
    if (!adj.has(id)) {
      adj.set(id, []);
      nodes.set(id, { wall, along });
    }
    return id;
  }

  function linkOnWall(wall, along, id) {
    for (const [otherId, node] of nodes) {
      if (node.wall !== wall || otherId === id) continue;
      const cost = Math.abs(node.along - along);
      adj.get(id).push({ id: otherId, cost });
      adj.get(otherId).push({ id, cost });
    }
  }

  const startId = ensureNode(from.wall, from.along);
  const endId = ensureNode(to.wall, to.along);
  linkOnWall(from.wall, from.along, startId);
  linkOnWall(to.wall, to.along, endId);

  const dist = new Map([[startId, 0]]);
  const prev = new Map();
  const visited = new Set();
  /** @type {string[]} */
  const queue = [startId];

  while (queue.length > 0) {
    queue.sort((a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity));
    const u = queue.shift();
    if (!u || visited.has(u)) continue;
    visited.add(u);
    if (u === endId) break;

    for (const { id: v, cost } of adj.get(u) ?? []) {
      if (forbidden.has(v) && v !== endId) continue;
      const alt = (dist.get(u) ?? Infinity) + cost;
      if (alt < (dist.get(v) ?? Infinity)) {
        dist.set(v, alt);
        prev.set(v, u);
        if (!visited.has(v)) queue.push(v);
      }
    }
  }

  /** @type {string[]} */
  const pathIds = [];
  let cur = endId;
  while (cur) {
    pathIds.unshift(cur);
    cur = prev.get(cur);
  }

  if (pathIds.length === 0 || pathIds[0] !== startId) {
    const fallback = [{ wall: from.wall, along: from.along }, { wall: to.wall, along: to.along }];
    const fallbackCost = Math.abs(from.along - to.along) || Infinity;
    return { path: fallback, cost: fallbackCost };
  }

  return {
    path: pathIds.map((id) => {
      const n = nodes.get(id);
      return { wall: n.wall, along: n.along };
    }),
    cost: dist.get(endId) ?? Infinity,
  };
}

/** @param {ReturnType<typeof buildWallGraph>} graph @param {WallPos} from @param {WallPos} to @returns {WallPos[]} */
export function shortestPath(graph, from, to) {
  return findShortestPath(graph, from, to).path;
}

function wallPosKey(p) {
  return nodeId(p.wall, p.along);
}

export const POWER_SLOTS = [12, 16, 20, 24];
export const DATA_TRUNK_H = 200;
export const KIND_CABLE = { sockets: "cyky25", lights: "cyky15", data: "slaboproud" };

/** @param {"sockets"|"lights"|"data"} kind @param {number[]} [occupiedPowerSlots] */
export function pickTrunkSlot(kind, occupiedPowerSlots = [], occupiedData = false) {
  if (kind === "data") return DATA_TRUNK_H;
  for (const s of POWER_SLOTS) {
    if (!occupiedPowerSlots.includes(s)) return s;
  }
  return POWER_SLOTS[POWER_SLOTS.length - 1];
}

/** @param {WallPos[]} points */
function dedupeConsecutive(points) {
  if (points.length === 0) return [];
  /** @type {WallPos[]} */
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    const cur = points[i];
    if (prev.wall !== cur.wall || prev.along !== cur.along) out.push(cur);
  }
  return out;
}

/**
 * @param {{
 *   kind: string,
 *   walls: WallSeg[],
 *   panel: { x: number, y: number },
 *   points: { id: string, x: number, y: number, h: number }[],
 *   occupiedSlots: number[],
 * }} opts
 */
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

  if (targets.length === 0) {
    return {
      cableType,
      trunkH,
      points: [{ wall: panelPos.wall, along: panelPos.along, h: trunkH }],
      pointIds: [],
      status: "draft",
    };
  }

  const sorted = [...targets].sort((a, b) => {
    const ca = findShortestPath(graph, panelPos, a.pos).cost;
    const cb = findShortestPath(graph, panelPos, b.pos).cost;
    return ca - cb;
  });

  /** @type {WallPos[]} */
  let polyline = findShortestPath(graph, panelPos, sorted[0].pos).path;

  for (let i = 1; i < sorted.length; i++) {
    const target = sorted[i];
    const servedKeys = new Set(sorted.slice(0, i).map((t) => wallPosKey(t.pos)));
    let bestAttachIdx = -1;
    /** @type {WallPos[] | null} */
    let bestPath = null;
    let bestCost = Infinity;

    for (let attachIdx = 0; attachIdx < polyline.length; attachIdx++) {
      const removed = polyline.slice(attachIdx + 1);
      if (removed.some((p) => servedKeys.has(wallPosKey(p)))) continue;

      const forbidden = new Set(polyline.map(wallPosKey));
      forbidden.delete(wallPosKey(polyline[attachIdx]));

      const { path, cost } = findShortestPath(
        graph,
        polyline[attachIdx],
        target.pos,
        forbidden
      );
      const merged = polyline.slice(0, attachIdx + 1).concat(path.slice(1));
      if (merged.some((p, idx) => merged.findIndex((q) => wallPosKey(q) === wallPosKey(p)) !== idx)) {
        continue;
      }
      if (cost < bestCost) {
        bestCost = cost;
        bestAttachIdx = attachIdx;
        bestPath = path;
      }
    }

    if (bestPath && bestAttachIdx >= 0) {
      polyline = polyline.slice(0, bestAttachIdx + 1).concat(bestPath.slice(1));
    }
  }

  polyline = dedupeConsecutive(polyline);
  const routePoints = polyline.map((p) => ({ wall: p.wall, along: p.along, h: trunkH }));

  return {
    cableType,
    trunkH,
    points: routePoints,
    pointIds: points.map((p) => p.id),
    status: "draft",
  };
}
