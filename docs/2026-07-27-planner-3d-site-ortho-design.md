# 3D site orthophoto underlay

## Goal
Flat satellite ground under the cabin for site context (not full 3D Earth).

## Site
- Lat/lon: 50.558394°N, 14.080436°E
- Plan “north” wall outward bearing: **343°**
- Half extent: **100 m** around cabin center

## Approach
Static Esri World Imagery tiles baked to `koupelna/assets/site-ortho.jpg` (+ `site-ortho.json` metadata). Toggle **Podklad mapa** in 3D panel.

## Orientation
Cabin stays in clear-cm coordinates (local −Z = plan north). Ortho plane is north-up; mesh `rotation.y = 360° − 343°` so local −Z matches the stated wall bearing.

## Attribution
Esri, Maxar, Earthstar Geographics, and the GIS User Community.

## Later
Swap static file for live Mapbox/Esri tiles without changing placement math.
