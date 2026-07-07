import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } from 'docx';
import { parseEventoText } from './relatorioModel';

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
          // Remove caracteres de controle que invalidariam o XML do DOCX.
          // eslint-disable-next-line no-control-regex
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
        // Remove caracteres de controle que invalidariam o XML do DOCX.
        // eslint-disable-next-line no-control-regex
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
