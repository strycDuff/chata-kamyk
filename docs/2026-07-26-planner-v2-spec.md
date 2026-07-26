# Planner v2.0 — Chata Kamyk (final)

**Stav:** finální 2.0 (2026-07-26). Další práce = nová major větev (nábytek / tab 2).

**906 × 333 cm = světlost** (od SDK k SDK). Vnější = světlost + 2× **23,92 cm** (v půdorysu kresleno zjednodušeně). SDK příčky **12,5 cm**.  
Kóty otvorů a X polohy (220, 313, 324, 569…) jsou **od vnitřního Z líce světlosti**.  
Postel: matrace 140/160 × 200 + editovatelný offset rámu; u východní stěny.  
Kolize dveří: jen **průchod otvorem** vs WC/sprcha — pouzdro / posuv ve stěně nevadí.

## Scope 2.0 (jeden pohled)
- Celý půdorys + ovládání v collapsible panelu (vše default collapsed)
- Koupelna (příčky, dveře A/B + směr posunu, sprcha, umyvadlo), kuchyň, postel, TV
- Měření, varianty localStorage, export/import SVG se stavem

## Defaults
| Prvek | Hodnota |
|-------|---------|
| Koupelna left (od vnitřního Z) | 569 cm |
| Koupelna outer W×D | 125 × 230 cm |
| TV příčka west face | 324 cm, délka 140 cm |
| Gauč | 240 (Z) × 160 (S), SZ roh |
| Kuchyň | left 313, délka 160, hloubka 60 |
| Postel | matrace 160×200, offset rámu 2,5 cm |
| Umyvadlo | 40 × 30 cm |
| Sprcha default | 80×80 |

## UI
- Collapsible sekce; export SVG + import; metr A→B
