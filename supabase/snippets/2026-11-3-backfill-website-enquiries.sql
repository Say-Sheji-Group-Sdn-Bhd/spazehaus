-- ───────────────────────────────────────────────────────────────────────────
-- Backfill: historical website enquiries from email (Jul–Sep 2026)
--
-- 14 real Contact-form enquiries that pre-date the Supabase write, transcribed
-- from the "SPAZEHAUS Website — New enquiry" emails in info@spazehaus.com.
-- Excluded: 3 test submissions (reCAPTCHA check, DIAG homepage test, "Edbert").
--
-- Direct INSERT (not the RPC) so each row keeps its ORIGINAL submitted_at.
-- `status` defaults to 'contacted' here — these are months-old leads the team
-- already received by email; adjust any in the app that weren't actually
-- followed up. "tim zhou" is a B2B franchise pitch, imported as 'spam'.
-- Idempotent: stable ids + ON CONFLICT DO NOTHING, so re-running is safe.
--
-- Run in Supabase SQL Editor (project exajkbvaqjqdedqavbvs).
-- ───────────────────────────────────────────────────────────────────────────

insert into public.website_enquiries
  (id, name, phone, email, project_location, project_type, property, budget, timeline, heard_via, message, status, source, submitted_at, created_at, staff_note)
values
  ('ENQ-bf-01', 'Jeya', '+60126852617', null, 'Horizon Hills Cluster', 'Residential', 'Landed house', 'RM500K – RM600K', null, null,
    $m$Need extension to create wet kitchen prayer room and en-suite bedroom$m$,
    'contacted', 'website', '2026-09-28T05:05:49Z', '2026-09-28T05:05:49Z', 'Backfilled from email enquiry.'),

  ('ENQ-bf-02', 'Mr Khoo', '+60166636738', null, 'Horizon Hill', 'Commercial', 'Landed house', 'Below RM200k', null, null,
    $m$Renovation for the entire unit$m$,
    'contacted', 'website', '2026-09-22T23:10:27Z', '2026-09-22T23:10:27Z', 'Backfilled from email enquiry.'),

  ('ENQ-bf-03', 'Kho', '0177611167', null, 'Batu pahat', 'Residential', 'Landed house', 'RM300K – RM500K', null, null,
    $m$现代托斯卡纳风，偏自然元素，大地色搭配少量木纹，需要有一个主人房，女佣房，一个客房，一个孩子房间，gym room,洗衣房间，store room,大厨房有中岛$m$,
    'contacted', 'website', '2026-09-27T23:48:49Z', '2026-09-27T23:48:49Z', 'Backfilled from email enquiry.'),

  ('ENQ-bf-04', 'Mr Leow', '+6586127379', null, 'East Ledang', 'Residential', 'Landed house', 'Below RM200k', null, null,
    $m$Hi, I am interested in renovating my 2,500 sq ft terrace house in East Ledang which I have just bought, and would like to get a quote from your company. Are you free for a consultation this coming Wednesday, Sep 16 or Thursday, Sep 17? I can be reached at the phone number above. Thank you.$m$,
    'contacted', 'website', '2026-09-14T11:57:02Z', '2026-09-14T11:57:02Z', 'Backfilled from email enquiry.'),

  ('ENQ-bf-05', 'Seline', '+60196228858', null, 'Leisure farm', 'Residential', 'Landed house', 'Below RM200k', null, null,
    null,
    'contacted', 'website', '2026-09-11T02:27:27Z', '2026-09-11T02:27:27Z', 'Backfilled from email enquiry.'),

  ('ENQ-bf-06', 'Tai Jia Lin', '0187849177', 'tracia.pa77@gmail.com', 'City Square', 'Commercial', 'Retail', 'RM200K – RM300K', 'ASAP', 'Google search',
    $m$Hi, I'm Jia Lin from Olego Food & Gifts. We're planning to open a beverage kiosk (takeaway only, no seating) in a shopping mall in Johor Bahru, and would like to enquire about your design and renovation services. Project overview: - Location: City Square, Johor Bahru - Concept: Beverage kiosk, takeaway only (no seating) - Kiosk size: approx. 230 sq ft - Target opening: November 2026 - Scope needed: Full design + build As this is an F&B concept, we would prefer a contractor with prior F&B kiosk or beverage counter experience. We'd like to know: - Have you done any F&B kiosk or beverage counter projects in malls before? - Have you worked on any projects at City Square or Komtar JBCC? - Could you share past project photos? - Roughly how long from consultation to completion? Contact: +6018-7849177 / +6010-2871134 (if cannot contact the first one) Thank you!$m$,
    'contacted', 'website', '2026-08-28T01:12:25Z', '2026-08-28T01:12:25Z', 'Backfilled from email enquiry.'),

  ('ENQ-bf-07', 'Khairil Anuar', '+6586191245', null, 'Tiny Lake, Senai Johor Bahru', 'Commercial', 'Café / Restaurant', 'Below RM200k', null, null,
    $m$A very small cafe at tiny lake Senai, that is yet to be furnished. I need your help to give ideas and recommendations to design this small cafe. Very small budget, as it is also a tiny space. Contact me for further information.$m$,
    'contacted', 'website', '2026-09-10T11:15:44Z', '2026-09-10T11:15:44Z', 'Backfilled from email enquiry.'),

  ('ENQ-bf-08', 'Darren', '0143146693', null, null, 'Residential', 'Condo', 'Below RM50k', null, null,
    null,
    'contacted', 'website', '2026-07-25T06:22:58Z', '2026-07-25T06:22:58Z', 'Backfilled from email enquiry.'),

  ('ENQ-bf-09', 'Jim', '0174813343', null, 'Horizon Mall', 'Commercial', 'Café / Restaurant', 'RM200K – RM300K', null, null,
    null,
    'contacted', 'website', '2026-09-03T18:21:28Z', '2026-09-03T18:21:28Z', 'Backfilled from email enquiry.'),

  ('ENQ-bf-10', 'Judy', '93652335', null, null, 'Residential', 'Condo', 'Below RM200k', null, null,
    $m$Hi do you do jobs in Singapore?$m$,
    'contacted', 'website', '2026-09-11T16:37:47Z', '2026-09-11T16:37:47Z', 'Backfilled from email enquiry.'),

  ('ENQ-bf-11', 'Bella', '0127103220', null, 'Uda height', 'Residential', 'Landed house', 'Below RM200k', null, null,
    $m$My wife house$m$,
    'contacted', 'website', '2026-09-02T07:13:00Z', '2026-09-02T07:13:00Z', 'Backfilled from email enquiry.'),

  ('ENQ-bf-12', 'tim zhou', '008619928365001', 'timshangpin@gmail.com', 'china', 'Residential', 'Condo', 'RM200K – RM300K', '1–3 months', 'Google search',
    $m$Tim from Sunpina (Chinese name 尚品宅配) here. We got your inquiry from our official facebook page. We are now vigorously developing overseas franchisees, the support policy is very attractive. B2B franchise / collaboration pitch (not a customer lead). Tim Zhou, Business Development Director.$m$,
    'spam', 'website', '2026-09-01T08:36:36Z', '2026-09-01T08:36:36Z', 'Backfilled from email — inbound sales pitch, marked spam.'),

  ('ENQ-bf-13', 'Lena Tan', '+447389834348', null, 'Horizon Hills', 'Residential', 'Landed house', 'RM300K – RM500K', null, null,
    null,
    'contacted', 'website', '2026-08-28T07:57:43Z', '2026-08-28T07:57:43Z', 'Backfilled from email enquiry.'),

  ('ENQ-bf-14', 'Kelvin', '+6597915101', null, 'Horizon Hills montcourt', 'Residential', 'Landed house', 'RM200K – RM300K', null, null,
    $m$Modern, warm and cozy$m$,
    'contacted', 'website', '2026-08-12T14:12:43Z', '2026-08-12T14:12:43Z', 'Backfilled from email enquiry.')

on conflict (id) do nothing;
