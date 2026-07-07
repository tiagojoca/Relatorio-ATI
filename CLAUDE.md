# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint (flat config in `eslint.config.js`)
- `npm test` — run the pure-function tests (Vitest)

Testes (Vitest) via `npm test` cobrem as funções puras (`src/lib/relatorioModel.js`) e o backend localStorage (`src/localdb/relatorios.js`). A UI é verificada manualmente no navegador. O backend Firebase está dormante — para ligá-lo no futuro, veja `docs/SETUP-FIREBASE.md`.

## What this app is

**Gerador de Relatórios CBMRO** — a React app (Vite) that generates the monthly activity report ("Relatório de Atividades") for the Assessoria Institucional do CBMRO, formatted as an official memo (ofício) and exported as a `.docx`. Reports (one per month, with history) are currently stored in the browser via **localStorage**; there is no login. A full Firebase backend (Firestore + Storage + shared-password Auth) is already built and dormant in the repo, ready to switch on later.

## Architecture

`src/App.jsx` is a thin router: it renders the app header plus the current screen (`ReportList` or `EditorScreen`). View state is a simple `{ screen: 'list' | 'editor', monthId }` object in `App`; there is no router library and no auth gate.

- **Swappable data layer** — screens NEVER import a backend directly. They import from `src/data/relatorios.js`, a one-line barrel that re-exports the active backend. Today it points to `../localdb/relatorios` (localStorage). To migrate to Firebase later: change that single re-export to `../firebase/relatorios`, fill `src/firebase/config.js`, and re-add the auth gate/`LockScreen` in `App.jsx` (see `docs/SETUP-FIREBASE.md`). Both backends expose the identical interface: `listRelatorios`, `getRelatorio`, `createRelatorio`, `saveRelatorioEvents`, `uploadEventPhotos`.
- `src/localdb/relatorios.js` — **active** backend. Stores all reports in one localStorage key `cbmro_relatorios` as a map `{ [monthId]: { mesAnoRaw, events } }`. `uploadEventPhotos` is a no-op that returns the photo URLs unchanged (photos stay embedded as data URLs). Round-trip tested in `relatorios.test.js`.
- `src/firebase/` — **dormant** backend (not imported by anything reachable from `App`): `config.js` (public web config, has `PREENCHER` placeholders), `auth.js` (shared-account `login`/`logout`/`onAuthChange`, `SHARED_EMAIL`), `relatorios.js` (Firestore/Storage impl). `LockScreen.jsx` (password gate) is likewise present but unused.
- `src/screens/` — `ReportList.jsx` (lists monthly reports, creates/opens one) and `EditorScreen.jsx` (the editor — bulk of the UI; takes `monthId`/`onBack`, loads that month on mount behind a `loading` gate, persists on every mutation).
- `src/lib/` — pure/shared logic:
  - `relatorioModel.js` — pure helpers (`monthIdFromRaw`, `separatePhotos`, `newEventId`, `isDataUrl`) and `parseEventoText`; unit-tested in `relatorioModel.test.js`.
  - `docxExport.js` — the `.docx` builder (`exportDocx`), extracted from the editor.

Key flows to understand before making changes:

- **Data model**: one report per month, keyed by `monthId` = `"YYYY-MM"` (sorting IDs as text orders chronologically). Each report holds `mesAnoRaw` and an ordered `events` array; each event has a stable `id`, the free-text `evento` field, and `fotoUrls`. Persistence is **last-write-wins**: every mutation writes the whole `events` array back via `saveRelatorioEvents`. In the localStorage backend all reports live under the single `cbmro_relatorios` key.
- **Photos**: in the active localStorage backend, photos stay embedded as data URLs inside the event (⚠️ localStorage has a ~5MB total quota — many photos can overflow it; the dormant Firebase backend solves this by uploading to Storage and keeping only URLs). `fotoUrl` (singular) is a legacy field kept only for backward-compat with old data. The Firebase `uploadEventPhotos`/`separatePhotos` distinction (upload data-URLs, keep existing http URLs) only matters once that backend is switched on.
- **Text parsing (`parseEventoText`, in `src/lib/relatorioModel.js`)**: users paste one freeform block into the "Evento" textarea. A single regex-based extractor pulls out `Evento/Nome`, `Data`, `Local`, `Envolvidos/Stakeholders/Participantes`, and `Relato` by label, tolerating several synonyms. If it doesn't match, the raw text renders as a fallback paragraph. Changes to labels/synonyms happen in this one function and affect both the preview and the DOCX export (both call it).
- **Dual rendering of the same data**: the live HTML preview panel (`#sei-document`, in `EditorScreen`) and the `.docx` export (`exportDocx` in `src/lib/docxExport.js`) are two separate implementations kept in sync by hand — no shared template. When changing report formatting, update both. For the DOCX, each image is fetched to a data URL (`toDataUrl`), redrawn onto a `<canvas>` and downscaled to max 500px width, then converted to a JPEG buffer for `ImageRun`.
- **Backup/restore**: "Salvar (.JSON)" / "Carregar (.JSON)" export/import the full `{ mesAnoRaw, events }` of the open report as a JSON file, independent of the database.
- **Report boilerplate**: the memo's fixed opening paragraph, addressee, closing, and signature (Cel. Wândrio Bandeira dos Anjos) are hardcoded text in both the preview and the DOCX export — treat these as fixed institutional copy, not placeholders, unless asked to change them.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys `dist/` to GitHub Pages on every push to `main`. `vite.config.js` sets `base: '/Relatorio-ATI/'` — this must match the GitHub Pages repo path if the repo is ever renamed.
