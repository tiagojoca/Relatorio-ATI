# Banco de Dados Firebase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a persistência em `localStorage` por um backend Firebase (Firestore + Storage + Auth), com histórico centralizado de relatórios por mês, tela de lista, e senha compartilhada.

**Architecture:** App React estático (GitHub Pages) passa a falar com Firebase via SDK do cliente. Firestore guarda um documento por mês (`relatorios/{YYYY-MM}`) com o array `events`; Firebase Storage guarda as fotos; Firebase Auth (uma conta fixa) implementa a senha compartilhada. A UI ganha uma tela de bloqueio (login), uma lista de relatórios e mantém o editor atual, trocando o destino da persistência.

**Tech Stack:** React 19, Vite 8, `firebase` (App/Auth/Firestore/Storage), `docx`, `file-saver`, Vitest (novo, para testes das funções puras).

**Spec:** `docs/superpowers/specs/2026-07-06-banco-de-dados-firebase-design.md`

---

## Estratégia de teste

O app é uma SPA sem testes hoje. Este plano usa **TDD para a lógica pura** (helpers de modelo — formatação de mês, separação de fotos novas vs. já enviadas) via Vitest, onde os testes têm valor real. Os módulos de integração Firebase (Auth/Firestore/Storage) e a UI são **verificados manualmente** rodando o app contra o projeto Firebase real, porque testes unitários deles apenas exercitariam mocks do SDK, não comportamento. As tarefas de integração terminam com passos de verificação manual explícitos.

## Estrutura de arquivos

**Criar:**
- `src/firebase/config.js` — inicializa o Firebase; exporta `auth`, `db`, `storage`. Contém o objeto de config (o usuário preenche com os dados do Console).
- `src/firebase/auth.js` — `login(senha)`, `logout()`, `onAuthChange(cb)`; constante `SHARED_EMAIL`.
- `src/firebase/relatorios.js` — camada de dados: listar/obter/criar relatório, salvar eventos, upload de fotos.
- `src/lib/relatorioModel.js` — funções puras: `monthIdFromRaw`, `isDataUrl`, `separatePhotos`, `newEventId`.
- `src/lib/relatorioModel.test.js` — testes das funções puras.
- `src/lib/docxExport.js` — geração do `.docx` (extraída de `App.jsx`).
- `src/screens/LockScreen.jsx` — tela de senha.
- `src/screens/ReportList.jsx` — lista de relatórios + criar novo.
- `src/screens/EditorScreen.jsx` — o editor atual, adaptado para carregar/salvar no Firestore.
- `firestore.rules`, `storage.rules` — regras de segurança.
- `docs/SETUP-FIREBASE.md` — passo a passo de configuração no Console.

**Modificar:**
- `package.json` — dependência `firebase`, devDep `vitest`, scripts `test`.
- `vite.config.js` — bloco `test` do Vitest.
- `src/App.jsx` — vira roteador fino (auth gate + lista/editor).
- `CLAUDE.md` — refletir a nova arquitetura.

---

## Task 1: Dependências (Firebase + Vitest)

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`

- [ ] **Step 1: Instalar dependências**

Run:
```bash
npm install firebase
npm install -D vitest
```
Expected: `package.json` passa a listar `firebase` em `dependencies` e `vitest` em `devDependencies`; sem erros.

- [ ] **Step 2: Adicionar script de teste**

Em `package.json`, no bloco `"scripts"`, adicionar as linhas `test` e `test:watch` (manter as existentes):

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 3: Configurar o Vitest no Vite**

Substituir todo o conteúdo de `vite.config.js` por:

```js
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/Relatorio-ATI/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
```

- [ ] **Step 4: Verificar que o Vitest roda (sem testes ainda)**

Run: `npm test`
Expected: Vitest inicia e reporta "No test files found" (ou 0 testes) — sem erro de configuração.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.js
git commit -m "chore: adiciona firebase e vitest"
```

---

## Task 2: Funções puras do modelo (TDD)

**Files:**
- Create: `src/lib/relatorioModel.js`
- Test: `src/lib/relatorioModel.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/relatorioModel.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { monthIdFromRaw, isDataUrl, separatePhotos, newEventId } from './relatorioModel';

describe('monthIdFromRaw', () => {
  it('extrai YYYY-MM de uma data completa', () => {
    expect(monthIdFromRaw('2026-03-01')).toBe('2026-03');
  });
  it('mantém YYYY-MM já curto', () => {
    expect(monthIdFromRaw('2026-03')).toBe('2026-03');
  });
  it('retorna null para vazio', () => {
    expect(monthIdFromRaw('')).toBe(null);
  });
});

describe('isDataUrl', () => {
  it('reconhece data URL', () => {
    expect(isDataUrl('data:image/png;base64,AAA')).toBe(true);
  });
  it('rejeita URL http', () => {
    expect(isDataUrl('https://x/y.jpg')).toBe(false);
  });
  it('rejeita não-string', () => {
    expect(isDataUrl(null)).toBe(false);
  });
});

describe('separatePhotos', () => {
  it('separa data URLs de URLs já existentes', () => {
    const { existing, toUpload } = separatePhotos([
      'https://a/1.jpg',
      'data:image/jpeg;base64,BBB',
    ]);
    expect(existing).toEqual(['https://a/1.jpg']);
    expect(toUpload).toEqual(['data:image/jpeg;base64,BBB']);
  });
  it('ignora valores vazios', () => {
    const { existing, toUpload } = separatePhotos(['', null]);
    expect(existing).toEqual([]);
    expect(toUpload).toEqual([]);
  });
  it('trata ausência de argumento', () => {
    const { existing, toUpload } = separatePhotos();
    expect(existing).toEqual([]);
    expect(toUpload).toEqual([]);
  });
});

describe('newEventId', () => {
  it('gera ids únicos', () => {
    expect(newEventId()).not.toBe(newEventId());
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test`
Expected: FAIL — `Failed to resolve import './relatorioModel'` (arquivo ainda não existe).

- [ ] **Step 3: Implementar as funções**

Criar `src/lib/relatorioModel.js`:

```js
// Deriva o ID do documento mensal ("YYYY-MM") a partir de uma data crua.
export function monthIdFromRaw(mesAnoRaw) {
  if (!mesAnoRaw) return null;
  return mesAnoRaw.slice(0, 7);
}

// True se a URL é uma data URL (imagem embutida, ainda não enviada ao Storage).
export function isDataUrl(url) {
  return typeof url === 'string' && url.startsWith('data:');
}

// Separa as fotos que já estão no Storage (http/https) das que ainda
// precisam ser enviadas (data URLs).
export function separatePhotos(fotoUrls = []) {
  const existing = [];
  const toUpload = [];
  for (const url of fotoUrls) {
    if (isDataUrl(url)) toUpload.push(url);
    else if (url) existing.push(url);
  }
  return { existing, toUpload };
}

// ID estável por evento; usado para nomear a pasta de fotos no Storage.
export function newEventId() {
  return crypto.randomUUID();
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: PASS — todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relatorioModel.js src/lib/relatorioModel.test.js
git commit -m "feat: helpers puros do modelo de relatorio"
```

---

## Task 3: Módulo de configuração do Firebase

**Files:**
- Create: `src/firebase/config.js`

- [ ] **Step 1: Criar o módulo de config**

Criar `src/firebase/config.js`:

```js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Cole aqui a config do seu app Web (Firebase Console > Configurações do projeto > Seus apps).
// Estes valores são PÚBLICOS por design — a proteção real vem das regras de segurança + login.
const firebaseConfig = {
  apiKey: 'PREENCHER',
  authDomain: 'PREENCHER',
  projectId: 'PREENCHER',
  storageBucket: 'PREENCHER',
  messagingSenderId: 'PREENCHER',
  appId: 'PREENCHER',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

- [ ] **Step 2: Verificar que o app ainda compila**

Run: `npm run build`
Expected: build conclui sem erro (o módulo é válido mesmo com valores `PREENCHER`; ele só é usado em runtime).

- [ ] **Step 3: Commit**

```bash
git add src/firebase/config.js
git commit -m "feat: modulo de config do firebase"
```

> **Nota:** os valores `PREENCHER` serão substituídos pelo usuário na Task 9 (configuração no Console). O restante do plano pode ser implementado antes disso; só a verificação end-to-end (Task 10) exige a config real.

---

## Task 4: Módulo de autenticação

**Files:**
- Create: `src/firebase/auth.js`

- [ ] **Step 1: Criar o módulo de auth**

Criar `src/firebase/auth.js`:

```js
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './config';

// Conta fixa compartilhada. O e-mail não é segredo; a senha é definida no
// Firebase Console e digitada pelo usuário na tela de bloqueio.
export const SHARED_EMAIL = 'equipe@relatorio-ati.local';

export function login(senha) {
  return signInWithEmailAndPassword(auth, SHARED_EMAIL, senha);
}

export function logout() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build sem erro.

- [ ] **Step 3: Commit**

```bash
git add src/firebase/auth.js
git commit -m "feat: modulo de autenticacao compartilhada"
```

---

## Task 5: Camada de dados (Firestore + Storage)

**Files:**
- Create: `src/firebase/relatorios.js`

- [ ] **Step 1: Criar o módulo de dados**

Criar `src/firebase/relatorios.js`:

```js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from './config';
import { separatePhotos } from '../lib/relatorioModel';

const COL = 'relatorios';

// Lista todos os relatórios, do mês mais recente para o mais antigo.
// Ordenar por __name__ (o ID "YYYY-MM") ordena cronologicamente.
export async function listRelatorios() {
  const q = query(collection(db, COL), orderBy('__name__', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Retorna o relatório de um mês, ou null se não existir.
export async function getRelatorio(monthId) {
  const snap = await getDoc(doc(db, COL, monthId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Cria um relatório vazio para o mês, ou retorna o existente (não duplica).
export async function createRelatorio(monthId, mesAnoRaw) {
  const existing = await getRelatorio(monthId);
  if (existing) return existing;
  const data = { mesAnoRaw, events: [], updatedAt: serverTimestamp() };
  await setDoc(doc(db, COL, monthId), data);
  return { id: monthId, mesAnoRaw, events: [] };
}

// Grava o array de eventos inteiro (última gravação vence).
export async function saveRelatorioEvents(monthId, mesAnoRaw, events) {
  await setDoc(
    doc(db, COL, monthId),
    { mesAnoRaw, events, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// Envia ao Storage as fotos que ainda são data URLs e retorna o array final
// de fotoUrls (mantendo as já existentes e acrescentando as recém-enviadas).
export async function uploadEventPhotos(monthId, eventId, fotoUrls) {
  const { existing, toUpload } = separatePhotos(fotoUrls);
  const uploaded = [];
  for (let i = 0; i < toUpload.length; i++) {
    const path = `relatorios/${monthId}/${eventId}/${Date.now()}_${i}.jpg`;
    const storageRef = ref(storage, path);
    await uploadString(storageRef, toUpload[i], 'data_url');
    uploaded.push(await getDownloadURL(storageRef));
  }
  return [...existing, ...uploaded];
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build sem erro.

- [ ] **Step 3: Commit**

```bash
git add src/firebase/relatorios.js
git commit -m "feat: camada de dados firestore + storage"
```

---

## Task 6: Extrair a geração do DOCX para um módulo

Refatoração que preserva o comportamento: mover `handleExportDocx` de `App.jsx` para `src/lib/docxExport.js`, parametrizando por `events` e `mesAnoFormatted`, e adicionar suporte a URLs do Storage (baixar via `fetch` antes de processar no canvas). O app continua usando `localStorage` nesta task.

**Files:**
- Create: `src/lib/docxExport.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: Criar `src/lib/docxExport.js`**

Criar o arquivo com o conteúdo abaixo. É o corpo atual de `handleExportDocx` (`src/App.jsx:117-415`), com três mudanças: (a) vira `export async function exportDocx({ events, mesAnoFormatted })`; (b) `processImage` passa a aceitar URL http (Storage) além de data URL, baixando-a antes; (c) sem outras alterações de layout.

```js
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } from 'docx';

// Converte qualquer URL (data: ou http do Storage) numa data URL, para que a
// imagem possa ser desenhada no canvas sem problema de CORS/taint.
async function toDataUrl(url) {
  if (url.startsWith('data:')) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export async function exportDocx({ events, mesAnoFormatted }) {
  try {
    const children = [];

    // Assunto
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Assunto: `, font: 'Times New Roman', size: 24 }),
          new TextRun({
            text: `Relatório de Atividades – ${mesAnoFormatted}.`,
            bold: true,
            font: 'Times New Roman',
            size: 24,
          }),
        ],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 400 },
      }),
    );

    // Vocativo
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Senhor Comandante-Geral,',
            font: 'Times New Roman',
            size: 24,
          }),
        ],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 200 },
      }),
    );

    // Parágrafo de abertura padrão
    const mesAnoTexto = mesAnoFormatted.replace('/', ' de ');
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Ao cumprimentá-lo cordialmente, sirvo-me do presente para encaminhar a Vossa Senhoria o Relatório de Atividades da Assessoria Institucional do CBMRO, em Brasília/DF no mês de `,
            font: 'Times New Roman',
            size: 24,
          }),
          new TextRun({ text: mesAnoTexto, bold: true, font: 'Times New Roman', size: 24 }),
          new TextRun({ text: `.`, font: 'Times New Roman', size: 24 }),
        ],
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 1417 },
        spacing: { before: 200, after: 400 },
      }),
    );

    for (let index = 0; index < events.length; index++) {
      const ev = events[index];
      const evText = ev.evento || '';
      const parsed = parseEventoText(evText);

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Evento${parsed && parsed.titulo ? `: ${parsed.titulo}` : ''}`,
              bold: true,
              font: 'Times New Roman',
              size: 24,
            }),
          ],
          spacing: { before: 200, after: 200 },
          keepNext: true,
        }),
      );

      if (parsed) {
        const addField = (label, value) => {
          if (!value) return;
          const sanitizeText = (text) => text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '');
          const safeValue = sanitizeText(value);
          const lines = safeValue.split('\n');

          const textRuns = [];
          textRuns.push(new TextRun({ text: `${label}: `, bold: true, font: 'Times New Roman', size: 24 }));
          lines.forEach((line, i) => {
            if (i === 0) {
              textRuns.push(new TextRun({ text: line, font: 'Times New Roman', size: 24 }));
            } else {
              textRuns.push(new TextRun({ text: line, font: 'Times New Roman', size: 24, break: 1 }));
            }
          });

          children.push(
            new Paragraph({
              children: textRuns,
              spacing: { before: 120, after: 120 },
              alignment: AlignmentType.JUSTIFIED,
            }),
          );
        };

        addField('Data', parsed.data);
        addField('Local', parsed.local);
        if (!parsed.titulo) {
          addField('Evento', parsed.titulo);
        }
        addField('Resumo', parsed.relato);
        addField('Participantes', parsed.envolvidos);
      } else if (evText) {
        const sanitizeText = (text) => text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '');
        const safeValue = sanitizeText(evText);
        const lines = safeValue.split('\n').filter((line) => line.trim() !== '');
        lines.forEach((line) => {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: line, font: 'Times New Roman', size: 24 })],
              spacing: { before: 120, after: 120 },
              alignment: AlignmentType.JUSTIFIED,
              indent: { firstLine: 720 },
            }),
          );
        });
      }

      const fotos = ev.fotoUrls || (ev.fotoUrl ? [ev.fotoUrl] : []);
      if (fotos.length > 0) {
        for (let pIndex = 0; pIndex < fotos.length; pIndex++) {
          const url = fotos[pIndex];
          try {
            const processImage = (src) =>
              new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const MAX_WIDTH = 500;
                  let width = img.width;
                  let height = img.height;
                  if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                  } else {
                    width = Math.round(width);
                    height = Math.round(height);
                  }
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx.fillStyle = '#FFFFFF';
                  ctx.fillRect(0, 0, width, height);
                  ctx.drawImage(img, 0, 0, width, height);
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                  const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
                  const binaryString = window.atob(base64Data);
                  const len = binaryString.length;
                  const bytes = new Uint8Array(len);
                  for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  resolve({ buffer: bytes, width, height });
                };
                img.onerror = reject;
                img.src = src;
              });

            const srcDataUrl = await toDataUrl(url);
            const imgObj = await processImage(srcDataUrl);
            const prefix = fotos.length > 1 ? `Foto ${pIndex + 1}:` : `Foto:`;

            children.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    data: imgObj.buffer,
                    transformation: { width: imgObj.width, height: imgObj.height },
                    type: 'jpg',
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 120 },
              }),
            );
            children.push(
              new Paragraph({
                children: [new TextRun({ text: prefix, bold: true, font: 'Times New Roman', size: 24 })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 300 },
              }),
            );
          } catch (err) {
            console.error('Erro ao processar imagem via Canvas para o DOCX', err);
          }
        }
      }
    }

    // Fecho / assinatura
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Respeitosamente,', font: 'Times New Roman', size: 24 })],
        spacing: { before: 600, after: 200 },
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 1417 },
      }),
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'WÂNDRIO', bold: true, font: 'Times New Roman', size: 24 }),
          new TextRun({ text: ' BANDEIRA DOS ANJOS - CEL BM', font: 'Times New Roman', size: 24 }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 },
      }),
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Chefe da Assessoria Institucional do CBMRO, em Brasília/DF',
            font: 'Times New Roman',
            size: 24,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    );

    const doc = new Document({
      creator: 'Gerador de Relatórios CBMRO',
      sections: [{ properties: {}, children }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Relatorio_Produtividade_${mesAnoFormatted.replace('/', '_')}.docx`);
  } catch (err) {
    alert('Erro ao montar o documento: ' + err.message);
    console.error(err);
  }
}
```

- [ ] **Step 2: Mover `parseEventoText` para o módulo de modelo**

`exportDocx` usa `parseEventoText`, que também é usado pela UI. Mover essa função para um módulo compartilhado evita duplicação.

Adicionar ao final de `src/lib/relatorioModel.js`:

```js
// Extrai campos rotulados (Evento/Data/Local/Envolvidos/Relato) de um bloco
// de texto livre. Usado pela UI e pela exportação DOCX.
export function parseEventoText(text) {
  if (!text) return null;

  const extract = (raw) => {
    const regex = new RegExp(
      `(?:#)?(${raw}):\\s*([\\s\\S]*?)(?=(?:(?:#)?(?:Evento Nome|Evento|Nome do Evento|Nome|Data|Local|Envolvidos|Stakeholders|Participantes|Relato):)|$)`,
      'i',
    );
    const match = text.match(regex);
    return match ? match[2].trim() : '';
  };

  const titulo = extract('Evento Nome|Evento|Nome do Evento|Nome');
  const data = extract('Data');
  const local = extract('Local');
  const envolvidos = extract('Envolvidos|Stakeholders|Participantes|Autoridades participantes');
  const relato = extract('Relato');

  if (!titulo && !data && !local && !envolvidos && !relato) {
    return null;
  }
  return { titulo, data, local, envolvidos, relato };
}
```

- [ ] **Step 3: Importar `parseEventoText` no módulo DOCX**

No topo de `src/lib/docxExport.js`, acrescentar o import:

```js
import { parseEventoText } from './relatorioModel';
```

- [ ] **Step 4: Usar o módulo em `App.jsx` e remover o código duplicado**

Em `src/App.jsx`:
1. Trocar o import `import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } from 'docx';` por `import { exportDocx } from './lib/docxExport';`.
2. Remover a definição local de `parseEventoText` (`src/App.jsx:46-66`) e, no topo, importar de `./lib/relatorioModel`:
   ```js
   import { parseEventoText } from './lib/relatorioModel';
   ```
3. Remover `saveAs` e `docx` do uso do DOCX, mas manter `saveAs` e `file-saver` porque `handleExportJSON` ainda usa (`src/App.jsx:417-425`). Ou seja: manter `import { saveAs } from 'file-saver';`.
4. Substituir toda a função `handleExportDocx` (`src/App.jsx:117-415`) por:
   ```js
   const handleExportDocx = () => exportDocx({ events, mesAnoFormatted });
   ```

- [ ] **Step 5: Verificar que os testes puros ainda passam**

Run: `npm test`
Expected: PASS (os testes de `relatorioModel` continuam verdes; `parseEventoText` não tem teste dedicado, mas não deve quebrar os existentes).

- [ ] **Step 6: Verificar build e comportamento**

Run: `npm run build`
Expected: build sem erro.

Verificação manual:
Run: `npm run dev -- --port 5173 --strictPort`
Abrir http://localhost:5173, adicionar um evento com uma foto, clicar **Baixar (.DOCX)** e confirmar que o documento é gerado igual a antes (texto + foto). Encerrar o dev server.

- [ ] **Step 7: Commit**

```bash
git add src/lib/docxExport.js src/lib/relatorioModel.js src/App.jsx
git commit -m "refactor: extrai exportacao docx e parser para modulos"
```

---

## Task 7: Auth gate + mover editor para `EditorScreen`

Introduz a tela de bloqueio e transforma `App.jsx` num roteador. O editor (todo o conteúdo atual de `App.jsx`) é movido, sem mudança de comportamento, para `EditorScreen.jsx` — ainda com `localStorage` nesta task. A persistência no Firestore entra na Task 8.

**Files:**
- Create: `src/screens/LockScreen.jsx`
- Create: `src/screens/EditorScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Criar `LockScreen`**

Criar `src/screens/LockScreen.jsx`:

```jsx
import { useState } from 'react';
import { login } from '../firebase/auth';

export default function LockScreen() {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    try {
      await login(senha);
      // onAuthChange no App vai detectar o login e trocar de tela.
    } catch {
      setErro('Senha incorreta');
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Gerador de Relatórios CBMRO</h1>
      </header>
      <div style={{ maxWidth: 360, margin: '4rem auto', padding: '0 1rem', width: '100%' }}>
        <form className="card" onSubmit={handleSubmit}>
          <h2 className="card-title">Acesso restrito</h2>
          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              className="input"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoFocus
            />
          </div>
          {erro && <p style={{ color: '#dc3545', margin: '0 0 1rem' }}>{erro}</p>}
          <button
            type="submit"
            className="button"
            style={{ width: '100%', justifyContent: 'center', backgroundColor: '#003366' }}
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar `EditorScreen` movendo o editor atual**

Criar `src/screens/EditorScreen.jsx` com **todo o conteúdo atual de `src/App.jsx`** (após a refatoração da Task 6), com estes ajustes:

1. Renomear o componente de `function App()` para `export default function EditorScreen()`.
2. Ajustar os caminhos de import (subir um nível): `'../index.css'`, `'../lib/docxExport'`, `'../lib/relatorioModel'`.
3. Remover a linha `import React ...` desnecessária se presente; manter `import { useState, useEffect } from 'react';`.
4. Remover o `<header className="header">…</header>` e o `<div className="app-container">` externos do `return` — eles passam para o `App`. O `return` do `EditorScreen` deve começar direto no `<main className="main-content">…</main>`.
5. Remover a linha final `export default App;`.

Nada mais muda nesta task (persistência continua via `localStorage`).

- [ ] **Step 3: Reescrever `App.jsx` como roteador com auth gate**

Substituir todo o conteúdo de `src/App.jsx` por:

```jsx
import { useEffect, useState } from 'react';
import { onAuthChange, logout } from './firebase/auth';
import LockScreen from './screens/LockScreen';
import EditorScreen from './screens/EditorScreen';
import './index.css';

function App() {
  const [authStatus, setAuthStatus] = useState('loading');

  useEffect(() => onAuthChange((user) => setAuthStatus(user ? 'in' : 'out')), []);

  if (authStatus === 'loading') {
    return (
      <div className="app-container">
        <p style={{ padding: '2rem' }}>Carregando...</p>
      </div>
    );
  }

  if (authStatus === 'out') {
    return <LockScreen />;
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>Gerador de Relatórios CBMRO</h1>
        <button className="button outline" onClick={logout}>
          Sair
        </button>
      </header>
      <EditorScreen />
    </div>
  );
}

export default App;
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: build sem erro.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/screens/LockScreen.jsx src/screens/EditorScreen.jsx
git commit -m "feat: auth gate e extracao do EditorScreen"
```

> **Verificação end-to-end do login** fica para a Task 10 (precisa da config real e do usuário criado no Console).

---

## Task 8: Lista de relatórios + persistência no Firestore

Adiciona a tela de lista, a navegação lista↔editor, e troca a persistência do `EditorScreen` de `localStorage` para Firestore/Storage.

**Files:**
- Create: `src/screens/ReportList.jsx`
- Modify: `src/App.jsx`
- Modify: `src/screens/EditorScreen.jsx`

- [ ] **Step 1: Criar `ReportList`**

Criar `src/screens/ReportList.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { FileText, PlusCircle } from 'lucide-react';
import { listRelatorios, createRelatorio } from '../firebase/relatorios';
import { monthIdFromRaw } from '../lib/relatorioModel';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function formatMonth(monthId) {
  const [ano, mes] = monthId.split('-');
  return `${MESES[parseInt(mes, 10) - 1]}/${ano}`;
}

export default function ReportList({ onOpen }) {
  const [items, setItems] = useState(null);
  const [novoMes, setNovoMes] = useState('');

  useEffect(() => {
    listRelatorios()
      .then(setItems)
      .catch((err) => {
        console.error(err);
        setItems([]);
      });
  }, []);

  const handleCreate = async () => {
    if (!novoMes) return;
    const monthId = monthIdFromRaw(novoMes);
    await createRelatorio(monthId, `${novoMes}-01`);
    onOpen(monthId);
  };

  return (
    <main className="main-content" style={{ display: 'block' }}>
      <div className="card">
        <h2 className="card-title">Novo Relatório</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="month"
            className="input"
            value={novoMes}
            onChange={(e) => setNovoMes(e.target.value)}
          />
          <button className="button" style={{ backgroundColor: '#003366', whiteSpace: 'nowrap' }} onClick={handleCreate}>
            <PlusCircle size={18} /> Criar / Abrir
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Relatórios Salvos</h2>
        {items === null ? (
          <p>Carregando...</p>
        ) : items.length === 0 ? (
          <p style={{ color: '#666' }}>Nenhum relatório ainda. Crie o primeiro acima.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {items.map((r) => (
              <button
                key={r.id}
                onClick={() => onOpen(r.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: 'white',
                  border: '1px solid #ddd',
                  borderLeft: '4px solid #003366',
                  borderRadius: '6px',
                  padding: '0.8rem 1rem',
                }}
              >
                <span style={{ color: '#003366', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileText size={16} /> {formatMonth(r.id)}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  {(r.events?.length || 0)} evento(s)
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Adicionar roteamento lista↔editor no `App.jsx`**

Em `src/App.jsx`, importar `ReportList` e introduzir o estado de view. Substituir o bloco autenticado (do `return (` final até o `export default App;`) por:

```jsx
  return (
    <div className="app-container">
      <header className="header">
        <h1>Gerador de Relatórios CBMRO</h1>
        <button className="button outline" onClick={logout}>
          Sair
        </button>
      </header>
      {view.screen === 'list' ? (
        <ReportList onOpen={(monthId) => setView({ screen: 'editor', monthId })} />
      ) : (
        <EditorScreen monthId={view.monthId} onBack={() => setView({ screen: 'list' })} />
      )}
    </div>
  );
}

export default App;
```

E adicionar, junto aos outros `useState`, a linha:

```jsx
  const [view, setView] = useState({ screen: 'list' });
```

E o import no topo:

```jsx
import ReportList from './screens/ReportList';
```

- [ ] **Step 3: `EditorScreen` — receber props e carregar do Firestore**

Em `src/screens/EditorScreen.jsx`:

1. Ajustar a assinatura para `export default function EditorScreen({ monthId, onBack }) {`.
2. Trocar os imports do topo, acrescentando a camada de dados e helpers:
   ```jsx
   import { useState, useEffect } from 'react';
   import { FileDown, FileText, Trash2, Edit2, PlusCircle, Check, X, UploadCloud, ArrowLeft } from 'lucide-react';
   import { saveAs } from 'file-saver';
   import { exportDocx } from '../lib/docxExport';
   import { parseEventoText, monthIdFromRaw, newEventId } from '../lib/relatorioModel';
   import { getRelatorio, saveRelatorioEvents, uploadEventPhotos } from '../firebase/relatorios';
   import '../index.css';
   ```
3. Substituir os **três** `useEffect` de `localStorage` (carregar no mount, salvar events, salvar date) por um único efeito de carga a partir do Firestore e um estado de status de salvamento. Localizar o bloco atual (equivalente a `src/App.jsx:17-36` de antes da refatoração) e substituí-lo por:
   ```jsx
   const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'

   useEffect(() => {
     let ativo = true;
     getRelatorio(monthId).then((rel) => {
       if (!ativo) return;
       if (rel) {
         setEvents(rel.events || []);
         setMesAnoRaw(rel.mesAnoRaw || `${monthId}-01`);
       } else {
         setMesAnoRaw(`${monthId}-01`);
       }
     });
     return () => {
       ativo = false;
     };
   }, [monthId]);

   // Grava o array de eventos inteiro no Firestore (última gravação vence).
   const persist = async (nextEvents, nextMesAnoRaw = mesAnoRaw) => {
     setSaveStatus('saving');
     try {
       await saveRelatorioEvents(monthId, nextMesAnoRaw, nextEvents);
       setSaveStatus('saved');
     } catch (err) {
       console.error(err);
       setSaveStatus('idle');
       alert('Erro ao salvar no banco: ' + err.message);
     }
   };
   ```
4. Como o mês agora é fixo pelo `monthId`, o seletor de mês/ano deixa de fazer sentido no editor. Remover o card "Configurações Gerais" inteiro (o `<div className="card">` com o `<input type="month">`). O `mesAnoRaw`/`mesAnoFormatted` continuam existindo em estado (derivados do documento) e sendo usados pelo preview/DOCX.

- [ ] **Step 4: `EditorScreen` — persistir em cada mutação e enviar fotos**

Substituir os handlers de mutação por versões que atualizam o estado, enviam as fotos novas ao Storage (quando aplicável) e gravam no Firestore.

Substituir `handleSaveEdit`:
```jsx
const handleSaveEdit = async () => {
  const evId = currentForm.id || newEventId();
  const fotoUrls = await uploadEventPhotos(monthId, evId, currentForm.fotoUrls || []);
  const updated = [...events];
  updated[editingIndex] = { ...currentForm, id: evId, fotoUrls, fotoUrl: '' };
  setEvents(updated);
  setEditingIndex(null);
  setCurrentForm(initialFormState);
  await persist(updated);
};
```

Substituir `handleAddEvent`:
```jsx
const handleAddEvent = async () => {
  if (!currentForm.evento && !currentForm.relato) {
    alert('Preencha o Nome ou Relato do evento.');
    return;
  }
  const evId = newEventId();
  const fotoUrls = await uploadEventPhotos(monthId, evId, currentForm.fotoUrls || []);
  const novo = { ...currentForm, id: evId, fotoUrls, fotoUrl: '' };
  const updated = [...events, novo];
  setEvents(updated);
  setCurrentForm(initialFormState);
  await persist(updated);
  setTimeout(() => {
    const panel = document.querySelector('.editor-panel');
    if (panel) panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
  }, 100);
};
```

Substituir `handleDelete`:
```jsx
const handleDelete = async (index) => {
  if (window.confirm('Tem certeza que deseja remover este evento?')) {
    const updated = events.filter((_, i) => i !== index);
    setEvents(updated);
    if (editingIndex === index) {
      handleCancelEdit();
    }
    await persist(updated);
  }
};
```

Substituir `clearAllData`:
```jsx
const clearAllData = async () => {
  if (window.confirm('CUIDADO: Isso apagará TODOS os eventos deste relatório. Deseja continuar?')) {
    setEvents([]);
    setCurrentForm(initialFormState);
    setEditingIndex(null);
    await persist([]);
  }
};
```

- [ ] **Step 5: `EditorScreen` — botão "Voltar" e indicador de salvamento**

No `return`, logo no início do `<main className="main-content">`, adicionar uma barra com o botão voltar e o status. Inserir como primeiro filho do `<main>`:

```jsx
<div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
  <button className="button outline" onClick={onBack}>
    <ArrowLeft size={18} /> Voltar à lista
  </button>
  <span style={{ fontSize: '0.85rem', color: '#666' }}>
    {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo ✓' : ''}
  </span>
</div>
```

> Se `.main-content` não for grid, o `gridColumn` é ignorado sem efeito colateral; a barra ocupa a largura naturalmente.

- [ ] **Step 6: Atualizar `handleExportDocx` (sem mudança de assinatura)**

Confirmar que `handleExportDocx` no `EditorScreen` continua sendo:
```jsx
const handleExportDocx = () => exportDocx({ events, mesAnoFormatted });
```
(Nenhuma mudança — `exportDocx` já baixa URLs do Storage via `toDataUrl`.)

- [ ] **Step 7: Verificar testes e build**

Run: `npm test`
Expected: PASS (testes puros inalterados).

Run: `npm run build`
Expected: build sem erro.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/screens/ReportList.jsx src/screens/EditorScreen.jsx
git commit -m "feat: lista de relatorios e persistencia no firestore"
```

---

## Task 9: Regras de segurança + documentação de setup

**Files:**
- Create: `firestore.rules`
- Create: `storage.rules`
- Create: `docs/SETUP-FIREBASE.md`

- [ ] **Step 1: Criar `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /relatorios/{monthId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

- [ ] **Step 2: Criar `storage.rules`**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /relatorios/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

- [ ] **Step 3: Criar `docs/SETUP-FIREBASE.md`**

```markdown
# Configuração do Firebase

Passos a fazer uma única vez no [Firebase Console](https://console.firebase.google.com).

## 1. Criar o projeto
Crie um projeto Firebase (ou use um existente).

## 2. Firestore
Build > Firestore Database > Criar banco de dados > modo de produção.

## 3. Storage
Build > Storage > Começar > modo de produção.

## 4. Authentication (senha compartilhada)
1. Build > Authentication > Começar.
2. Aba "Sign-in method" > ative **E-mail/senha**.
3. Aba "Users" > **Adicionar usuário**:
   - E-mail: `equipe@relatorio-ati.local` (precisa bater com `SHARED_EMAIL` em `src/firebase/auth.js`)
   - Senha: escolha a senha compartilhada que será digitada na tela de bloqueio.

## 5. App Web + config
1. Configurações do projeto (engrenagem) > "Seus apps" > ícone Web (`</>`).
2. Registre o app e copie o objeto `firebaseConfig`.
3. Cole os valores em `src/firebase/config.js` (substituindo os `PREENCHER`).

## 6. Regras de segurança
Cole o conteúdo de `firestore.rules` em Firestore > Regras > Publicar.
Cole o conteúdo de `storage.rules` em Storage > Regras > Publicar.

## 7. Domínios autorizados
Em Authentication > Settings > Authorized domains, confirme que o domínio do
GitHub Pages (ex.: `SEU-USUARIO.github.io`) está na lista. `localhost` já vem
autorizado para desenvolvimento.
```

- [ ] **Step 4: Commit**

```bash
git add firestore.rules storage.rules docs/SETUP-FIREBASE.md
git commit -m "docs: regras de seguranca e guia de setup do firebase"
```

---

## Task 10: Verificação end-to-end e documentação final

Requer que o usuário tenha concluído `docs/SETUP-FIREBASE.md` (projeto criado, usuário fixo criado, `config.js` preenchido, regras publicadas).

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Confirmar pré-requisitos com o usuário**

Verificar que `src/firebase/config.js` tem valores reais (não `PREENCHER`) e que o usuário `equipe@relatorio-ati.local` existe no Auth. Se não, pausar e pedir ao usuário para concluir a Task 9/`SETUP-FIREBASE.md`.

- [ ] **Step 2: Lint e build**

Run: `npm run lint`
Expected: sem erros.

Run: `npm run build`
Expected: build sem erro.

- [ ] **Step 3: Verificação manual end-to-end**

Run: `npm run dev -- --port 5173 --strictPort`

Abrir http://localhost:5173 e verificar, em ordem:
1. **Login:** aparece a tela de senha. Digitar a senha errada → "Senha incorreta". Digitar a correta → entra.
2. **Lista vazia:** mostra "Nenhum relatório ainda".
3. **Criar:** escolher um mês, "Criar / Abrir" → abre o editor daquele mês.
4. **Adicionar evento com foto:** colar texto + anexar uma foto + "Adicionar Evento". Indicador mostra "Salvando..." → "Salvo ✓".
5. **Persistência:** recarregar a página (F5), logar de novo se necessário, abrir o mesmo mês → o evento e a foto continuam lá (vindos do Firestore/Storage).
6. **Voltar à lista:** o mês aparece com a contagem de eventos correta.
7. **DOCX:** abrir o relatório, "Baixar (.DOCX)" → documento gerado com o texto e a foto (foto baixada do Storage).
8. **Sair:** botão "Sair" volta à tela de bloqueio.

Encerrar o dev server ao final.

- [ ] **Step 4: Atualizar `CLAUDE.md`**

Substituir a seção "## Architecture" e a menção a `localStorage`/arquivo único por uma descrição da nova arquitetura. Aplicar estas mudanças em `CLAUDE.md`:

- Em "Commands", acrescentar: `npm test` — roda os testes das funções puras (Vitest).
- Trocar a frase "There is no test suite/framework configured in this project." por "Testes das funções puras (`src/lib/relatorioModel.js`) rodam com Vitest via `npm test`. Integração Firebase e UI são verificadas manualmente."
- Reescrever a seção "## Architecture" para refletir: `App.jsx` é um roteador (auth gate + lista/editor); telas em `src/screens/`; camada Firebase em `src/firebase/`; helpers puros e DOCX em `src/lib/`; dados em Firestore (`relatorios/{YYYY-MM}`) e fotos no Storage; senha compartilhada via conta fixa no Auth. Manter as notas ainda válidas sobre `parseEventoText` (agora em `src/lib/relatorioModel.js`), a renderização dupla preview/DOCX, e o texto fixo do ofício.
- Acrescentar referência a `docs/SETUP-FIREBASE.md` para configuração.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: atualiza CLAUDE.md para arquitetura firebase"
```

---

## Self-review notes

- **Cobertura da spec:** backend Firebase (Tasks 3-5), modelo `relatorios/{YYYY-MM}` + fotos no Storage (Task 5), senha compartilhada/Auth (Tasks 4, 7), lista de relatórios + navegação (Task 8), última-gravação-vence (Task 8, `persist`), sem migração (não há task de import — correto), DOCX/JSON/parser/preview preservados (Task 6), regras de segurança + setup (Task 9), verificação E2E (Task 10). Sem migração de `localStorage` por decisão da spec.
- **Fotos:** `separatePhotos` (Task 2) + `uploadEventPhotos` (Task 5) + wiring no add/save (Task 8) cobrem o fluxo "preview local → upload no commit".
- **Consistência de nomes:** `monthIdFromRaw`, `separatePhotos`, `newEventId`, `parseEventoText` (todos em `relatorioModel.js`); `listRelatorios`, `getRelatorio`, `createRelatorio`, `saveRelatorioEvents`, `uploadEventPhotos` (em `relatorios.js`); `login`/`logout`/`onAuthChange`/`SHARED_EMAIL` (em `auth.js`); `exportDocx` (em `docxExport.js`) — usados de forma consistente entre as tasks.
- **Config `PREENCHER`:** não é placeholder de plano; é config de runtime que o usuário preenche na Task 9, com verificação na Task 10.
```
