// Interruptor da camada de dados. As telas importam SEMPRE deste módulo,
// nunca diretamente de um backend específico.
//
// Hoje o app grava em localStorage. Para migrar ao Firebase no futuro,
// troque a linha abaixo por:
//   export * from '../firebase/relatorios';
// (e preencha src/firebase/config.js + religue a tela de login em App.jsx).
export * from '../localdb/relatorios';
