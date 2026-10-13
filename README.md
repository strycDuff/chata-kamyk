# Chata Kamyk

Statický web k rekonstrukci chaty: interaktivní plánovač půdorysu, nákupní výběr vybavení a projektová dokumentace elektro / SmartHome.

Žádný backend. Stav plánovače, skici a výběru vybavení žije v `localStorage` prohlížeče. Export JSON (a u plánovače i SVG) přenáší stav mezi počítači.

Podrobný popis modulů, souřadnic a deploye: [docs/stav-projektu.md](docs/stav-projektu.md).

## Živě

- https://chata.kamaik.cz/
- https://chata-kamyk.pages.dev/

## Lokálně

```bash
npx --yes serve .
```

Otevři `http://localhost:3000/`. Soubor `index.html` jde otevřít i přímo, ale plánovač tahá moduly přes ES import a 3D přes CDN, takže HTTP server je spolehlivější.

## Testy

```bash
node --test koupelna/*.test.mjs
```

Pokryté jsou layout model (schéma v10, příčky, nábytek, dveře) a autoroute elektrotras. UI se netestuje.

## Deploy

```bash
./scripts/deploy.sh
```

Nahraje pracovní kopii na Cloudflare Pages projekt `chata-kamyk` a do nahrávané kopie `koupelna/index.html` orazítkuje `APP_BUILD` (počet commitů) a `APP_COMMIT` (krátké SHA). `docs/`, `scripts/`, `.cursor/` a `.git/` se nenahrávají.

Vlastní doména `chata.kamaik.cz` je custom domain téhož Pages projektu (zóna `kamaik.cz` na Cloudflare). Pages není napojené na Git — push sám o sobě web neaktualizuje.

## Struktura

| Cesta | Co to je |
| --- | --- |
| `/` | Rozcestník |
| `/koupelna/` | Plánovač v3 (půdorys, nábytek, elektro, 3D, skica) |
| `/vybaveni/` | Katalog variant a součty cen |
| `/smarthome/` | Tisknutelná dokumentace elektroinstalace (Final V7) |
| `assets/site.css` | Společná navigace |
| `docs/` | Specifikace a tento přehled; na web se nenahrává |
