// Camada de dados em localStorage, com a MESMA interface de
// src/firebase/relatorios.js — assim as telas não sabem qual backend está ativo.
// Guarda todos os relatórios num único item, como um mapa
// { [monthId]: { mesAnoRaw, events } }. No modo local as fotos permanecem
// embutidas como data URLs (não há storage externo).

const STORAGE_KEY = 'cbmro_relatorios';

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Erro ao ler relatórios do localStorage', err);
    return {};
  }
}

function writeAll(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

// Lista todos os relatórios, do mês mais recente para o mais antigo.
// Ordenar os IDs "YYYY-MM" como texto (desc) já ordena cronologicamente.
export async function listRelatorios() {
  const map = readAll();
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map((id) => ({ id, ...map[id] }));
}

// Retorna o relatório de um mês, ou null se não existir.
export async function getRelatorio(monthId) {
  const map = readAll();
  return map[monthId] ? { id: monthId, ...map[monthId] } : null;
}

// Cria um relatório vazio para o mês, ou retorna o existente (não duplica).
export async function createRelatorio(monthId, mesAnoRaw) {
  const map = readAll();
  if (map[monthId]) return { id: monthId, ...map[monthId] };
  map[monthId] = { mesAnoRaw, events: [] };
  writeAll(map);
  return { id: monthId, mesAnoRaw, events: [] };
}

// Grava o array de eventos inteiro (última gravação vence).
export async function saveRelatorioEvents(monthId, mesAnoRaw, events) {
  const map = readAll();
  map[monthId] = { mesAnoRaw, events };
  writeAll(map);
}

// No modo local as fotos ficam embutidas (data URLs); nada é enviado a um
// storage externo. Mantém a mesma assinatura async do backend Firebase para
// que as telas funcionem sem alteração ao trocar de backend.
export async function uploadEventPhotos(monthId, eventId, fotoUrls) {
  return fotoUrls || [];
}
