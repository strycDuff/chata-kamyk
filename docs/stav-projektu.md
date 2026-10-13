# Chata Kamyk — stav projektu

Aktuální popis k 13. 10. 2026. Plánovač je **v3.26.1**. Starší návrhové specky v `docs/2026-07-*` popisují, jak jednotlivé vrstvy vznikly; tento soubor popisuje, co v repozitáři skutečně je.

## K čemu web je

Jeden statický web pro stavbu chaty (dřevostavba / rekonstrukce, objekt Kamyk):

1. **Plánovač** — kreslí světlý půdorys, nábytek, elektrobody a jednoduchý 3D pohled.
2. **Vybavení** — výběr konkrétních výrobků (vana, podlahy, IKEA…) a součet cen.
3. **SmartHome** — textová projektová dokumentace rozvodů pro elektrikáře a investora.

Není tu server, účet, ani synchronizace. Cloudflare Pages jen servíruje soubory.

## Objekt v číslech

Světlost (SDK k SDK) je **906 × 333 cm**.

Souřadnice v plánovači i ve `layout-model.mjs`:

- počátek = vnitřní severozápadní roh světlosti
- **+X** na východ, **+Y** na jih, jednotky **cm**
- výška **+Z** nahoru jen ve 3D (Three.js má Y nahoru, mapování je v `planner3d.mjs`)

Obvodová stěna se v půdorysu kreslí tloušťkou 10 cm. Skutečná skladba je asi 23,92 cm (`5 + 1.8 + 12 + 4 + 1.12`) a v měřítku není. SDK příčky mají **12,5 cm** (`PART_THICK`).

Otvorové segmenty (stejné v plánovači i ve Skice), délky v cm od západního respektive severního konce:

| Stěna | Skladba |
| --- | --- |
| Sever | zeď 220, okno 96,5, zeď 120, okno 90,5, zeď 99, okno 56,5, zeď 224 |
| Jih | zeď 204, dveře 103, zeď 79, okno 87 (kuchyň), zeď 434,5 |
| Západ | zeď 56, okno 83, zeď 50, okno 83, zeď 61 |
| Východ | zeď 124, okno 85, zeď 124 |

Výška okenního otvoru je 83 cm, kuchyňské jižní okno 62 cm, stejné nadpraží. Světlá výška místnosti v modelu je kolem 210 cm (3D a pohledy na stěny si ji berou ze stavu).

Výchozí parametrický layout (`koupelna/default-layout.mjs`, název „Výchozí rozložení“):

| Prvek | Hodnota |
| --- | --- |
| Koupelna, levý okraj od vnitřního Z | 569 cm |
| Koupelna vnější Š × H | 125 × 230 cm |
| Dveře koupelny | 70 cm, typ A (posuv po stěně), offset 90 cm |
| Kuchyň | left 313 cm, délka 181 cm, hloubka 60 cm |
| Postel | matrace 140, vnější rám 150 × 215, offset rámu 2,5 cm |
| Rohová sedačka | 160 (sever) × 240 (západ) |
| TV | 55", příčka od X 324 |

Průchod koupelna ↔ postel: nad 100 cm zeleně, 90–100 oranžově, pod 90 červeně. Příčka se nesmí trefit do severního okna (`clampOffNorthWindows`).

## Stránky

| URL | Soubor | Účel |
| --- | --- | --- |
| `/` | `index.html` | Rozcestník |
| `/koupelna/` | `koupelna/index.html` | Plánovač |
| `/vybaveni/` | `vybaveni/index.html` + `catalog.json` | Nákupní výběr |
| `/smarthome/` | `smarthome/index.html` | Elektro dokumentace k tisku |

Navigace je společná (`assets/site.css`, třída `.site-nav`). Na tisk se schová.

## Plánovač (`/koupelna/`)

Jedna stránka, pět záložek. Verze v toolbaru (`#app-meta`) je `v{APP_VERSION} · build {APP_BUILD} · {APP_COMMIT}`. `APP_VERSION` se mění ručně při větším řezu. `APP_BUILD` a `APP_COMMIT` doplní deploy skript do nahrávané kopie; v gitu zůstává `APP_COMMIT` prázdný, aby se commit nehashoval sám se sebou.

### Záložky

1. **Půdorys** — parametrická koupelna (příčky, dveře A/B, sprcha, umyvadlo), kuchyňská linka, postel, TV, gauč. Tahání na plátně, kóty, měření dvou bodů.
2. **Nábytek** — volné kusy nad parametrickým půdorysem (vrstvy).
3. **Elektro** — okruhy, body na stěnách, pohled na stěnu (rozvinutý pás), návrh trasy.
4. **3D** — Three.js pohled z místa (gauč, vchod, lednice, krov, loft). Tah = rozhled, WASD / šipky = pohyb.
5. **Skica** — volné rozvržení příček a nábytku, oddělené od parametrického plánovače. Bez elektro.

### Moduly

| Soubor | Role |
| --- | --- |
| `koupelna/index.html` | UI, kreslení SVG, stav, elektro, export. ~7,5k řádků. |
| `koupelna/layout-model.mjs` | Volný layout: příčky, otvory, typovaný nábytek. Schéma **10**. |
| `koupelna/default-layout.mjs` | Vestavěný výchozí snapshot parametrického stavu. Generuje se i `default-layout.json`. |
| `koupelna/skica.mjs` | Skica: editace půdorysu + 3D kontrola. Vlastní `localStorage`. |
| `koupelna/planner3d.mjs` | Three.js prohlížeč. Textury kreslí na canvas (dřevo, zeď, podlaha…), volitelně satelitní prstenec okolí. |
| `koupelna/autoroute.mjs` | Graf stěn (rohy i T-kusy příček) a nejkratší trasa kabelu po stěnách. |
| `koupelna/*.test.mjs` | `node:test` pro layout model a autoroute. |

Three.js **0.170.0** jde z jsDelivr (`importmap` v `index.html`). Bez sítě se 3D nenačte. Zbytek stránky je lokální.

### Dva layouty vedle sebe

Parametrický plánovač drží čísla (pozice koupelny, kuchyně, postele…). Záložka Nábytek a Skica používají volný model:

- `partitions[]` — úsečky, id jako `bath-west`, `tv-west`
- `openings[]` — dveře na příčce (typ A posuv / typ B pouzdro, panty, směr)
- `furnitureLayers[]` — druhy `generic`, `bed`, `sofa`, `kitchen`, `wc`, `shower`, `sink`, `tv`
- `livingBoundaryId` — typicky příčka `tv-west`, odděluje obývák

`seedFromParametric()` z čísel postaví tento model. `migrateSnapshotToV10()` je idempotentní migrace starších exportů.

Skica semena z výchozího layoutu, ale ukládá se zvlášť a parametrický plánovač nemění.

### Elektro

Body: zásuvka (30 cm), vypínač (120), světlo (210), rozvaděč (150). Okruhy mají druh `data` / `lights` / `sockets` a k tomu kabel `slaboproud` / `cyky15` / `cyky25`.

Trasa se navrhuje po stěnách (`autoroute.mjs`): projekce bodu na zeď, graf včetně T-spojů příčky do obvodu, nejkratší cesta. Silové páteře jedou v pevných výškách 12 / 16 / 20 / 24 cm (`POWER_SLOTS`), datové výš kolem 200 cm. V půdorysu mají koridory boční offset, aby se na jedné zdi nepřekreslily přes sebe.

Pohled na stěny je pás (sever / východ / jih / západ), zoom a posun. Návrh trasy umí sloučit body na stejné i na různých stěnách bez couvání a začíná svislým stoupáním k výšce rozvaděče.

### 3D

`createViewer` / `rebuild` / `setCameraView`. Boxy jsou ve světlých cm. Volitelně: střecha (sklon, krokve, kleštiny, bednění, krytina, přesahy), loft, interiérové bodové světlo, textury, otevřené dveře, satelitní podklad okolí (Esri). Vypínač světel a střechy je součást stavu plánovače.

### Ukládání a přenos

| Klíč | Obsah |
| --- | --- |
| `chata-kamyk-planner-variants-v9` | Uživatelské varianty plánovače. Vestavěný default se do klíče neukládá. |
| `chata-kamyk-skica-v2` | Příčky, otvory a nábytek skici. |
| `chata-kamyk-vybaveni-picks-v1` | Vybrané varianty, vyřazené položky, množství. |

Export SVG z plánovače obsahuje grafiku i JSON stavu pro import na jiném počítači. Export JSON je totéž bez grafiky. Import bere `.svg` i `.json`.

## Vybavení (`/vybaveni/`)

`catalog.json` verze 1 je jednorázový dump (27. 7. 2026) plus plochy z finálního snapshotu. Zdrojový Google Sheet je v poli `sheetUrl`; stránka ho **nečte živě**.

43 položek, 55 variant, čtyři místnosti:

| Místnost | Položek |
| --- | --- |
| Koupelna | 13 |
| Kuchyně | 13 |
| Obývací pokoj | 7 |
| Ložnice | 10 |

U položky je množství, jednotka a `options[]` (název, URL, cena, poznámka, `default`). Stránka nechá vybrat variantu, položku vyřadit, u kusů upravit množství a sečte Kč. Plochy k nákupu (čistá vs. objednat) jsou v `areas`: podlahy, obklady koupelny, kuchyňský splashback.

Export / import JSON ve stejném duchu jako plánovač. Výchozí výběr se po smazání `localStorage` znovu složí z `default: true`.

## SmartHome (`/smarthome/`)

Jedna tisknutelná stránka, revize **Final V7**. Není to ovládání domu, je to zadání instalace.

Koncept: klasická silovina + oddělený slaboproud + Home Assistant (Zigbee 3.0 / Wi‑Fi). Žádný Loxone ani KNX. Bez řídicího počítače musí světla a zásuvky fungovat dál.

- Silový rozvaděč **NOARK PHS 36T** (36 modulů, IP65) na stěně u WC. V něm jen 230 V. Na druhé DIN řadě rezerva 2M pro SPD **NOARK Ex9UE1+2** (fáze 3, před hromosvodem).
- Zvlášť multimediální skříň: Intel N100 s Home Assistant OS, Mercusys MS108GP (PoE+) a MS108G, SONOFF PoE Dongle Max.
- Vypínače: do každé krabice dotažené L+N, **Sonoff ZBMINIR2** jako Zigbee router. Krabice KOPOS **KUL 68-45/LD NA** kvůli parozábraně ve skladbě rošt 40 mm + SDK 12,5 mm.
- Bojler 80 l / 1,2 kW přes stykač Noark Ex9CH25; chytrý modul spíná jen cívku. Měření Sonoff POWR316D.
- Voda: ventil GOMEDIA 1" NC, ZBMINIR2 spíná 230 V stranu 12 V zdroje. Výpadek nebo povel zavře vodu.
- Kamery IMOU Cruiser nejsou nativní PoE — aktivní 802.3af splitter na 12 V.

Stránka má řaditelnou nákupní tabulku (fáze, sekce, produkt, odkaz). Tisk na A4, navigace se skryje.

## Testy

```bash
node --test koupelna/*.test.mjs
```

22 testů (k 13. 10. 2026): projekce na zeď, nejkratší cesta, T-spoj příčky, výška páteře, návrh trasy, seed příček, migrace v10, rotace nábytku, panty dveří. Prohlížečové chování testy neberou.

## Deploy

`scripts/deploy.sh`:

1. Spočítá build = `git rev-list --count HEAD`, commit = krátké SHA, verzi vytáhne z `APP_VERSION`.
2. `rsync` do dočasného adresáře. Vynechá `.git`, `.tools`, `.wrangler`, `docs`, `.cursor`, `scripts`, `.DS_Store`.
3. V **kopii** `koupelna/index.html` přepíše blok `BUILD_META`. Zdroj v gitu se nemění.
4. `npx wrangler pages deploy` na projekt **`chata-kamyk`**, účet `vopicka.david@gmail.com`.

`scripts/stamp-build.sh` umí orazítkovat build do zdrojového HTML (commit nechá prázdný). Běžný deploy to nedělá, aby nevznikal commit jen kvůli číslu buildu.

`wrangler.toml` jen pojmenovává projekt a `pages_build_output_dir`. Pages projekt **nemá** Git integraci — nasazuje se ručně tímto skriptem.

Produkce:

- https://chata.kamaik.cz/ — custom domain projektu `chata-kamyk`. Proxied CNAME `chata` → `chata-kamyk.pages.dev` v zóně `kamaik.cz`.
- https://chata-kamyk.pages.dev/ — výchozí Pages hostname

DNS zápis nejde přes `wrangler login` (má jen `zone:read`). Token `cursor-chata-kamyk` je v klíčence macOS (`security find-generic-password -s cloudflare-api-token -a kamaik`). Umí DNS edit na zóně `kamaik.cz` a Pages edit na účtu.

Skript nastavuje `NODE_TLS_REJECT_UNAUTHORIZED=0`, protože na téhle síti OAuth k Cloudflare bez toho nedoběhne.

## Historické specky

Nejsou návod k aktuálnímu kódu. Jsou to návrhové zápisy z 26.–27. 7. 2026:

| Soubor | Téma |
| --- | --- |
| `docs/2026-07-26-planner-v2-spec.md` | Finální 2.0, jeden půdorys |
| `docs/2026-07-26-planner-v3-furniture-layers-design.md` | Vrstvy nábytku |
| `docs/2026-07-26-planner-elevations-design.md` | Pohledy na stěny |
| `docs/2026-07-26-planner-electro-floorplan-design.md` | Elektro v půdorysu |
| `docs/2026-07-27-planner-electro-multi-elev-design.md` | Více stěn v pásu |
| `docs/2026-07-27-planner-electro-socket-trunk-design.md` | Páteř zásuvek |
| `docs/2026-07-27-planner-electro-autoroute-design.md` | Automatická trasa |
| `docs/superpowers/plans/2026-07-27-electro-autoroute.md` | Plán implementace autoroute |
| `docs/2026-07-27-planner-free-layout-design.md` | Volný layout / skica |
| `docs/2026-07-27-planner-3d-view-design.md` | 3D pohled |
| `docs/2026-07-27-planner-3d-roof-klestiny-design.md` | Krov a kleštiny |
| `docs/layout-variants/` | Varianty A/B/C (SVG, PNG, JSON) — alternativy k výchozímu layoutu, ne živá data |

## Co v repozitáři není

- Konfigurace Home Assistant, Zigbee síť, ani skutečné zapojení v objektu.
- Živé čtení Google Sheetu s vybavením.
- Účty, sdílení stavu mezi prohlížeči, historie mimo exportované soubory.
- Automatický deploy z GitHubu.
