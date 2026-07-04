-- ============================================================
-- WIAMAPP — CATEGORIES SEED (12 categories + worker subtypes)
-- (color/sort_order columns are added FIRST so the INSERT works)
-- ============================================================
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color VARCHAR(20);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- ============================================================
-- WIAMAPP â€” COMPLETE CATEGORIES SEED
-- All 12 Service Categories + Worker Types
-- Â© 2026 WiamApp. Powered by WiamLabs
-- ============================================================
-- Run this in Supabase SQL Editor after migrations 001-006
-- ============================================================

-- Clear existing categories first
TRUNCATE categories CASCADE;

-- â”€â”€â”€ INSERT ALL 12 CATEGORIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
INSERT INTO categories (id, name, icon, description, color, sort_order, is_active) VALUES

('c1000000-0000-0000-0000-000000000001',
 'Building & Construction',
 'construct-outline',
 'Heavy-duty tradespeople who build structures, renovate, and do major construction work.',
 '#8B4513', 1, TRUE),

('c1000000-0000-0000-0000-000000000002',
 'Plumbing & Water Systems',
 'water-outline',
 'All plumbing, water supply, drainage, and water system specialists.',
 '#1E90FF', 2, TRUE),

('c1000000-0000-0000-0000-000000000003',
 'Electrical & Power Engineering',
 'flash-outline',
 'Electricians, solar installers, generator mechanics and power specialists.',
 '#FFD700', 3, TRUE),

('c1000000-0000-0000-0000-000000000004',
 'Automotive & Mechanical Repair',
 'car-outline',
 'Car mechanics, auto electricians, and all vehicle repair specialists.',
 '#FF4500', 4, TRUE),

('c1000000-0000-0000-0000-000000000005',
 'Finishing, Painting & Decor',
 'brush-outline',
 'Painters, ceiling designers, interior decorators and finishing specialists.',
 '#9B59B6', 5, TRUE),

('c1000000-0000-0000-0000-000000000006',
 'Cleaning & Property Maintenance',
 'sparkles-outline',
 'Cleaners, fumigators, pest control and property maintenance workers.',
 '#00CED1', 6, TRUE),

('c1000000-0000-0000-0000-000000000007',
 'Hair, Beauty & Personal Care',
 'cut-outline',
 'Barbers, hairstylists, makeup artists, nail technicians and beauty professionals.',
 '#FF69B4', 7, TRUE),

('c1000000-0000-0000-0000-000000000008',
 'Hospitality, Catering & Food',
 'restaurant-outline',
 'Event caterers, private chefs, bakers and food service professionals.',
 '#FF8C00', 8, TRUE),

('c1000000-0000-0000-0000-000000000009',
 'Photography, Media & Creative',
 'camera-outline',
 'Photographers, videographers, drone operators and creative professionals.',
 '#4169E1', 9, TRUE),

('c1000000-0000-0000-0000-000000000010',
 'Logistics, Transport & Delivery',
 'bicycle-outline',
 'Dispatch riders, delivery drivers, movers and transport professionals.',
 '#228B22', 10, TRUE),

('c1000000-0000-0000-0000-000000000011',
 'Education, Tuition & Lessons',
 'book-outline',
 'Home tutors, language teachers, music instructors and skill tutors.',
 '#8B0000', 11, TRUE),

('c1000000-0000-0000-0000-000000000012',
 'Events, Entertainment & Sound',
 'musical-notes-outline',
 'Event planners, DJs, MCs, sound engineers and event professionals.',
 '#DC143C', 12, TRUE)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;


-- â”€â”€â”€ INSERT WORKER SUBTYPES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- These are the specific worker types under each category
-- Used for more detailed search and filtering

CREATE TABLE IF NOT EXISTS worker_subtypes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
);

-- Building & Construction
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000001', 'Mason / Bricklayer', 1),
('c1000000-0000-0000-0000-000000000001', 'Tile Installer', 2),
('c1000000-0000-0000-0000-000000000001', 'Carpenter (Roofing/Framing)', 3),
('c1000000-0000-0000-0000-000000000001', 'Ironmonger / Steel Bender', 4),
('c1000000-0000-0000-0000-000000000001', 'Welder / Fabricator', 5),
('c1000000-0000-0000-0000-000000000001', 'Concrete Worker', 6),
('c1000000-0000-0000-0000-000000000001', 'Scaffolding Worker', 7),
('c1000000-0000-0000-0000-000000000001', 'Roofing Specialist', 8),
('c1000000-0000-0000-0000-000000000001', 'Foundation Worker', 9),
('c1000000-0000-0000-0000-000000000001', 'Block Layer', 10);

-- Plumbing & Water Systems
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000002', 'Domestic Plumber', 1),
('c1000000-0000-0000-0000-000000000002', 'Borehole Driller', 2),
('c1000000-0000-0000-0000-000000000002', 'Water Tank Installer', 3),
('c1000000-0000-0000-0000-000000000002', 'Drainage Cleaner', 4),
('c1000000-0000-0000-0000-000000000002', 'Pipe Fitter', 5),
('c1000000-0000-0000-0000-000000000002', 'Swimming Pool Technician', 6),
('c1000000-0000-0000-0000-000000000002', 'Water Heater Installer', 7),
('c1000000-0000-0000-0000-000000000002', 'Septic Tank Cleaner', 8);

-- Electrical & Power Engineering
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000003', 'House Wiring Electrician', 1),
('c1000000-0000-0000-0000-000000000003', 'Solar Panel Installer', 2),
('c1000000-0000-0000-0000-000000000003', 'Generator Mechanic', 3),
('c1000000-0000-0000-0000-000000000003', 'Inverter Technician', 4),
('c1000000-0000-0000-0000-000000000003', 'CCTV Installer', 5),
('c1000000-0000-0000-0000-000000000003', 'Satellite Dish Installer', 6),
('c1000000-0000-0000-0000-000000000003', 'Smart Home Installer', 7),
('c1000000-0000-0000-0000-000000000003', 'Security System Installer', 8),
('c1000000-0000-0000-0000-000000000003', 'AC Technician', 9),
('c1000000-0000-0000-0000-000000000003', 'Transformer Technician', 10);

-- Automotive & Mechanical Repair
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000004', 'Car Mechanic', 1),
('c1000000-0000-0000-0000-000000000004', 'Auto Electrician', 2),
('c1000000-0000-0000-0000-000000000004', 'Motorcycle / Tricycle Repairer', 3),
('c1000000-0000-0000-0000-000000000004', 'Car Body Painter / Sprayer', 4),
('c1000000-0000-0000-0000-000000000004', 'Vulcanizer', 5),
('c1000000-0000-0000-0000-000000000004', 'Auto AC Technician', 6),
('c1000000-0000-0000-0000-000000000004', 'Car Wash Specialist', 7),
('c1000000-0000-0000-0000-000000000004', 'Truck Mechanic', 8),
('c1000000-0000-0000-0000-000000000004', 'Panel Beater', 9);

-- Finishing, Painting & Interior Decor
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000005', 'House Painter', 1),
('c1000000-0000-0000-0000-000000000005', 'POP Ceiling Designer', 2),
('c1000000-0000-0000-0000-000000000005', 'Wallpaper Installer', 3),
('c1000000-0000-0000-0000-000000000005', 'Interior Decorator', 4),
('c1000000-0000-0000-0000-000000000005', 'Window Blind Installer', 5),
('c1000000-0000-0000-0000-000000000005', 'Floor Polisher', 6),
('c1000000-0000-0000-0000-000000000005', 'Gypsum Board Installer', 7),
('c1000000-0000-0000-0000-000000000005', 'False Ceiling Worker', 8);

-- Cleaning & Property Maintenance
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000006', 'Deep Cleaner', 1),
('c1000000-0000-0000-0000-000000000006', 'Janitor / Office Cleaner', 2),
('c1000000-0000-0000-0000-000000000006', 'Laundry & Dry Cleaner', 3),
('c1000000-0000-0000-0000-000000000006', 'Fumigation / Pest Control', 4),
('c1000000-0000-0000-0000-000000000006', 'Garbage Collector', 5),
('c1000000-0000-0000-0000-000000000006', 'Post-Construction Cleaner', 6),
('c1000000-0000-0000-0000-000000000006', 'Carpet Cleaner', 7),
('c1000000-0000-0000-0000-000000000006', 'Swimming Pool Cleaner', 8);

-- Hair, Beauty & Personal Care
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000007', 'Barber', 1),
('c1000000-0000-0000-0000-000000000007', 'Hairstylist / Braider', 2),
('c1000000-0000-0000-0000-000000000007', 'Makeup Artist', 3),
('c1000000-0000-0000-0000-000000000007', 'Nail Technician / Manicurist', 4),
('c1000000-0000-0000-0000-000000000007', 'Skincare Therapist', 5),
('c1000000-0000-0000-0000-000000000007', 'Eyebrow Artist', 6),
('c1000000-0000-0000-0000-000000000007', 'Lash Technician', 7),
('c1000000-0000-0000-0000-000000000007', 'Massage Therapist', 8),
('c1000000-0000-0000-0000-000000000007', 'Spa Technician', 9);

-- Hospitality, Catering & Food
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000008', 'Event Caterer', 1),
('c1000000-0000-0000-0000-000000000008', 'Private Chef', 2),
('c1000000-0000-0000-0000-000000000008', 'Baker / Confectioner', 3),
('c1000000-0000-0000-0000-000000000008', 'Cocktail Mixologist', 4),
('c1000000-0000-0000-0000-000000000008', 'Local Food Cook', 5),
('c1000000-0000-0000-0000-000000000008', 'Waiter / Waitress', 6),
('c1000000-0000-0000-0000-000000000008', 'Event Food Vendor', 7),
('c1000000-0000-0000-0000-000000000008', 'Drinks Supplier', 8);

-- Photography, Media & Creative Arts
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000009', 'Event Photographer', 1),
('c1000000-0000-0000-0000-000000000009', 'Videographer', 2),
('c1000000-0000-0000-0000-000000000009', 'Drone Operator', 3),
('c1000000-0000-0000-0000-000000000009', 'Video Editor', 4),
('c1000000-0000-0000-0000-000000000009', 'Graphic Designer', 5),
('c1000000-0000-0000-0000-000000000009', 'Photo Editor', 6),
('c1000000-0000-0000-0000-000000000009', 'Social Media Content Creator', 7),
('c1000000-0000-0000-0000-000000000009', 'Brand Identity Designer', 8);

-- Logistics, Transport & Delivery
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000010', 'Dispatch Rider', 1),
('c1000000-0000-0000-0000-000000000010', 'Delivery Driver', 2),
('c1000000-0000-0000-0000-000000000010', 'Truck / Hauling Driver', 3),
('c1000000-0000-0000-0000-000000000010', 'Private Driver', 4),
('c1000000-0000-0000-0000-000000000010', 'Courier Assistant', 5),
('c1000000-0000-0000-0000-000000000010', 'Airport Pickup Driver', 6),
('c1000000-0000-0000-0000-000000000010', 'Moving Company Worker', 7),
('c1000000-0000-0000-0000-000000000010', 'Cargo Handler', 8);

-- Education, Tuition & Home Lessons
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000011', 'Home Tutor (Math/Science)', 1),
('c1000000-0000-0000-0000-000000000011', 'Language Instructor', 2),
('c1000000-0000-0000-0000-000000000011', 'Music Teacher (Piano/Guitar)', 3),
('c1000000-0000-0000-0000-000000000011', 'Coding / Tech Tutor', 4),
('c1000000-0000-0000-0000-000000000011', 'WAEC / BECE Specialist', 5),
('c1000000-0000-0000-0000-000000000011', 'Early Childhood Educator', 6),
('c1000000-0000-0000-0000-000000000011', 'Adult Literacy Teacher', 7),
('c1000000-0000-0000-0000-000000000011', 'Sign Language Tutor', 8);

-- Events, Entertainment & Sound
INSERT INTO worker_subtypes (category_id, name, sort_order) VALUES
('c1000000-0000-0000-0000-000000000012', 'Event Planner', 1),
('c1000000-0000-0000-0000-000000000012', 'DJ', 2),
('c1000000-0000-0000-0000-000000000012', 'MC / Master of Ceremonies', 3),
('c1000000-0000-0000-0000-000000000012', 'Sound Engineer', 4),
('c1000000-0000-0000-0000-000000000012', 'Stage / Lighting Designer', 5),
('c1000000-0000-0000-0000-000000000012', 'Usher', 6),
('c1000000-0000-0000-0000-000000000012', 'Balloon Decorator', 7),
('c1000000-0000-0000-0000-000000000012', 'Event Security', 8),
('c1000000-0000-0000-0000-000000000012', 'Tent & Chair Supplier', 9),
('c1000000-0000-0000-0000-000000000012', 'Photo Booth Operator', 10);

-- Add color column to categories if not exists
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color VARCHAR(20);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- Update colors
UPDATE categories SET color = '#8B4513', sort_order = 1  WHERE id = 'c1000000-0000-0000-0000-000000000001';
UPDATE categories SET color = '#1E90FF', sort_order = 2  WHERE id = 'c1000000-0000-0000-0000-000000000002';
UPDATE categories SET color = '#FFD700', sort_order = 3  WHERE id = 'c1000000-0000-0000-0000-000000000003';
UPDATE categories SET color = '#FF4500', sort_order = 4  WHERE id = 'c1000000-0000-0000-0000-000000000004';
UPDATE categories SET color = '#9B59B6', sort_order = 5  WHERE id = 'c1000000-0000-0000-0000-000000000005';
UPDATE categories SET color = '#00CED1', sort_order = 6  WHERE id = 'c1000000-0000-0000-0000-000000000006';
UPDATE categories SET color = '#FF69B4', sort_order = 7  WHERE id = 'c1000000-0000-0000-0000-000000000007';
UPDATE categories SET color = '#FF8C00', sort_order = 8  WHERE id = 'c1000000-0000-0000-0000-000000000008';
UPDATE categories SET color = '#4169E1', sort_order = 9  WHERE id = 'c1000000-0000-0000-0000-000000000009';
UPDATE categories SET color = '#228B22', sort_order = 10 WHERE id = 'c1000000-0000-0000-0000-000000000010';
UPDATE categories SET color = '#8B0000', sort_order = 11 WHERE id = 'c1000000-0000-0000-0000-000000000011';
UPDATE categories SET color = '#DC143C', sort_order = 12 WHERE id = 'c1000000-0000-0000-0000-000000000012';

