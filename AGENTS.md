# AGENTS.md

## Project

Fanta Draft Assistant: client-only Vite + React 19 + TypeScript SPA per aste Fantacalcio.
No backend/API — the only data input is a user-uploaded quotazioni `.xlsx`; app and draft
state persist in `localStorage`. UI strings, comments, and test names are in Italian.

## Commands

- Run `npm install` first (fresh clones have no `node_modules`).
- Dev server: `npm run dev`; preview prod build: `npm run preview`.
- `npm run build` = `tsc --noEmit && vite build` — this is the only typecheck; there is no
  lint/format script and no ESLint/Prettier config.
- Tests: `npm test` (= `vitest run`).
  - Single file: `npx vitest run src/lib/engine.test.ts`
  - Single suite/case: add `-t "maxBidFor"`

## Architecture

- `src/lib/parser.ts` parses the official Fantacalcio quotazioni workbook with a hard-coded
  contract: sheet must be named `"Tutti"`, row 1 is a title line (read via `range: 1`),
  columns are fixed Italian headers (`Id, R, RM, Nome, Squadra, Qt.A, Qt.I, Diff., Qt.A M,
  FVM, FVM M`). Renaming `Player` fields in `src/types.ts` or these columns breaks parsing.
- `src/lib/engine.ts` is pure draft logic (budget status, max bid, best lineup, upgrades)
  shared by two modes: `classic` (macro roles P/D/C/A) and `mantra` (sub-roles like
  Dd/Dc/B/E/M/C/W/T/A/Pc; formations are slot arrays in `MANTRA_MODULES`).
- `src/types.ts` also holds mode-aware helpers (`quoteOf`, `ratingOf`, `blocchiOf`) — route
  all mode-dependent value selection through them instead of reading fields directly.
- State lives in `src/state/store.tsx`: `useReducer` store with undo history (`past`
  capped at 50), persisted per mode to `fanta-draft:v1:<mode>`; quotazioni cached under
  `fanta-draft:v1:data`; selected mode under `fanta-draft:mode`. Corrupt storage silently
  resets to defaults — bump key versions when changing persisted shapes.

## Testing

- Vitest runs with default config (no `test` block in vite.config.ts, no jsdom): tests
  cover pure logic only (`engine.test.ts`, `parser.test.ts`). Configure an environment
  before adding DOM/component tests.
- Parser tests build real `.xlsx` buffers via `XLSX.utils` — reuse the `buildWorkbook`
  helper pattern from `parser.test.ts` (sheet `"Tutti"`, title row, then header row).
