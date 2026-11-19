# @vampyre/web

Spelarens gränssnitt: React 19 + Vite + TypeScript. Plan: `docs/ui/main-screen-plan.md`.

```sh
npm install        # i repots rot
npm run dev        # i roten eller här; öppna http://localhost:5173/?player=prince
npm test -w @vampyre/web
npm run typecheck -w @vampyre/web
```

`?player=` väljer spelare i demokampanjen: `innerCircle`, `prince`, `baron`, `hiddenArchbishop`, `untitled`.

## Struktur

| Fil | Innehåll |
|---|---|
| `src/screen/model.ts` | Skärmens modell och `PlayerScreenPort`. Det enda komponenterna känner till. |
| `src/screen/localPort.ts` | Utvecklingsport som kör motorn lokalt (SPEC B1: i spelet körs motorn på servern). |
| `src/screen/catalogShim.ts` | Tillfällig actionkatalog tills motorns katalog finns. |
| `src/screen/mapModel.ts` | Kartmodell ur `PlayerView`: bara garanterad information. |
| `src/screen/draft.ts` | Rena operationer på actionlistan. |
| `src/components/` | Resursrad, karta, flikmeny, vampyrpanel, actionpanel. |
