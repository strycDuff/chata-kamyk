# Design: Planner v3 — tab Nábytek (vrstvy obdélníků)

**Datum:** 2026-07-26  
**Stav:** schváleno / implementace  
**Navazuje na:** Planner v2.0 (frozen)

## 1. Cíl
Dát možnost rychle nakreslit **základní rozmístění nábytku** jako pojmenované obdélníkové vrstvy přes půdorys z v2 (geometrie chaty / koupelny zůstává z tabu 1, read-only v tabu 2).

## 2. Taby
1. **Půdorys** — stávající v2.0 (příčky, kuchyň, postel, TV, koupelna…)
2. **Nábytek** — stejný půdorysný podklad (stav z tabu 1), jiné pravé menu; editace jen uživatelských vrstev

## 3. Pravé menu (tab 2)
- Tlačítko **+ Nová vrstva**
- Seznam vrstev (shora dolů = z-order):
  - editovatelný **název**
  - rozměry W×D (cm)
  - smazat
- Aktivní vrstva = vybraná v seznamu (zvýraznění v SVG)

## 4. Vytvoření a editace obdélníku
**A) Drag na půdorysu**  
- Režim „kreslit“: tah A→B vytvoří obdélník (osa-aligned), hned pojmenovatelný  
- Hotový kus: drag těla = posun; SE úchyt = změna velikosti (min. 20×20 cm)

**B) Formulář**  
- Pole šířka / hloubka (+ název) → **Vytvořit a umístit**  
- Poté posun dragem na místo

**Zobrazení ve SVG**  
- Výplň jemná, obrys výraznější  
- Uvnitř text: `název` + `Š×H` (např. `Komoda` / `60×120`)  
- Při kolizi: **červená** výplň/obrys (neblokuje pohyb)

## 5. Omezení polohy a kolize
- **Poloha jen ve světlosti** (906×333): clamp X/Y/W/D do clear spanu — mimo světlost nelze.
- **Kolize s ostatním nábytkem / příčkami / vestavěnými kusy jsou povolené** — kus se jen vykreslí červeně (a v seznamu „· kolize“).
- Vestavěné překážky pro detekci: příčky koupelny (Z/V/J), TV příčka, kuchyň, postel/pohovka (pokud zobrazené), ostatní vrstvy nábytku.

## 6. Export / stav
- Export SVG z tabu 2 zahrnuje podklad + vrstvy  
- Do metadata SVG (jako v2) uložit i `furnitureLayers[]`  
- Import obnoví vrstvy; geometrie tabu 1 zůstane kompatibilní s v2 snapshotem

## 7. Datový model
```js
{
  id: string,
  name: string,
  x: number, // od vnitřního Z (clear)
  y: number, // od vnitřního S (clear)
  w: number,
  d: number
}
```
