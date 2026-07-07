import { useState } from 'react';
import ReportList from './screens/ReportList';
import EditorScreen from './screens/EditorScreen';
import './index.css';

function App() {
  const [view, setView] = useState({ screen: 'list' });

  return (
    <div className="app-container">
      <header className="header">
        <h1>Gerador de Relatórios CBMRO</h1>
      </header>
      {view.screen === 'list' ? (
        <ReportList onOpen={(monthId) => setView({ screen: 'editor', monthId })} />
      ) : (
        <EditorScreen monthId={view.monthId} onBack={() => setView({ screen: 'list' })} />
      )}
    </div>
  );
}

export default App;
