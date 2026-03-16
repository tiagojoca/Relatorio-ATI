import React, { useState, useEffect } from 'react';
import { FileDown, FileText, Trash2, Edit2, PlusCircle, Check, X, UploadCloud } from 'lucide-react';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType } from 'docx';
import './index.css';

function App() {
  const [mesAnoRaw, setMesAnoRaw] = useState('2026-03-01');
  const [events, setEvents] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  
  const initialFormState = {
    data: '', local: '', evento: '', relato: '', envolvidos: '', fotoUrls: []
  };
  const [currentForm, setCurrentForm] = useState(initialFormState);

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedEvents = localStorage.getItem('cbmro_events');
    const savedDate = localStorage.getItem('cbmro_date');
    if (savedEvents) {
      try { setEvents(JSON.parse(savedEvents)); } catch (e) { console.error('Error loading events'); }
    }
    if (savedDate) {
      setMesAnoRaw(savedDate);
    }
  }, []);

  // Save to LocalStorage on change
  useEffect(() => {
    localStorage.setItem('cbmro_events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem('cbmro_date', mesAnoRaw);
  }, [mesAnoRaw]);

  const getFormattedMesAno = () => {
    if (!mesAnoRaw) return 'mês/ano não informado';
    const [year, month] = mesAnoRaw.split('-');
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `${meses[parseInt(month, 10) - 1]}/${year}`;
  };
  const mesAnoFormatted = getFormattedMesAno();

  const parseEventoText = (text) => {
    if (!text) return null;
    
    const extract = (raw) => {
       const regex = new RegExp(`(?:#)?(${raw}):\\s*([\\s\\S]*?)(?=(?:(?:#)?(?:Evento Nome|Evento|Nome do Evento|Nome|Data|Local|Envolvidos|Stakeholders|Autoridades participantes|Relato|Resumo):)|$)`, 'i');
       const match = text.match(regex);
       return match ? match[2].trim() : '';
    };

    const titulo = extract('Evento Nome|Evento|Nome do Evento|Nome');
    const data = extract('Data');
    const local = extract('Local');
    const envolvidos = extract('Envolvidos|Stakeholders|Autoridades participantes');
    const relato = extract('Relato|Resumo');

    if (!titulo && !data && !local && !envolvidos && !relato) {
        return null;
    }

    return { titulo, data, local, envolvidos, relato };
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setCurrentForm(events[index]);
    document.querySelector('.editor-panel').scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveEdit = () => {
    const updated = [...events];
    updated[editingIndex] = currentForm;
    setEvents(updated);
    setEditingIndex(null);
    setCurrentForm(initialFormState);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setCurrentForm(initialFormState);
  };

  const handleAddEvent = () => {
    if (!currentForm.evento && !currentForm.relato) {
       alert("Preencha o Nome ou Relato do evento.");
       return;
    }
    setEvents([...events, currentForm]);
    setCurrentForm(initialFormState);
    setTimeout(() => {
       const panel = document.querySelector('.editor-panel');
       panel.scrollTo({ top: panel.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const handleDelete = (index) => {
    if (window.confirm('Tem certeza que deseja remover este evento?')) {
      setEvents(events.filter((_, i) => i !== index));
      if (editingIndex === index) {
         handleCancelEdit();
      }
    }
  };

  const clearAllData = () => {
    if (window.confirm('CUIDADO: Isso apagará TODOS os eventos atuais. Deseja iniciar um novo relatório do zero?')) {
      setEvents([]);
      setCurrentForm(initialFormState);
      setEditingIndex(null);
    }
  };

  const handleExportDocx = async () => {
    try {
      // Helper to get image dimensions
      const getImageDimensions = (dataUrl) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => resolve({ width: 400, height: 300 }); // fallback
        img.src = dataUrl;
      });

      const children = [];

    // Assunto
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Assunto: `,
            font: "Times New Roman",
            size: 24
          }),
          new TextRun({
            text: `Relatório de Atividades – ${mesAnoFormatted}.`,
            bold: true,
            font: "Times New Roman",
            size: 24
          }),
        ],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 400 },
      })
    );

    // Vocativo
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Senhor Comandante-Geral,",
            font: "Times New Roman",
            size: 24
          }),
        ],
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 200 },
      })
    );

    // Parágrafo de abertura Padrão
    const mesAnoTexto = mesAnoFormatted.replace('/', ' de ');
    
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Ao cumprimentá-lo cordialmente, sirvo-me do presente para encaminhar a Vossa Senhoria o Relatório de Atividades da Assessoria Institucional do CBMRO, em Brasília/DF no mês de `,
            font: "Times New Roman",
            size: 24
          }),
          new TextRun({
            text: mesAnoTexto,
            bold: true,
            font: "Times New Roman",
            size: 24
          }),
          new TextRun({
            text: `.`,
            font: "Times New Roman",
            size: 24
          }),
        ],
        alignment: AlignmentType.JUSTIFIED,
        indent: {
          firstLine: 1417,
        },
        spacing: { before: 200, after: 400 },
      })
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
              font: "Times New Roman",
              size: 24
            }),
          ],
          spacing: { before: 200, after: 200 },
          keepNext: true
        })
      );

      if (parsed) {
        const addField = (label, value) => {
          if (!value) return;
          const sanitizeText = (text) => text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '');
          const safeValue = sanitizeText(value);
          const lines = safeValue.split('\n');
          
          const textRuns = [];
          textRuns.push(new TextRun({ text: `${label}: `, bold: true, font: "Times New Roman", size: 24 }));
          
          lines.forEach((line, i) => {
             if (i === 0) {
               textRuns.push(new TextRun({ text: line, font: "Times New Roman", size: 24 }));
             } else {
               textRuns.push(new TextRun({ text: line, font: "Times New Roman", size: 24, break: 1 }));
             }
          });

          children.push(
            new Paragraph({
               children: textRuns,
               spacing: { before: 120, after: 120 },
               alignment: AlignmentType.JUSTIFIED,
            })
          );
        };

        addField('Data', parsed.data);
        addField('Local', parsed.local);
        if (!parsed.titulo) {
          addField('Evento', parsed.titulo); // Fallback caso precisemos, mas já está no título superior
        }
        addField('Resumo', parsed.relato);
        addField('Stakeholders', parsed.envolvidos);
      } else if (evText) {
        const sanitizeText = (text) => text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '');
        const safeValue = sanitizeText(evText);
        const lines = safeValue.split('\n').filter(line => line.trim() !== '');
        
        lines.forEach(line => {
          children.push(
            new Paragraph({
               children: [new TextRun({ text: line, font: "Times New Roman", size: 24 })],
               spacing: { before: 120, after: 120 },
               alignment: AlignmentType.JUSTIFIED,
               indent: { firstLine: 720 }
            })
          );
        });
      }

      const fotos = ev.fotoUrls || (ev.fotoUrl ? [ev.fotoUrl] : []); // fallback retrocompatível

      if (fotos.length > 0) {
        for (let pIndex = 0; pIndex < fotos.length; pIndex++) {
           const url = fotos[pIndex];
           try {
             const processImage = (src) => new Promise((resolve, reject) => {
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
                 const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
                 
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

             const imgObj = await processImage(url);
             
             const prefix = fotos.length > 1 ? `Foto ${pIndex + 1}:` : `Foto:`;

             children.push(
               new Paragraph({
                 children: [
                   new ImageRun({
                     data: imgObj.buffer,
                     transformation: {
                       width: imgObj.width,
                       height: imgObj.height,
                     },
                     type: 'jpg'
                   })
                 ],
                 alignment: AlignmentType.CENTER,
                 spacing: { before: 120, after: 120 },
               })
             );

             children.push(
               new Paragraph({
                  children: [new TextRun({ text: prefix, bold: true, font: "Times New Roman", size: 24 })],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 300 }
               })
             );
           } catch (err) {
              console.error("Erro ao processar imagem via Canvas para o DOCX", err);
           }
        }
      }
    }

    // Fecho / Assinatura
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Respeitosamente,",
            font: "Times New Roman",
            size: 24
          }),
        ],
        spacing: { before: 600, after: 200 },
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 1417 } // Alinhamento justificado com recuo padrão
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "WÂNDRIO",
            bold: true,
            font: "Times New Roman",
            size: 24
          }),
          new TextRun({
            text: " BANDEIRA DOS ANJOS - CEL BM",
            font: "Times New Roman",
            size: 24
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 400 }
      })
    );
    
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Chefe da Assessoria Institucional do CBMRO, em Brasília/DF",
            font: "Times New Roman",
            size: 24
          }),
        ],
        alignment: AlignmentType.CENTER
      })
    );

      const doc = new Document({
        creator: "Gerador de Relatórios CBMRO",
        sections: [{
          properties: {},
          children: children,
        }],
      });

      Packer.toBlob(doc).then((blob) => {
        saveAs(blob, `Relatorio_Produtividade_${mesAnoFormatted.replace('/', '_')}.docx`);
      }).catch(err => {
        alert("Erro no empacotador do Word: " + err.message);
        console.error(err);
      });
    } catch (err) {
      alert("Erro ao montar o documento: " + err.message);
      console.error(err);
    }
  };

  const handleExportJSON = () => {
    try {
      const data = { mesAnoRaw, events };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      saveAs(blob, `Relatorio_Backup_${mesAnoFormatted.replace('/', '_')}.json`);
    } catch (err) {
      alert("Erro ao salvar o arquivo: " + err.message);
    }
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.events && Array.isArray(data.events)) {
          setEvents(data.events);
          if (data.mesAnoRaw) {
            setMesAnoRaw(data.mesAnoRaw);
          }
          alert("Relatório carregado com sucesso!");
        } else {
          alert("Arquivo inválido. Nenhum evento encontrado.");
        }
      } catch (err) {
        alert("Erro ao ler o arquivo: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    processFiles(files);
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    processFiles(files);
  };

  const processFiles = (files) => {
    if (files.length === 0) return;
    const readers = files.map(file => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    });
    Promise.all(readers).then(results => {
      setCurrentForm(prev => {
         const currentPhotos = prev.fotoUrls || [];
         if (prev.fotoUrl && !currentPhotos.includes(prev.fotoUrl)) {
             currentPhotos.push(prev.fotoUrl);
         }
         return { ...prev, fotoUrls: [...currentPhotos, ...results], fotoUrl: '' };
      });
    });
  };

  const removePhoto = (index) => {
    setCurrentForm(prev => {
      const current = prev.fotoUrls || (prev.fotoUrl ? [prev.fotoUrl] : []);
      return {
         ...prev,
         fotoUrls: current.filter((_, i) => i !== index),
         fotoUrl: ''
      };
    });
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Gerador de Relatórios CBMRO</h1>
      </header>
      
      <main className="main-content">
        <section className="editor-panel">
          
          <div className="card">
            <h2 className="card-title">Configurações Gerais</h2>
            <div className="form-group">
              <label>Mês/Ano Referência</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="month"
                  className="input" 
                  value={mesAnoRaw.substring(0, 7)} 
                  onChange={e => setMesAnoRaw(e.target.value)} 
                />
                <button 
                  className="button outline" 
                  onClick={() => setMesAnoRaw('')}
                  title="Limpar Seletor"
                  style={{ padding: '0.6rem 0.8rem' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ borderTopColor: editingIndex !== null ? '#ffc107' : '#28a745' }}>
            <h2 className="card-title">
              {editingIndex !== null ? `Editando Evento ${editingIndex + 1}` : 'Adicionar Novo Evento'}
            </h2>
            <div className="form-group">
              <label>Evento (Cole aqui o relato completo gerado pela IA)</label>
              <textarea className="textarea" placeholder="Data, Nome do evento e relato detalhado juntos..." style={{ height: '150px' }} value={currentForm.evento} onChange={e => setCurrentForm({...currentForm, evento: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Mídia (Arraste ou Selecione Múltiplas)</label>
              <div 
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFileDrop(e); }}
                onClick={(e) => { e.stopPropagation(); document.getElementById('photo-upload').click(); }}
                style={{
                  border: '2px dashed #003366',
                  backgroundColor: '#e6f0fa',
                  padding: '2rem',
                  textAlign: 'center',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#d0e3f8'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#e6f0fa'}
              >
                <UploadCloud size={32} color="#003366" style={{ marginBottom: '0.5rem', pointerEvents: 'none' }} />
                <p style={{ margin: 0, color: '#003366', fontWeight: '500', pointerEvents: 'none' }}>
                  Clique para anexar mídia ou arraste as fotos aqui
                </p>
              </div>
              
              <input 
                id="photo-upload"
                type="file" 
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileInput} 
                onClick={(e) => { e.target.value = null; }}
              />

              {((currentForm.fotoUrls && currentForm.fotoUrls.length > 0) || currentForm.fotoUrl) && (
                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {(currentForm.fotoUrls || [currentForm.fotoUrl]).map((url, i) => url ? (
                    <div key={i} style={{ position: 'relative', border: '1px solid #ddd', padding: '0.2rem', borderRadius: '6px', background: 'white' }}>
                      <img src={url} alt={`Preview ${i}`} style={{ height: '80px', width: 'auto', borderRadius: '4px', objectFit: 'cover' }} />
                      <button 
                        className="button danger" 
                        style={{ position: 'absolute', top: '-8px', right: '-8px', padding: '0.2rem', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                        title="Remover Foto"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : null)}
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              {editingIndex !== null ? (
                <>
                  <button className="button" style={{backgroundColor: '#28a745', flex: 1, justifyContent: 'center'}} onClick={handleSaveEdit}>
                    <Check size={18} /> Salvar Edição
                  </button>
                  <button className="button outline" style={{flex: 1, justifyContent: 'center'}} onClick={handleCancelEdit}>
                    <X size={18} /> Cancelar
                  </button>
                </>
              ) : (
                <button className="button" style={{backgroundColor: '#003366', width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1.1rem'}} onClick={handleAddEvent}>
                  <PlusCircle size={20} /> ADICIONAR EVENTO AO RELATÓRIO
                </button>
              )}
            </div>
          </div>

          {events.length > 0 && (
            <div className="card" style={{ borderTopColor: '#666' }}>
              <h2 className="card-title">Linha do Tempo de Eventos ({events.length})</h2>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button className="button danger" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={clearAllData}>
                   <Trash2 size={16} style={{ marginRight: '0.5rem' }} /> Limpar Todo o Relatório
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {events.map((ev, idx) => {
                  const hasFotos = ev.fotoUrls?.length > 0 || ev.fotoUrl;
                  const evFotos = ev.fotoUrls || (ev.fotoUrl ? [ev.fotoUrl] : []);
                  const parsed = parseEventoText(ev.evento);
                  
                  return (
                    <div key={idx} className="event-item" style={{ borderLeft: '4px solid #003366' }}>
                      <div className="event-actions">
                        <button className="button outline" style={{padding: '0.4rem'}} onClick={() => handleEdit(idx)} title="Editar">
                          <Edit2 size={16} />
                        </button>
                        <button className="button danger" style={{padding: '0.4rem'}} onClick={() => handleDelete(idx)} title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      <div style={{ paddingRight: '4rem' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#003366' }}>
                          {idx + 1}. {parsed?.titulo || `Evento ${idx + 1}`}
                        </h3>
                        {parsed ? (
                          <>
                            {(parsed.data || ev.data) && (
                              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.2rem' }}>
                                <strong>Data:</strong> {parsed.data || ev.data}
                              </div>
                            )}
                            {parsed.local && (
                              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.2rem' }}>
                                <strong>Local:</strong> {parsed.local}
                              </div>
                            )}
                            {parsed.envolvidos && (
                              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.2rem' }}>
                                <strong>Envolvidos:</strong> {parsed.envolvidos}
                              </div>
                            )}
                            {parsed.relato && (
                              <p style={{ fontSize: '0.9rem', color: '#444', margin: '0.5rem 0 1rem 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                <strong>Relato:</strong> {parsed.relato}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            {ev.data && (
                              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                                <strong>Data:</strong> {ev.data}
                              </div>
                            )}
                            {ev.evento && (
                              <p style={{ fontSize: '0.9rem', color: '#444', margin: '0 0 1rem 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {ev.evento}
                              </p>
                            )}
                          </>
                        )}
                        
                        {hasFotos && (
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {evFotos.map((url, imgIdx) => (
                              <img key={imgIdx} src={url} alt="miniatura" style={{ height: '40px', width: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="preview-panel">
          <div className="preview-toolbar" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="button" style={{backgroundColor: '#28a745', flex: 1}} onClick={handleExportDocx}>
              <FileDown size={18} /> Baixar (.DOCX)
            </button>
            <button className="button outline" style={{flex: 1}} onClick={handleExportJSON} title="Salvar Backup do Relatório para continuar depois">
              <FileDown size={18} /> Salvar (.JSON)
            </button>
            <button className="button outline" style={{flex: 1}} onClick={() => document.getElementById('import-json').click()} title="Carregar Backup do Relatório">
              <UploadCloud size={18} /> Carregar (.JSON)
            </button>
            <input 
              id="import-json"
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportJSON}
            />
          </div>
          
          <div className="document-preview" id="sei-document">
            <div style={{ textAlign: 'justify' }}>
              <p style={{ marginBottom: '2rem' }}>
                Assunto: <strong>Relatório de Atividades – {mesAnoFormatted}.</strong>
              </p>
              
              <p style={{ marginBottom: '1.5rem' }}>
                Senhor Comandante-Geral,
              </p>
              
              <p style={{ marginBottom: '2rem', textIndent: '2.5rem' }}>
                Ao cumprimentá-lo cordialmente, sirvo-me do presente para encaminhar a Vossa Senhoria o Relatório de Atividades da Assessoria Institucional do CBMRO, em Brasília/DF no mês de <strong>{mesAnoFormatted.replace('/', ' de ')}</strong>.
              </p>

              {events.map((ev, index) => {
                const docFotos = ev.fotoUrls || (ev.fotoUrl ? [ev.fotoUrl] : []);
                const parsed = parseEventoText(ev.evento);

                return (
                  <div key={index} style={{ marginBottom: '2.5rem', pageBreakInside: 'avoid' }}>
                    <p style={{ display: 'block', margin: '1.5rem 0' }}><strong>Evento{parsed && parsed.titulo ? `: ${parsed.titulo}` : ''}</strong></p>
                    
                    {parsed ? (
                      <>
                        {parsed.data && <p style={{ display: 'block', margin: '1.5rem 0' }}><strong>Data:</strong> {parsed.data}</p>}
                        {parsed.local && <p style={{ display: 'block', margin: '1.5rem 0' }}><strong>Local:</strong> {parsed.local}</p>}
                        {parsed.relato && <p style={{ display: 'block', margin: '1.5rem 0' }}><strong>Resumo:</strong> {parsed.relato}</p>}
                        {parsed.envolvidos && <p style={{ display: 'block', margin: '1.5rem 0' }}><strong>Stakeholders:</strong> {parsed.envolvidos}</p>}
                      </>
                    ) : (
                      ev.evento ? ev.evento.split('\n').filter(line => line.trim() !== '').map((line, lIdx) => (
                        <p key={lIdx} style={{ display: 'block', marginBottom: '1rem', textIndent: '2.5rem' }}>{line}</p>
                      )) : null
                    )}

                    {docFotos.length > 0 && (
                       <div style={{ marginTop: '1.5rem', textAlign: 'center', pageBreakInside: 'avoid' }}>
                        {docFotos.map((url, pIndex) => (
                           <div key={pIndex} style={{ marginBottom: '1.5rem' }}>
                            <img src={url} alt={`Evento - Foto ${pIndex+1}`} style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', display: 'block', margin: '0 auto 0.5rem auto' }} />
                            <p><strong>{docFotos.length > 1 ? `Foto ${pIndex + 1}:` : `Foto:`}</strong></p>
                           </div>
                        ))}
                       </div>
                    )}
                  </div>
                );
              })}

              <div style={{ marginTop: '4rem' }}>
                <p style={{ textAlign: 'justify', textIndent: '2.5rem' }}>Respeitosamente,</p>
                <div style={{ textAlign: 'center', marginTop: '4rem' }}>
                  <p style={{ marginBottom: '0.2rem' }}><strong>WÂNDRIO</strong> BANDEIRA DOS ANJOS - CEL BM</p>
                  <p style={{ margin: 0 }}>Chefe da Assessoria Institucional do CBMRO, em Brasília/DF</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
