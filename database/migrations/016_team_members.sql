-- ============================================================
-- WIAMAPP MIGRATION 016 — Team Members System
-- © 2026 WiamApp. Powered by WiamLabs
-- Run after 015
-- ============================================================

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name         VARCHAR(100) NOT NULL,
  personal_email    VARCHAR(150) NOT NULL UNIQUE,
  role              VARCHAR(100) NOT NULL,
  department        VARCHAR(100) NOT NULL,
  position          VARCHAR(200),
  code_hash         VARCHAR(64) NOT NULL,
  code_expires_at   TIMESTAMPTZ NOT NULL,
  permissions       TEXT[] DEFAULT '{}',
  dashboard_key     VARCHAR(100),
  is_active         BOOLEAN DEFAULT true,
  last_login_at     TIMESTAMPTZ,
  deactivated_at    TIMESTAMPTZ,
  hired_at          TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_code ON team_members(code_hash);
CREATE INDEX IF NOT EXISTS idx_team_members_active ON team_members(is_active);

-- Career applications table
CREATE TABLE IF NOT EXISTS career_applications (
  id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  position_id       VARCHAR(100) NOT NULL,
  position_title    VARCHAR(200) NOT NULL,
  full_name         VARCHAR(100) NOT NULL,
  email             VARCHAR(150) NOT NULL,
  phone             VARCHAR(20) NOT NULL,
  country           VARCHAR(100),
  city              VARCHAR(100),
  years_experience  INT,
  relevant_skills   TEXT,
  previous_roles    TEXT,
  why_wiamapp       TEXT,
  what_they_bring   TEXT,
  availability      VARCHAR(50),
  linkedin_url      VARCHAR(200),
  portfolio_url     VARCHAR(200),
  cv_s3_key         TEXT,
  references_info   TEXT,
  status            VARCHAR(30) DEFAULT 'pending'
    CHECK (status IN ('pending','reviewing','approved','rejected')),
  rejection_reason  TEXT,
  reviewer_notes    TEXT,
  reviewed_by       UUID,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_apps_status ON career_applications(status);
CREATE INDEX IF NOT EXISTS idx_career_apps_position ON career_applications(position_id);

-- Career positions (what shows on the website careers page)
CREATE TABLE IF NOT EXISTS career_positions (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  position_key    VARCHAR(100) UNIQUE NOT NULL,
  title           VARCHAR(200) NOT NULL,
  department      VARCHAR(100) NOT NULL,
  location        VARCHAR(100) DEFAULT 'Remote',
  job_type        VARCHAR(50) DEFAULT 'Full-time',
  description     TEXT NOT NULL,
  responsibilities TEXT NOT NULL,
  requirements    TEXT NOT NULL,
  nice_to_have    TEXT,
  is_active       BOOLEAN DEFAULT true,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed all career positions
INSERT INTO career_positions (position_key, title, department, location, job_type, description, responsibilities, requirements) VALUES

-- Leadership
('cto', 'Chief Technology Officer', 'Leadership', 'Remote / Accra', 'Full-time',
 'Lead all technical decisions and engineering teams for WiamApp Africa.',
 'Oversee technical architecture, lead engineering teams, make technology decisions, manage DevOps and security.',
 'Strong software engineering background, 5+ years leadership, experience with mobile and backend systems.'),

('coo', 'Chief Operations Officer', 'Leadership', 'Accra, Ghana', 'Full-time',
 'Oversee daily operations of WiamApp platform across Ghana and Nigeria.',
 'Manage operations teams, optimize processes, coordinate between departments, oversee growth strategy.',
 '5+ years operations management, experience scaling a tech product in Africa.'),

-- Platform Administration
('senior_admin', 'Senior Platform Administrator', 'Administration', 'Remote', 'Full-time',
 'Control and manage the WiamApp platform, users, and operations from the admin dashboard.',
 'Manage user accounts, review platform activity, enforce policies, handle escalations.',
 'Strong attention to detail, experience with digital platforms, excellent judgment.'),

('junior_admin', 'Junior Platform Administrator', 'Administration', 'Remote', 'Full-time',
 'Support platform administration tasks and help manage daily operations.',
 'Assist with user management, follow up on flagged accounts, support senior admin.',
 'Organized, detail-oriented, comfortable with digital tools.'),

('content_mod', 'Content Moderator', 'Trust and Safety', 'Remote', 'Full-time',
 'Review and moderate all Spotlight posts to maintain platform quality and safety.',
 'Review post submissions, approve or reject content, enforce content policies, report trends.',
 'Good judgment on appropriate content, familiarity with social platforms, consistent standards.'),

('doc_reviewer', 'Document Reviewer', 'Trust and Safety', 'Remote', 'Full-time',
 'Review identity documents submitted by workers and customers for verification.',
 'Review ID documents and selfies, verify authenticity, approve or reject with reasons, maintain queue within 24 hours.',
 'Detail-oriented, able to spot inconsistencies, understanding of African ID documents.'),

('biz_reviewer', 'Business Verification Reviewer', 'Trust and Safety', 'Accra, Ghana', 'Full-time',
 'Review and verify business account applications for the Gold Badge certification.',
 'Review business registration documents, verify legitimacy, approve or reject applications.',
 'Knowledge of Ghana business registration processes, strong verification skills.'),

('dispute_officer', 'Dispute Resolution Officer', 'Operations', 'Remote', 'Full-time',
 'Resolve disputes between customers and workers fairly and professionally.',
 'Review disputed bookings, analyze evidence, make fair decisions, communicate outcomes.',
 'Excellent judgment, strong communication, ability to remain neutral.'),

('fraud_analyst', 'Fraud Analyst', 'Trust and Safety', 'Remote', 'Full-time',
 'Investigate fraud reports and protect the platform from bad actors.',
 'Investigate fraud cases, analyze patterns, compile evidence, coordinate with authorities when needed.',
 'Analytical mindset, attention to detail, understanding of fraud patterns.'),

('emergency_officer', 'Emergency Response Officer', 'Trust and Safety', 'Accra, Ghana', 'Full-time',
 'Monitor and respond to SOS alerts from workers and customers on the platform.',
 'Monitor SOS dashboard 24/7 in rotation, respond immediately to alerts, coordinate with emergency services.',
 'Calm under pressure, fast decision maker, knowledge of Ghana emergency services.'),

-- Customer and Worker Support
('cs_lead', 'Customer Support Lead', 'Support', 'Remote', 'Full-time',
 'Lead the customer support team and ensure all customers receive excellent service.',
 'Manage support team, handle escalations, improve support processes, track satisfaction metrics.',
 '3+ years customer support experience, leadership skills, excellent communication.'),

('cs_rep', 'Customer Support Representative', 'Support', 'Remote', 'Full-time',
 'Help customers with bookings, payments, and platform issues.',
 'Respond to customer tickets, resolve booking issues, assist with payments, escalate complex cases.',
 'Patient, clear communicator, fast typist, empathetic approach.'),

('ws_rep', 'Worker Support Representative', 'Support', 'Remote', 'Full-time',
 'Help workers succeed on the platform — from onboarding to earnings.',
 'Support worker onboarding, resolve subscription issues, handle worker complaints.',
 'Empathetic, understanding of the informal economy, excellent Twi or Hausa a bonus.'),

('biz_manager', 'Business Account Manager', 'Sales', 'Accra, Ghana', 'Full-time',
 'Manage relationships with Starter and Growth business accounts.',
 'Onboard new business accounts, support businesses in using the platform, upsell tier upgrades.',
 'Sales experience, relationship building, knowledge of local business culture.'),

('enterprise_manager', 'Enterprise Account Manager', 'Sales', 'Accra, Ghana', 'Full-time',
 'Manage WiamApp Enterprise clients with white-glove, dedicated service.',
 'Own relationships with Enterprise accounts, conduct quarterly reviews, handle all enterprise needs.',
 '5+ years B2B account management, experience with corporate clients in Ghana or Nigeria.'),

-- Technical Team
('backend_dev', 'Backend Developer', 'Engineering', 'Remote', 'Full-time',
 'Build and maintain the WiamApp backend APIs and server infrastructure.',
 'Build RESTful APIs, maintain database, optimize performance, write clean Node.js code.',
 'Strong Node.js and PostgreSQL skills, experience with Supabase or similar, API design experience.'),

('mobile_dev', 'Mobile Developer', 'Engineering', 'Remote', 'Full-time',
 'Build and improve the WiamApp React Native / Expo mobile application.',
 'Build new screens and features, fix bugs, optimize performance, improve UI.',
 'Strong React Native and Expo experience, JavaScript/TypeScript, mobile UX understanding.'),

('frontend_dev', 'Frontend Developer', 'Engineering', 'Remote', 'Full-time',
 'Build the WiamApp website and team dashboard interfaces.',
 'Build Next.js website, develop team dashboards, maintain web interfaces.',
 'Strong Next.js and React experience, CSS and responsive design, TypeScript.'),

('db_admin', 'Database Administrator', 'Engineering', 'Remote', 'Full-time',
 'Manage, optimize, and secure the WiamApp Supabase/PostgreSQL database.',
 'Write and review migrations, optimize queries, manage backups, ensure data integrity.',
 'Strong PostgreSQL skills, experience with Supabase or similar, RLS and security knowledge.'),

('devops', 'DevOps Engineer', 'Engineering', 'Remote', 'Full-time',
 'Manage WiamApp deployments, infrastructure, and reliability.',
 'Manage Render deployments, Cloudflare setup, monitor uptime, improve CI/CD pipeline.',
 'Experience with cloud deployments, Node.js servers, Cloudflare, monitoring tools.'),

('security_eng', 'Security Engineer', 'Engineering', 'Remote', 'Full-time',
 'Protect WiamApp users, data, and infrastructure from security threats.',
 'Conduct security audits, review code for vulnerabilities, manage security incidents.',
 'Strong security background, web and mobile security, experience with penetration testing.'),

('qa_lead', 'QA Lead', 'Engineering', 'Remote', 'Full-time',
 'Lead quality assurance for all WiamApp releases.',
 'Create test plans, manage QA team, approve releases, maintain quality standards.',
 '3+ years QA experience, mobile and web testing, strong testing methodology.'),

('qa_tester', 'QA Tester', 'Engineering', 'Remote', 'Full-time',
 'Test new features and ensure WiamApp works perfectly for all users.',
 'Test new features before release, report bugs clearly, verify fixes, test on Android and iOS.',
 'Methodical approach, good bug reporting skills, experience with mobile apps.'),

('ui_designer', 'UI/UX Designer', 'Design', 'Remote', 'Full-time',
 'Design beautiful, usable screens and interfaces for WiamApp.',
 'Design app screens, website pages, and team dashboards. Maintain brand consistency.',
 'Strong Figma skills, mobile UX experience, understanding of WiamLabs brand guidelines.'),

-- Business and Marketing
('marketing_mgr', 'Marketing Manager', 'Marketing', 'Accra, Ghana', 'Full-time',
 'Lead all marketing efforts to grow WiamApp across Ghana and Nigeria.',
 'Plan and execute marketing campaigns, manage budget, coordinate with team, track metrics.',
 '4+ years marketing experience, digital marketing skills, experience in African markets.'),

('social_media', 'Social Media Manager', 'Marketing', 'Remote', 'Full-time',
 'Manage WiamApp social media presence across Facebook, Instagram, Twitter, TikTok.',
 'Create content, manage community, run campaigns, grow followers, respond to comments.',
 'Strong content creation skills, social media experience, understanding of Ghana/Nigeria online culture.'),

('community_mgr', 'Community Manager', 'Marketing', 'Accra, Ghana', 'Full-time',
 'Build and manage the WiamApp community of workers and customers.',
 'Manage WhatsApp groups, organize events, gather feedback, be the face of WiamApp locally.',
 'Excellent communication, well-connected in Accra, passionate about helping workers.'),

('partnerships_mgr', 'Partnerships Manager', 'Business Development', 'Accra, Ghana', 'Full-time',
 'Build strategic partnerships with businesses, trade associations, and government bodies.',
 'Identify and approach partners, negotiate agreements, manage relationships.',
 'Strong networking skills, business development background, knowledge of Ghana business landscape.'),

-- Finance
('financial_mgr', 'Financial Manager', 'Finance', 'Accra, Ghana', 'Full-time',
 'Oversee all financial operations including revenue, commissions, and payouts.',
 'Manage revenue tracking, commission reconciliation, payout processing, financial reports.',
 'Finance or accounting background, experience with fintech or marketplace businesses.'),

('commission_analyst', 'Commission Analyst', 'Finance', 'Remote', 'Full-time',
 'Monitor, analyze, and reconcile all commission transactions on the platform.',
 'Review commission records, identify discrepancies, generate reports, support financial manager.',
 'Strong analytical skills, Excel or Google Sheets, attention to numerical detail.'),

-- Legal and Compliance
('legal_officer', 'Legal Officer', 'Legal', 'Accra, Ghana', 'Full-time',
 'Handle all legal matters including contracts, disputes, and regulatory compliance.',
 'Draft and review contracts, handle legal disputes, advise on regulatory requirements.',
 'Legal qualification in Ghana or Nigeria, experience with tech or marketplace companies.'),

('data_protection', 'Data Protection Officer', 'Legal', 'Remote', 'Full-time',
 'Ensure WiamApp complies with Ghana Data Protection Act and international privacy standards.',
 'Review data practices, handle data requests, maintain privacy policy, respond to breaches.',
 'Knowledge of Ghana Data Protection Act 2012, GDPR familiarity, legal or compliance background.')

ON CONFLICT (position_key) DO NOTHING;

-- RLS for team tables
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_positions ENABLE ROW LEVEL SECURITY;

-- Career positions are public (website)
CREATE POLICY "career_positions_public_read"
  ON career_positions FOR SELECT USING (is_active = true);

-- Applications: only admin can read
CREATE POLICY "career_apps_admin_only"
  ON career_applications FOR SELECT USING (false);

-- Anyone can submit application (public route)
CREATE POLICY "career_apps_public_insert"
  ON career_applications FOR INSERT WITH CHECK (true);
