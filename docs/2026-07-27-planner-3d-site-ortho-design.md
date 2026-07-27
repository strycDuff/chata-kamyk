# 3D distant site surround

## Goal
Show real surroundings **in the distance** — not seat the cabin into a garden/terrain underlay.

## Why v1 failed
Esri tiles at z18/z19 returned gray “Map not yet available” placeholders. A full under-cabin plane also made landscape appear to cut through the bedroom.

## Approach (v3.21.1)
- Source: Esri World Imagery **z16** → `koupelna/assets/site-surround.jpg` (~800 m half-extent)
- Render: `RingGeometry` from **~25 m** (near clear) to **~800 m**
- Near yard stays simple gray pad under/around the cabin
- Toggle: **Pozadí okolí (satelit v dálce)**
- Orientation: plan north wall bearing **343°** (`rotation.y = 360° − 343°`)

## Site
50.558394°N, 14.080436°E

## Attribution
Esri, Maxar, Earthstar Geographics, and the GIS User Community.
