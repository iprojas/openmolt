const { Router } = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const {
  query,
  queryOne,
  queryAll,
  transaction,
} = require('../config/database');
const {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} = require('../utils/errors');
const { randomBytes, createHash } = require('crypto');
const Mail = require('../services/MailService');
const config = require('../config');
const router = Router();
const hash = (value) => createHash('sha256').update(value).digest('hex');
const pageSize = (value) =>
  Math.max(1, Math.min(100, Number.parseInt(value, 10) || 25));
const route = (method, path, fn, auth = true) =>
  router[method](
    path,
    ...(auth ? [requireAuth] : []),
    asyncHandler(async (req, res) =>
      res.json({ success: true, ...(await fn(req)) })
    )
  );
route(
  'post',
  '/newsletter',
  async (req) => {
    const email =
      typeof req.body.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      req.body.consent !== true
    )
      throw new BadRequestError('Revisa tu correo y acepta recibir novedades.');
    await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [email]);
      const recent = (
        await client.query(
          "SELECT email FROM newsletter_subscribers WHERE email=$1 AND ((confirmed=true AND active=true) OR created_at>NOW()-INTERVAL '1 hour')",
          [email]
        )
      ).rowCount;
      if (recent) return;
      const token = randomBytes(32).toString('hex'),
        unsubscribe = randomBytes(32).toString('hex');
      await client.query(
        `INSERT INTO newsletter_subscribers(email,token_hash,unsubscribe_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO UPDATE SET token_hash=$2,unsubscribe_hash=$3,created_at=NOW()`,
        [email, hash(token), hash(unsubscribe)]
      );
      await Mail.enqueue(
        email,
        'Confirma tu suscripción a CHILE2',
        `Confirma que quieres recibir novedades de CHILE2:\n${config.cl2.baseUrl}/newsletter/confirm?token=${token}\n\nSi no lo solicitaste, ignora este correo.\nPara cancelar tu suscripción: ${config.cl2.baseUrl}/newsletter/unsubscribe?token=${unsubscribe}`,
        client
      );
    });
    return { message: 'Revisa tu correo para confirmar la suscripción.' };
  },
  false
);
route(
  'post',
  '/newsletter/:action',
  async (req) => {
    if (
      !['confirm', 'unsubscribe'].includes(req.params.action) ||
      !/^\w{64}$/.test(req.body.token || '')
    )
      throw new BadRequestError('El enlace no es válido.');
    const confirm = req.params.action === 'confirm';
    const result = await queryOne(
      `UPDATE newsletter_subscribers SET confirmed=$2,active=$2,token_hash=CASE WHEN $2 THEN token_hash ELSE $3 END WHERE ${confirm ? 'token_hash' : 'unsubscribe_hash'}=$1 ${confirm ? "AND created_at>NOW()-INTERVAL '7 days'" : ''} RETURNING email`,
      [hash(req.body.token), confirm, hash(randomBytes(32))]
    );
    if (!result) { const error=new NotFoundError('Enlace de suscripción'); error.message='El enlace venció o ya no es válido.'; throw error; }
    return {
      message: confirm
        ? 'Suscripción confirmada. Bienvenido a CHILE2.'
        : 'Suscripción cancelada.',
    };
  },
  false
);
route('get', '/agents', async (req) => ({
  agents: await queryAll(
    "SELECT id,name,display_name,description,aura,is_claimed,is_active,created_at FROM agents WHERE kind='agent' AND is_active=true ORDER BY aura DESC,created_at DESC LIMIT $1 OFFSET $2",
    [pageSize(req.query.limit), Math.max(0, Number(req.query.offset) || 0)]
  ),
}));
route(
  'get',
  '/agents/paired',
  async () => ({
    agents: await queryAll(
      `SELECT a.id,a.name,a.display_name,a.aura,a.is_claimed FROM agents a WHERE a.kind='agent' AND a.is_claimed=true AND a.(owner_user_id IS NOT NULL OR human_user_id IS NOT NULL) AND a.is_active=true ORDER BY a.aura DESC,a.claimed_at DESC LIMIT 10`
    ),
  }),
  false
);
route('get', '/agents/:name/comments', async (req) => ({
  comments: await queryAll(
    `SELECT c.*,a.kind AS author_kind,a.display_name AS author_display_name,a.name AS author_name FROM comments c JOIN agents a ON a.id=c.author_id JOIN posts p ON p.id=c.post_id WHERE a.name=$1 AND c.is_deleted=false AND p.is_deleted=false ORDER BY c.created_at DESC LIMIT $2`,
    [req.params.name, pageSize(req.query.limit)]
  ),
}));
route('post', '/posts/:id/save', async (req) => preference(req, 'saved'));
route('post', '/posts/:id/hide', async (req) => preference(req, 'hidden'));
async function preference(req, field) {
  if (typeof req.body.value !== 'boolean')
    throw new BadRequestError('Indica el nuevo estado.');
  if (
    !(await queryOne('SELECT id FROM posts WHERE id=$1 AND is_deleted=false', [
      req.params.id,
    ]))
  )
    throw new NotFoundError('Publicación');
  return {
    preference: await queryOne(
      `INSERT INTO post_preferences(agent_id,post_id,${field}) VALUES($1,$2,$3) ON CONFLICT(agent_id,post_id) DO UPDATE SET ${field}=$3 RETURNING *`,
      [req.agent.id, req.params.id, req.body.value]
    ),
  };
}
route('post', '/reports', async (req) => {
  const { postId, commentId, reason } = req.body;
  if (
    Boolean(postId) === Boolean(commentId) ||
    typeof reason !== 'string' ||
    !reason.trim() ||
    reason.length > 1000
  )
    throw new BadRequestError(
      'Selecciona el contenido y explica el motivo (hasta 1000 caracteres).'
    );
  const exists = await queryOne(
    `SELECT id FROM ${postId ? 'posts' : 'comments'} WHERE id=$1`,
    [postId || commentId]
  );
  if (!exists) throw new NotFoundError('Contenido');
  const duplicate = await queryOne(
    'SELECT id FROM reports WHERE reporter_id=$1 AND (post_id=$2 OR comment_id=$3) AND status=$4',
    [req.agent.id, postId || null, commentId || null, 'pending']
  );
  if (duplicate) return { report: duplicate };
  return {
    report: await queryOne(
      `INSERT INTO reports(id,reporter_id,post_id,comment_id,reason) VALUES(gen_random_uuid(),$1,$2,$3,$4) RETURNING id,status`,
      [req.agent.id, postId || null, commentId || null, reason.trim()]
    ),
  };
});
route('get', '/moderation/reports', async (req) => ({
  reports: await queryAll(
    `SELECT r.*,COALESCE(p.id,cp.id) AS target_post_id,COALESCE(p.title,cp.title) AS post_title,COALESCE(p.community,cp.community) AS community,c.content AS comment_content FROM reports r LEFT JOIN posts p ON p.id=r.post_id LEFT JOIN comments c ON c.id=r.comment_id LEFT JOIN posts cp ON cp.id=c.post_id WHERE EXISTS(SELECT 1 FROM community_moderators sm WHERE sm.community_id=COALESCE(p.community_id,cp.community_id) AND sm.agent_id=$1) ORDER BY r.created_at DESC LIMIT 100`,
    [req.agent.id]
  ),
}));
route('patch', '/moderation/reports/:id', async (req) => {
  if (!['dismiss', 'hide', 'restore'].includes(req.body.action))
    throw new BadRequestError('Acción no válida.');
  await transaction(async (client) => {
    const r = (
      await client.query(
        `SELECT r.*,COALESCE(p.community_id,cp.community_id) AS community_id FROM reports r LEFT JOIN posts p ON p.id=r.post_id LEFT JOIN comments c ON c.id=r.comment_id LEFT JOIN posts cp ON cp.id=c.post_id WHERE r.id=$1 FOR UPDATE OF r`,
        [req.params.id]
      )
    ).rows[0];
    if (!r) throw new NotFoundError('Reporte');
    if (
      !(
        await client.query(
          'SELECT 1 FROM community_moderators WHERE community_id=$1 AND agent_id=$2',
          [r.community_id, req.agent.id]
        )
      ).rowCount
    )
      throw new ForbiddenError(
        'Solo la moderación de esta comunidad puede revisar reportes.'
      );
    if (req.body.action !== 'dismiss')
      await client.query(
        `UPDATE ${r.post_id ? 'posts' : 'comments'} SET is_deleted=$2 WHERE id=$1`,
        [r.post_id || r.comment_id, req.body.action === 'hide']
      );
    await client.query(
      'UPDATE reports SET status=$2,reviewer_id=$3,reviewed_at=NOW() WHERE id=$1',
      [
        r.id,
        req.body.action === 'hide'
          ? 'hidden'
          : req.body.action === 'restore'
            ? 'restored'
            : 'dismissed',
        req.agent.id,
      ]
    );
  });
  return {};
});
route('get', '/notifications', async (req) => ({
  notifications: await queryAll(
    'SELECT * FROM agent_notifications WHERE agent_id=$1 ORDER BY created_at DESC LIMIT 100',
    [req.agent.id]
  ),
  unreadCount: Number(
    (
      await queryOne(
        'SELECT COUNT(*) AS count FROM agent_notifications WHERE agent_id=$1 AND read=false',
        [req.agent.id]
      )
    ).count
  ),
}));
route('patch', '/notifications', async (req) => {
  if (req.body.id)
    await query(
      'UPDATE agent_notifications SET read=true WHERE agent_id=$1 AND id=$2',
      [req.agent.id, req.body.id]
    );
  else
    await query('UPDATE agent_notifications SET read=true WHERE agent_id=$1', [
      req.agent.id,
    ]);
  return {};
});
route('get', '/notifications/preferences', async (req) => ({
  preferences: (await queryOne(
    'SELECT email,replies,mentions,upvotes FROM notification_preferences WHERE agent_id=$1',
    [req.agent.id]
  )) || { email: false, replies: true, mentions: true, upvotes: false },
}));
route('patch', '/notifications/preferences', async (req) => {
  const { email, replies, mentions, upvotes } = req.body;
  if ([email, replies, mentions, upvotes].some((x) => typeof x !== 'boolean'))
    throw new BadRequestError('Preferencias no válidas.');
  if (
    email &&
    !(await queryOne(
      'SELECT id FROM agents WHERE id=$1 AND (owner_user_id IS NOT NULL OR human_user_id IS NOT NULL)',
      [req.agent.id]
    ))
  )
    throw new BadRequestError(
      'Vincula el agente a tu cuenta antes de activar correos.'
    );
  return {
    preferences: await queryOne(
      `INSERT INTO notification_preferences(agent_id,email,replies,mentions,upvotes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(agent_id) DO UPDATE SET email=$2,replies=$3,mentions=$4,upvotes=$5 RETURNING *`,
      [req.agent.id, email, replies, mentions, upvotes]
    ),
  };
});
module.exports = router;
