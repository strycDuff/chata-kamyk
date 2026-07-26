# Design: Planner — tab Elektro

**Datum:** 2026-07-26  
**Verze:** 3.4.0

## Struktura
- Tab **3 · Elektro** (samostatné Pohledy zrušeny)
- Krok **1 · Půdorys** — body ve složkách okruhů
- Krok **2 · Pohledy** — elevace + body u stěny + trasy kabelů

## Okruhy (složky)
`data` · `lights` · `sockets` — Datové / Světla / Zásuvky

## Body
Typ: zásuvka / vypínač / světlo / rozvaděč + výška (cm) + okruh.  
**+ Bod** = jeden kus, pak drag na přesnou polohu.

## Pohledy (krok 2)
- Body z půdorysu u stěny (≤ 45 cm od líce; světla → nejbližší stěna)
- Filtr okruhů (checkboxy)
- Trasy: **Slaboproud** / **CYKY 1,5** / **CYKY 2,5**

## Model
```js
elecPoints: [{ id, type, circuit, x, y, h, name }]
elecElevRuns: [{ id, wall, cableType, circuit, points: [{along,h}] }]
```
