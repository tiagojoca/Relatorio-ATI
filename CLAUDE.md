# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint (flat config in `eslint.config.js`)
- `npm test` — run the pure-function tests (Vitest)

Testes das funções puras (`src/lib/relatorioModel.js`) rodam com Vitest via `npm test`. Integração Firebase e UI são verificadas manualmente. Configuração do backend: veja `docs/SETUP-FIREBASE.md`.

## What this app is

**Gerador de Relatórios CBMRO** — a React app (Vite) that generates the monthly activity report ("Relatório de Atividades") for the Assessoria Institucional do CBMRO, formatted as an official memo (ofício) and exported as a `.docx`. Reports are stored centrally in Firebase (Firestore + Storage), gated behind a shared password (Firebase Auth).

## Architecture

`src/App.jsx` is a thin router: it watches the Firebase auth state and renders one of three things — a loading state, the `LockScreen` (when logged out), or the app header + the current screen (`ReportList` or `EditorScreen`). View state is a simple `{ screen: 'list' | 'editor', monthId }` object in `App`; there is no router library.

- `src/screens/` — the three screens:
  - `LockScreen.jsx` — password gate; calls `login()` with the shared account.
  - `ReportList.jsx` — lists existing monthly reports and creates/opens one.
  - `EditorScreen.jsx` — the editor (the bulk of the UI); receives `monthId`/`onBack` props, loads that month's doc on mount, and persists on every mutation.
- `src/firebase/` — backend layer:
  - `config.js` — initializes the Firebase app; exports `auth`, `db`, `storage`. Holds the public web config (fill in per `docs/SETUP-FIREBASE.md`).
  - `auth.js` — shared-password auth: one fixed account (`SHARED_EMAIL`); `login`/`logout`/`onAuthChange`.
  - `relatorios.js` — Firestore/Storage data layer: `listRelatorios`, `getRelatorio`, `createRelatorio`, `saveRelatorioEvents`, `uploadEventPhotos`.
- `src/lib/` — pure/shared logic:
  - `relatorioModel.js` — pure helpers (`monthIdFromRaw`, `separatePhotos`, `newEventId`, `isDataUrl`) and `parseEventoText`; unit-tested in `relatorioModel.test.js`.
  - `docxExport.js` — the `.docx` builder (`exportDocx`), extracted from the editor.

Key flows to understand before making changes:

- **Data model**: Firestore has one document per month at `relatorios/{YYYY-MM}` (the month is the doc ID, so ordering by ID orders chronologically). Each doc holds `mesAnoRaw`, an ordered `events` array, and `updatedAt`. Each event has a stable `id`, the free-text `evento` field, and `fotoUrls`. Persistence is **last-write-wins**: every mutation writes the whole `events` array back via `saveRelatorioEvents`.
- **Photos**: stored in Firebase Storage at `relatorios/{YYYY-MM}/{eventId}/…`; Firestore keeps only the download URLs (avoids the 1MB/doc limit). During form editing, photos are data URLs (local preview); on Add/Save, `uploadEventPhotos` uploads the new data-URL ones and leaves already-uploaded http URLs untouched (see `separatePhotos`). `fotoUrl` (singular) is a legacy field kept only for backward-compat.
- **Text parsing (`parseEventoText`, in `src/lib/relatorioModel.js`)**: users paste one freeform block into the "Evento" textarea. A single regex-based extractor pulls out `Evento/Nome`, `Data`, `Local`, `Envolvidos/Stakeholders/Participantes`, and `Relato` by label, tolerating several synonyms. If it doesn't match, the raw text renders as a fallback paragraph. Changes to labels/synonyms happen in this one function and affect both the preview and the DOCX export (both call it).
- **Dual rendering of the same data**: the live HTML preview panel (`#sei-document`, in `EditorScreen`) and the `.docx` export (`exportDocx` in `src/lib/docxExport.js`) are two separate implementations kept in sync by hand — no shared template. When changing report formatting, update both. For the DOCX, each image is fetched to a data URL (`toDataUrl`), redrawn onto a `<canvas>` and downscaled to max 500px width, then converted to a JPEG buffer for `ImageRun`.
- **Backup/restore**: "Salvar (.JSON)" / "Carregar (.JSON)" export/import the full `{ mesAnoRaw, events }` of the open report as a JSON file, independent of the database.
- **Report boilerplate**: the memo's fixed opening paragraph, addressee, closing, and signature (Cel. Wândrio Bandeira dos Anjos) are hardcoded text in both the preview and the DOCX export — treat these as fixed institutional copy, not placeholders, unless asked to change them.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys `dist/` to GitHub Pages on every push to `main`. `vite.config.js` sets `base: '/Relatorio-ATI/'` — this must match the GitHub Pages repo path if the repo is ever renamed.
