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
