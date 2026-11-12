-- ============================================================================
-- Spazehaus — Insert the REAL team (11 members with emails).
-- Run via Supabase SQL Editor:
--   https://supabase.com/dashboard/project/exajkbvaqjqdedqavbvs → SQL Editor → New query
--
-- PREREQUISITE: run this on a CLEAN slate (mock staff/projects already cleared).
--   The purge step is handled separately — see the note from Claude / supabase/README.md
--   "If you need to start over". These IDs (SH001–SH011) assume no existing SH001–SH010
--   mock rows, so clear those first or this errors on duplicate primary key.
--
-- Role mapping (confirmed 2026-09-29): principal = admin tier · admin_exec = admin ·
--   pm = ops tier · designer/sales = field tier.
-- job_title carries the firm position (+ team where relevant). join_date + leave
--   balances are PLACEHOLDERS — update per HR.
-- Vinson Tan = Director AND Team C Team Leader (one person, one row).
-- Deferred (no email yet): Aveline Chaw, Taris, Jaeysone, CK, Qiu Ying, Xiao Tong, Hong Yu.
-- ============================================================================

insert into public.staff
  (id, email, name, role, job_title, dept, avatar_code, status, join_date, leave_balance_annual, leave_balance_medical, whatsapp_opt_in)
values
  ('SH001','vinsontan16@gmail.com',    'Vinson Tan', 'principal',  'Director · Team C Lead',            'Admin',      'VT','active','2026-09-29',14,14,true),
  ('SH002','leonghuijam2011@gmail.com','Leonghui',   'admin_exec', 'HR',                                'Admin',      'LH','active','2026-09-29',14,14,true),
  ('SH003','peyruchia@gmail.com',      'Ruby',       'admin_exec', 'Admin',                             'Admin',      'RB','active','2026-09-29',14,14,true),
  ('SH004','gracetst81@gmail.com',     'Grace Tan',  'admin_exec', 'Project QA',                        'Operations', 'GT','active','2026-09-29',14,14,true),
  ('SH005','darercachaw@gmail.com',    'Xian',       'sales',      'Marketing',                         'Sales',      'XN','active','2026-09-29',14,14,true),
  ('SH006','yauwen89@gmail.com',       'Wilson',     'pm',         'Team Leader · Team A',              'Design',     'WL','active','2026-09-29',14,14,true),
  ('SH007','skyong.WTY@gmail.com',     'TY',         'designer',   'Trainee Team Leader · Team A',      'Design',     'TY','active','2026-09-29',14,14,true),
  ('SH008','zli215494@gmail.com',      'Zhitan',     'designer',   'Senior Design Consultant · Team A', 'Design',     'ZT','active','2026-09-29',14,14,true),
  ('SH009','waihong981015@gmail.com',  'Waihong',    'pm',         'Senior Project Manager · Team C',   'Operations', 'WH','active','2026-09-29',14,14,true),
  ('SH010','moifoong0530@gmail.com',   'Laveness',   'pm',         'Project Manager · Team C',          'Operations', 'LV','active','2026-09-29',14,14,true),
  ('SH011','deniseng0114@gmail.com',   'Denise',     'designer',   'Senior Design Consultant · Team C', 'Design',     'DN','active','2026-09-29',14,14,true);

-- Sanity check — expect 11 rows, distinct emails, no nulls in required cols.
select id, email, name, role, job_title, dept, avatar_code from public.staff order by id;
