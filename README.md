# Gerador de Relatórios CBMRO

Aplicativo web (React + Vite) para gerar o **Relatório Mensal de Atividades da
Assessoria Institucional do CBMRO**, formatado como ofício e exportável em `.docx`.

## Funcionalidades

- Histórico de relatórios por mês (um relatório por mês).
- Editor que recebe um bloco de texto livre por evento e extrai automaticamente
  **Evento**, **Data**, **Local**, **Participantes** e **Relato**.
- Anexo de múltiplas fotos por evento (arrastar/soltar ou seleção).
- Prévia ao vivo no formato de ofício.
- Exportação para `.docx` (Times New Roman, imagens redimensionadas).
- Backup/restauração manual do relatório aberto em `.json`.

## Comandos

- `npm run dev` — sobe o servidor de desenvolvimento (Vite).
- `npm run build` — build de produção em `dist/`.
- `npm run preview` — pré-visualiza o build de produção.
- `npm run lint` — roda o ESLint.
- `npm test` — roda os testes (Vitest).

Ambiente de desenvolvimento padrão: <http://localhost:5173/Relatorio-ATI/>

## Armazenamento de dados

Atualmente os relatórios são salvos **localmente no navegador** (localStorage) —
não há login, e os dados ficam no dispositivo/navegador em uso.

Um backend completo em **Firebase** (Firestore + Storage + login por senha
compartilhada) já está construído no repositório, porém **dormente**. A troca é
de baixo esforço graças à camada de dados trocável em `src/data/relatorios.js`.
Para ligar o Firebase no futuro, veja [`docs/SETUP-FIREBASE.md`](docs/SETUP-FIREBASE.md).

> ⚠️ No modo local, as fotos ficam embutidas (data URLs) no localStorage, que tem
> cota total de ~5 MB por origem. Muitos relatórios com imagens podem estourar
> esse limite — o backend Firebase resolve isso ao ser ligado.

## Arquitetura (resumo)

- `src/App.jsx` — roteador simples entre a lista (`ReportList`) e o editor (`EditorScreen`).
- `src/data/relatorios.js` — "interruptor" que reexporta o backend ativo
  (hoje `src/localdb/`; futuro `src/firebase/`). Ambos expõem a mesma interface.
- `src/localdb/` — backend localStorage (**ativo**). `src/firebase/` — backend Firebase (**dormente**).
- `src/lib/` — lógica pura: `relatorioModel.js` (parser de texto + helpers) e
  `docxExport.js` (geração do `.docx`).

Detalhes completos para desenvolvimento em [`CLAUDE.md`](CLAUDE.md).

## Deploy

Push na branch `main` dispara o GitHub Actions
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) que publica
`dist/` no GitHub Pages. O `base` do Vite (`/Relatorio-ATI/`) precisa casar com o
nome do repositório.
