import type { PoolClient } from 'pg'

// Reconcile sessions created before a vocabulary was archived, preserving submitted answers.
export async function reconcileArchivedQuizItems(client: PoolClient, userId: string) {
  const sessions = await client.query<{ id: string }>(
    `SELECT id FROM quiz_sessions WHERE user_id = $1 AND status = 'active' ORDER BY id FOR UPDATE`,
    [userId],
  )
  for (const session of sessions.rows) {
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
