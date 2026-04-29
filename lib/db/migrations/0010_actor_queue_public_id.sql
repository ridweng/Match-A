-- Migration: 0010_actor_queue_public_id.sql
-- Purpose: Add target_profile_public_id to discovery.actor_queue for identity consistency
-- Critical: Prevents identity drift by using canonical public IDs

BEGIN;

-- Step 1: Add target_profile_public_id column (nullable initially for backfill)
ALTER TABLE discovery.actor_queue
ADD COLUMN IF NOT EXISTS target_profile_public_id VARCHAR(64);

-- Step 2: Backfill existing rows from core.profiles
UPDATE discovery.actor_queue aq
SET target_profile_public_id = p.public_id
FROM core.profiles p
WHERE aq.target_profile_id = p.id;

-- Step 3: Validate backfill (should return 0)
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM discovery.actor_queue
  WHERE target_profile_public_id IS NULL;
  
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Backfill failed: % rows have NULL target_profile_public_id', null_count;
  END IF;
  
  RAISE NOTICE 'Backfill successful: All rows have target_profile_public_id';
END $$;

-- Step 4: Make column NOT NULL now that backfill is complete
ALTER TABLE discovery.actor_queue
ALTER COLUMN target_profile_public_id SET NOT NULL;

-- Step 5: Add index for efficient lookups by public_id
CREATE INDEX IF NOT EXISTS actor_queue_target_public_id_idx
ON discovery.actor_queue(target_profile_public_id);

-- Step 6: Add hydration_level column for 3-slot deck support
ALTER TABLE discovery.actor_queue
ADD COLUMN IF NOT EXISTS hydration_level VARCHAR(16) DEFAULT 'full';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'actor_queue_hydration_level_check'
  ) THEN
    ALTER TABLE discovery.actor_queue
    ADD CONSTRAINT actor_queue_hydration_level_check
    CHECK (hydration_level IN ('full', 'partial', 'metadata'));
  END IF;
END $$;

-- Step 7: Set hydration levels based on position for existing rows
UPDATE discovery.actor_queue
SET hydration_level = CASE
  WHEN position = 1 THEN 'full'
  WHEN position = 2 THEN 'partial'
  WHEN position = 3 THEN 'metadata'
  ELSE 'full'
END;

COMMIT;

-- Verification query (run after migration)
-- SELECT 
--   COUNT(*) as total_rows,
--   COUNT(target_profile_public_id) as rows_with_public_id,
--   COUNT(DISTINCT hydration_level) as hydration_levels
-- FROM discovery.actor_queue;
