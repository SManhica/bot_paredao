# Arquitetura do Bot Paredão

Este documento descreve a organização introduzida para remover o monolito do `index.js` e preparar a base para novos jogos.

## Estrutura

- `index.js`
  - bootstrap da aplicação;
  - criação do client WhatsApp;
  - eventos globais (QR, auth, shutdown, erros de processo).

- `app/BotApplication.js`
  - roteador central;
  - separa entrada por contexto (DM, grupo, Supremo);
  - evita acumular regras de negócio no bootstrap.

- `whatsapp/handlers/dmHandler.js`
  - fluxo de perguntas e respostas no privado;
  - validação de turno e envio para `game-manager`.

- `whatsapp/handlers/groupGameHandler.js`
  - comandos do jogo no grupo;
  - estado do jogo, controle de turnos, admin e menções.

- `whatsapp/handlers/supremoHandler.js`
  - comandos dedicados do Supremo;
  - isolamento de regras de moderação/troll.

- `whatsapp/helpers/messageUtils.js`
  - normalização de texto;
  - fallback de menções (`mentionedIds` e `getMentions`) para compatibilidade de versões.

## Como adicionar um novo jogo

1. Criar pasta dedicada (`games/<novo-jogo>/`).
2. Implementar um handler de comandos para esse jogo.
3. Registrar o handler no `BotApplication`.
4. Reaproveitar helpers existentes para parsing/menções.
5. Manter persistência isolada por entidades/tabelas do jogo.

## Observação

A lógica original do paredão foi preservada; a mudança foca em separação de responsabilidades e manutenção evolutiva.
