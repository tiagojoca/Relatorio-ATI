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
