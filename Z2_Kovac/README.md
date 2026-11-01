# Obedové menu v okolí fakulty

WEBTE1 – Zadanie 2, ZS 2026/2027
Autor: Gabriel Kováč

Stránka načíta stránky troch reštaurácií, spracuje z nich denné menu a zobrazí ho podľa dní v týždni.
Celé riešenie beží v prehliadači (HTML, CSS, JavaScript).

Odkaz na stránku na školskom serveri: ** https://webte1.fei.stuba.sk/~xkovacg/ **

## Spustenie

Stránka načítava lokálne HTML kópie cez Fetch API, preto ju treba otvoriť cez webový server
(napr. Live Server vo VS Code alebo školský server). Pri otvorení dvojklikom (`file://`) prehliadač
požiadavky zablokuje.

## Štruktúra

```
index.html          denné menu (hlavná stránka)
o-projekte.html     podstránka O projekte
favicon.svg         ikona stránky
css/styles.css      vlastné štýly (pripojené za Bootstrapom) a @font-face
js/utils.js         pomocné funkcie (cleanText, textOf, parsePrice, parseHtml, práca s dátumami)
js/parsers.js       jeden parser pre každú reštauráciu, všetky vracajú rovnakú štruktúru
js/script.js        načítanie, localStorage, záložky dní, filter, vykreslenie kariet
lib/                Bootstrap 5.3.8 (CSS) a jQuery 4.0.0
fonts/              písmo Roboto (WOFF2) a jeho licencia
data/               lokálne kópie stránok reštaurácií
docs/               výstupy z validátorov HTML a CSS
```

## Reštaurácie

| Reštaurácia | Pôvodná stránka | Lokálna kópia |
| --- | --- | --- |
| Eat & Meet | https://eatandmeet.sk/tyzdenne-menu | `data/eatandmeet.html` |
| U Zlatého Bažanta | https://uzlatehobazanta.sk/denne-menu/ | `data/zlatybazant.html` |
| Café Devín | https://www.cafedevin.sk/menu/denne-business-menu/ | `data/cafedevin.html` |

Podľa spresnenia k bodu (3) sa nepoužíva proxy, načítavajú sa iba lokálne kópie.

## Ako to funguje

1. Pri otvorení sa pre každú reštauráciu skontroluje `localStorage`. Ak sú tam jej dáta z dnešného dňa,
   použijú sa a stránka reštaurácie sa nenačítava.
2. Inak sa kópia stiahne cez `fetch` (kontroluje sa `response.ok`, text sa číta cez `response.text()`). Všetky reštaurácie sa načítavajú súčasne
   (`Promise.allSettled`) a každá karta sa zobrazí, hneď ako je jej reštaurácia hotová.
3. HTML sa prevedie na samostatný dokument cez `DOMParser` a údaje sa vyberajú cez
   `querySelector` / `querySelectorAll` (parser Eat & Meet cez jQuery selektory). Regulárne výrazy sa používajú iba na krátky text jedného prvku
   (cena, dátum, alergény, hmotnosť).
4. Každý parser vracia pole dní:
   `[{ day, date, items: [{ type, label, name, price, priceStudent, priceNote, allergens, weight }] }]`.
5. Na stránku sa vkladajú iba vybrané údaje cez `createElement` a `textContent`, nikdy nie cudzie HTML.
6. Chyby: nedostupná stránka (HTTP chyba), zmenená štruktúra (parser nič nenájde) a chýbajúci deň
   sa zobrazia v karte danej reštaurácie. Ostatné reštaurácie sa zobrazia normálne. Karta s chybou má
   tlačidlo *Skúsiť znova*.
7. Ak sú dátumy v menu z iného týždňa (reštaurácia ešte neaktualizovala stránku), karta to oznámi.

Pridanie novej reštaurácie: uložiť kópiu do `data/`, napísať funkciu `parseNazov(doc)` v `js/parsers.js`
a pridať jeden objekt do poľa `SOURCES` v `js/script.js`. Karta aj filter sa vytvoria automaticky.

## Použité knižnice

- **Bootstrap 5.3.8** (iba CSS) – mriežka, karty, formulárové prvky, spinner. Licencia MIT.
- **jQuery 4.0.0** – parser Eat & Meet vyberá údaje cez jQuery selektory (`$(doc).find()`, `.each()`). Licencia MIT.

Knižnice sú uložené lokálne v priečinku `lib/`.

## Písmo

**Roboto** (The Roboto Project Authors), licencia **SIL Open Font License 1.1**.
Plné znenie licencie je v `fonts/OFL.txt`. Súbory WOFF2 pochádzajú z balíka `@fontsource/roboto`
a sú pripojené cez `@font-face` v `css/styles.css` (podmnožiny latin a latin-ext kvôli slovenskej diakritike).

## Validita

Výstupy z https://validator.w3.org/ a https://jigsaw.w3.org/css-validator/ sú v priečinku `docs/`.

## Použitie AI

Pri vypracovaní tohto zadania som použil AI na generovanie rôznych častí kódu, vysvetlenie problematiky, na celkové doľaďovanie zadania a na pomoc pri problémoch, ktoré nastali.
