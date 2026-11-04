import type { PoolClient } from 'pg'

// Reconcile sessions created before a vocabulary was archived, preserving submitted answers.
export async function reconcileArchivedQuizItems(client: PoolClient, userId: string) {
  const sessions = await client.query<{ id: string; mode: string }>(
    `SELECT id,mode FROM quiz_sessions WHERE user_id = $1 AND status = 'active' ORDER BY id FOR UPDATE`,
    [userId],
  )
  for (const session of sessions.rows) {
      if(session.mode==='incorrect') {
        const removed=await client.query(`UPDATE quiz_session_items i SET practice_excluded=TRUE
          FROM vocabularies v JOIN vocabulary_progress p ON p.vocabulary_id=v.id AND p.user_id=v.user_id
          WHERE i.session_id=$1 AND i.vocabulary_id=v.id AND NOT i.practice_excluded
            AND (v.archived_at IS NOT NULL OR p.incorrect_practice_excluded_at IS NOT NULL) RETURNING i.id`,[session.id])
        if(removed.rowCount) await client.query(`UPDATE quiz_sessions SET
          total_count=(SELECT count(*) FROM quiz_session_items WHERE session_id=$1 AND retry_of_item_id IS NULL AND NOT practice_excluded),
          correct_count=(SELECT count(*) FROM quiz_session_items WHERE session_id=$1 AND retry_of_item_id IS NULL AND NOT practice_excluded AND result='correct'),
          status=CASE WHEN EXISTS(SELECT 1 FROM quiz_session_items WHERE session_id=$1 AND NOT practice_excluded AND result IS NULL) THEN 'active'
            WHEN EXISTS(SELECT 1 FROM quiz_session_items WHERE session_id=$1 AND NOT practice_excluded) THEN 'completed' ELSE 'abandoned' END,
          completed_at=CASE WHEN EXISTS(SELECT 1 FROM quiz_session_items WHERE session_id=$1 AND NOT practice_excluded AND result IS NULL) THEN NULL ELSE CURRENT_TIMESTAMP END
          WHERE id=$1`,[session.id])
        continue
      }

      const removed = await client.query(
        `DELETE FROM quiz_session_items i USING vocabularies v
         WHERE i.session_id = $1 AND i.vocabulary_id = v.id AND v.archived_at IS NOT NULL
           AND i.result IS NULL RETURNING i.id`,
        [session.id],
      )
      if (!removed.rowCount) continue
      await client.query(
        `UPDATE quiz_sessions SET
           total_count = (SELECT COUNT(*) FROM quiz_session_items WHERE session_id = $1 AND retry_of_item_id IS NULL),
           status = CASE
             WHEN EXISTS (SELECT 1 FROM quiz_session_items WHERE session_id = $1 AND result IS NULL) THEN 'active'
             WHEN EXISTS (SELECT 1 FROM quiz_session_items WHERE session_id = $1) THEN 'completed'
             ELSE 'abandoned' END,
           completed_at = CASE WHEN EXISTS (SELECT 1 FROM quiz_session_items WHERE session_id = $1 AND result IS NULL)
             THEN NULL ELSE CURRENT_TIMESTAMP END
         WHERE id = $1`,
        [session.id],
      )
    }
}
