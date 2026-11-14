# P+R figyelő – webes (Angular) változat

Ugyanaz a P+R parkoló figyelő, mint a repó gyökerében lévő Flutter app, csak böngészőben fut.
Kezdőképernyőre téve önálló appként működik, aláírás és lejárat nélkül.

## Funkciók

- KÖKI Terminál (P061) és Kőbánya-Kispest (P051) szabad helyei, telítettségi sáv, változásjelzés
- 10 mp-enként frissít, **csak amíg az oldal előtérben van** (`visibilitychange`)
- Kézi frissítés gomb, utolsó lekérdezés ideje + „x mp-e” számláló
- **A képernyő ébren tartása** a Screen Wake Lock API-val (napocska gomb, kikapcsolható).
  iPhone-on Safariban iOS 16.4-től, kezdőképernyős appként iOS 18.4-től működik.
- Világos / sötét mód a rendszer beállítása szerint

Új parkoló: bővítsd a `WATCHED_IDS` listát a `src/app/parking.ts` fájlban.

## Fejlesztés

```bash
npm install
npx ng serve          # http://localhost:4200
npx ng test --watch=false
npx ng build
```

A Közút API (`https://kozutfigyelo-back.budapestkozut.hu/api/ikszr/get`) bármely originről
engedi a böngészős hívást, proxy nem kell.

## Telepítés

A `master` ágra pusholt változás után a `.github/workflows/pages.yml` workflow lefordítja és
GitHub Pagesre telepíti az appot.

## iPhone-ra

1. Nyisd meg a GitHub Pages linket Safariban.
2. Megosztás gomb → **Főképernyőhöz adás**.
3. Az ikonról indítva teljes képernyős appként fut.
