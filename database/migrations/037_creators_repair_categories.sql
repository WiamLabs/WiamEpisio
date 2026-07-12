-- © 2026 WiamApp. Powered by WiamLabs
-- 037_creators_repair_categories.sql
-- Phase A: Music & Live Performance, Film & Talent, Phones & Gadgets Repair
-- APPEND only — never TRUNCATE live categories.

-- ── New parent categories ─────────────────────────────────────
INSERT INTO categories (id, name, icon, description, color, sort_order, is_active) VALUES
(
  'c1000000-0000-0000-0000-000000000013',
  'Music & Live Performance',
  'mic-outline',
  'Musicians, bands, gospel artists, rappers and live performers available for booking.',
  '#7C3AED', 13, TRUE
),
(
  'c1000000-0000-0000-0000-000000000014',
  'Film & Talent',
  'film-outline',
  'Actors, voice artists, models and on-camera talent for productions and events.',
  '#DB2777', 14, TRUE
),
(
  'c1000000-0000-0000-0000-000000000015',
  'Phones & Gadgets Repair',
  'phone-portrait-outline',
  'Phone, tablet and laptop repair technicians — service booking only, not product sales.',
  '#0EA5E9', 15, TRUE
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- Ensure worker_subtypes table exists (from categories_seed)
CREATE TABLE IF NOT EXISTS worker_subtypes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- ── Music & Live Performance subtypes ─────────────────────────
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000013', v.name, v.sort_order
FROM (VALUES
  ('Musician (Solo)', 1),
  ('Musician', 2),
  ('Band / Group', 3),
  ('Gospel Artist', 4),
  ('Rapper / Hip-Hop Artist', 5),
  ('Highlife / Traditional Performer', 6),
  ('Session Musician', 7),
  ('Choir Director', 8),
  ('Instrumentalist (Guitar)', 9),
  ('Instrumentalist (Keys)', 10),
  ('Instrumentalist (Drums)', 11),
  ('Instrumentalist (Bass)', 12)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_subtypes ws
  WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000013'
    AND ws.name = v.name
);

-- Extra performance subtypes under Events (if category exists)
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000012', v.name, v.sort_order
FROM (VALUES
  ('Live Singer', 11),
  ('Backing Vocalist', 12),
  ('Praise & Worship Leader', 13)
) AS v(name, sort_order)
WHERE EXISTS (SELECT 1 FROM categories WHERE id = 'c1000000-0000-0000-0000-000000000012')
  AND NOT EXISTS (
    SELECT 1 FROM worker_subtypes ws
    WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000012'
      AND ws.name = v.name
  );

-- ── Film & Talent subtypes ────────────────────────────────────
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000014', v.name, v.sort_order
FROM (VALUES
  ('Movie Actor / Actress', 1),
  ('Movie Actor', 2),
  ('Voice Actor', 3),
  ('Extra / Background Actor', 4),
  ('Model (Events / Commercial)', 5),
  ('Script / Content Actor', 6),
  ('Presenter / Host', 7)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_subtypes ws
  WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000014'
    AND ws.name = v.name
);

-- ── Phones & Gadgets Repair subtypes ──────────────────────────
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000015', v.name, v.sort_order
FROM (VALUES
  ('Phone Repairer', 1),
  ('Phone Screen Replacement', 2),
  ('Phone Software / Unlock Technician', 3),
  ('Tablet Repairer', 4),
  ('Laptop Repairer', 5),
  ('Gadget Repair Technician', 6)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_subtypes ws
  WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000015'
    AND ws.name = v.name
);
