import { describe, it, expect, beforeEach } from 'vitest';
import {
  listRelatorios,
  getRelatorio,
  createRelatorio,
  saveRelatorioEvents,
  uploadEventPhotos,
} from './relatorios';

// A camada local usa localStorage, que não existe no ambiente 'node' do Vitest.
// Instalamos um mock em memória antes de cada teste.
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
});

describe('localdb/relatorios', () => {
  it('createRelatorio cria um relatório vazio e getRelatorio o recupera', async () => {
    const created = await createRelatorio('2026-03', '2026-03-01');
    expect(created).toEqual({ id: '2026-03', mesAnoRaw: '2026-03-01', events: [] });
    const fetched = await getRelatorio('2026-03');
    expect(fetched).toEqual({ id: '2026-03', mesAnoRaw: '2026-03-01', events: [] });
  });

  it('createRelatorio não duplica um mês existente', async () => {
    await createRelatorio('2026-03', '2026-03-01');
    await saveRelatorioEvents('2026-03', '2026-03-01', [{ id: 'a', evento: 'x', fotoUrls: [] }]);
    const again = await createRelatorio('2026-03', '2026-03-01');
    expect(again.events).toHaveLength(1);
  });

  it('getRelatorio retorna null para mês inexistente', async () => {
    expect(await getRelatorio('2099-01')).toBe(null);
  });

  it('saveRelatorioEvents grava e sobrescreve (última gravação vence)', async () => {
    await saveRelatorioEvents('2026-05', '2026-05-01', [{ id: 'a' }]);
    await saveRelatorioEvents('2026-05', '2026-05-01', [{ id: 'b' }, { id: 'c' }]);
    const rel = await getRelatorio('2026-05');
    expect(rel.events).toEqual([{ id: 'b' }, { id: 'c' }]);
  });

  it('listRelatorios ordena do mês mais recente para o mais antigo', async () => {
    await createRelatorio('2026-01', '2026-01-01');
    await createRelatorio('2026-12', '2026-12-01');
    await createRelatorio('2026-06', '2026-06-01');
    const list = await listRelatorios();
    expect(list.map((r) => r.id)).toEqual(['2026-12', '2026-06', '2026-01']);
  });

  it('uploadEventPhotos devolve as fotos inalteradas (data URLs ficam embutidas)', async () => {
    const fotos = ['data:image/png;base64,AAA', 'data:image/png;base64,BBB'];
    expect(await uploadEventPhotos('2026-03', 'ev1', fotos)).toEqual(fotos);
    expect(await uploadEventPhotos('2026-03', 'ev1', undefined)).toEqual([]);
  });
});
