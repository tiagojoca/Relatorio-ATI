# Configuração do Firebase

Passos a fazer uma única vez no [Firebase Console](https://console.firebase.google.com).

## 1. Criar o projeto
Crie um projeto Firebase (ou use um existente).

## 2. Firestore
Build > Firestore Database > Criar banco de dados > modo de produção.

## 3. Storage
Build > Storage > Começar > modo de produção.

## 4. Authentication (senha compartilhada)
1. Build > Authentication > Começar.
2. Aba "Sign-in method" > ative **E-mail/senha**.
3. Aba "Users" > **Adicionar usuário**:
   - E-mail: `equipe@relatorio-ati.local` (precisa bater com `SHARED_EMAIL` em `src/firebase/auth.js`)
   - Senha: escolha a senha compartilhada que será digitada na tela de bloqueio.

## 5. App Web + config
1. Configurações do projeto (engrenagem) > "Seus apps" > ícone Web (`</>`).
2. Registre o app e copie o objeto `firebaseConfig`.
3. Cole os valores em `src/firebase/config.js` (substituindo os `PREENCHER`).

## 6. Regras de segurança
Cole o conteúdo de `firestore.rules` em Firestore > Regras > Publicar.
Cole o conteúdo de `storage.rules` em Storage > Regras > Publicar.

## 7. Domínios autorizados
Em Authentication > Settings > Authorized domains, confirme que o domínio do
GitHub Pages (ex.: `SEU-USUARIO.github.io`) está na lista. `localhost` já vem
autorizado para desenvolvimento.
