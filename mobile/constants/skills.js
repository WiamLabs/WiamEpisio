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
  'Music & Live Performance',
  'Film, TV & Talent',
  'Electronics & Appliances Repair',
  'Fashion, Tailoring & Textiles',
  'Gardening, Farming & Outdoor',
  'Security & Guarding',
  'IT, Computers & Digital Services',
  'Domestic Help & Caregiving',
  'Printing, Signage & Branding',
  'Furniture & Upholstery',
  'Fitness, Sports & Coaching',
  'Welding, Metal & Fabrication',
  'Comedy & Spoken Word',
  'Dance & Choreography',
  'Influencers & Celebrity Appearances',
  'Public Speaking & Thought Leadership',
  'Theatre & Stage Performance',
  'Magicians & Specialty Acts',
  'Gaming & Esports Talent',
  'Wedding & Ceremonial Services',
  'Pet Care & Animal Services',
  'Handyman & General Home Services',
  'HVAC & Climate Control',
  'Locksmith & Key Services',
  'Translation & Language Services',
  'Spiritual & Faith Services',
  'Childcare & Nanny Services',
  'Moving, Packing & Storage',
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
  { name: 'Live Singer', category: 'Events, Entertainment & Sound' },
  { name: 'Backing Vocalist', category: 'Events, Entertainment & Sound' },
  { name: 'Praise & Worship Leader', category: 'Events, Entertainment & Sound' },

  // Music & Live Performance (global)
  { name: 'Musician (Solo)', category: 'Music & Live Performance' },
  { name: 'Musician', category: 'Music & Live Performance' },
  { name: 'Band / Group', category: 'Music & Live Performance' },
  { name: 'Gospel Artist', category: 'Music & Live Performance' },
  { name: 'Rapper / Hip-Hop Artist', category: 'Music & Live Performance' },
  { name: 'Highlife / Traditional Performer', category: 'Music & Live Performance' },
  { name: 'Afrobeats Artist', category: 'Music & Live Performance' },
  { name: 'Pop Artist', category: 'Music & Live Performance' },
  { name: 'R&B / Soul Artist', category: 'Music & Live Performance' },
  { name: 'Jazz Musician', category: 'Music & Live Performance' },
  { name: 'Classical Musician', category: 'Music & Live Performance' },
  { name: 'Orchestra / Ensemble', category: 'Music & Live Performance' },
  { name: 'Session Musician', category: 'Music & Live Performance' },
  { name: 'Choir Director', category: 'Music & Live Performance' },
  { name: 'DJ (Club / Wedding)', category: 'Music & Live Performance' },
  { name: 'Music Producer', category: 'Music & Live Performance' },
  { name: 'Songwriter', category: 'Music & Live Performance' },
  { name: 'Instrumentalist (Guitar)', category: 'Music & Live Performance' },
  { name: 'Instrumentalist (Keys)', category: 'Music & Live Performance' },
  { name: 'Instrumentalist (Drums)', category: 'Music & Live Performance' },
  { name: 'Instrumentalist (Bass)', category: 'Music & Live Performance' },
  { name: 'Backup Dancer (Music)', category: 'Music & Live Performance' },

  // Film, TV & Talent — actors, directors, crew (bookable worldwide)
  { name: 'Movie Actor / Actress', category: 'Film, TV & Talent' },
  { name: 'Movie Actor', category: 'Film, TV & Talent' },
  { name: 'Movie Actress', category: 'Film, TV & Talent' },
  { name: 'TV Actor / Actress', category: 'Film, TV & Talent' },
  { name: 'Voice Actor', category: 'Film, TV & Talent' },
  { name: 'Extra / Background Actor', category: 'Film, TV & Talent' },
  { name: 'Model (Events / Commercial)', category: 'Film, TV & Talent' },
  { name: 'Script / Content Actor', category: 'Film, TV & Talent' },
  { name: 'Presenter / Host', category: 'Film, TV & Talent' },
  { name: 'Movie Director', category: 'Film, TV & Talent' },
  { name: 'Film Director', category: 'Film, TV & Talent' },
  { name: 'TV Director', category: 'Film, TV & Talent' },
  { name: 'Assistant Director (AD)', category: 'Film, TV & Talent' },
  { name: 'Film Producer', category: 'Film, TV & Talent' },
  { name: 'Casting Director', category: 'Film, TV & Talent' },
  { name: 'Cinematographer / DoP', category: 'Film, TV & Talent' },
  { name: 'Screenwriter', category: 'Film, TV & Talent' },
  { name: 'Film Editor', category: 'Film, TV & Talent' },
  { name: 'Production Designer', category: 'Film, TV & Talent' },
  { name: 'Costume Designer', category: 'Film, TV & Talent' },
  { name: 'Makeup Artist (Film / TV)', category: 'Film, TV & Talent' },
  { name: 'Stunt Performer', category: 'Film, TV & Talent' },
  { name: 'Location Manager', category: 'Film, TV & Talent' },
  { name: 'Continuity / Script Supervisor', category: 'Film, TV & Talent' },

  // Electronics & Appliances Repair (service only — not product sales)
  { name: 'Phone Repairer', category: 'Electronics & Appliances Repair' },
  { name: 'Phone Screen Replacement', category: 'Electronics & Appliances Repair' },
  { name: 'Phone Software / Unlock Technician', category: 'Electronics & Appliances Repair' },
  { name: 'Tablet Repairer', category: 'Electronics & Appliances Repair' },
  { name: 'Laptop Repairer', category: 'Electronics & Appliances Repair' },
  { name: 'Gadget Repair Technician', category: 'Electronics & Appliances Repair' },
  { name: 'TV / LED Repairer', category: 'Electronics & Appliances Repair' },
  { name: 'TV Repairer', category: 'Electronics & Appliances Repair' },
  { name: 'Fridge / Freezer Repairer', category: 'Electronics & Appliances Repair' },
  { name: 'Fridge Repairer', category: 'Electronics & Appliances Repair' },
  { name: 'Washing Machine Repairer', category: 'Electronics & Appliances Repair' },
  { name: 'Microwave Repairer', category: 'Electronics & Appliances Repair' },
  { name: 'Home Theatre / Sound System Repairer', category: 'Electronics & Appliances Repair' },
  { name: 'Decoder / DSTV Technician', category: 'Electronics & Appliances Repair' },
  { name: 'Blender / Small Appliance Repairer', category: 'Electronics & Appliances Repair' },
  { name: 'Iron / Fan Repairer', category: 'Electronics & Appliances Repair' },
  { name: 'Printer / Photocopier Repairer', category: 'Electronics & Appliances Repair' },
  { name: 'Game Console Repairer', category: 'Electronics & Appliances Repair' },

  // Fashion
  { name: 'Tailor / Seamstress', category: 'Fashion, Tailoring & Textiles' },
  { name: 'Tailor', category: 'Fashion, Tailoring & Textiles' },
  { name: 'Fashion Designer', category: 'Fashion, Tailoring & Textiles' },
  { name: 'Kente / Traditional Cloth Weaver', category: 'Fashion, Tailoring & Textiles' },
  { name: 'Shoe Maker / Cobbler', category: 'Fashion, Tailoring & Textiles' },
  { name: 'Bag Maker', category: 'Fashion, Tailoring & Textiles' },
  { name: 'Embroidery Specialist', category: 'Fashion, Tailoring & Textiles' },
  { name: 'Curtain / Soft Furnishings Maker', category: 'Fashion, Tailoring & Textiles' },
  { name: 'Bridal / Occasion Wear Stylist', category: 'Fashion, Tailoring & Textiles' },

  // Gardening / Farming
  { name: 'Gardener', category: 'Gardening, Farming & Outdoor' },
  { name: 'Landscaper', category: 'Gardening, Farming & Outdoor' },
  { name: 'Lawn / Grass Cutter', category: 'Gardening, Farming & Outdoor' },
  { name: 'Tree Feller / Pruner', category: 'Gardening, Farming & Outdoor' },
  { name: 'Farm Hand / Agricultural Helper', category: 'Gardening, Farming & Outdoor' },
  { name: 'Irrigation Installer', category: 'Gardening, Farming & Outdoor' },
  { name: 'Poultry / Livestock Helper', category: 'Gardening, Farming & Outdoor' },
  { name: 'Greenhouse Technician', category: 'Gardening, Farming & Outdoor' },

  // Security
  { name: 'Security Guard', category: 'Security & Guarding' },
  { name: 'Watchman / Night Guard', category: 'Security & Guarding' },
  { name: 'Site Security Supervisor', category: 'Security & Guarding' },
  { name: 'Event Security (Guard)', category: 'Security & Guarding' },
  { name: 'Door / Access Control Guard', category: 'Security & Guarding' },
  { name: 'Cash-in-Transit Guard', category: 'Security & Guarding' },

  // IT
  { name: 'Computer Technician', category: 'IT, Computers & Digital Services' },
  { name: 'Network / Wi‑Fi Installer', category: 'IT, Computers & Digital Services' },
  { name: 'Software / OS Installer', category: 'IT, Computers & Digital Services' },
  { name: 'Data Recovery Specialist', category: 'IT, Computers & Digital Services' },
  { name: 'CCTV / Network Cabling Tech', category: 'IT, Computers & Digital Services' },
  { name: 'Web / App Freelancer', category: 'IT, Computers & Digital Services' },
  { name: 'POS / Business Software Setup', category: 'IT, Computers & Digital Services' },
  { name: 'Cyber Cafe / Printing Operator', category: 'IT, Computers & Digital Services' },

  // Domestic
  { name: 'House Help / Domestic Worker', category: 'Domestic Help & Caregiving' },
  { name: 'House Help', category: 'Domestic Help & Caregiving' },
  { name: 'Nanny / Childcare', category: 'Domestic Help & Caregiving' },
  { name: 'Elderly Caregiver', category: 'Domestic Help & Caregiving' },
  { name: 'Cook (Home)', category: 'Domestic Help & Caregiving' },
  { name: 'Driver (Family / Personal)', category: 'Domestic Help & Caregiving' },
  { name: 'Laundry Helper', category: 'Domestic Help & Caregiving' },
  { name: 'Live-in House Manager', category: 'Domestic Help & Caregiving' },

  // Printing
  { name: 'Offset / Digital Printer', category: 'Printing, Signage & Branding' },
  { name: 'Sign Writer / Signage Maker', category: 'Printing, Signage & Branding' },
  { name: 'Large Format Banner Printer', category: 'Printing, Signage & Branding' },
  { name: 'T-Shirt / Merchandise Printer', category: 'Printing, Signage & Branding' },
  { name: 'Business Card / Branding Designer', category: 'Printing, Signage & Branding' },
  { name: 'Vehicle Branding Installer', category: 'Printing, Signage & Branding' },
  { name: 'Stamp / Seal Maker', category: 'Printing, Signage & Branding' },

  // Furniture
  { name: 'Furniture Maker / Carpenter', category: 'Furniture & Upholstery' },
  { name: 'Upholsterer', category: 'Furniture & Upholstery' },
  { name: 'Mattress Maker / Repairer', category: 'Furniture & Upholstery' },
  { name: 'Cabinet Maker', category: 'Furniture & Upholstery' },
  { name: 'Furniture Polisher / Restorer', category: 'Furniture & Upholstery' },
  { name: 'Aluminium / Glass Furniture Worker', category: 'Furniture & Upholstery' },

  // Fitness
  { name: 'Personal Trainer', category: 'Fitness, Sports & Coaching' },
  { name: 'Football / Sports Coach', category: 'Fitness, Sports & Coaching' },
  { name: 'Fitness Instructor', category: 'Fitness, Sports & Coaching' },
  { name: 'Yoga / Wellness Coach', category: 'Fitness, Sports & Coaching' },
  { name: 'Boxing / Martial Arts Coach', category: 'Fitness, Sports & Coaching' },
  { name: 'Swimming Instructor', category: 'Fitness, Sports & Coaching' },

  // Welding
  { name: 'Aluminium Fabricator', category: 'Welding, Metal & Fabrication' },
  { name: 'Steel Door / Gate Maker', category: 'Welding, Metal & Fabrication' },
  { name: 'Metal Roofing Fabricator', category: 'Welding, Metal & Fabrication' },
  { name: 'Blacksmith', category: 'Welding, Metal & Fabrication' },
  { name: 'Grill / Burglar Proof Maker', category: 'Welding, Metal & Fabrication' },

  // Comedy
  { name: 'Stand-up Comedian', category: 'Comedy & Spoken Word' },
  { name: 'Comedian', category: 'Comedy & Spoken Word' },
  { name: 'Comedy Troupe', category: 'Comedy & Spoken Word' },
  { name: 'Spoken Word Artist', category: 'Comedy & Spoken Word' },
  { name: 'Roast / Host Comedian', category: 'Comedy & Spoken Word' },
  { name: 'Improv Performer', category: 'Comedy & Spoken Word' },

  // Dance
  { name: 'Contemporary Dancer', category: 'Dance & Choreography' },
  { name: 'Ballet Dancer', category: 'Dance & Choreography' },
  { name: 'Hip-Hop Dancer', category: 'Dance & Choreography' },
  { name: 'Choreographer', category: 'Dance & Choreography' },
  { name: 'Dance Crew', category: 'Dance & Choreography' },
  { name: 'Traditional / Cultural Dancer', category: 'Dance & Choreography' },
  { name: 'Ballroom / Latin Dancer', category: 'Dance & Choreography' },

  // Influencers & celebrities
  { name: 'Social Media Influencer', category: 'Influencers & Celebrity Appearances' },
  { name: 'Celebrity Appearance', category: 'Influencers & Celebrity Appearances' },
  { name: 'Brand Ambassador (Bookable)', category: 'Influencers & Celebrity Appearances' },
  { name: 'Content Creator (Appearances)', category: 'Influencers & Celebrity Appearances' },
  { name: 'Reality TV Personality', category: 'Influencers & Celebrity Appearances' },
  { name: 'Sports Celebrity Appearance', category: 'Influencers & Celebrity Appearances' },

  // Speakers
  { name: 'Keynote Speaker', category: 'Public Speaking & Thought Leadership' },
  { name: 'Motivational Speaker', category: 'Public Speaking & Thought Leadership' },
  { name: 'Corporate Trainer', category: 'Public Speaking & Thought Leadership' },
  { name: 'Panelist / Moderator', category: 'Public Speaking & Thought Leadership' },
  { name: 'Workshop Facilitator', category: 'Public Speaking & Thought Leadership' },
  { name: 'TEDx / Conference Speaker', category: 'Public Speaking & Thought Leadership' },

  // Theatre
  { name: 'Stage Actor / Actress', category: 'Theatre & Stage Performance' },
  { name: 'Theatre Director', category: 'Theatre & Stage Performance' },
  { name: 'Musical Theatre Performer', category: 'Theatre & Stage Performance' },
  { name: 'Stage Manager', category: 'Theatre & Stage Performance' },
  { name: 'Playwright', category: 'Theatre & Stage Performance' },

  // Specialty acts
  { name: 'Magician', category: 'Magicians & Specialty Acts' },
  { name: 'Illusionist', category: 'Magicians & Specialty Acts' },
  { name: 'Circus Performer', category: 'Magicians & Specialty Acts' },
  { name: 'Fire / Specialty Act', category: 'Magicians & Specialty Acts' },
  { name: 'Puppeteer', category: 'Magicians & Specialty Acts' },
  { name: 'Clowns / Kids Entertainer', category: 'Magicians & Specialty Acts' },

  // Gaming
  { name: 'Esports Player', category: 'Gaming & Esports Talent' },
  { name: 'Live Streamer (Appearances)', category: 'Gaming & Esports Talent' },
  { name: 'Gaming Coach', category: 'Gaming & Esports Talent' },
  { name: 'Tournament Host / Caster', category: 'Gaming & Esports Talent' },

  // Wedding
  { name: 'Wedding Planner', category: 'Wedding & Ceremonial Services' },
  { name: 'Wedding Coordinator', category: 'Wedding & Ceremonial Services' },
  { name: 'Wedding Officiant', category: 'Wedding & Ceremonial Services' },
  { name: 'Bridal Assistant', category: 'Wedding & Ceremonial Services' },
  { name: 'Ceremony Decorator', category: 'Wedding & Ceremonial Services' },

  // Pets
  { name: 'Dog Walker', category: 'Pet Care & Animal Services' },
  { name: 'Pet Sitter', category: 'Pet Care & Animal Services' },
  { name: 'Pet Groomer', category: 'Pet Care & Animal Services' },
  { name: 'Pet Trainer', category: 'Pet Care & Animal Services' },
  { name: 'Mobile Vet Assistant', category: 'Pet Care & Animal Services' },

  // Handyman
  { name: 'Handyman', category: 'Handyman & General Home Services' },
  { name: 'Furniture Assembler', category: 'Handyman & General Home Services' },
  { name: 'Door / Window Repairer', category: 'Handyman & General Home Services' },
  { name: 'Drywall / Patch Repairer', category: 'Handyman & General Home Services' },
  { name: 'General Home Fixer', category: 'Handyman & General Home Services' },

  // HVAC
  { name: 'HVAC Technician', category: 'HVAC & Climate Control' },
  { name: 'AC Installer / Repairer', category: 'HVAC & Climate Control' },
  { name: 'Heating Technician', category: 'HVAC & Climate Control' },
  { name: 'Ventilation Specialist', category: 'HVAC & Climate Control' },

  // Locksmith
  { name: 'Locksmith', category: 'Locksmith & Key Services' },
  { name: 'Automotive Locksmith', category: 'Locksmith & Key Services' },
  { name: 'Safe Technician', category: 'Locksmith & Key Services' },
  { name: 'Key Cutter', category: 'Locksmith & Key Services' },

  // Translation
  { name: 'Translator (Written)', category: 'Translation & Language Services' },
  { name: 'Interpreter (Live)', category: 'Translation & Language Services' },
  { name: 'Conference Interpreter', category: 'Translation & Language Services' },
  { name: 'Sign Language Interpreter', category: 'Translation & Language Services' },
  { name: 'Document Translator', category: 'Translation & Language Services' },

  // Faith / spiritual (events)
  { name: 'Wedding / Event Officiant', category: 'Spiritual & Faith Services' },
  { name: 'Worship Leader', category: 'Spiritual & Faith Services' },
  { name: 'Pastor / Minister (Events)', category: 'Spiritual & Faith Services' },
  { name: 'Imam / Faith Officiant (Events)', category: 'Spiritual & Faith Services' },
  { name: 'Choir Coordinator', category: 'Spiritual & Faith Services' },

  // Childcare
  { name: 'Nanny', category: 'Childcare & Nanny Services' },
  { name: 'Babysitter', category: 'Childcare & Nanny Services' },
  { name: 'After-School Helper', category: 'Childcare & Nanny Services' },
  { name: 'Special Needs Carer (Child)', category: 'Childcare & Nanny Services' },

  // Moving
  { name: 'Home Mover', category: 'Moving, Packing & Storage' },
  { name: 'Office Mover', category: 'Moving, Packing & Storage' },
  { name: 'Packing Specialist', category: 'Moving, Packing & Storage' },
  { name: 'Furniture Mover', category: 'Moving, Packing & Storage' },
  { name: 'Storage Helper', category: 'Moving, Packing & Storage' },
];

/** Also allow typing a parent category name directly */
const LEGACY_ALIASES = [
  { name: 'Film & Talent', category: 'Film, TV & Talent' },
  { name: 'Phones & Gadgets Repair', category: 'Electronics & Appliances Repair' },
  { name: 'Musician Pro', category: 'Music & Live Performance' },
];

const CATEGORY_AS_SKILLS = [
  ...WIAMAPP_CATEGORIES.map((name) => ({ name, category: name })),
  ...LEGACY_ALIASES,
];

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
