-- © 2026 WiamApp. Powered by WiamLabs
-- 039_expand_service_categories.sql
-- Broaden WiamApp beyond "phone repair only" — real Ghana service economy.
-- APPEND only. Aligns legacy short category names + expands electronics & new verticals.

-- ── Align legacy category names with mobile skills.js ─────────
UPDATE categories SET name = 'Building & Construction', description = 'Heavy-duty tradespeople who build structures, renovate, and do major construction work.'
WHERE id = 'c1000000-0000-0000-0000-000000000001';
UPDATE categories SET name = 'Plumbing & Water Systems', description = 'All plumbing, water supply, drainage, and water system specialists.'
WHERE id = 'c1000000-0000-0000-0000-000000000002';
UPDATE categories SET name = 'Electrical & Power Engineering', description = 'Electricians, solar installers, generator mechanics and power specialists.'
WHERE id = 'c1000000-0000-0000-0000-000000000003';
UPDATE categories SET name = 'Automotive & Mechanical Repair', description = 'Car mechanics, auto electricians, and all vehicle repair specialists.'
WHERE id = 'c1000000-0000-0000-0000-000000000004';
UPDATE categories SET name = 'Finishing, Painting & Decor', description = 'Painters, ceiling designers, interior decorators and finishing specialists.'
WHERE id = 'c1000000-0000-0000-0000-000000000005';
UPDATE categories SET name = 'Cleaning & Property Maintenance', description = 'Cleaners, fumigators, pest control and property maintenance workers.'
WHERE id = 'c1000000-0000-0000-0000-000000000006';
UPDATE categories SET name = 'Hair, Beauty & Personal Care', description = 'Barbers, hairstylists, makeup artists, nail technicians and beauty professionals.'
WHERE id = 'c1000000-0000-0000-0000-000000000007';
UPDATE categories SET name = 'Hospitality, Catering & Food', description = 'Event caterers, private chefs, bakers and food service professionals.'
WHERE id = 'c1000000-0000-0000-0000-000000000008';
UPDATE categories SET name = 'Photography, Media & Creative', description = 'Photographers, videographers, drone operators and creative professionals.'
WHERE id = 'c1000000-0000-0000-0000-000000000009';
UPDATE categories SET name = 'Logistics, Transport & Delivery', description = 'Dispatch riders, delivery drivers, movers and transport professionals.'
WHERE id = 'c1000000-0000-0000-0000-000000000010';
UPDATE categories SET name = 'Education, Tuition & Lessons', description = 'Tutors, teachers and skill instructors.'
WHERE id = 'c1000000-0000-0000-0000-000000000011';
UPDATE categories SET name = 'Events, Entertainment & Sound', description = 'DJs, MCs, event planners and entertainment crews.'
WHERE id = 'c1000000-0000-0000-0000-000000000012';

-- ── Rename / expand phones category into full electronics & appliances ──
UPDATE categories SET
  name = 'Electronics & Appliances Repair',
  icon = 'tv-outline',
  description = 'TV, fridge, phone, laptop, washing machine and home electronics repair — service booking only, not product sales.',
  color = '#0EA5E9',
  sort_order = 15,
  is_active = TRUE
WHERE id = 'c1000000-0000-0000-0000-000000000015'
   OR name = 'Phones & Gadgets Repair';

-- Ensure the category exists even if 037 was never run
INSERT INTO categories (id, name, icon, description, color, sort_order, is_active) VALUES
(
  'c1000000-0000-0000-0000-000000000015',
  'Electronics & Appliances Repair',
  'tv-outline',
  'TV, fridge, phone, laptop, washing machine and home electronics repair — service booking only, not product sales.',
  '#0EA5E9', 15, TRUE
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

-- Electronics & Appliances subtypes (append)
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000015', v.name, v.sort_order
FROM (VALUES
  ('Phone Repairer', 1),
  ('Phone Screen Replacement', 2),
  ('Phone Software / Unlock Technician', 3),
  ('Tablet Repairer', 4),
  ('Laptop Repairer', 5),
  ('Gadget Repair Technician', 6),
  ('TV / LED Repairer', 7),
  ('Fridge / Freezer Repairer', 8),
  ('Washing Machine Repairer', 9),
  ('Microwave Repairer', 10),
  ('Home Theatre / Sound System Repairer', 11),
  ('Decoder / DSTV Technician', 12),
  ('Blender / Small Appliance Repairer', 13),
  ('Iron / Fan Repairer', 14),
  ('Printer / Photocopier Repairer', 15),
  ('Game Console Repairer', 16)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_subtypes ws
  WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000015'
    AND ws.name = v.name
);

-- ── New parent categories ─────────────────────────────────────
INSERT INTO categories (id, name, icon, description, color, sort_order, is_active) VALUES
(
  'c1000000-0000-0000-0000-000000000016',
  'Fashion, Tailoring & Textiles',
  'shirt-outline',
  'Tailors, fashion designers, seamstresses and textile craftspeople.',
  '#EC4899', 16, TRUE
),
(
  'c1000000-0000-0000-0000-000000000017',
  'Gardening, Farming & Outdoor',
  'leaf-outline',
  'Gardeners, landscapers, farm helpers and outdoor grounds workers.',
  '#16A34A', 17, TRUE
),
(
  'c1000000-0000-0000-0000-000000000018',
  'Security & Guarding',
  'shield-checkmark-outline',
  'Security guards, watchmen and site protection services.',
  '#475569', 18, TRUE
),
(
  'c1000000-0000-0000-0000-000000000019',
  'IT, Computers & Digital Services',
  'desktop-outline',
  'Computer technicians, network installers, software helpers and digital freelancers.',
  '#2563EB', 19, TRUE
),
(
  'c1000000-0000-0000-0000-000000000020',
  'Domestic Help & Caregiving',
  'people-outline',
  'House helps, nannies, caregivers and home support workers.',
  '#A855F7', 20, TRUE
),
(
  'c1000000-0000-0000-0000-000000000021',
  'Printing, Signage & Branding',
  'print-outline',
  'Printers, sign writers, branding and promotional product makers.',
  '#EA580C', 21, TRUE
),
(
  'c1000000-0000-0000-0000-000000000022',
  'Furniture & Upholstery',
  'bed-outline',
  'Furniture makers, upholsterers and wood finish specialists.',
  '#92400E', 22, TRUE
),
(
  'c1000000-0000-0000-0000-000000000023',
  'Fitness, Sports & Coaching',
  'barbell-outline',
  'Personal trainers, sports coaches and fitness instructors.',
  '#DC2626', 23, TRUE
),
(
  'c1000000-0000-0000-0000-000000000024',
  'Welding, Metal & Fabrication',
  'hammer-outline',
  'Welders, metal fabricators, aluminium and steel workers (standalone booking).',
  '#64748B', 24, TRUE
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- Fashion
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000016', v.name, v.sort_order
FROM (VALUES
  ('Tailor / Seamstress', 1),
  ('Fashion Designer', 2),
  ('Kente / Traditional Cloth Weaver', 3),
  ('Shoe Maker / Cobbler', 4),
  ('Bag Maker', 5),
  ('Embroidery Specialist', 6),
  ('Curtain / Soft Furnishings Maker', 7),
  ('Bridal / Occasion Wear Stylist', 8)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_subtypes ws
  WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000016' AND ws.name = v.name
);

-- Gardening / Farming
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000017', v.name, v.sort_order
FROM (VALUES
  ('Gardener', 1),
  ('Landscaper', 2),
  ('Lawn / Grass Cutter', 3),
  ('Tree Feller / Pruner', 4),
  ('Farm Hand / Agricultural Helper', 5),
  ('Irrigation Installer', 6),
  ('Poultry / Livestock Helper', 7),
  ('Greenhouse Technician', 8)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_subtypes ws
  WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000017' AND ws.name = v.name
);

-- Security
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000018', v.name, v.sort_order
FROM (VALUES
  ('Security Guard', 1),
  ('Watchman / Night Guard', 2),
  ('Site Security Supervisor', 3),
  ('Event Security (Guard)', 4),
  ('Door / Access Control Guard', 5),
  ('Cash-in-Transit Guard', 6)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_subtypes ws
  WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000018' AND ws.name = v.name
);

-- IT
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000019', v.name, v.sort_order
FROM (VALUES
  ('Computer Technician', 1),
  ('Network / Wi‑Fi Installer', 2),
  ('Software / OS Installer', 3),
  ('Data Recovery Specialist', 4),
  ('CCTV / Network Cabling Tech', 5),
  ('Web / App Freelancer', 6),
  ('POS / Business Software Setup', 7),
  ('Cyber Cafe / Printing Operator', 8)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_subtypes ws
  WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000019' AND ws.name = v.name
);

-- Domestic
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000020', v.name, v.sort_order
FROM (VALUES
  ('House Help / Domestic Worker', 1),
  ('Nanny / Childcare', 2),
  ('Elderly Caregiver', 3),
  ('Cook (Home)', 4),
  ('Driver (Family / Personal)', 5),
  ('Laundry Helper', 6),
  ('Live-in House Manager', 7)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_subtypes ws
  WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000020' AND ws.name = v.name
);

-- Printing
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000021', v.name, v.sort_order
FROM (VALUES
  ('Offset / Digital Printer', 1),
  ('Sign Writer / Signage Maker', 2),
  ('Large Format Banner Printer', 3),
  ('T-Shirt / Merchandise Printer', 4),
  ('Business Card / Branding Designer', 5),
  ('Vehicle Branding Installer', 6),
  ('Stamp / Seal Maker', 7)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_subtypes ws
  WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000021' AND ws.name = v.name
);

-- Furniture
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000022', v.name, v.sort_order
FROM (VALUES
  ('Furniture Maker / Carpenter', 1),
  ('Upholsterer', 2),
  ('Mattress Maker / Repairer', 3),
  ('Cabinet Maker', 4),
  ('Furniture Polisher / Restorer', 5),
  ('Aluminium / Glass Furniture Worker', 6)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_subtypes ws
  WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000022' AND ws.name = v.name
);

-- Fitness
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000023', v.name, v.sort_order
FROM (VALUES
  ('Personal Trainer', 1),
  ('Football / Sports Coach', 2),
  ('Fitness Instructor', 3),
  ('Yoga / Wellness Coach', 4),
  ('Boxing / Martial Arts Coach', 5),
  ('Swimming Instructor', 6)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_subtypes ws
  WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000023' AND ws.name = v.name
);

-- Welding (standalone — also still listed under Building)
INSERT INTO worker_subtypes (category_id, name, sort_order)
SELECT 'c1000000-0000-0000-0000-000000000024', v.name, v.sort_order
FROM (VALUES
  ('Welder / Fabricator', 1),
  ('Aluminium Fabricator', 2),
  ('Steel Door / Gate Maker', 3),
  ('Metal Roofing Fabricator', 4),
  ('Blacksmith', 5),
  ('Grill / Burglar Proof Maker', 6)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_subtypes ws
  WHERE ws.category_id = 'c1000000-0000-0000-0000-000000000024' AND ws.name = v.name
);
