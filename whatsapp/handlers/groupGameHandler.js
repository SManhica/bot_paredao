const { getMentionedIds } = require('../helpers/messageUtils');

class GroupGameHandler {
  constructor({ client, db, manager }) {
    this.client = client;
    this.db = db;
    this.manager = manager;
  }

  async getSafeName(id) {
    try {
      const player = await this.db.findPlayerByAnyId(id);
      if (player?.name) return player.name;

      const contact = await this.client.getContactById(id).catch(() => null);
      return contact?.pushname || contact?.name || id.split('@')[0];
    } catch {
      return id.split('@')[0];
    }
  }

  async mentionAllGroupMembers(chat, excludeIds = []) {
    try {
      const participants = chat.participants || [];
      const mentions = [];

      for (const participant of participants) {
        const participantId = participant.id._serialized;
        if (participantId.includes('@bot') || excludeIds.includes(participantId)) continue;

        const contact = await this.client.getContactById(participantId).catch(() => null);
        if (contact) mentions.push(contact);
      }

      return mentions;
    } catch (error) {
      console.error('❌ Erro ao obter membros:', error.message);
      return [];
    }
  }

  async mentionPlayers(playerIds) {
    const mentions = [];
    for (const playerId of playerIds) {
      const contact = await this.client.getContactById(playerId).catch(() => null);
      if (contact) mentions.push(contact);
    }
    return mentions;
  }

  async promoteGroupAdmin(chat, targetId) {
    if (typeof chat.promoteParticipants !== 'function') return false;
    try {
      await chat.promoteParticipants([targetId]);
      return true;
    } catch (error) {
      console.error('⚠️ Falha ao promover admin do grupo:', error.message);
      return false;
    }
  }

  async demoteGroupAdmin(chat, targetId) {
    if (typeof chat.demoteParticipants !== 'function') return false;
    try {
      await chat.demoteParticipants([targetId]);
      return true;
    } catch (error) {
      console.error('⚠️ Falha ao remover admin do grupo:', error.message);
      return false;
    }
  }

  async handle({ msg, chat, senderId, command, args }) {
    if (!chat.isGroup || !command.startsWith('!')) return false;

    if (command === '!ping') {
      await msg.reply('🏓 Pong!');
      return true;
    }

    if (command === '!comandos' || command === '!help') {
      await msg.reply(
        `🤖 *COMANDOS DO PAREDÃO* 🤖\n\n` +
        `*PÚBLICOS:*\n` +
        `!entrar NUMERO NOME - Entrar\n` +
        `!sair - Sair\n` +
        `!minhaordem - Ver posição\n` +
        `!status - Status\n` +
        `!comojogar - Explicação completa\n` +
        `!comandos - Esta lista\n\n` +
        `*ADMIN:*\n` +
        `!iniciarparedao - Novo paredão\n` +
        `!sortear - Sortear ordem\n` +
        `!comecar - Começar\n` +
        `!proximoturno - Próximo turno\n` +
        `!skipturno - Pular turno\n` +
        `!encerrarturno - Encerrar turno\n` +
        `!forcarentrar @ - Adicionar\n` +
        `!remover @ - Remover\n` +
        `!finalizar - Finalizar\n` +
        `!admin @ - Promover admin\n` +
        `!removeradmin @ - Remover admin`
      );
      return true;
    }

    if (command === '!comojogar') {
      await msg.reply(
        `🎮 *COMO FUNCIONA O PAREDÃO* 🎮\n\n` +
        `1) Um admin usa *!iniciarparedao*.\n` +
        `2) Cada pessoa entra com *!entrar NUMERO NOME*.\n` +
        `3) Um admin organiza com *!sortear* e começa com *!comecar*.\n` +
        `4) Durante o turno de alguém, as perguntas são enviadas no meu privado.\n` +
        `5) A pessoa do turno responde no privado usando o botão *Responder*.\n` +
        `6) As respostas voltam para o grupo automaticamente.\n\n` +
        `📌 Comandos úteis:\n` +
        `• !status → ver situação atual\n` +
        `• !minhaordem → ver sua posição\n` +
        `• !proximoturno / !skipturno / !encerrarturno → controle do turno\n` +
        `• !finalizar → encerra o jogo`
      );
      return true;
    }

    if (command === '!entrar') {
      const game = await this.manager.getActiveGame(chat.id._serialized);
      if (!game) return msg.reply('❌ Use !iniciarparedao primeiro').then(() => true);
      if (game.status !== 'waiting') return msg.reply('❌ Jogo já começou!').then(() => true);

      try {
        const isSupremo = await this.manager.isSupremo(senderId);
        if (isSupremo) {
          const playerInfo = await this.manager.registerPlayer(game.id, senderId, '', '');
          await msg.reply(`✅ ${playerInfo.name} entrou! Posição: ${playerInfo.order}º`);
          return true;
        }

        if (args.length < 2) {
          await msg.reply('❌ Formato: !entrar NUMERO NOME\nEx: !entrar 258866630883 João');
          return true;
        }

        const playerInfo = await this.manager.registerPlayer(game.id, senderId, args[0], args.slice(1).join(' '));
        const dmId = playerInfo.dmId || senderId;
        const dmChat = await this.client.getChatById(dmId).catch(() => null);
        if (dmChat) {
          await dmChat.sendMessage(
            `✅ *Você entrou no Paredão!*\n\n` +
            `📌 Grupo: ${chat.name}\n` +
            `🎮 Jogo: #${game.id}\n` +
            `📋 Posição: ${playerInfo.order}º`
          );
        }

        await msg.reply(`✅ ${playerInfo.name} entrou! Posição: ${playerInfo.order}º`);
      } catch (error) {
        await msg.reply(`❌ ${error.message.includes('já está') || error.message.includes('Número inválido') || error.message.includes('Digite seu nome') ? error.message : 'Erro ao entrar'}`);
      }
      return true;
    }

    if (command === '!sair') {
      const game = await this.manager.getActiveGame(chat.id._serialized);
      if (!game) return msg.reply('❌ Nenhum paredão').then(() => true);
      if (game.current_player_id === senderId) return msg.reply('❌ Não pode sair durante turno!').then(() => true);
      await this.manager.removePlayer(game.id, senderId).then(() => msg.reply('🏳️ Você saiu')).catch(() => msg.reply('❌ Você não está'));
      return true;
    }

    if (command === '!minhaordem') {
      const game = await this.manager.getActiveGame(chat.id._serialized);
      if (!game) return msg.reply('❌ Nenhum paredão').then(() => true);
      const orderInfo = await this.manager.getPlayerOrder(game.id, senderId);
      if (!orderInfo) return msg.reply('❌ Você não está. Use !entrar').then(() => true);

      let response = `📋 *POSIÇÃO:* ${orderInfo.position}º de ${orderInfo.total}\n`;
      if (senderId === game.current_player_id) response += '🎤 *VOCÊ ESTÁ NO PAREDÃO!*';
      else if (orderInfo.position === 1 && !game.current_player_id) response += '⏭️ *Você é o próximo!*';
      else if (orderInfo.position > 1) response += `⏳ *Faltam ${orderInfo.position - 1} turnos*`;
      await msg.reply(response);
      return true;
    }

    if (command === '!status') {
      const game = await this.manager.getActiveGame(chat.id._serialized);
      if (!game) return msg.reply('❌ Nenhum paredão').then(() => true);
      const status = await this.manager.getGameStatus(game.id);
      let statusText = `🎮 *PAREDÃO #${game.id}*\n📊 ${status.statusText}\n👥 ${status.totalPlayers} jogadores\n`;
      if (status.currentPlayer) statusText += `\n🎤 *ATUAL:* ${status.currentPlayer.name}`;
      statusText += '\n\n📋 *ORDEM:*\n';
      status.players.forEach((player, index) => {
        const indicator = player.id === game.current_player_id ? '🎤' : index === 0 && !game.current_player_id ? '⏭️' : `${index + 1}º`;
        statusText += `${indicator} ${player.name}\n`;
      });
      await msg.reply(statusText);
      return true;
    }

    const isAdmin = await this.manager.isAdmin(senderId);
    const isSupremo = await this.manager.isSupremo(senderId);
    const adminCommands = ['!iniciarparedao', '!sortear', '!comecar', '!proximoturno', '!skipturno', '!encerrarturno', '!forcarentrar', '!remover', '!finalizar', '!admin', '!removeradmin'];
    if (!isAdmin && !isSupremo && adminCommands.includes(command)) {
      await msg.reply('❌ Apenas administradores');
      return true;
    }

    if (command === '!iniciarparedao') {
      const existingGame = await this.manager.getActiveGame(chat.id._serialized);
      if (existingGame && existingGame.status !== 'finished') return msg.reply('❌ Já existe um paredão').then(() => true);
      const gameId = await this.manager.createGame(chat.id._serialized);
      const mentions = await this.mentionAllGroupMembers(chat, [senderId]);
      let announcement = `🎮 *NOVO PAREDÃO #${gameId}!*\n\n`;
      if (mentions.length > 0) {
        announcement += `🎯 *CONVITE PARA TODOS:*\n${mentions.map((c) => `@${(c.name || c.pushname || 'Amigo').split(' ')[0]}`).join(' ')}\n\n`;
      }
      announcement += `📝 *PARA PARTICIPAR:*\n!entrar NUMERO SEU_NOME\nEx: !entrar 258866630883 João`;
      await chat.sendMessage(announcement, mentions.length > 0 ? { mentions } : undefined);
      await msg.reply(`✅ Paredão #${gameId} iniciado!`);
      return true;
    }

    if (command === '!sortear') {
      const game = await this.manager.getActiveGame(chat.id._serialized);
      if (!game) return msg.reply('❌ Nenhum paredão').then(() => true);
      if (game.status !== 'waiting') return msg.reply('❌ Jogo já começou!').then(() => true);
      const shuffled = await this.manager.shufflePlayers(game.id);
      await msg.reply(`🎲 *ORDEM SORTEADA*\n\n${shuffled.map((p, i) => `${i + 1}º ${p.name}`).join('\n')}\n\n✅ Use !comecar`);
      return true;
    }

    if (command === '!comecar') {
      const game = await this.manager.getActiveGame(chat.id._serialized);
      if (!game) return msg.reply('❌ Nenhum paredão').then(() => true);
      if (game.status !== 'waiting') return msg.reply('❌ Jogo já começou!').then(() => true);
      const players = await this.db.getGamePlayers(game.id);
      if (players.length === 0) return msg.reply('❌ Nenhum jogador').then(() => true);
      const first = players[0];
      const contact = await this.client.getContactById(first.id).catch(() => null);
      const announcement = `🔥 *VAMOS COMEÇAR!*\n\n🎤 Primeiro: ${contact ? `@${first.name.split(' ')[0]}` : first.name}\n`;
      await chat.sendMessage(announcement, contact ? { mentions: [contact] } : undefined);
      await this.manager.startTurn(game.id, chat.id._serialized, first);
      return true;
    }

    if (command === '!proximoturno' || command === '!skipturno') {
      const game = await this.manager.getActiveGame(chat.id._serialized);
      if (!game) return msg.reply('❌ Nenhum paredão').then(() => true);
      const result = command === '!proximoturno'
        ? await this.manager.nextTurn(game.id, chat.id._serialized)
        : await this.manager.skipTurn(game.id, chat.id._serialized);
      if (result.success) {
        const contact = await this.client.getContactById(result.player.id).catch(() => null);
        const title = command === '!proximoturno' ? '⏭️ *PRÓXIMO TURNO*' : '⏩ *TURNO PULADO*';
        const lead = command === '!proximoturno' ? 'Agora' : 'Próximo';
        await chat.sendMessage(`${title}\n\n🎤 ${lead}: ${contact ? `@${result.player.name.split(' ')[0]}` : result.player.name}\n`, contact ? { mentions: [contact] } : undefined);
      } else if (result.error) {
        await msg.reply(`❌ ${result.error}`);
      }
      return true;
    }

    if (command === '!encerrarturno') {
      const game = await this.manager.getActiveGame(chat.id._serialized);
      if (!game) return msg.reply('❌ Nenhum paredão').then(() => true);
      if (!game.current_player_id) return msg.reply('❌ Nenhum turno ativo').then(() => true);
      await this.manager.endTurn(game.id, chat.id._serialized);
      await msg.reply('⏹️ *Turno encerrado!*');
      return true;
    }

    if (command === '!forcarentrar' || command === '!remover' || command === '!admin' || command === '!removeradmin') {
      const mentionedIds = await getMentionedIds(msg);
      if (mentionedIds.length === 0) {
        await msg.reply(`❌ Use: ${command} @membro`);
        return true;
      }
      const targetId = mentionedIds[0];
      const game = await this.manager.getActiveGame(chat.id._serialized);
      if (!game && (command === '!forcarentrar' || command === '!remover')) return msg.reply('❌ Nenhum paredão').then(() => true);

      if (command === '!forcarentrar') {
        const name = await this.getSafeName(targetId);
        const playerInfo = await this.manager.forceAddPlayer(game.id, targetId, name);
        await msg.reply(`✅ ${playerInfo.name} adicionado! Posição: ${playerInfo.order}º`);
        return true;
      }

      if (command === '!remover') {
        if (game.current_player_id === targetId) return msg.reply('❌ Não pode remover durante turno').then(() => true);
        await this.manager.removePlayer(game.id, targetId).then(() => msg.reply('✅ Jogador removido')).catch(() => msg.reply('❌ Erro ao remover'));
        return true;
      }

      if (command === '!admin') {
        if (!isSupremo) return msg.reply('❌ Apenas SUPREMO').then(() => true);
        await this.db.promoteToAdmin(targetId);
        const promotedOnGroup = await this.promoteGroupAdmin(chat, targetId);
        await msg.reply(
          promotedOnGroup
            ? `🛡️ ${await this.getSafeName(targetId)} promovido a admin do jogo e do grupo`
            : `🛡️ ${await this.getSafeName(targetId)} promovido a admin do jogo (não consegui promover no grupo)`
        );
        return true;
      }

      if (command === '!removeradmin') {
        if (!isSupremo) return msg.reply('❌ Apenas SUPREMO').then(() => true);
        if (await this.manager.isSupremo(targetId)) return msg.reply('❌ Não pode remover SUPREMO').then(() => true);
        await this.db.demoteAdmin(targetId);
        const demotedOnGroup = await this.demoteGroupAdmin(chat, targetId);
        await msg.reply(
          demotedOnGroup
            ? `🛡️ ${await this.getSafeName(targetId)} removido como admin do jogo e do grupo`
            : `🛡️ ${await this.getSafeName(targetId)} removido como admin do jogo`
        );
        return true;
      }
    }

    if (command === '!finalizar') {
      const game = await this.manager.getActiveGame(chat.id._serialized);
      if (!game) return msg.reply('❌ Nenhum paredão').then(() => true);
      await this.manager.finishGame(game.id, chat.id._serialized);
      const players = await this.db.getGamePlayers(game.id);
      if (players.length === 0) {
        await msg.reply('🏁 *PAREDÃO FINALIZADO!*');
        return true;
      }

      const mentions = await this.mentionPlayers(players.map((p) => p.id));
      let finalMessage = `🏁 *PAREDÃO #${game.id} FINALIZADO!*\n\n🎉 *OBRIGADO A TODOS!*\n\n`;
      if (mentions.length > 0) {
        finalMessage += `👏 *PARABÉNS:*\n${mentions.map((c) => `@${(c.name || c.pushname || 'Jogador').split(' ')[0]}`).join(' ')}\n\n`;
      }
      await chat.sendMessage(finalMessage, mentions.length > 0 ? { mentions } : undefined);
      return true;
    }

    return false;
  }
}

module.exports = GroupGameHandler;
