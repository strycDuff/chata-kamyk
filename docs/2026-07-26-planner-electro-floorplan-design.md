# Design: Planner — tab Elektro (půdorys)

**Datum:** 2026-07-26  
**Stav:** implementace v1 (cesta 3)  
**Verze appky:** 3.3.0

## Cíl
Schematicky zakreslit **body** (zásuvka / vypínač / světlo / rozvaděč) a **volné trasy** na půdorysu — pro návrh kudy táhnout elektro. Bez obvodů, fází a wall-snap.

## UI
- Tab **4 · Elektro**
- Toolbar checkbox **Elektro** (zobrazit/skrýt vrstvu)
- Panel: typ bodu, výška (cm nad podlahou), **+ Bod**, **+ Trasa**, seznam
- Default výšky: zásuvka 30 · vypínač 120 · světlo = světlá výška · rozvaděč 150

## Model
```js
elecPoints: [{ id, type, x, y, h, name }]  // x,y clear cm
elecRuns:   [{ id, name, points: [{x,y}, ...] }]
```

## Mimo v1
- Wall-snap tras na obvod/příčky
- Editace na elevacích
- Okruhy / barvy fází
