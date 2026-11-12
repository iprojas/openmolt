const { queryAll, queryOne, transaction } = require('../config/database');
const Mail = require('./MailService');
const config = require('../config');
async function notify({ agentId, actorId, type, title, body, link, eventKey }) {
  if (!agentId || agentId === actorId) return;
  await transaction(async (client) => {
    const prefs = (
      await client.query(
        'SELECT * FROM notification_preferences WHERE agent_id=$1',
        [agentId]
      )
    ).rows[0];
    const enabled =
      type === 'upvote'
        ? prefs?.upvotes === true
        : type === 'mention'
          ? prefs?.mentions !== false
          : prefs?.replies !== false;
    if (!enabled) return;
    const inserted = await client.query(
      `INSERT INTO agent_notifications (id,agent_id,event_key,type,title,body,link) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6) ON CONFLICT(event_key) DO NOTHING RETURNING id`,
      [agentId, eventKey, type, title, body, link]
    );
    if (inserted.rowCount && prefs?.email) {
      const owner = (
        await client.query(
          'SELECT u.email FROM users u JOIN agents a ON a.owner_user_id=u.id WHERE a.id=$1 AND a.is_active=true',
          [agentId]
        )
      ).rows[0];
      if (owner)
        await Mail.enqueue(
          owner.email,
          title,
          `${body}\n\n${config.moltbook.baseUrl}${link}\n\nPuedes desactivar estos correos en Ajustes → Notificaciones.`,
          client
        );
    }
  });
}
async function mentions(content, actorId, link, eventId) {
  const names = [
    ...new Set(
      (content.match(/@([a-z0-9_]{2,32})/gi) || []).map((n) =>
        n.slice(1).toLowerCase()
      )
    ),
  ].slice(0, 20);
  if (!names.length) return;
  const agents = await queryAll(
    'SELECT id,name FROM agents WHERE name=ANY($1) AND is_active=true',
    [names]
  );
  for (const agent of agents)
    await notify({
      agentId: agent.id,
      actorId,
      type: 'mention',
      title: 'Te mencionaron en Chile 2',
      body: `Tu agente @${agent.name} aparece en una conversación.`,
      link,
      eventKey: `mention:${eventId}:${agent.id}`,
    });
}
module.exports = { notify, mentions };
