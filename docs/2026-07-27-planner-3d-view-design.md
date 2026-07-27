# Design: Planner — tab 4 · 3D

**Datum:** 2026-07-27  
**Verze:** 3.13.0  
**Stack:** Three.js (CDN, dynamic import) + OrbitControls

## Cíl
Prohlížení / prezentace (bez editace ve 3D). Nový tab **4 · 3D**.

## Obsah scény
- Podlaha světlosti, obvodové stěny (segmenty stěna/okno/dveře), koupelnové + TV příčky
- Masy: postel (+ matrace), kuchyň, sprcha, WC, umyvadlo, gauč, ostatní nábytek
- Jednoduché materiály, ambient + directional light

## Výšky
| Prvek | Default H |
|-------|-----------|
| Místnost | `roomClearH` |
| Postel / matrace | 45 / 20 |
| Kuchyň | 86 |
| Sprcha | 5 |
| WC / umyvadlo | 40 / 85 |
| Gauč | 80 |
| Ostatní nábytek | `layer.h` (default 75, edit v tabu Nábytek) |

## Kamery
Presety Izometrie / SV / JV + OrbitControls (rotace, zoom, pan). Reset = aktivní preset.

## Souřadnice
Clear cm: Three X = clearX, Z = clearY (S), Y = výška.
