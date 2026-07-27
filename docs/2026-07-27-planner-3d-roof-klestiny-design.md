# Design: 3D krov · kleštiny · loft

**Datum:** 2026-07-27  
**Verze:** 3.15.0

## Cíl
Vizualizace sedlové střechy v tabu **4 · 3D** a ověření snížených kleštin nad obývací částí (loft na spaní / sezónní věci).

## Geometrie
- Hřeben běží po **delší straně** chaty (E–Z, světlost 906 cm).
- Krokve S–J, osová vzdálenost default **90 cm**.
- Koruna stěn = `roomClearH` (default 210 cm) — pozednice.
- Sklon default **35°** → výška hřebene ≈ plate + (166,5 · tan θ).
- Kleštiny **150×60 mm** (15×6 cm): jinde v polovině krokoví; nad obývákem (západně od TV příčky) spodní líc nastavitelný (default **210 cm**).
- Volitelná prkenná podlaha loftu na snížených kleštinách.

## Ovládání (panel 3D)
- Zobrazit krov / podlaha loftu
- Sklon, osová vzdálenost, spodní líc kleštiny obývák
- Presety kamery: **Ke krovu** (pohled vzhůru), **Z loftu** (stání na podlaze loftu)

## Souřadnice
Stejné clear cm jako zbytek 3D. Orientované prvky (krokve) jdou přes `oriented: true` + `rotX` ve `planner3d.mjs`.
