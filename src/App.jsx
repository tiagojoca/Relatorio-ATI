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
