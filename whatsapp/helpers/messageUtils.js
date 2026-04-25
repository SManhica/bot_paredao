async function getMentionedIds(msg) {
  if (Array.isArray(msg.mentionedIds) && msg.mentionedIds.length > 0) {
    return msg.mentionedIds;
  }

  if (typeof msg.getMentions === 'function') {
    try {
      const mentions = await msg.getMentions();
      return mentions.map((contact) => contact.id._serialized);
    } catch (error) {
      return [];
    }
  }

  return [];
}

function normalizeText(msg) {
  return (msg.body || '').trim();
}

module.exports = {
  getMentionedIds,
  normalizeText,
};
