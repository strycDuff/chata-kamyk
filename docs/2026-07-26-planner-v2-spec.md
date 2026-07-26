# Planner v2 — Chata Kamyk

Schváleno 2026-07-26.  
**906 × 333 cm = světlost** (od SDK k SDK). Vnější = světlost + 2× **23,92 cm**. SDK příčky **12,5 cm**.  
Kóty otvorů a X polohy (220, 313, 324, 569…) jsou **od vnitřního Z líce světlosti**, ne od vnějšího okraje.  
Postel: kratší strana (140/160) **V–Z**, delší 200 **S–J**, u východní stěny.  
Kolize dveří: jen **průchod otvorem** vs WC/sprcha — pouzdro ve příčce nevadí.

## Taby
1. **Půdorys** — drag příček, gauč/postel/TV/kuchyň, safe zóny, měření
2. **Koupelna** — dědí box koupelny z tabu 1; dveře/sprcha/umyvadlo/kolize (v1)

## Defaults
| Prvek | Hodnota |
|-------|---------|
| Koupelna left outer | 569 cm |
| Koupelna outer W×D | 125 × 230 cm |
| TV příčka west face | 324 cm, délka 140 cm |
| Gauč | 240 (Z stěna) × 160 (S stěna), SZ roh |
| Kuchyň | x 313–473, hloubka 60 od jižní vnitřní |
| Průchod | PR linky ↔ JL koupelny (cíl 105 cm) |
| Postel | u východní obvodové stěny, 160/140 × 200 |
| Umyvadlo default | 40 × 30 cm |

## UI
- Panel vpravo; varianty localStorage; export SVG; metr A→B + reset
- Drag smí za safe zónu (jen vizuální warn)
