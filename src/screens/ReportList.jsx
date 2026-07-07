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
