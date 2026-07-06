# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build locally
- `npm run lint` — run ESLint (flat config in `eslint.config.js`)

There is no test suite/framework configured in this project.

## What this app is

**Gerador de Relatórios CBMRO** — a single-page React app (Vite) that generates the monthly activity report ("Relatório de Atividades") for the Assessoria Institucional do CBMRO, formatted as an official memo (ofício) and exported as a `.docx`.

## Architecture

The entire application — state, business logic, and UI — lives in one file: `src/App.jsx`. There is no routing and no component decomposition; everything is inline JSX with inline styles inside a single `App` function.

Key flows to understand before making changes:

- **Data model**: an ordered list of `events`, each with free-text fields (`evento`, plus legacy `data`/`local`/`envolvidos`/`relato`) and `fotoUrls` (array of image data URLs). State is persisted to `localStorage` under `cbmro_events` and `cbmro_date` on every change (two separate `useEffect` hooks).
- **Text parsing (`parseEventoText`)**: users paste one freeform block of AI-generated text into the "Evento" textarea. A single regex-based extractor pulls out `Evento/Nome`, `Data`, `Local`, `Envolvidos/Stakeholders/Participantes`, and `Relato` by label, tolerating several synonyms per label. This parser is the crux of the app — if it doesn't match, the raw pasted text is rendered as a fallback plain paragraph. Any change to accepted labels/synonyms must be made in this one function and affects both the on-screen preview and the DOCX export identically (both call it independently).
- **Dual rendering of the same data**: the live HTML preview panel (`#sei-document`) and the `.docx` export (`handleExportDocx`, using the `docx` package) are two separate implementations that must be kept visually/structurally in sync by hand — there's no shared template. When changing report formatting (fonts, spacing, field order, the fixed opening/closing paragraphs and signature block), update both.
- **Photos**: multiple images per event are stored as data URLs. `fotoUrl` (singular) is a legacy field kept only for backward-compat with old saved/imported data; `fotoUrls` (array) is current. Before embedding in the DOCX, each image is redrawn onto a `<canvas>` and downscaled to max 500px width, then converted to a JPEG buffer for `ImageRun`.
- **Backup/restore**: "Salvar (.JSON)" / "Carregar (.JSON)" export/import the full `{ mesAnoRaw, events }` state as a JSON file, independent of `localStorage`, for cross-session/device backup.
- **Report boilerplate**: the memo's fixed opening paragraph, addressee, closing, and signature (Cel. Wândrio Bandeira dos Anjos) are hardcoded text in both the preview and the DOCX export — treat these as fixed institutional copy, not placeholders, unless asked to change them.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys `dist/` to GitHub Pages on every push to `main`. `vite.config.js` sets `base: '/Relatorio-ATI/'` — this must match the GitHub Pages repo path if the repo is ever renamed.
