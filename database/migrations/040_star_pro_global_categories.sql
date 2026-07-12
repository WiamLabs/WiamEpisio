-- © 2026 WiamApp. Powered by WiamLabs
-- 040_star_pro_global_categories.sql
-- Star/Talent Pro for ALL bookable celebrities + global service categories.
-- APPEND only. WiamApp is worldwide — not Ghana-only.

-- ── Star Pro: talent_type on artist_profiles ──────────────────
ALTER TABLE artist_profiles
  ADD COLUMN IF NOT EXISTS talent_type VARCHAR(40) DEFAULT 'performer';

COMMENT ON COLUMN artist_profiles.talent_type IS
  'musician|actor|director|influencer|comedian|dancer|athlete|speaker|model|dj|host|specialty|other';

CREATE INDEX IF NOT EXISTS idx_artist_profiles_talent_type
  ON artist_profiles (talent_type);

-- Multi-currency ready defaults stay per-package; no hard GHS lock beyond default.

-- ── Expand Film & Talent → Film, TV & Talent (directors, crew, actors) ──
UPDATE categories SET
  name = 'Film, TV & Talent',
  icon = 'film-outline',
  description = 'Actors, actresses, directors, producers and screen talent available for booking worldwide.',
  sort_order = 14,
  is_active = TRUE
WHERE id = 'c1000000-0000-0000-0000-000000000014'
   OR name IN ('Film & Talent', 'Film, TV & Talent');

INSERT INTO categories (id, name, icon, description, color, sort_order, is_active) VALUES
(
  'c1000000-0000-0000-0000-000000000014',
  'Film, TV & Talent',
  'film-outline',
  'Actors, actresses, directors, producers and screen talent available for booking worldwide.',
  '#DB2777', 14, TRUE
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

CREATE TABLE IF NOT EXISTS worker_subtypes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000014', v.name, v.sort_order
FROM (VALUES
  ('Movie Actor / Actress', 1),
  ('Movie Actor', 2),
  ('Movie Actress', 3),
  ('TV Actor / Actress', 4),
  ('Voice Actor', 5),
  ('Extra / Background Actor', 6),
  ('Model (Events / Commercial)', 7),
  ('Script / Content Actor', 8),
  ('Presenter / Host', 9),
  ('Movie Director', 10),
  ('TV Director', 11),
  ('Assistant Director (AD)', 12),
  ('Film Producer', 13),
  ('Casting Director', 14),
  ('Cinematographer / DoP', 15),
  ('Screenwriter', 16),
  ('Film Editor', 17),
  ('Production Designer', 18),
  ('Costume Designer', 19),
  ('Makeup Artist (Film / TV)', 20),
  ('Stunt Performer', 21),
  ('Location Manager', 22),
  ('Continuity / Script Supervisor', 23)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_subtypes ws
  WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000014' AND ws.name = v.name
);

-- Music: add global genres/roles (not country-specific only)
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000013', v.name, v.sort_order
FROM (VALUES
  ('Pop Artist', 20),
  ('Afrobeats Artist', 21),
  ('R&B / Soul Artist', 22),
  ('Jazz Musician', 23),
  ('Classical Musician', 24),
  ('Orchestra / Ensemble', 25),
  ('DJ (Club / Wedding)', 26),
  ('Music Producer', 27),
  ('Songwriter', 28),
  ('Backup Dancer (Music)', 29)
) AS v(name, sort_order)
WHERE EXISTS (SELECT 1 FROM categories WHERE id = 'c1000000-0000-0000-0000-000000000013')
  AND NOT EXISTS (
    SELECT 1 FROM worker_subtypes ws
    WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000013' AND ws.name = v.name
  );

-- ── New global parent categories ──────────────────────────────
INSERT INTO categories (id, name, icon, description, color, sort_order, is_active) VALUES
(
  'c1000000-0000-0000-0000-000000000025',
  'Comedy & Spoken Word',
  'happy-outline',
  'Comedians, spoken-word artists and comedy troupes for shows and events worldwide.',
  '#F59E0B', 25, TRUE
),
(
  'c1000000-0000-0000-0000-000000000026',
  'Dance & Choreography',
  'walk-outline',
  'Dancers, choreographers and dance crews for stage, video and events.',
  '#E11D48', 26, TRUE
),
(
  'c1000000-0000-0000-0000-000000000027',
  'Influencers & Celebrity Appearances',
  'sparkles-outline',
  'Influencers, celebrities and public figures for appearances, launches and brand days.',
  '#8B5CF6', 27, TRUE
),
(
  'c1000000-0000-0000-0000-000000000028',
  'Public Speaking & Thought Leadership',
  'mic-outline',
  'Keynote speakers, trainers and industry experts for conferences and corporate events.',
  '#0EA5E9', 28, TRUE
),
(
  'c1000000-0000-0000-0000-000000000029',
  'Theatre & Stage Performance',
  'ticket-outline',
  'Stage actors, theatre directors and live theatre professionals.',
  '#BE185D', 29, TRUE
),
(
  'c1000000-0000-0000-0000-000000000030',
  'Magicians & Specialty Acts',
  'color-wand-outline',
  'Magicians, illusionists, circus and specialty entertainment acts.',
  '#7C3AED', 30, TRUE
),
(
  'c1000000-0000-0000-0000-000000000031',
  'Gaming & Esports Talent',
  'game-controller-outline',
  'Esports players, streamers and gaming personalities for events and appearances.',
  '#22C55E', 31, TRUE
),
(
  'c1000000-0000-0000-0000-000000000032',
  'Wedding & Ceremonial Services',
  'heart-outline',
  'Wedding planners, officiants, coordinators and ceremonial specialists.',
  '#F43F5E', 32, TRUE
),
(
  'c1000000-0000-0000-0000-000000000033',
  'Pet Care & Animal Services',
  'paw-outline',
  'Pet sitters, dog walkers, groomers and animal care professionals.',
  '#A16207', 33, TRUE
),
(
  'c1000000-0000-0000-0000-000000000034',
  'Handyman & General Home Services',
  'build-outline',
  'Handymen and general home repair and assembly professionals.',
  '#57534E', 34, TRUE
),
(
  'c1000000-0000-0000-0000-000000000035',
  'HVAC & Climate Control',
  'thermometer-outline',
  'Heating, ventilation, air conditioning and climate system technicians.',
  '#0284C7', 35, TRUE
),
(
  'c1000000-0000-0000-0000-000000000036',
  'Locksmith & Key Services',
  'key-outline',
  'Locksmiths, key cutters and access hardware technicians.',
  '#44403C', 36, TRUE
),
(
  'c1000000-0000-0000-0000-000000000037',
  'Translation & Language Services',
  'language-outline',
  'Translators, interpreters and language tutors for hire.',
  '#4F46E5', 37, TRUE
),
(
  'c1000000-0000-0000-0000-000000000038',
  'Spiritual & Faith Services',
  'moon-outline',
  'Officiants, worship leaders and faith-based service providers for events.',
  '#6366F1', 38, TRUE
),
(
  'c1000000-0000-0000-0000-000000000039',
  'Childcare & Nanny Services',
  'happy-outline',
  'Professional childcare, nannies and after-school helpers.',
  '#DB2777', 39, TRUE
),
(
  'c1000000-0000-0000-0000-000000000040',
  'Moving, Packing & Storage',
  'cube-outline',
  'Movers, packers and storage helpers for homes and offices.',
  '#0F766E', 40, TRUE
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- Subtypes for new categories
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000025', v.name, v.sort_order
FROM (VALUES
  ('Stand-up Comedian', 1), ('Comedy Troupe', 2), ('Spoken Word Artist', 3),
  ('Roast / Host Comedian', 4), ('Improv Performer', 5)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000025' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000026', v.name, v.sort_order
FROM (VALUES
  ('Contemporary Dancer', 1), ('Ballet Dancer', 2), ('Hip-Hop Dancer', 3),
  ('Choreographer', 4), ('Dance Crew', 5), ('Traditional / Cultural Dancer', 6),
  ('Ballroom / Latin Dancer', 7)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000026' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000027', v.name, v.sort_order
FROM (VALUES
  ('Social Media Influencer', 1), ('Celebrity Appearance', 2), ('Brand Ambassador (Bookable)', 3),
  ('Content Creator (Appearances)', 4), ('Reality TV Personality', 5), ('Sports Celebrity Appearance', 6)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000027' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000028', v.name, v.sort_order
FROM (VALUES
  ('Keynote Speaker', 1), ('Motivational Speaker', 2), ('Corporate Trainer', 3),
  ('Panelist / Moderator', 4), ('Workshop Facilitator', 5), ('TEDx / Conference Speaker', 6)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000028' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000029', v.name, v.sort_order
FROM (VALUES
  ('Stage Actor / Actress', 1), ('Theatre Director', 2), ('Musical Theatre Performer', 3),
  ('Stage Manager', 4), ('Playwright', 5)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000029' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000030', v.name, v.sort_order
FROM (VALUES
  ('Magician', 1), ('Illusionist', 2), ('Circus Performer', 3),
  ('Fire / Specialty Act', 4), ('Puppeteer', 5), ('Clowns / Kids Entertainer', 6)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000030' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000031', v.name, v.sort_order
FROM (VALUES
  ('Esports Player', 1), ('Live Streamer (Appearances)', 2), ('Gaming Coach', 3),
  ('Tournament Host / Caster', 4)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000031' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000032', v.name, v.sort_order
FROM (VALUES
  ('Wedding Planner', 1), ('Wedding Coordinator', 2), ('Wedding Officiant', 3),
  ('Bridal Assistant', 4), ('Ceremony Decorator', 5)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000032' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000033', v.name, v.sort_order
FROM (VALUES
  ('Dog Walker', 1), ('Pet Sitter', 2), ('Pet Groomer', 3),
  ('Pet Trainer', 4), ('Mobile Vet Assistant', 5)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000033' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000034', v.name, v.sort_order
FROM (VALUES
  ('Handyman', 1), ('Furniture Assembler', 2), ('Door / Window Repairer', 3),
  ('Drywall / Patch Repairer', 4), ('General Home Fixer', 5)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000034' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000035', v.name, v.sort_order
FROM (VALUES
  ('HVAC Technician', 1), ('AC Installer / Repairer', 2), ('Heating Technician', 3),
  ('Ventilation Specialist', 4)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000035' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000036', v.name, v.sort_order
FROM (VALUES
  ('Locksmith', 1), ('Automotive Locksmith', 2), ('Safe Technician', 3), ('Key Cutter', 4)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000036' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000037', v.name, v.sort_order
FROM (VALUES
  ('Translator (Written)', 1), ('Interpreter (Live)', 2), ('Conference Interpreter', 3),
  ('Sign Language Interpreter', 4), ('Document Translator', 5)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000037' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000038', v.name, v.sort_order
FROM (VALUES
  ('Wedding / Event Officiant', 1), ('Worship Leader', 2), ('Pastor / Minister (Events)', 3),
  ('Imam / Faith Officiant (Events)', 4), ('Choir Coordinator', 5)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000038' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000039', v.name, v.sort_order
FROM (VALUES
  ('Nanny', 1), ('Babysitter', 2), ('After-School Helper', 3), ('Special Needs Carer (Child)', 4)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000039' AND ws.name = v.name);

INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000040', v.name, v.sort_order
FROM (VALUES
  ('Home Mover', 1), ('Office Mover', 2), ('Packing Specialist', 3),
  ('Furniture Mover', 4), ('Storage Helper', 5)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM worker_subtypes ws WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000040' AND ws.name = v.name);
