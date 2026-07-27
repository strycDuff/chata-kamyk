import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  projectPointToWalls,
  buildWallGraph,
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

describe("pickTrunkSlot", () => {
  it("picks first free power slot", () => {
    assert.equal(pickTrunkSlot("sockets", [12, 16]), 20);
  });
  it("uses ~200 for data", () => {
    assert.equal(pickTrunkSlot("data", [200]), 200);
  });
});

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
});
