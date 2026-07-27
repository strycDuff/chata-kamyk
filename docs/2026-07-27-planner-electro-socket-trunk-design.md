# Design: Zásuvková páteř + automatické odbočky

**Datum:** 2026-07-27  
**Verze:** 3.11.0

## Cíl
U zásuvkových elev-tras: jeden přívodní kabel (páteř) v ~10–20 cm + svislé odbočky k zásuvkám (~30 cm). Odbočky odvozené, ne kreslené ručně. Hybrid napojení + pojmenování tras (outlier).

## Data (`elecElevRuns`)
```ts
{
  id, circuitId, cableType, name,
  points: [{ wall, along, h }],  // jen páteř
  trunkH: 15,                    // default; editovatelné
  excludePointIds: string[],     // auto-kandidáti odpojení
  includePointIds: string[],     // ruční mimo span
}
```

Stub logika jen když `circuit.kind === "sockets"`.

## Napojení
1. Kandidáti = zásuvky stejného okruhu na stěnách páteře.
2. Auto = `along` ve spanu páteře na stěně (± 5 cm).
3. Attached = `(auto − exclude) ∪ include`.
4. Odbočka = `(wall, along, trunkH) → (wall, along, socket.h)` svisle.

## Metry
`délka páteře + Σ |socket.h − trunkH|` pro attached zásuvky.

## UI
- Název trasy: ✎ / ✓ / ✗
- `trunkH` input u vybrané trasy
- Checklist napojených zásuvek
- Ve výkresu: páteř + tenčí odbočky

## Mimo scope
Pás 10–20 cm, materializované stub vertexy, stejná logika pro světla/data.
