// © 2026 WiamApp. Powered by WiamLabs
// constants/skills.js — Official skills WiamApp offers (categories + subtypes)

export const WIAMAPP_CATEGORIES = [
  'Building & Construction',
  'Plumbing & Water Systems',
  'Electrical & Power Engineering',
  'Automotive & Mechanical Repair',
  'Finishing, Painting & Decor',
  'Cleaning & Property Maintenance',
  'Hair, Beauty & Personal Care',
  'Hospitality, Catering & Food',
  'Photography, Media & Creative',
  'Logistics, Transport & Delivery',
  'Education, Tuition & Lessons',
  'Events, Entertainment & Sound',
];

/** Each skill maps to a parent category used by the backend categories table */
export const WIAMAPP_SKILLS = [
  // Building & Construction
  { name: 'Mason / Bricklayer', category: 'Building & Construction' },
  { name: 'Tile Installer', category: 'Building & Construction' },
  { name: 'Carpenter (Roofing/Framing)', category: 'Building & Construction' },
  { name: 'Carpenter', category: 'Building & Construction' },
  { name: 'Ironmonger / Steel Bender', category: 'Building & Construction' },
  { name: 'Welder / Fabricator', category: 'Building & Construction' },
  { name: 'Concrete Worker', category: 'Building & Construction' },
  { name: 'Scaffolding Worker', category: 'Building & Construction' },
  { name: 'Roofing Specialist', category: 'Building & Construction' },
  { name: 'Foundation Worker', category: 'Building & Construction' },
  { name: 'Block Layer', category: 'Building & Construction' },

  // Plumbing
  { name: 'Domestic Plumber', category: 'Plumbing & Water Systems' },
  { name: 'Plumber', category: 'Plumbing & Water Systems' },
  { name: 'Borehole Driller', category: 'Plumbing & Water Systems' },
  { name: 'Water Tank Installer', category: 'Plumbing & Water Systems' },
  { name: 'Drainage Cleaner', category: 'Plumbing & Water Systems' },
  { name: 'Pipe Fitter', category: 'Plumbing & Water Systems' },
  { name: 'Swimming Pool Technician', category: 'Plumbing & Water Systems' },
  { name: 'Water Heater Installer', category: 'Plumbing & Water Systems' },
  { name: 'Septic Tank Cleaner', category: 'Plumbing & Water Systems' },

  // Electrical
  { name: 'House Wiring Electrician', category: 'Electrical & Power Engineering' },
  { name: 'Electrician', category: 'Electrical & Power Engineering' },
  { name: 'Solar Panel Installer', category: 'Electrical & Power Engineering' },
  { name: 'Generator Mechanic', category: 'Electrical & Power Engineering' },
  { name: 'Inverter Technician', category: 'Electrical & Power Engineering' },
  { name: 'CCTV Installer', category: 'Electrical & Power Engineering' },
  { name: 'Satellite Dish Installer', category: 'Electrical & Power Engineering' },
  { name: 'Smart Home Installer', category: 'Electrical & Power Engineering' },
  { name: 'Security System Installer', category: 'Electrical & Power Engineering' },
  { name: 'AC Technician', category: 'Electrical & Power Engineering' },
  { name: 'Transformer Technician', category: 'Electrical & Power Engineering' },

  // Automotive
  { name: 'Car Mechanic', category: 'Automotive & Mechanical Repair' },
  { name: 'Mechanic / Auto', category: 'Automotive & Mechanical Repair' },
  { name: 'Auto Electrician', category: 'Automotive & Mechanical Repair' },
  { name: 'Motorcycle / Tricycle Repairer', category: 'Automotive & Mechanical Repair' },
  { name: 'Car Body Painter / Sprayer', category: 'Automotive & Mechanical Repair' },
  { name: 'Vulcanizer', category: 'Automotive & Mechanical Repair' },
  { name: 'Auto AC Technician', category: 'Automotive & Mechanical Repair' },
  { name: 'Car Wash Specialist', category: 'Automotive & Mechanical Repair' },
  { name: 'Truck Mechanic', category: 'Automotive & Mechanical Repair' },
  { name: 'Panel Beater', category: 'Automotive & Mechanical Repair' },

  // Finishing
  { name: 'House Painter', category: 'Finishing, Painting & Decor' },
  { name: 'Painter', category: 'Finishing, Painting & Decor' },
  { name: 'POP Ceiling Designer', category: 'Finishing, Painting & Decor' },
  { name: 'Wallpaper Installer', category: 'Finishing, Painting & Decor' },
  { name: 'Interior Decorator', category: 'Finishing, Painting & Decor' },
  { name: 'Window Blind Installer', category: 'Finishing, Painting & Decor' },
  { name: 'Floor Polisher', category: 'Finishing, Painting & Decor' },
  { name: 'Gypsum Board Installer', category: 'Finishing, Painting & Decor' },
  { name: 'False Ceiling Worker', category: 'Finishing, Painting & Decor' },

  // Cleaning
  { name: 'Deep Cleaner', category: 'Cleaning & Property Maintenance' },
  { name: 'Cleaner', category: 'Cleaning & Property Maintenance' },
  { name: 'Janitor / Office Cleaner', category: 'Cleaning & Property Maintenance' },
  { name: 'Laundry & Dry Cleaner', category: 'Cleaning & Property Maintenance' },
  { name: 'Fumigation / Pest Control', category: 'Cleaning & Property Maintenance' },
  { name: 'Garbage Collector', category: 'Cleaning & Property Maintenance' },
  { name: 'Post-Construction Cleaner', category: 'Cleaning & Property Maintenance' },
  { name: 'Carpet Cleaner', category: 'Cleaning & Property Maintenance' },
  { name: 'Swimming Pool Cleaner', category: 'Cleaning & Property Maintenance' },

  // Beauty
  { name: 'Barber', category: 'Hair, Beauty & Personal Care' },
  { name: 'Barber / Beauty', category: 'Hair, Beauty & Personal Care' },
  { name: 'Hairstylist / Braider', category: 'Hair, Beauty & Personal Care' },
  { name: 'Makeup Artist', category: 'Hair, Beauty & Personal Care' },
  { name: 'Nail Technician / Manicurist', category: 'Hair, Beauty & Personal Care' },
  { name: 'Skincare Therapist', category: 'Hair, Beauty & Personal Care' },
  { name: 'Eyebrow Artist', category: 'Hair, Beauty & Personal Care' },
  { name: 'Lash Technician', category: 'Hair, Beauty & Personal Care' },
  { name: 'Massage Therapist', category: 'Hair, Beauty & Personal Care' },
  { name: 'Spa Technician', category: 'Hair, Beauty & Personal Care' },

  // Food
  { name: 'Event Caterer', category: 'Hospitality, Catering & Food' },
  { name: 'Caterer / Cook', category: 'Hospitality, Catering & Food' },
  { name: 'Private Chef', category: 'Hospitality, Catering & Food' },
  { name: 'Baker / Confectioner', category: 'Hospitality, Catering & Food' },
  { name: 'Cocktail Mixologist', category: 'Hospitality, Catering & Food' },
  { name: 'Local Food Cook', category: 'Hospitality, Catering & Food' },
  { name: 'Waiter / Waitress', category: 'Hospitality, Catering & Food' },
  { name: 'Event Food Vendor', category: 'Hospitality, Catering & Food' },
  { name: 'Drinks Supplier', category: 'Hospitality, Catering & Food' },

  // Media
  { name: 'Event Photographer', category: 'Photography, Media & Creative' },
  { name: 'Photographer / Videographer', category: 'Photography, Media & Creative' },
  { name: 'Videographer', category: 'Photography, Media & Creative' },
  { name: 'Drone Operator', category: 'Photography, Media & Creative' },
  { name: 'Video Editor', category: 'Photography, Media & Creative' },
  { name: 'Graphic Designer', category: 'Photography, Media & Creative' },
  { name: 'Photo Editor', category: 'Photography, Media & Creative' },
  { name: 'Social Media Content Creator', category: 'Photography, Media & Creative' },
  { name: 'Brand Identity Designer', category: 'Photography, Media & Creative' },

  // Logistics
  { name: 'Dispatch Rider', category: 'Logistics, Transport & Delivery' },
  { name: 'Delivery Rider', category: 'Logistics, Transport & Delivery' },
  { name: 'Delivery Driver', category: 'Logistics, Transport & Delivery' },
  { name: 'Truck / Hauling Driver', category: 'Logistics, Transport & Delivery' },
  { name: 'Private Driver', category: 'Logistics, Transport & Delivery' },
  { name: 'Courier Assistant', category: 'Logistics, Transport & Delivery' },
  { name: 'Airport Pickup Driver', category: 'Logistics, Transport & Delivery' },
  { name: 'Moving Company Worker', category: 'Logistics, Transport & Delivery' },
  { name: 'Cargo Handler', category: 'Logistics, Transport & Delivery' },

  // Education
  { name: 'Home Tutor (Math/Science)', category: 'Education, Tuition & Lessons' },
  { name: 'Teacher / Tutor', category: 'Education, Tuition & Lessons' },
  { name: 'Language Instructor', category: 'Education, Tuition & Lessons' },
  { name: 'Music Teacher (Piano/Guitar)', category: 'Education, Tuition & Lessons' },
  { name: 'Coding / Tech Tutor', category: 'Education, Tuition & Lessons' },
  { name: 'WAEC / BECE Specialist', category: 'Education, Tuition & Lessons' },
  { name: 'Early Childhood Educator', category: 'Education, Tuition & Lessons' },
  { name: 'Adult Literacy Teacher', category: 'Education, Tuition & Lessons' },
  { name: 'Sign Language Tutor', category: 'Education, Tuition & Lessons' },

  // Events
  { name: 'Event Planner', category: 'Events, Entertainment & Sound' },
  { name: 'DJ', category: 'Events, Entertainment & Sound' },
  { name: 'MC / Master of Ceremonies', category: 'Events, Entertainment & Sound' },
  { name: 'Sound Engineer', category: 'Events, Entertainment & Sound' },
  { name: 'Stage / Lighting Designer', category: 'Events, Entertainment & Sound' },
  { name: 'Usher', category: 'Events, Entertainment & Sound' },
  { name: 'Balloon Decorator', category: 'Events, Entertainment & Sound' },
  { name: 'Event Security', category: 'Events, Entertainment & Sound' },
  { name: 'Tent & Chair Supplier', category: 'Events, Entertainment & Sound' },
  { name: 'Photo Booth Operator', category: 'Events, Entertainment & Sound' },
];

/** Also allow typing a parent category name directly */
const CATEGORY_AS_SKILLS = WIAMAPP_CATEGORIES.map((name) => ({
  name,
  category: name,
}));

const ALL = [...WIAMAPP_SKILLS, ...CATEGORY_AS_SKILLS];

export function searchWiamAppSkills(query, limit = 8) {
  const q = (query || '').trim().toLowerCase();
  if (q.length < 1) return [];
  const scored = ALL
    .map((s) => {
      const n = s.name.toLowerCase();
      let score = 0;
      if (n === q) score = 100;
      else if (n.startsWith(q)) score = 80;
      else if (n.includes(q)) score = 50;
      else if (s.category.toLowerCase().includes(q)) score = 20;
      else return null;
      return { ...s, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  // De-dupe by name
  const seen = new Set();
  const out = [];
  for (const s of scored) {
    if (seen.has(s.name.toLowerCase())) continue;
    seen.add(s.name.toLowerCase());
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Exact or close match against official WiamApp skills */
export function resolveWiamAppSkill(input) {
  const q = (input || '').trim().toLowerCase();
  if (!q) return null;
  const exact = ALL.find((s) => s.name.toLowerCase() === q);
  if (exact) return { skillName: exact.name, categoryName: exact.category };
  const starts = ALL.find((s) => s.name.toLowerCase().startsWith(q) && q.length >= 3);
  if (starts) return { skillName: starts.name, categoryName: starts.category };
  return null;
}
