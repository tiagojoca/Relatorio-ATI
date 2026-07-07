import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './config';

// Conta fixa compartilhada. O e-mail não é segredo; a senha é definida no
// Firebase Console e digitada pelo usuário na tela de bloqueio.
export const SHARED_EMAIL = 'equipe@relatorio-ati.local';

export function login(senha) {
  return signInWithEmailAndPassword(auth, SHARED_EMAIL, senha);
}

export function logout() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}
