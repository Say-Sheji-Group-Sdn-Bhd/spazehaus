-- ───────────────────────────────────────────────────────────────────────────
-- SPAZEHAUS — Local testing seed
--
-- Two parts:
--   (1) REQUIRED reference data — the 29 lifecycle_stages (the app's engine
--       breaks without them; this is NOT demo data).
--   (2) TEST FIXTURES — staff per tier, projects mid-lifecycle, inquiries, etc.,
--       matching .agent/plan/local-testing-plan.md.
--
-- Applied automatically by `supabase db reset`, or manually:
--   docker exec -i supabase_db_Web psql -U postgres -d postgres < supabase/seed.sql
--
-- Triggers are disabled during the seed (session_replication_role = replica) so
-- that inserting "completed" payments doesn't auto-advance project stages and so
-- the audit log stays clean. Insert order respects FKs.
-- ───────────────────────────────────────────────────────────────────────────

set session_replication_role = replica;

-- Idempotent: wipe existing rows so re-running the seed is safe.
truncate table
  kpi_records, leave_requests, quotation_items, quotations, site_photos,
  signature_records, payment_records, inquiries, projects, staff,
  lifecycle_stages, audit_log
  restart identity cascade;

-- ── (1) lifecycle_stages — 32 stages (Flow 2 Phase 3; required reference data) ──
insert into lifecycle_stages (order_index, id, label, phase, stage_type, payment_gate, signature_key, service_type) values
  (1,  'new-inquiry',                'New Inquiry',                             'Inquiry',   'milestone',     null, null,                  'Design'),
  (2,  'inquiry-form',               'Fill In Inquiry Form',                    'Inquiry',   'milestone',     null, null,                  'Design'),
  (3,  'showroom-meet',              'First Meet-Up',                           'Inquiry',   'milestone',     null, null,                  'Design'),
  (4,  'proposal-deposit',           'Proposal Deposit Collected',              'Design',    'payment',       1,    null,                  'Design'),
  (5,  'design-proposal',            'Design Proposal',                         'Design',    'milestone',     null, null,                  'Design'),
  (6,  'design-quotation',           'Design Quotation',                        'Design',    'milestone',     null, null,                  'Design'),
  (7,  'proposal-meeting',           'Proposal Meeting',                        'Design',    'milestone',     null, null,                  'Design'),
  (8,  'design-contract',            'Design Contract Signed',                  'Design',    'contract-sign', 2,    'design-contract',     'Design'),
  (9,  'design-commission-contract', 'Design Commission Contract Signed',       'Design',    'milestone',     null, null,                  'Design'),
  (10, 'storage-handbook',           'Storage Handbook From Client',            'Design',    'milestone',     null, null,                  'Design'),
  (11, 'revised-3d',                 '3D Design — Signed',                      'Pre-Build', 'drawing-sign',  null, 'revised-3d',          'Design'),
  (12, 'reno-quotation',             'Renovation Quotation',                    'Pre-Build', 'milestone',     null, null,                  'Design'),
  (13, '2d-shopping',                '2D Drawings & Material Board — Signed',    'Pre-Build', 'drawing-sign',  null, '2d-shopping',         'Design'),
  (14, 'reno-contract',              'Renovation Contract Signed',              'Pre-Build', 'contract-sign', null, 'renovation-contract', 'Renovation'),
  (15, 'reno-commission-contract',   'Renovation Commission Contract Signed',   'Pre-Build', 'milestone',     null, null,                  'Renovation'),
  (16, 'reno-deposit',               'Renovation Deposit Collected',            'Pre-Build', 'payment',       3,    null,                  'Renovation'),
  (17, 'work-schedule',              'Site Work Schedule',                      'Pre-Build', 'milestone',     null, null,                  'Renovation'),
  (18, 'cidb-authority',             'CIDB / Authority / Insurance',            'Build',     'milestone',     null, null,                  'Renovation'),
  (19, 'kick-off',                   'Site Marking',                            'Build',     'milestone',     null, null,                  'Renovation'),
  (20, 'contractor-brief',           'Contractor Briefing',                     'Build',     'milestone',     null, null,                  'Renovation'),
  (21, 'project-po',                 'Project PO',                              'Build',     'milestone',     null, null,                  'Renovation'),
  (22, 'site-inspection',            'Site Inspection',                         'Build',     'milestone',     null, null,                  'Renovation'),
  (23, 'site-report',                'Site Report',                             'Build',     'milestone',     null, null,                  'Renovation'),
  (24, 'progressive-pay',            'Progressive Payment',                     'Build',     'payment',       4,    null,                  'Renovation'),
  (25, 'site-completed',             'Client Site Inspection',                  'Closeout',  'milestone',     null, null,                  'Renovation'),
  (26, 'furniture-delivery',         'Supplier Delivery & Installation',        'Closeout',  'milestone',     null, null,                  'Renovation'),
  (27, 'handover',                   'Handover Document / As-Built — Signed',   'Closeout',  'contract-sign', null, 'handover',            'Renovation'),
  (28, 'handover-meeting',           'Handover Meeting',                        'Closeout',  'milestone',     null, null,                  'Renovation'),
  (29, 'final-payment',              'Final Payment',                           'Closeout',  'payment',       5,    null,                  'Renovation'),
  (30, 'project-statement-review',   'Project Statement Review',                'Closeout',  'milestone',     null, null,                  'Renovation'),
  (31, 'completion',                 'Project Completion',                      'Closeout',  'milestone',     null, null,                  'Renovation'),
  (32, 'defect-period',              'Warranty Follow-Up',                      'Closeout',  'milestone',     null, null,                  'Renovation');

-- ── (2a) staff — one per tier, 2 admins, a same-initials pair (JT) ───────────
-- auth_user_id is null: each links on first magic-link login by email.
-- Emails are *.spazehaus.test — local Mailpit catches all mail, any email works.
insert into staff (id, email, name, role, job_title, dept, avatar_code, status, join_date, leave_balance_annual, leave_balance_medical, kpi_grade, phone, whatsapp_opt_in) values
  ('SH001','admin@spazehaus.test',     'Grace Tan',  'principal',       'Principal',          'Admin',       'GT', 'active', '2021-01-04', 16, 14, 'A',  '+60123000001', true),
  ('SH002','admin2@spazehaus.test',    'Adam Lee',   'admin',           'Admin Manager',      'Admin',       'AL', 'active', '2021-06-15', 14, 14, 'A',  '+60123000002', true),
  ('SH003','ops@spazehaus.test',       'Priya Menon','pm',              'Project Manager',    'Operations',  'PM', 'active', '2022-03-01', 12, 10, 'B+', '+60123000003', true),
  ('SH004','site@spazehaus.test',      'Sam Wong',   'site_supervisor', 'Site Supervisor',    'Operations',  'SW', 'active', '2022-09-12', 13, 12, 'B',  '+60123000004', true),
  ('SH005','designer@spazehaus.test',  'Jamie Tan',  'designer',        'Interior Designer',  'Design',      'JT', 'active', '2023-02-20', 15, 14, 'A-', '+60123000005', true),
  ('SH006','sales@spazehaus.test',     'Jordan Teh', 'sales',           'Sales Executive',    'Sales',       'JT', 'active', '2023-08-08', 16, 14, 'B+', '+60123000006', true),
  ('SH007','designer2@spazehaus.test', 'Nadia Idris','designer',        'Senior Designer',    'Design',      'NI', 'active', '2022-11-02', 14, 13, 'A',  '+60123000007', true);

-- ── (2b) projects — PRJ001 at stage 9 (dual-gate), PRJ002 mid-build ──────────
insert into projects (id, name, client_name, client_contact, client_email, project_type, property_type, location, size_sqft, budget, start_date, target_date, status, priority, progress, designer_id, pm_id, team, current_stage_id, lifecycle_started_at, areas, description, created_by, client_access_token) values
  ('PRJ001','Tan Residence Reno','Mr. & Mrs. Tan','+60127770001','tan.family@example.com','Residential','Condominium','Mont Kiara, KL', 1200, 150000, '2026-05-01','2026-11-01','assigned','high',   30, 'SH007','SH003', '{NI,PM}', 'design-contract', '2026-05-01', '{Living Room,Master Bedroom,Kitchen}', 'Full condo renovation. Currently awaiting design contract signature + design fee.', 'SH001', '11111111-1111-1111-1111-111111111111'),
  ('PRJ002','Lim Office Fitout', 'Lim Holdings',   '+60127770002','ops@limholdings.example','Commercial', 'Office',     'KLCC, KL',       3500, 480000, '2026-03-15','2026-09-30','active',  'medium', 60, 'SH005','SH003', '{JT,PM}', 'kick-off',        '2026-03-15', '{Reception,Open Office,Meeting Room,Pantry}', 'Office fitout, renovation underway.', 'SH001', '22222222-2222-2222-2222-222222222222');

-- ── (2c) payment_records ─────────────────────────────────────────────────────
-- PRJ001: Gate 1 collected (at conversion), Gates 2–5 pending.
insert into payment_records (project_id, gate, label, amount, status, collected_date, reference, notes) values
  ('PRJ001', 1, 'Proposal Deposit',          10000, 'completed', '2026-05-01', 'PD-2026-001', null),
  ('PRJ001', 2, 'Design Contract Fee',       10500, 'pending',   null, null, null),
  ('PRJ001', 3, 'Renovation Deposit (50%)',  64750, 'pending',   null, null, null),
  ('PRJ001', 4, 'Progressive Payment',       38850, 'pending',   null, null, 'To be split into instalments'),
  ('PRJ001', 5, 'Final Payment',             25900, 'pending',   null, null, null);
-- PRJ002: Gates 1–3 collected (it's at kick-off, stage 19), Gates 4–5 pending.
insert into payment_records (project_id, gate, label, amount, status, collected_date, reference, notes) values
  ('PRJ002', 1, 'Proposal Deposit',          30000, 'completed', '2026-03-15', 'PD-2026-002', null),
  ('PRJ002', 2, 'Design Contract Fee',       33600, 'completed', '2026-04-02', 'DC-2026-002', null),
  ('PRJ002', 3, 'Renovation Deposit (50%)', 208200, 'completed', '2026-05-10', 'RD-2026-002', null),
  ('PRJ002', 4, 'Progressive Payment',      124920, 'pending',   null, null, 'To be split into instalments'),
  ('PRJ002', 5, 'Final Payment',             83280, 'pending',   null, null, null);

-- ── (2d) signature_records ───────────────────────────────────────────────────
-- PRJ001: all 5 Flow 2 documents pending (material-selection merged into 2d-shopping).
insert into signature_records (project_id, signature_key, label, group_name, status) values
  ('PRJ001','design-contract',     'Design Contract',               'contract', 'pending'),
  ('PRJ001','revised-3d',          '3D Design',                     'drawing',  'pending'),
  ('PRJ001','renovation-contract', 'Renovation Contract',           'contract', 'pending'),
  ('PRJ001','2d-shopping',         '2D Drawings & Material Board',  'drawing',  'pending'),
  ('PRJ001','handover',            'Handover Document',             'contract', 'pending');
-- PRJ002: design-side signed, handover pending.
insert into signature_records (project_id, signature_key, label, group_name, status, signed_date, signed_by) values
  ('PRJ002','design-contract',     'Design Contract',               'contract', 'completed', '2026-04-02', 'Lim Holdings'),
  ('PRJ002','revised-3d',          '3D Design',                     'drawing',  'completed', '2026-04-20', 'Lim Holdings'),
  ('PRJ002','renovation-contract', 'Renovation Contract',           'contract', 'completed', '2026-05-08', 'Lim Holdings'),
  ('PRJ002','2d-shopping',         '2D Drawings & Material Board',  'drawing',  'completed', '2026-05-22', 'Lim Holdings'),
  ('PRJ002','handover',            'Handover Document',             'contract', 'pending',    null, null);

-- ── (2e) inquiries — convertible + attribution pair + awarded + rejected ─────
-- Customers (Phase 5): one per seed inquiry (local reset applies migrations BEFORE
-- this seed, so the backfill migration can't see these rows — seed them here).
insert into customers (id, name, contact, email, category, tier, source) values
  ('CUS001','Wong Family',   '+60127880001','wong@example.com','Residential','Standard','Website'),
  ('CUS002','Ng Enterprise', '+60127880002','ng@example.com',  'Commercial', 'Repeat',  'Referral'),
  ('CUS003','Siti Residence','+60127880003','siti@example.com','Residential','Standard','Website'),
  ('CUS004','Lim Holdings',  '+60127880004','lim@example.com', 'Commercial', 'VIP',     'Referral'),
  ('CUS005','Tan Boutique',  '+60127880005','tanb@example.com','F&B',        'Standard','Walk-in');

insert into inquiries (id, customer_id, inquiry_date, client_name, contact, email, category, tier, source, property_type, location, estimated_size, estimated_budget, stage, assigned_to_id, notes, awarded_project_id, awarded_date, rejected_date, rejection_reason, contact_log, last_updated) values
  ('INQ001','CUS001','2026-05-20','Wong Family',   '+60127880001','wong@example.com','Residential','Standard','Website','Condominium','Cheras, KL',        1100, 140000, 'showroom-meet', 'SH007', 'Ready to convert — proposal accepted.', null, null, null, null, '[]'::jsonb, '2026-05-28'),
  ('INQ002','CUS002','2026-05-22','Ng Enterprise', '+60127880002','ng@example.com',  'Commercial', 'Repeat',  'Referral','Retail',     'Bangsar, KL',      900,  220000, 'showroom-meet', 'SH005', 'Jamie''s lead — retail shop.',          null, null, null, null, '[]'::jsonb, '2026-05-27'),
  ('INQ003','CUS003','2026-05-23','Siti Residence','+60127880003','siti@example.com','Residential','Standard','Website','Landed',      'Shah Alam',        1800, 260000, 'showroom-meet', 'SH006', 'Jordan''s lead — landed house.',        null, null, null, null, '[]'::jsonb, '2026-05-26'),
  ('INQ004','CUS004','2026-02-10','Lim Holdings',  '+60127880004','lim@example.com', 'Commercial', 'VIP',     'Referral','Office',      'KLCC, KL',         3500, 480000, 'awarded',       'SH003', 'Won — became PRJ002.',                  'PRJ002', '2026-03-10', null, null, '[]'::jsonb, '2026-03-10'),
  ('INQ005','CUS005','2026-04-05','Tan Boutique',  '+60127880005','tanb@example.com','F&B',        'Standard','Walk-in', 'F&B',         'Petaling Jaya',    700,  90000,  'rejected',      'SH006', 'Budget mismatch.',                      null, null, '2026-04-18', 'Budget too low for scope', '[]'::jsonb, '2026-04-18');

-- ── (2f) quotation + items (for PRJ001) ──────────────────────────────────────
insert into quotations (id, project_id, doc_type, status, client_name, client_contact, client_email, issue_date, valid_until, tax_rate, notes, revision, created_by) values
  ('QT-2026-001','PRJ001','Quotation','draft','Mr. & Mrs. Tan','+60127770001','tan.family@example.com','2026-05-25','2026-06-25', 0, 'Initial design + renovation quotation.', 1, 'SH005');
insert into quotation_items (id, quotation_id, area, description, category, qty, unit, unit_price, discount, sort_order) values
  ('QT-2026-001-001','QT-2026-001','Living Room','Built-in TV console + feature wall','Material', 1, 'lot',  8500, 0, 0),
  ('QT-2026-001-002','QT-2026-001','Kitchen','Cabinet carcass + solid surface top','Material', 18, 'ft',  650, 5, 1),
  ('QT-2026-001-003','QT-2026-001','Master Bedroom','Wardrobe + study unit','Furniture', 1, 'lot', 12000, 0, 2);

-- ── (2g) leave_requests ──────────────────────────────────────────────────────
insert into leave_requests (id, staff_id, leave_type, start_date, end_date, days, reason, status, applied_date, approved_by_id, approved_at) values
  ('LR001','SH005','Annual', '2026-06-15','2026-06-17', 3, 'Family trip',         'pending',  '2026-06-01', null, null),
  ('LR002','SH005','Medical','2026-05-04','2026-05-04', 1, 'Medical appointment', 'approved', '2026-05-02', 'SH001', '2026-05-02');

-- ── (2h) kpi_records ─────────────────────────────────────────────────────────
-- total_score is GENERATED (sum of parts). Caps: A<=30, B<=50, C<=20; rating in (A,B,C).
insert into kpi_records (staff_id, year, month, part_a_score, part_b_score, part_c_score, rating, reviewer_id, notes) values
  ('SH005', 2026, 5, 28, 45, 18, 'A', 'SH001', 'Strong design output.'),
  ('SH006', 2026, 5, 24, 40, 16, 'B', 'SH001', 'Good pipeline activity.');

-- ── (2i) site_photos (PRJ002 — in build) ─────────────────────────────────────
-- storage_path points at the private site-photos bucket; the object itself isn't
-- seeded, so thumbnails will gracefully show the placeholder (no crash).
insert into site_photos (project_id, photo_date, uploaded_by_id, storage_path, notes) values
  ('PRJ002','2026-06-04','SH004','PRJ002/2026-06-04.jpg','Hacking works in progress'),
  ('PRJ002','2026-06-05','SH004','PRJ002/2026-06-05.jpg','Electrical rough-in');

reset session_replication_role;
