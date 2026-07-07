import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Cole aqui a config do seu app Web (Firebase Console > Configurações do projeto > Seus apps).
// Estes valores são PÚBLICOS por design — a proteção real vem das regras de segurança + login.
const firebaseConfig = {
  apiKey: 'PREENCHER',
  authDomain: 'PREENCHER',
  projectId: 'PREENCHER',
  storageBucket: 'PREENCHER',
  messagingSenderId: 'PREENCHER',
  appId: 'PREENCHER',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
