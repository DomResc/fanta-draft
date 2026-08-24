# Fanta Draft Assistant

Assistente da tenere aperto durante l'asta del tuo Fantacalcio: budget, rosa, bersagli e upgrade sempre sotto controllo. Funziona interamente nel browser — nessun account, nessun server.

**Demo:** https://domresc.github.io/fanta-draft/

[![Deploy](https://github.com/DomResc/fanta-draft/actions/workflows/deploy.yml/badge.svg)](https://github.com/DomResc/fanta-draft/actions/workflows/deploy.yml)

## Come si usa

1. Scarica il file `.xlsx` delle quotazioni ufficiali da fantacalcio.it e caricalo nell'app (foglio "Tutti")
2. Configura la lega: budget, dimensione della rosa, vincoli minimi per reparto
3. Durante l'asta segna i tuoi acquisti e i giocatori presi dagli altri: l'app calcola in tempo reale quanto puoi offrire

## Funzionalità

- Due modalità: **Classic** (P/D/C/A) e **Mantra** (sotto-ruoli Dd/Dc/B/E/M/C/W/T/A/Pc con moduli ufficiali)
- **Offerta massima** sostenibile per ogni giocatore, dato il budget residuo e la rosa minima ancora da coprire
- Miglior undici automatico con il modulo scelto (assegnamento ottimale dei slot in Mantra)
- Suggerimenti di **upgrade** con guadagno stimato sulla somma FVM dell'undici
- Undo fino a 50 mosse, esporta/importa dello stato dell'asta in JSON
- Tutto persiste nel `localStorage` del browser: nessun dato lascia il tuo dispositivo

## Sviluppo

```bash
npm install
npm run dev      # server di sviluppo
npm test         # test (vitest)
npm run build    # typecheck + build in dist/
```

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · SheetJS (xlsx)

## Licenza

[MIT](LICENSE)
