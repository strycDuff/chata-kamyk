# Design: Planner — tab Elektro

**Datum:** 2026-07-27  
**Verze:** 3.9.0

## Struktura
- Tab **3 · Elektro**
- Výrazný stepper: **1 · Půdorys** / **2 · Pohledy**
- Legenda + status kolizí jen na tabu **1 · Půdorys** (ne u Elektro / Nábytek)

## Okruhy (pojmenované složky)
Default při prázdném stavu (3 typy × místnosti):
- **Světla / Zásuvky / Datové:** Ložnice, Chodba, Kuchyně, Obývak, Venek

Strom okruhů (stejný JSON, jiný pohled):
- **Dle místnosti** (default) — místnost → typ okruhu → body
- **Dle typu** — typ → místnosti

Body i trasy (`elecElevRuns.circuitId`) patří do **aktivního okruhu**.  
Strom je společný pro Půdorys i Pohledy. V pohledech jsou ostatní okruhy ztlumené.

Boční panel vlevo, širší (stromová navigace).

## Pohledy — rozvinutý pás
- Multi-select stěn (Sever / Východ / Jih / Západ)
- Pořadí N → E → S(flip) → W(flip), mezi nimi roh `NE` / `SE` / …
- Trasa jedním tahem přes roh: `points: [{ wall, along, h }]`
- Ortho snap + rubber-band + výška

## Ukládání
| Cesta | Formát |
|---|---|
| Varianty | localStorage JSON |
| **Export JSON** | pretty-print celý snapshot |
| Export SVG | grafika + embedded JSON |
| Import | SVG i JSON |

## Model
```js
elevWalls: ["north","east"]
elecCircuits: [{ id, kind, name, room }]
elecPoints: [{ id, type, circuitId, x, y, h, name }]
elecElevRuns: [{ id, cableType, circuitId, points: [{wall,along,h}] }]
```
