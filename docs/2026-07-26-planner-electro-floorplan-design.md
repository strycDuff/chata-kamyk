# Design: Planner — tab Elektro

**Datum:** 2026-07-26  
**Verze:** 3.5.0

## Struktura
- Tab **3 · Elektro** (samostatné Pohledy zrušeny)
- Krok **1 · Půdorys** — pojmenované okruhy (složky) + body
- Krok **2 · Pohledy** — elevace + body u stěny + trasy kabelů

## Okruhy (pojmenované složky)
Nejdřív **+ Nový okruh** → typ (`data` / `lights` / `sockets`) + název (např. „Ložnice“) + volitelná místnost.  
Body a trasy patří do **aktivního** okruhu. Typ okruhu jen filtruje/hintuje výchozí typ bodu a kabelu:

| Typ okruhu | Typický kabel | Typické body |
|---|---|---|
| Datové | Slaboproud | rozvaděč / data |
| Světla | CYKY 1,5 | vypínače, světla |
| Zásuvky | CYKY 2,5 | zásuvky |

Příklad: okruh **Zásuvky / Ložnice** (CYKY 2,5 od rozvaděče) a zvlášť **Světla / Ložnice** (CYKY 1,5).

## Body (krok 1)
Typ: zásuvka / vypínač / světlo / rozvaděč + výška (cm).  
**+ Bod do aktivního okruhu** = jeden kus, pak drag.

## Pohledy (krok 2)
- Body z půdorysu u stěny (≤ 45 cm od líce; světla → nejbližší stěna)
- Filtr typů okruhů (checkboxy)
- Trasy: tenká čára + popisek typu kabelu vedle trasy
- **Ortogonální snap** (pravé úhly / stejná výška) — norma při rozvodech
- Rubber-band náhled k kurzoru + aktuální výška `h=… cm`

## Model
```js
elecCircuits: [{ id, kind, name, room }]
elecActiveCircuitId: string | null
elecPoints: [{ id, type, circuitId, x, y, h, name }]
elecElevRuns: [{ id, wall, cableType, circuitId, name, points: [{along,h}] }]
```

Legacy snapshoty v3.4 (`circuit` = kind) se migrují do okruhů „Migrace“.
