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
