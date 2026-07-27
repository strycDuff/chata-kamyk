# Design: Auto-planner tras (Elektro)

**Datum:** 2026-07-27  
**Verze plánovače (cíl):** 3.15.x  
**Stav:** schválený návrh (brainstorm)

## Cíl
Uživatel na půdorysu přiřadí **okruhy a body**. Systém navrhne **trasy** (páteř + odbočky) podle pravidel. Uživatel návrh **přijme / zahodí / doladí**.

Ruční kreslení páteře v elevaci zůstává možné, ale default workflow = auto-návrh.

## Hierarchie
```
Místnost → Okruh → Body
                 → Trasy
```
- Bod patří do jednoho okruhu (a tím do místnosti okruhu).
- Trasa patří do jednoho okruhu.
- K trase se přiřadí podmnožina bodů **stejného okruhu** (explicitní `pointIds`).
- Default: páteř jen pro přiřazené body (ne „vše na stěně“).

### Příklad (kuchyně)
- Okruh `Zásuvky` — kavovar atd. + trasa T1  
- Okruh `Zásuvky – sporák` — varná deska + trasa T2 (vlastní jistič, vlastní slot)

## Pravidla vedení
| Kind okruhu | Kabel | Výška páteře |
|-------------|-------|--------------|
| `sockets` | CYKY 2,5 | slot v koridoru **10–25 cm** |
| `lights` | CYKY 1,5 | slot v koridoru **10–25 cm** |
| `data` | slaboproud | **≈ 200 cm** |

**Silnoproudé sloty (fixní):** 12, 16, 20, 24 cm.  
Nová *accepted* trasa dostane **první volný** slot (kolize se accepted trasami, které sdílí stěnový koridor v místnosti). Draft slot neobsazuje natrvalo (jen rezervace vizuální).

**Odbočky:** svisle z páteře `trunkH` na `point.h` ve stejném `along` na stěně.

**Default výšky bodů** (pokud uživatel nezadal jinak): zásuvka 30 · vypínač 120 · světlo 210 · rozvaděč dle stávajícího defaultu.

**Start trasy:** vždy **rozvaděč** (1 jistič = 1 okruh = 1 vývod).  
Uvnitř okruhu: jedna páteř + odbočky k bodům — ne sdílení přívodu mezi okruhy.

**Půdorysná cesta:** jen **po stěnách** (obvod + koupelnové/TV příčky), ortogonálně / po wall-graph. Ne přes volný prostor místnosti.

## Data (`elecElevRuns` / trasa)
```ts
{
  id: string
  circuitId: string
  cableType: "cyky15" | "cyky25" | "slaboproud"
  name: string
  pointIds: string[]          // přiřazené body
  trunkH: number              // slot nebo ~200
  points: { wall, along, h }[] // páteř
  status: "draft" | "accepted"
}
```
Odbočky se **neukládají** jako vertexy — odvozují se z `pointIds` + `trunkH` (jako dřívější socket stubs).

Migrace: stávající trasy bez `pointIds`/`status` → `accepted`, `pointIds: []` (ruční legacy).

## Algoritmus (wall-graph) — v1
1. Z geometrie postav graf: hrany = clear líce stěn/příček, uzly = rohy + projekce panelu/bodů.  
2. Každý bod v `pointIds` → projekce na nejbližší stěnu (`wall`, `along`).  
3. Zvol `trunkH` (slot / 200).  
4. Spočítej nejkratší cesty panel→body po grafu; sestav **strom** (MST nad pairwise distancemi / jednoduchý greedy attach).  
5. Emituj páteř jako `points[]` ve výšce `trunkH` (rohy = změna `wall`).  
6. Délka ≈ délka páteře + Σ |point.h − trunkH|.

V1 nemusí být globálně optimální Steiner — stačí korektní, čitelná trasa po stěnách.

## UI tok (hybrid C)
1. Aktivní okruh → checkboxy u bodů.  
2. **Navrhnout trasu** → vytvoří `draft` (oranžová / čárkovaná).  
3. **Přijmout** → `accepted`, slot obsazen.  
4. **Zahodit** → smazat draft.  
5. Volitelně změnit `trunkH` / `pointIds` a znovu navrhnout.

Seznam tras: název, kabel, `trunkH`, ~m, badge draft.

## Elev UX (související)
Při 4 stěnách je pás moc široký → **wheel zoom + pan**, tlačítko **Fit stěna**.  
(Příčky jako samostatné elev karty = až po auto-routeru; body na příčkách už wall-graph umí vést.)

## Mimo v1
- Editace vertexů páteře tahem v elevaci  
- Navázání nové trasy na existující páteř *jiného* startu než panel  
- Dynamické rovnoměrné sloty  
- Samostatné elev pohledy „jen koupelna / jen TV líc“ jako filtr  
- Plně auto bez Přijmout

## Test plan (až implementace)
- [ ] Kuchyně: 2 zásuvkové okruhy → 2 sloty, 2 trasy od panelu  
- [ ] Draft neblokuje slot po Zahodit  
- [ ] Slaboproud páteř ~200, CYKY správný typ  
- [ ] Odbočky sedí na `along` bodů  
- [ ] Zoom/pan na 4stěnovém pásu použitelný  
