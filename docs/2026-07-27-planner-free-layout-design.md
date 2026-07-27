# Freestyle Skica (v3.24) — explore tab only

**Stav:** implementováno 2026-07-27.

Freestyle layout žije **jen** v tabu **5 · Skica**. Hlavní plánovač (1–4: půdorys / nábytek / elektro / 3D) zůstává parametrický a neměnný.

## Co Skica dělá
- Volné příčky (osa-aligned), dveře na příčce, typed nábytek + preset + otočení 90°
- Půdorys + **3D náhled** pro validaci
- **Bez elektro**

## Storage
- Parametrický plánovač: `chata-kamyk-planner-variants-v9` (autoritativní)
- Skica: `chata-kamyk-skica-v1` (odděleně, neovlivní varianty)

## Soubory
- [`koupelna/layout-model.mjs`](../../koupelna/layout-model.mjs) — model partitions/openings/furniture
- [`koupelna/skica.mjs`](../../koupelna/skica.mjs) — UI + plan SVG + 3D spec
- [`koupelna/index.html`](../../koupelna/index.html) — tab `skica` + mount
