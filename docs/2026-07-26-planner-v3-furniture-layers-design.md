# Design: Planner v3 — tab Nábytek (vrstvy obdélníků)

**Datum:** 2026-07-26  
**Stav:** návrh (čeká na schválení)  
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
  - smazat / (volitelně) skrýt
- Aktivní vrstva = vybraná v seznamu (zvýraznění v SVG)

## 4. Vytvoření a editace obdélníku
**A) Drag na půdorysu**  
- Režim „kreslit“: tah A→B vytvoří obdélník (osa-aligned), hned pojmenovatelný  
- Hotový kus: drag těla = posun; úchyty hran = změna velikosti (min. např. 20×20 cm)

**B) Formulář**  
- Pole šířka / hloubka (+ volitelně X/Y od vnitřního Z/S) → **Vytvořit**  
- Poté posun dragem na místo

**Zobrazení ve SVG**  
- Výplň jemná, obrys výraznější  
- Uvnitř text: `název` + `Š×H` (např. `Komoda` / `60×120`)

## 5. Export / stav
- Export SVG z tabu 2 zahrnuje podklad + vrstvy  
- Do metadata SVG (jako v2) uložit i `furnitureLayers[]`  
- Import obnoví vrstvy; geometrie tabu 1 zůstane kompatibilní s v2 snapshotem

## 6. Mimimum / mimo scope (první cut)
**V scope:** osa-aligned rects, název, W×D, posun, resize, seznam, + vrstva, smazat, export/import  
**Mimo v1 nábytku (později):** rotace, snap na stěny, kolize s vestavěným nábytkem, předvolby kusů, kopírování

## 7. Datový model (návrh)
```js
{
  id: string,
  name: string,
  x: number, // od vnitřního Z (clear)
  y: number, // od vnitřního S (clear)
  w: number,
  d: number,
  visible?: boolean
}
```
