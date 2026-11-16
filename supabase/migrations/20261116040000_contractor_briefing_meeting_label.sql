-- Rename the Renovation-side "Contractor Briefing" stage to "Contractor Briefing
-- Meeting" (client's wording). Label-only; the DESIGN-side stage keeps its own label.
-- Lockstep with lifecycleData.ts + seed.sql. Deploy: supabase db push.

update public.lifecycle_stages
   set label = 'Contractor Briefing Meeting'
 where id = 'contractor-brief';
