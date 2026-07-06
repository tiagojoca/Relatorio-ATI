# Banco de Dados para o Gerador de Relatórios CBMRO — Design

**Data:** 2026-07-06
**Status:** Aprovado (design), aguardando plano de implementação

## Problema

O app hoje persiste os dados apenas em `localStorage` (um único mês por vez, preso ao navegador). O usuário quer um **histórico centralizado** de relatórios de todos os meses, acessível de qualquer dispositivo e compartilhável com outras pessoas (sem contas individuais).

## Objetivos

- Guardar todos os relatórios mensais de forma centralizada (não só o mês atual, não só no navegador local).
- Permitir abrir e editar qualquer mês a partir de uma lista.
- Guardar as fotos dos eventos de forma centralizada, junto com o texto.
- Barreira mínima de acesso (senha compartilhada), já que o app é público no GitHub Pages.

## Não-objetivos (YAGNI)

- Contas de usuário individuais / perfis / permissões por pessoa.
- Sincronização em tempo real entre editores simultâneos.
- Fluxo de "esqueci minha senha", cadastro de novos usuários pela UI.
- Migração automática dos dados hoje no `localStorage` (o usuário confirmou não ter dados importantes salvos).
- Histórico de versões / auditoria de quem alterou o quê.

## Decisões-chave

| Tema | Decisão |
|------|---------|
| Backend | Firebase (Firestore + Storage + Authentication) acessado direto do app estático via SDK. |
| Usuários | Sem contas individuais. Acesso compartilhado via **uma única conta fixa** no Firebase Auth. |
| Fotos | Firebase Storage guarda os arquivos; Firestore guarda só texto + URLs de download. |
| Navegação | Tela de lista de relatórios por mês → abrir um por vez no editor. |
| Concorrência | Salvar explícito por mutação; **última gravação vence** (sem merge, sem tempo real). |
| Segurança | Senha única compartilhada via Firebase Auth (e-mail fixo + senha definida no Console). |
| Migração | Nenhuma. Começa do zero. |

## Arquitetura

O app continua servido 100% estático pelo GitHub Pages. Passa a comunicar-se com o Firebase pela internet via SDK do cliente. A config do Firebase (`apiKey` etc.) é pública por design — a proteção real vem das **regras de segurança** do Firestore/Storage combinadas com o **login obrigatório**.

- **Firestore** — dados de texto dos relatórios.
- **Firebase Storage** — arquivos de foto dos eventos.
- **Firebase Authentication (e-mail/senha)** — implementa a "senha compartilhada". Existe **uma única conta fixa** (ex.: `equipe@relatorio-ati.local`); o app faz login nela com a senha que o usuário digita. As regras exigem apenas `request.auth != null`. Força de senha, rate limiting e sessão ficam a cargo do próprio Firebase Auth — mais robusto do que reimplementar verificação de PIN nas regras.

## Modelo de dados

### Firestore

Coleção `relatorios`, **um documento por mês**, com o ID no formato `"YYYY-MM"` (ex.: `relatorios/2026-03`). Usar o mês como ID ordena os documentos cronologicamente ao ordenar por ID (texto), e evita relatórios duplicados do mesmo mês.

```
relatorios/{YYYY-MM} = {
  mesAnoRaw: "2026-03-01",
  events: [
    {
      id: "uuid-gerado-no-cliente",   // estável; nomeia a pasta de fotos no Storage
      evento: "texto colado (Data/Local/Relato/Participantes/...)",
      fotoUrls: ["https://firebasestorage.../foto1.jpg", ...]  // URLs de download, não base64
    },
    ...
  ],
  updatedAt: <serverTimestamp>
}
```

O array `events` mantém a mesma estrutura consumida hoje pelo `parseEventoText` e pelo preview/DOCX. As duas únicas diferenças em relação ao modelo atual:
- Cada evento ganha um `id` (uuid) estável.
- `fotoUrls` guarda URLs de download do Storage em vez de data URLs base64.

### Firebase Storage

```
relatorios/{YYYY-MM}/{eventoId}/{arquivo}.jpg
```

O `eventoId` estável garante que editar/reordenar eventos não quebre os links de foto. Guardar fotos aqui (e não no Firestore) evita o limite de 1MB por documento.

## Fluxo de acesso (PIN compartilhado)

1. Ao abrir o app, antes de qualquer tela, exibir **tela de bloqueio**: campo de senha + "Entrar".
2. App chama `signInWithEmailAndPassword` com o e-mail fixo (embutido no código, não é segredo) + senha digitada.
3. Sucesso → libera o app. Erro → "Senha incorreta".
4. Firebase Auth mantém a sessão localmente; no mesmo navegador não é preciso redigitar a senha a cada visita.
5. Botão discreto de **"Sair"** (logout) para encerrar a sessão em computador compartilhado.
6. A senha real é definida pelo usuário no Firebase Console ao criar o usuário fixo — **não** fica hardcoded no código; só o e-mail fica.

## Mudanças na UI

### Nova tela: Lista de Relatórios (tela inicial pós-login)

- Busca todos os documentos de `relatorios`, ordenados do mês mais recente para o mais antigo.
- Cada item: mês/ano formatado (ex.: "março/2026") + quantidade de eventos.
- **"Novo Relatório"**: abre o seletor `<input type="month">`. Mês inexistente → cria documento vazio no Firestore e abre o editor. Mês existente → apenas abre o existente (sem duplicar).
- Clicar num item → abre o editor com os dados daquele documento.
- **"Voltar à lista"** no editor, para trocar de relatório sem recarregar a página.

### Editor (o que já existe hoje)

- Mesmo layout, mesmos campos (colar texto do evento, upload de fotos, linha do tempo, preview).
- Persistência muda de destino: em vez de gravar no `localStorage` a cada mudança, cada mutação (adicionar / salvar edição / excluir / limpar tudo) grava o array `events` inteiro de volta no documento Firestore do mês — mesmo padrão "auto-save por mutação" atual.
- Indicador de estado "Salvando..." / "Salvo", já que agora é chamada de rede.

### Fluxo de fotos

- Durante a composição do formulário (antes de "Adicionar Evento"), fotos continuam lidas como data URL local para preview imediato — sem tocar rede, idêntico a hoje.
- No momento de **Adicionar Evento** / **Salvar Edição**, cada foto nova (data URL) é enviada ao Storage; a URL de download substitui a data URL antes de gravar no Firestore. Fotos já existentes (já com URL do Storage) não são reenviadas.

## O que permanece igual

- **Exportação DOCX**: mesma lógica de montagem. Imagens agora vêm de URL do Storage — baixadas via `fetch` antes do processamento no canvas (hoje processa a data URL diretamente).
- **Exportação/Importação JSON**: mantida como backup manual do relatório aberto, independente do banco.
- **`parseEventoText`, preview HTML, texto fixo do ofício e assinatura**: sem alterações.
- **Deploy no GitHub Pages**: inalterado; app continua estático.

## Regras de segurança (a serem escritas na implementação)

- **Firestore**: leitura/escrita em `relatorios/**` permitidas apenas para `request.auth != null`.
- **Storage**: leitura/escrita em `relatorios/**` permitidas apenas para `request.auth != null`.

## Pré-requisitos de configuração (responsabilidade do usuário)

No Firebase Console, antes da implementação:
1. Criar projeto Firebase.
2. Ativar Firestore Database (modo produção).
3. Ativar Storage.
4. Ativar Authentication → provedor E-mail/senha; criar manualmente o usuário fixo (ex.: `equipe@relatorio-ati.local` + senha compartilhada).
5. Registrar um app Web e obter o objeto de config (`apiKey`, `authDomain`, `projectId`, ...).
6. Fornecer essa config ao projeto (arquivo a ser indicado na implementação).

Responsabilidade do assistente: regras de segurança Firestore/Storage, todo o código do app (login, lista, editor, upload de fotos) e a integração.

## Riscos / observações

- **Última gravação vence**: dois editores simultâneos sem recarregar podem sobrescrever um ao outro. Aceito pelo usuário.
- **App público**: a barreira é só a senha compartilhada; não é segurança forte. Aceito pelo usuário.
- **Config do Firebase no código**: pública por design; a proteção vem das regras + login.
- **Fotos órfãs no Storage**: excluir um evento/relatório do Firestore não apaga automaticamente os arquivos no Storage. Para o escopo atual, aceitável; limpeza pode ser tratada depois se necessário.
