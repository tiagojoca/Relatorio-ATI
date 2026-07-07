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
