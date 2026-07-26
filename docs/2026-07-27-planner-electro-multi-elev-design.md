# Design: Elektro UI + multi-elev + JSON export

**Datum:** 2026-07-27  
**Verze:** 3.6.0

## Scope
1. Schovat legendu/status mimo tab Půdorys
2. Výraznější přepínač Půdorys / Pohledy v Elektro
3. Více stěn najednou jako rozvinutý pás s rohy
4. Export JSON (pretty) vedle SVG

## Ukládání
- **Varianty** — localStorage (beze změny)
- **Export SVG** — grafika + embedded snapshot
- **Export JSON** — `JSON.stringify(snapshot, null, 2)` stažení souboru
- **Import** — SVG i JSON (už funguje)

## Multi-elev
- `elevWalls: string[]` — multi-select, min 1
- Rozvinutí po obvodu: N → E → S(flip) → W(flip)
- Rohy: silný svislý marker + NE/SE/SW/NW
- Trasa: `points: [{ wall, along, h }]` (legacy 1-wall migrace)

## UI
- Elektro/Nábytek: `#legend`, `#status` hidden
- Stepper Elektro větší / jasně aktivní
