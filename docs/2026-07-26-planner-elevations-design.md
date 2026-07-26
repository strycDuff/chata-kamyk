# Design: Planner — tab Pohledy (elevace)

**Datum:** 2026-07-26  
**Stav:** implementace v1  
**Odděleně od:** 3D náhled příček (později), elektro kreslení (mimo tool)

## Cíl
Z půdorysu vygenerovat **čelní pohledy vnitřních líčů** obvodových stěn (SVG) pro tisk / zakreslení elektro jinde.

## Defaults (výšky)
| Parametr | cm |
|----------|-----|
| Světlá výška místnosti | 210 |
| Parapet okna | 90 |
| Nadpraží okna (hlava) | 200 |
| Otvor dveří (výška) | 200 |
| Křídlo dveří (výška) | 190 |

Pozn.: zadání „dveře 200 / otvor 190“ je v UI editovatelné; default drží **otvor ≥ křídlo** (200 / 190).

## Scope v1
- Tab **3 · Pohledy**
- Stěny S / J / Z / V (osa podél světlosti, levá = Z u S/J, levá = S u Z/V)
- Otvorové segmenty z půdorysu (šířky), výšky z parametrů výše
- Svislé značky napojení příček (koupelna, TV) na danou stěnu
- Základní kóty; export SVG včetně stavu

## Mimo v1
- Elektro body / kabely v toolu
- Interiérové pohledy na příčky koupelny
- 3D
