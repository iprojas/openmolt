const { queryOne, queryAll, transaction } = require('../config/database');
const { BadRequestError, NotFoundError } = require('../utils/errors');
class VoteService {
  static upvotePost(targetId, agentId) {
    return this.vote({ targetId, agentId, targetType: 'post', value: 1 });
  }
  static downvotePost(targetId, agentId) {
    return this.vote({ targetId, agentId, targetType: 'post', value: -1 });
  }
  static upvoteComment(targetId, agentId) {
    return this.vote({ targetId, agentId, targetType: 'comment', value: 1 });
  }
  static downvoteComment(targetId, agentId) {
    return this.vote({ targetId, agentId, targetType: 'comment', value: -1 });
  }
  static async vote({ targetId, targetType, agentId, value }) {
    const table = targetType === 'post' ? 'posts' : 'comments';
    const result = await transaction(async (client) => {
      const target = (
        await client.query(
          `SELECT * FROM ${table} WHERE id=$1 AND is_deleted=false FOR UPDATE`,
          [targetId]
        )
      ).rows[0];
      if (!target) throw new NotFoundError('Contenido');
      if (target.author_id === agentId)
        throw new BadRequestError('No puedes votar tu propio contenido.');
      const previous = (
        await client.query(
          'SELECT id,value FROM votes WHERE agent_id=$1 AND target_id=$2 AND target_type=$3',
          [agentId, targetId, targetType]
        )
      ).rows[0];
      const old = previous?.value || 0,
        next = old === value ? 0 : value;
      if (!next)
        await client.query('DELETE FROM votes WHERE id=$1', [previous.id]);
      else if (previous)
        await client.query('UPDATE votes SET value=$2 WHERE id=$1', [
          previous.id,
          next,
        ]);
      else
        await client.query(
          'INSERT INTO votes(id,agent_id,target_id,target_type,value,post_id,comment_id) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6)',
          [
            agentId,
            targetId,
            targetType,
            next,
            targetType === 'post' ? targetId : null,
            targetType === 'comment' ? targetId : null,
          ]
        );
      const delta = next - old;
      const score = (
        await client.query(
          `UPDATE ${table} SET score=score+$2,upvotes=upvotes+$3,downvotes=downvotes+$4 WHERE id=$1 RETURNING score,upvotes,downvotes`,
          [
            targetId,
            delta,
            Number(next === 1) - Number(old === 1),
            Number(next === -1) - Number(old === -1),
          ]
        )
      ).rows[0];
      await client.query('UPDATE agents SET aura=aura+$2 WHERE id=$1', [
        target.author_id,
        delta,
      ]);
      return {
        ...score,
        scoreDelta: delta,
        user_vote: next === 1 ? 'up' : next === -1 ? 'down' : null,
        action:
          next === 0
            ? 'removed'
            : old
              ? 'changed'
              : next === 1
                ? 'upvoted'
                : 'downvoted',
        authorId: target.author_id,
        postId: targetType === 'post' ? targetId : target.post_id,
      };
    });
    if (result.user_vote === 'up')
      await require('./NotificationService').notify({
        agentId: result.authorId,
        actorId: agentId,
        type: 'upvote',
        title: 'Tu aporte recibió un Upvote',
        body: 'Alguien encontró valioso tu aporte.',
        link: `/post/${result.postId}`,
        eventKey: `upvote:${targetType}:${targetId}:${agentId}`,
      });
    return { success: true, ...result };
  }
  static async getVote(agentId, targetId, targetType) {
    return (
      (
        await queryOne(
          'SELECT value FROM votes WHERE agent_id=$1 AND target_id=$2 AND target_type=$3',
          [agentId, targetId, targetType]
        )
      )?.value || null
    );
  }
  static async getVotes(agentId, targets) {
    const rows = await queryAll(
      'SELECT target_id,value FROM votes WHERE agent_id=$1 AND target_id=ANY($2)',
      [agentId, targets.map((x) => x.targetId)]
    );
    return new Map(rows.map((x) => [x.target_id, x.value]));
  }
}
module.exports = VoteService;
