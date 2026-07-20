-- WiamApp: Migrate usernames to be unique
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- STATUS: COMPLETED 2026-04-30

-- Step 1: Find case-insensitive duplicates
SELECT LOWER(username) as lower_name, COUNT(*) as count 
FROM users 
WHERE username IS NOT NULL 
GROUP BY LOWER(username) 
HAVING COUNT(*) > 1;

-- Step 2: Fix duplicates by appending user ID (keeps oldest account's username)
WITH duplicates AS (
  SELECT id, username,
    ROW_NUMBER() OVER (PARTITION BY LOWER(username) ORDER BY id) as rn
  FROM users
  WHERE username IS NOT NULL
)
UPDATE users u
SET username = u.username || '_' || u.id
FROM duplicates d
WHERE u.id = d.id AND d.rn > 1;

-- Step 3: Add unique index (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_username_unique 
ON users (LOWER(username)) 
WHERE username IS NOT NULL;

-- Done! "Khoby" and "khoby" are now considered the same username.
