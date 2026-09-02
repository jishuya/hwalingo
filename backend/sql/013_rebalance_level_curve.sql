BEGIN;

-- Preserve every user's current level and within-level progress while moving
-- from the original, overly fast XP curve to the balanced curve.
CREATE TEMP TABLE level_curve_xp_adjustments ON COMMIT DROP AS
WITH RECURSIVE levels AS (
    SELECT 1 AS level
    UNION ALL
    SELECT level + 1 FROM levels WHERE level < 50
), requirements AS (
    SELECT level,
           CASE WHEN level < 10
                THEN 50 + (level - 1) * 15
                ELSE round(200 + (level - 10) * 28 + power(level - 10, 2) * 2.2)::BIGINT
           END AS old_required,
           CASE WHEN level < 10
                THEN 150 + (level - 1) * 30
                ELSE round(450 + (level - 10) * 55 + power(level - 10, 2) * 4)::BIGINT
           END AS new_required
    FROM levels
), thresholds AS (
    SELECT level,
           COALESCE(sum(old_required) OVER (ORDER BY level ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS old_before,
           COALESCE(sum(new_required) OVER (ORDER BY level ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS new_before,
           old_required,
           new_required
    FROM requirements
), mapped AS (
    SELECT up.user_id, up.total_xp, t.level, t.old_before, t.new_before,
           t.old_required, t.new_required
    FROM user_progress up
    JOIN LATERAL (
        SELECT * FROM thresholds
        WHERE old_before <= up.total_xp
        ORDER BY level DESC
        LIMIT 1
    ) t ON TRUE
    WHERE NOT EXISTS (
        SELECT 1 FROM xp_events xe
        WHERE xe.user_id = up.user_id
          AND xe.event_type = 'adjustment'
          AND xe.metadata->>'curveMigration' = 'balanced-v2'
    )
)
SELECT user_id,
       GREATEST(0, CASE WHEN level = 50
           THEN new_before + (total_xp - old_before)
           ELSE new_before + floor(
               LEAST(1, (total_xp - old_before)::NUMERIC / old_required) * new_required
           )::BIGINT
       END - total_xp) AS amount
FROM mapped;

INSERT INTO xp_events (user_id, event_type, amount, metadata)
SELECT user_id, 'adjustment', amount, '{"curveMigration":"balanced-v2"}'::jsonb
FROM level_curve_xp_adjustments;

UPDATE user_progress up
SET total_xp = up.total_xp + adjustment.amount,
    updated_at = CURRENT_TIMESTAMP
FROM level_curve_xp_adjustments adjustment
WHERE up.user_id = adjustment.user_id;

COMMIT;
