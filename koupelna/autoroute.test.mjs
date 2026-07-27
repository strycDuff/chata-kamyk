import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  projectPointToWalls,
  buildWallGraph,
  findShortestPath,
  shortestPath,
  pickTrunkSlot,
  proposeRoute,
} from "./autoroute.mjs";

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

describe("buildWallGraph T-junctions", () => {
  it("connects a mid-wall partition (T-junction) into the rest of the graph", () => {
    const rectWalls = [
      { id: "north", x0: 0, y0: 0, x1: 400, y1: 0 },
      { id: "east", x0: 400, y0: 0, x1: 400, y1: 300 },
      { id: "south", x0: 400, y0: 300, x1: 0, y1: 300 },
      { id: "west", x0: 0, y0: 300, x1: 0, y1: 0 },
      // vertical partition dropping from mid north wall, dead-ending mid-room
      { id: "part", x0: 200, y0: 0, x1: 200, y1: 150 },
    ];
    const g = buildWallGraph(rectWalls);
    const { path, cost } = findShortestPath(
      g,
      { wall: "north", along: 50 },
      { wall: "part", along: 100 }
    );
    assert.ok(Number.isFinite(cost) && cost > 0, `expected finite positive cost, got ${cost}`);
    // A disconnected graph falls back to a naive 2-point path; a real route
    // through the T-junction must pass through at least one extra node.
    assert.ok(path.length >= 3, `expected path to traverse the T-junction, got ${path.length} points`);
    assert.equal(path[0].wall, "north");
    assert.equal(path[path.length - 1].wall, "part");
  });
});

describe("pickTrunkSlot", () => {
  it("picks first free power slot", () => {
    assert.equal(pickTrunkSlot("sockets", [12, 16]), 20);
  });
  it("uses ~200 for data", () => {
    assert.equal(pickTrunkSlot("data", [200]), 200);
  });
});

function wallKey(p) {
  return `${p.wall}:${Math.round(p.along * 100) / 100}`;
}

/** Each (wall, along) may appear at most once — no backtracking. */
function assertNoBacktrack(points) {
  const seen = new Set();
  for (const p of points) {
    const k = wallKey(p);
    assert.ok(!seen.has(k), `backtrack at ${k}`);
    seen.add(k);
  }
}

describe("proposeRoute", () => {
  it("builds trunk from panel to one socket with stub height", () => {
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

  it("does not backtrack when merging two points on the same wall", () => {
    const route = proposeRoute({
      kind: "sockets",
      walls,
      panel: { x: 548, y: 2 },
      points: [
        { id: "p1", x: 850, y: 5, h: 30 },
        { id: "p2", x: 100, y: 5, h: 30 },
      ],
      occupiedSlots: [],
    });
    assert.ok(route.points.length >= 2);
    assert.deepEqual(route.pointIds, ["p1", "p2"]);
    assertNoBacktrack(route.points);
  });

  it("does not backtrack when merging two points on different walls", () => {
    const route = proposeRoute({
      kind: "sockets",
      walls,
      panel: { x: 548, y: 2 },
      points: [
        { id: "p1", x: 850, y: 5, h: 30 },
        { id: "p2", x: 900, y: 50, h: 30 },
      ],
      occupiedSlots: [],
    });
    assert.ok(route.points.length >= 2);
    assert.deepEqual(route.pointIds, ["p1", "p2"]);
    assertNoBacktrack(route.points);
  });
});
