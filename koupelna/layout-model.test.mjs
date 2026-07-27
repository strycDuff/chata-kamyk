import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  seedFromParametric,
  migrateSnapshotToV10,
  partitionBox,
  openingBox,
  livingBoundaryX,
  partitionsToWallSegs,
  rotateFurniture90,
  PART_THICK,
} from "./layout-model.mjs";

describe("layout-model seed", () => {
  it("seeds stable bath/tv partition ids", () => {
    const s = seedFromParametric({});
    assert.equal(s.layoutSchema, 10);
    const ids = s.partitions.map((p) => p.id);
    assert.ok(ids.includes("bath-west"));
    assert.ok(ids.includes("bath-east"));
    assert.ok(ids.includes("bath-south"));
    assert.ok(ids.includes("tv-west"));
    assert.equal(s.livingBoundaryId, "tv-west");
    assert.ok(s.openings.some((o) => o.partitionId === "bath-west"));
    const kinds = s.furnitureLayers.map((f) => f.kind);
    for (const k of ["bed", "sofa", "kitchen", "wc", "shower", "sink", "tv"]) {
      assert.ok(kinds.includes(k), k);
    }
  });

  it("bath-west opening sits on west partition", () => {
    const s = seedFromParametric({ bathLeft: 569, bathD: 230, doorOffset: 90, doorWidth: 70 });
    const part = s.partitions.find((p) => p.id === "bath-west");
    const op = s.openings.find((o) => o.id === "bath-door");
    const box = openingBox(op, part);
    assert.equal(box.x, 569);
    assert.equal(box.w, PART_THICK);
    assert.equal(box.y, 90);
    assert.equal(box.d, 70);
  });

  it("migrateSnapshotToV10 is idempotent on v10", () => {
    const once = migrateSnapshotToV10({ bathLeft: 569, furnitureLayers: [] });
    const twice = migrateSnapshotToV10(once);
    assert.equal(twice.partitions.length, once.partitions.length);
    assert.equal(twice.layoutSchema, 10);
  });

  it("livingBoundaryX reads tv-west", () => {
    const s = seedFromParametric({ tvX: 380 });
    assert.equal(livingBoundaryX(s.partitions, s.livingBoundaryId), 380);
  });

  it("partitionsToWallSegs includes outer + partitions", () => {
    const s = seedFromParametric({});
    const segs = partitionsToWallSegs(s.partitions);
    assert.ok(segs.some((w) => w.id === "north"));
    assert.ok(segs.some((w) => w.id === "bath-west"));
    assert.ok(segs.some((w) => w.id === "tv-west"));
  });

  it("rotateFurniture90 swaps w/d", () => {
    const layer = { w: 80, d: 40, rot: 0 };
    rotateFurniture90(layer);
    assert.equal(layer.w, 40);
    assert.equal(layer.d, 80);
    assert.equal(layer.rot, 90);
  });

  it("partitionBox for vertical segment", () => {
    const box = partitionBox({ x1: 100, y1: 0, x2: 100, y2: 200, thickness: 12.5 });
    assert.deepEqual(box, { x: 100, y: 0, w: 12.5, d: 200 });
  });
});
