/**
 * Free layout model — partitions, openings, typed furniture.
 * Clear-space coords (cm): origin = inner NW, +X east, +Y south.
 */

export const PART_THICK = 12.5;
export const LAYOUT_SCHEMA = 10;

export const FURN_KINDS = {
  generic: { label: "Kus", defaultH: 75 },
  bed: { label: "Postel", defaultH: 45 },
  sofa: { label: "Rohová sedačka", defaultH: 80 },
  kitchen: { label: "Kuchyňská linka", defaultH: 86 },
  wc: { label: "WC", defaultH: 40 },
  shower: { label: "Sprcha", defaultH: 5 },
  sink: { label: "Umyvadlo", defaultH: 85 },
  tv: { label: "TV", defaultH: 70 },
};

/** Dimension presets keyed by furniture kind. */
export const FURN_PRESETS = {
  bed: [
    { id: "140", label: "140×200", w: 150, d: 210, matW: 140 },
    { id: "160", label: "160×200", w: 165, d: 205, matW: 160 },
  ],
  shower: [
    { id: "80x80", label: "80×80", w: 80, d: 80 },
    { id: "90x90", label: "90×90", w: 90, d: 90 },
    { id: "100x80", label: "100×80", w: 100, d: 80 },
    { id: "120x80", label: "120×80", w: 120, d: 80 },
  ],
  kitchen: [
    { id: "160", label: "160 cm", w: 160, d: 60 },
    { id: "180", label: "180 cm", w: 180, d: 60 },
    { id: "200", label: "200 cm", w: 200, d: 60 },
    { id: "230", label: "230 cm", w: 230, d: 60 },
  ],
  sofa: [
    { id: "L", label: "Rohová L", w: 160, d: 240 },
  ],
  wc: [{ id: "std", label: "37×63", w: 37, d: 63 }],
  sink: [
    { id: "40x30", label: "40×30", w: 40, d: 30 },
    { id: "50x35", label: "50×35", w: 50, d: 35 },
  ],
  tv: [
    { id: "55", label: '55"', w: 8, d: 123 },
    { id: "50", label: '50"', w: 8, d: 112 },
    { id: "65", label: '65"', w: 8, d: 145 },
  ],
};

/** Fixed WC clear position from measured layout (bathLeft=569 axis). */
export const WC_FIXED_CLEAR = { x: 628, y: 0, w: 37, d: 63 };

let _idSeq = 1;
export function newLayoutId(prefix = "p") {
  return `${prefix}${Date.now().toString(36)}_${_idSeq++}`;
}

export function isVerticalPartition(p) {
  return Math.abs(p.x1 - p.x2) < 0.01;
}

export function isHorizontalPartition(p) {
  return Math.abs(p.y1 - p.y2) < 0.01;
}

/** Axis-aligned partition → clear AABB (includes thickness). */
export function partitionBox(p, thick = PART_THICK) {
  const t = p.thickness ?? thick;
  if (isVerticalPartition(p)) {
    const x = Math.min(p.x1, p.x2);
    const y0 = Math.min(p.y1, p.y2);
    const y1 = Math.max(p.y1, p.y2);
    return { x, y: y0, w: t, d: y1 - y0 };
  }
  const y = Math.min(p.y1, p.y2);
  const x0 = Math.min(p.x1, p.x2);
  const x1 = Math.max(p.x1, p.x2);
  return { x: x0, y, w: x1 - x0, d: t };
}

export function partitionLength(p) {
  return Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
}

/**
 * Opening along a partition.
 * offset = distance from partition start (x1,y1) along the segment.
 * Returns clear AABB of the opening slot (same thickness as partition).
 */
export function openingBox(opening, partition, thick = PART_THICK) {
  const box = partitionBox(partition, thick);
  const len = partitionLength(partition);
  const off = Math.max(0, Math.min(len - opening.width, Number(opening.offset) || 0));
  const w = Math.min(opening.width, len);
  if (isVerticalPartition(partition)) {
    return { x: box.x, y: box.y + off, w: box.w, d: w };
  }
  return { x: box.x + off, y: box.y, w, d: box.d };
}

/** Passage just inside the room from an opening (8 cm deep). */
export function openingPassageBox(opening, partition, thick = PART_THICK) {
  const op = openingBox(opening, partition, thick);
  const side = opening.side === "neg" ? -1 : 1;
  if (isVerticalPartition(partition)) {
    // positive side = +X (east of west-face partition)
    const x = side >= 0 ? op.x + op.w : op.x - 8;
    return { x, y: op.y, w: 8, d: op.d };
  }
  const y = side >= 0 ? op.y + op.d : op.y - 8;
  return { x: op.x, y, w: op.w, d: 8 };
}

export function rotateFurniture90(layer) {
  const w = layer.w;
  layer.w = layer.d;
  layer.d = w;
  layer.rot = ((Number(layer.rot) || 0) + 90) % 180;
  return layer;
}

export function applyFurnPreset(layer, presetId) {
  const kind = layer.kind || "generic";
  const list = FURN_PRESETS[kind] || [];
  const preset = list.find((p) => p.id === presetId) || list[0];
  if (!preset) return layer;
  layer.preset = preset.id;
  layer.w = preset.w;
  layer.d = preset.d;
  if (preset.matW != null) layer.matW = preset.matW;
  if (FURN_KINDS[kind]?.defaultH) layer.h = FURN_KINDS[kind].defaultH;
  return layer;
}

export function normalizePartition(raw, i = 0) {
  const thick = Number(raw.thickness);
  return {
    id: typeof raw.id === "string" ? raw.id : newLayoutId("p"),
    name: (raw.name && String(raw.name).trim()) || `Příčka ${i + 1}`,
    x1: Number(raw.x1) || 0,
    y1: Number(raw.y1) || 0,
    x2: Number(raw.x2) || 0,
    y2: Number(raw.y2) || 0,
    thickness: Number.isFinite(thick) && thick > 0 ? thick : PART_THICK,
  };
}

export function normalizeOpening(raw, i = 0) {
  return {
    id: typeof raw.id === "string" ? raw.id : newLayoutId("o"),
    partitionId: typeof raw.partitionId === "string" ? raw.partitionId : "",
    name: (raw.name && String(raw.name).trim()) || `Dveře ${i + 1}`,
    offset: Number(raw.offset) || 0,
    width: Math.max(40, Number(raw.width) || 70),
    kind: raw.kind === "pocket" ? "pocket" : "door",
    pocketDir: raw.pocketDir === "neg" ? "neg" : "pos",
    side: raw.side === "neg" ? "neg" : "pos",
    leafOpen: !!raw.leafOpen,
  };
}

export function normalizeFurnitureLayer(raw, i = 0) {
  const kind = FURN_KINDS[raw.kind] ? raw.kind : "generic";
  const rot = Number(raw.rot) === 90 ? 90 : 0;
  return {
    id: typeof raw.id === "string" ? raw.id : newLayoutId("f"),
    name: (raw.name && String(raw.name).trim()) || (FURN_KINDS[kind]?.label || `Kus ${i + 1}`),
    kind,
    rot,
    preset: raw.preset || null,
    matW: raw.matW != null ? Number(raw.matW) : undefined,
    x: Number(raw.x) || 0,
    y: Number(raw.y) || 0,
    w: Number(raw.w) || 60,
    d: Number(raw.d) || 120,
    h: Number(raw.h) || FURN_KINDS[kind]?.defaultH || 75,
  };
}

/**
 * Seed free layout from legacy parametric bath/tv/door/bed/kitchen/fixtures.
 * Stable partition ids preserve electro elev-run wall references.
 */
export function seedFromParametric(p = {}) {
  const thick = PART_THICK;
  const bathLeft = Number(p.bathLeft) || 569;
  const bathW = Number(p.bathW) || 125;
  const bathD = Number(p.bathD) || 230;
  const tvX = Number(p.tvX) || 324;
  const tvLen = Number(p.tvLen) || 140;
  const doorOffset = Number(p.doorOffset) || 90;
  const doorWidth = Number(p.doorWidth) || 70;
  const doorType = p.doorType === "B" ? "pocket" : "door";
  const pocketDir = p.pocketDir === "north" ? "neg" : "pos";
  const kitchenLeft = Number(p.kitchenLeft) || 313;
  const kitchenLen = Number(p.kitchenLen) || 160;
  const bedVariant = Number(p.bedVariant) === 140 ? 140 : 160;
  const bedOuterW = Number(p.bedOuterW) || bedVariant + 5;
  const bedOuterD = Number(p.bedOuterD) || 205;
  const clearW = Number(p.clearW) || 906;
  const clearH = Number(p.clearH) || 333;

  const partitions = [
    {
      id: "bath-west",
      name: "Koupelna Z",
      x1: bathLeft, y1: 0,
      x2: bathLeft, y2: bathD,
      thickness: thick,
    },
    {
      id: "bath-east",
      name: "Koupelna V",
      x1: bathLeft + bathW - thick, y1: 0,
      x2: bathLeft + bathW - thick, y2: bathD,
      thickness: thick,
    },
    {
      id: "bath-south",
      name: "Koupelna J",
      x1: bathLeft, y1: bathD - thick,
      x2: bathLeft + bathW, y2: bathD - thick,
      thickness: thick,
    },
    {
      id: "tv-west",
      name: "TV příčka",
      x1: tvX, y1: 0,
      x2: tvX, y2: tvLen,
      thickness: thick,
    },
  ];

  // Bedroom corridor door wall (south line spanning bath→bed gap)
  const bedX = clearW - bedOuterW;
  const bathEast = bathLeft + bathW;
  const corridorW = bedX - bathEast;
  if (corridorW > 1) {
    partitions.push({
      id: "bed-door",
      name: "Ložnice dveře",
      x1: bathEast, y1: bathD - thick,
      x2: bedX, y2: bathD - thick,
      thickness: thick,
    });
  }

  const openings = [
    {
      id: "bath-door",
      partitionId: "bath-west",
      name: "Dveře koupelny",
      offset: doorOffset,
      width: doorWidth,
      kind: doorType,
      pocketDir,
      side: "pos", // into bath (east of west partition)
      leafOpen: !!p.view3dDoorOpen,
    },
  ];
  if (corridorW > 1) {
    openings.push({
      id: "bed-door-opening",
      partitionId: "bed-door",
      name: "Dveře ložnice",
      offset: 0,
      width: corridorW,
      kind: p.bedDoorType === "B" ? "pocket" : "door",
      pocketDir: p.bedDoorPocketDir === "west" ? "neg" : "pos",
      side: "pos",
      leafOpen: !!p.view3dBedDoorOpen,
    });
  }

  const showerW = Number(p.showerW) || 80;
  const showerD = Number(p.showerD) || 80;
  let showerX = Number(p.showerClearX);
  let showerY = Number(p.showerClearY);
  if (!Number.isFinite(showerX) || !Number.isFinite(showerY)) {
    // default SE of bath inner
    showerX = bathLeft + bathW - thick - showerW;
    showerY = bathD - thick - showerD;
  }

  const sinkW = Number(p.sinkW) || 40;
  const sinkD = Number(p.sinkD) || 30;
  const sinkOffset = Number(p.sinkOffset) || 70;
  const sinkX = bathLeft + bathW - thick - sinkD;
  const sinkY = sinkOffset;

  const furniture = [
    {
      id: "furn-sofa",
      name: "Rohová sedačka",
      kind: "sofa",
      rot: 0,
      preset: "L",
      x: 0, y: 0, w: 160, d: 240,
      h: FURN_KINDS.sofa.defaultH,
    },
    {
      id: "furn-bed",
      name: "Postel",
      kind: "bed",
      rot: 0,
      preset: String(bedVariant),
      matW: bedVariant,
      x: clearW - bedOuterW, y: 0,
      w: bedOuterW, d: bedOuterD,
      h: FURN_KINDS.bed.defaultH,
    },
    {
      id: "furn-kitchen",
      name: "Kuchyňská linka",
      kind: "kitchen",
      rot: 0,
      preset: null,
      x: kitchenLeft, y: clearH - 60,
      w: kitchenLen, d: 60,
      h: FURN_KINDS.kitchen.defaultH,
    },
    {
      id: "furn-wc",
      name: "WC",
      kind: "wc",
      rot: 0,
      preset: "std",
      x: WC_FIXED_CLEAR.x, y: WC_FIXED_CLEAR.y,
      w: WC_FIXED_CLEAR.w, d: WC_FIXED_CLEAR.d,
      h: FURN_KINDS.wc.defaultH,
    },
    {
      id: "furn-shower",
      name: "Sprcha",
      kind: "shower",
      rot: p.showerRotate ? 90 : 0,
      preset: p.showerPreset || "80x80",
      x: showerX, y: showerY,
      w: showerW, d: showerD,
      h: FURN_KINDS.shower.defaultH,
    },
    {
      id: "furn-sink",
      name: "Umyvadlo",
      kind: "sink",
      rot: 90, // depth into room from east wall → w=depth along X after rot handling in seed
      preset: "40x30",
      x: sinkX, y: sinkY,
      w: sinkD, d: sinkW,
      h: FURN_KINDS.sink.defaultH,
    },
    {
      id: "furn-tv",
      name: "TV",
      kind: "tv",
      rot: 0,
      preset: String(p.tvVariant || 55),
      x: tvX - 8, y: Math.max(0, (tvLen - 123) / 2),
      w: 8, d: 123,
      h: FURN_KINDS.tv.defaultH,
    },
  ];

  // Merge user furniture layers (generic) that aren't builtins
  const extra = Array.isArray(p.furnitureLayers) ? p.furnitureLayers : [];
  for (const layer of extra) {
    const n = normalizeFurnitureLayer(layer);
    if (["bed", "sofa", "kitchen", "wc", "shower", "sink", "tv"].includes(n.kind) &&
        furniture.some((f) => f.kind === n.kind && f.id.startsWith("furn-"))) {
      continue;
    }
    // Keep generic extras
    if (!furniture.some((f) => f.id === n.id)) furniture.push(n);
  }

  return {
    layoutSchema: LAYOUT_SCHEMA,
    partitions,
    openings,
    furnitureLayers: furniture,
    livingBoundaryId: "tv-west",
  };
}

/**
 * Migrate legacy snapshot (schema < 10 / missing partitions) to free layout.
 * Returns mutated shallow copy of data.
 */
export function migrateSnapshotToV10(data, opts = {}) {
  if (!data || typeof data !== "object") return data;
  const out = { ...data };
  if (Array.isArray(out.partitions) && out.partitions.length > 0 && Number(out.layoutSchema) >= 10) {
    out.partitions = out.partitions.map(normalizePartition);
    out.openings = (out.openings || []).map(normalizeOpening);
    out.furnitureLayers = (out.furnitureLayers || []).map(normalizeFurnitureLayer);
    if (!out.livingBoundaryId) out.livingBoundaryId = "tv-west";
    return out;
  }
  const seeded = seedFromParametric({
    ...out,
    clearW: opts.clearW || 906,
    clearH: opts.clearH || 333,
  });
  out.layoutSchema = LAYOUT_SCHEMA;
  out.partitions = seeded.partitions;
  out.openings = seeded.openings;
  out.furnitureLayers = seeded.furnitureLayers;
  out.livingBoundaryId = seeded.livingBoundaryId;
  return out;
}

/** Living zone west bound (clear X) from livingBoundaryId partition. */
export function livingBoundaryX(partitions, livingBoundaryId, fallback = 324) {
  const p = (partitions || []).find((x) => x.id === livingBoundaryId);
  if (!p) {
    const tv = (partitions || []).find((x) => x.id === "tv-west");
    if (tv) return Math.min(tv.x1, tv.x2);
    return fallback;
  }
  if (isVerticalPartition(p)) return Math.min(p.x1, p.x2);
  return fallback;
}

/** Electro / snap wall segments from free partitions (clear coords). */
export function partitionsToWallSegs(partitions, clearW = 906, clearH = 333) {
  const segs = [
    { id: "north", x0: 0, y0: 0, x1: clearW, y1: 0 },
    { id: "east", x0: clearW, y0: 0, x1: clearW, y1: clearH },
    { id: "south", x0: 0, y0: clearH, x1: clearW, y1: clearH },
    { id: "west", x0: 0, y0: 0, x1: 0, y1: clearH },
  ];
  for (const p of partitions || []) {
    const box = partitionBox(p);
    if (isVerticalPartition(p)) {
      // Use west face for routing consistency with former bath-west / tv-west
      segs.push({
        id: p.id,
        x0: box.x, y0: box.y,
        x1: box.x, y1: box.y + box.d,
      });
    } else {
      // South face of horizontal partition
      segs.push({
        id: p.id,
        x0: box.x, y0: box.y + box.d,
        x1: box.x + box.w, y1: box.y + box.d,
      });
    }
  }
  return segs;
}

export function findFurnByKind(layers, kind) {
  return (layers || []).find((l) => l.kind === kind) || null;
}

/** Sofa L arms in clear coords from furniture layer (NW anchor). */
export function sofaArmsFromLayer(layer) {
  const rot = Number(layer.rot) || 0;
  if (rot === 90) {
    // mirrored: north arm along west, west arm along north — swap
    return {
      west: { x: layer.x, y: layer.y, w: 90, d: 160 },
      north: { x: layer.x, y: layer.y, w: 240, d: 95 },
    };
  }
  return {
    west: { x: layer.x, y: layer.y, w: 95, d: Math.min(240, layer.d) },
    north: { x: layer.x, y: layer.y, w: Math.min(160, layer.w), d: 90 },
  };
}
