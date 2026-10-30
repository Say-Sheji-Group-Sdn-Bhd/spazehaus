create extension if not exists "pg_net" with schema "public";

alter table "public"."quotation_items" drop constraint "quotation_items_quotation_id_fkey";

drop function if exists "public"."convert_inquiry_to_project"(p_inquiry_id text, p_project_name text, p_designer_name text, p_pm_name text, p_designer_avatar text, p_pm_avatar text, p_start_date date, p_target_date date, p_budget numeric, p_priority text, p_areas text[], p_proposal_deposit numeric, p_assigned_to_avatar text);


  create table "public"."calendar_google_links" (
    "event_id" text not null,
    "user_id" uuid not null,
    "google_calendar_id" text not null default 'primary'::text,
    "google_event_id" text not null,
    "etag" text,
    "last_synced_at" timestamp with time zone not null default now()
      );


alter table "public"."calendar_google_links" enable row level security;


  create table "public"."developers" (
    "id" text not null,
    "email" text not null,
    "name" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."developers" enable row level security;


  create table "public"."google_oauth_tokens" (
    "user_id" uuid not null,
    "email" text,
    "access_token" text,
    "refresh_token" text,
    "expiry" timestamp with time zone,
    "scope" text,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."google_oauth_tokens" enable row level security;

alter table "public"."projects" add column "project_code" text;

alter table "public"."projects" add column "service_type" text;

alter table "public"."staff" add column "is_developer" boolean not null default false;

CREATE UNIQUE INDEX calendar_google_links_pkey ON public.calendar_google_links USING btree (event_id, user_id);

CREATE UNIQUE INDEX developers_email_key ON public.developers USING btree (email);

CREATE UNIQUE INDEX developers_pkey ON public.developers USING btree (id);

CREATE UNIQUE INDEX google_oauth_tokens_pkey ON public.google_oauth_tokens USING btree (user_id);

CREATE UNIQUE INDEX projects_project_code_key ON public.projects USING btree (project_code);

alter table "public"."calendar_google_links" add constraint "calendar_google_links_pkey" PRIMARY KEY using index "calendar_google_links_pkey";

alter table "public"."developers" add constraint "developers_pkey" PRIMARY KEY using index "developers_pkey";

alter table "public"."google_oauth_tokens" add constraint "google_oauth_tokens_pkey" PRIMARY KEY using index "google_oauth_tokens_pkey";

alter table "public"."calendar_google_links" add constraint "calendar_google_links_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."calendar_google_links" validate constraint "calendar_google_links_user_id_fkey";

alter table "public"."developers" add constraint "developers_email_key" UNIQUE using index "developers_email_key";

alter table "public"."google_oauth_tokens" add constraint "google_oauth_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."google_oauth_tokens" validate constraint "google_oauth_tokens_user_id_fkey";

alter table "public"."projects" add constraint "projects_service_type_check" CHECK (((service_type IS NULL) OR (service_type = ANY (ARRAY['Design'::text, 'Renovation'::text])))) not valid;

alter table "public"."projects" validate constraint "projects_service_type_check";

alter table "public"."quotation_items" add constraint "quotation_items_quotation_id_fkey" FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."quotation_items" validate constraint "quotation_items_quotation_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.convert_inquiry_to_project(p_inquiry_id text, p_project_name text, p_designer_name text, p_pm_name text, p_designer_avatar text, p_pm_avatar text, p_start_date date, p_target_date date, p_budget numeric, p_priority text, p_areas text[], p_proposal_deposit numeric, p_assigned_to_avatar text DEFAULT NULL::text, p_service_type text DEFAULT 'Design'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_inq inquiries%rowtype; v_new_id text; v_max int; v_today date := current_date;
  v_design_fee numeric; v_reno_total numeric; v_reno_dep numeric; v_progressive numeric;
  v_final numeric; v_type text; v_log_entry jsonb;
  v_prefix text; v_code_max int; v_project_code text;
begin
  if not public.is_ops_tier() then
    raise exception 'Not authorized to convert inquiries' using errcode = '42501';
  end if;

  select * into v_inq from inquiries where id = p_inquiry_id for update;
  if not found then raise exception 'Inquiry % not found', p_inquiry_id; end if;
  if v_inq.stage = 'awarded' then raise exception 'Inquiry % is already awarded', p_inquiry_id; end if;
  if v_inq.stage = 'rejected' then raise exception 'Cannot convert rejected inquiry %', p_inquiry_id; end if;

  select coalesce(max(substring(id from 4)::int), 0) into v_max
    from projects where id ~ '^PRJ\d+$';
  v_new_id := 'PRJ' || lpad((v_max + 1)::text, 3, '0');

  -- SD (Design) / SR (Renovation) code: <PREFIX><YY>-<seq from 801>.
  v_prefix := case when p_service_type = 'Renovation' then 'SR' else 'SD' end;
  select coalesce(max(substring(project_code from '[0-9]+$')::int), 800) into v_code_max
    from projects where project_code like v_prefix || to_char(v_today, 'YY') || '-%';
  v_project_code := v_prefix || to_char(v_today, 'YY') || '-' || lpad((v_code_max + 1)::text, 3, '0');

  v_type := case when v_inq.category = 'Residential' then 'Residential' else 'Commercial' end;
  v_design_fee  := round(p_budget * 0.07);
  v_reno_total  := greatest(0, p_budget - p_proposal_deposit - v_design_fee);
  v_reno_dep    := round(v_reno_total * 0.5);
  v_progressive := round(v_reno_total * 0.3);
  v_final       := v_reno_total - v_reno_dep - v_progressive;

  insert into projects (
    id, name, client_name, client_contact, client_email,
    project_type, property_type, service_type, project_code, location, size_sqft, budget,
    start_date, target_date, status, priority, progress,
    designer_id, pm_id, team, current_stage_id, lifecycle_started_at,
    photo_count, task_count, tasks_completed, areas, description
  ) values (
    v_new_id, p_project_name, v_inq.client_name, v_inq.contact, v_inq.email,
    v_type, v_inq.property_type, p_service_type, v_project_code, v_inq.location, coalesce(v_inq.estimated_size, 1000), p_budget,
    p_start_date, p_target_date, 'assigned', p_priority::public.project_priority, 0,
    null, null, coalesce(array[p_designer_avatar, p_pm_avatar], '{}'), 'design-prop-signed', v_today,
    0, 0, 0, coalesce(p_areas, '{}'),
    format('Converted from inquiry %s on %s.', v_inq.id, to_char(v_today, 'DD/MM/YYYY'))
  );

  update projects
     set designer_id = (select id from staff where avatar_code = p_designer_avatar limit 1),
         pm_id       = (select id from staff where avatar_code = p_pm_avatar       limit 1)
   where id = v_new_id;

  insert into payment_records (project_id, gate, label, amount, status, collected_date, reference) values
    (v_new_id, 1, 'Proposal Deposit', p_proposal_deposit, 'completed', v_today, 'PD-' || to_char(v_today, 'YYYY') || '-NEW');
  insert into payment_records (project_id, gate, label, amount, status) values
    (v_new_id, 2, 'Design Contract Fee', v_design_fee, 'pending'),
    (v_new_id, 3, 'Renovation Deposit (50%)', v_reno_dep, 'pending'),
    (v_new_id, 4, 'Progressive Payment', v_progressive, 'pending'),
    (v_new_id, 5, 'Final Payment', v_final, 'pending');
  update payment_records set notes = 'To be split into instalments' where project_id = v_new_id and gate = 4;

  insert into signature_records (project_id, signature_key, label, group_name, status) values
    (v_new_id, 'design-contract', 'Design Contract', 'contract', 'pending'),
    (v_new_id, 'revised-3d', 'Revised 3D Drawing', 'drawing', 'pending'),
    (v_new_id, 'renovation-contract', 'Renovation Contract', 'contract', 'pending'),
    (v_new_id, 'material-selection', 'Material Selection', 'drawing', 'pending'),
    (v_new_id, '2d-shopping', '2D Drawing / Shopping List', 'drawing', 'pending'),
    (v_new_id, 'handover', 'Handover Acceptance', 'contract', 'pending');

  v_log_entry := jsonb_build_object(
    'date', to_char(v_today, 'DD/MM/YYYY'), 'type', 'meet',
    'note', format('Design proposal signed · converted to project %s (RM %s)', v_new_id, to_char(p_budget, 'FM999G999G999')),
    'by', coalesce(p_assigned_to_avatar, v_inq.assigned_to_id, 'GT')
  );
  update inquiries
     set stage = 'awarded', awarded_project_id = v_new_id, awarded_date = v_today,
         last_updated = v_today, contact_log = contact_log || jsonb_build_array(v_log_entry)
   where id = p_inquiry_id;

  return v_new_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.link_staff_on_staff_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.auth_user_id is null then
    select id into new.auth_user_id
      from auth.users where lower(email) = lower(new.email) limit 1;
  end if;
  return new;
end;
$function$
;

grant delete on table "public"."calendar_google_links" to "anon";

grant insert on table "public"."calendar_google_links" to "anon";

grant references on table "public"."calendar_google_links" to "anon";

grant select on table "public"."calendar_google_links" to "anon";

grant trigger on table "public"."calendar_google_links" to "anon";

grant truncate on table "public"."calendar_google_links" to "anon";

grant update on table "public"."calendar_google_links" to "anon";

grant delete on table "public"."calendar_google_links" to "authenticated";

grant insert on table "public"."calendar_google_links" to "authenticated";

grant references on table "public"."calendar_google_links" to "authenticated";

grant select on table "public"."calendar_google_links" to "authenticated";

grant trigger on table "public"."calendar_google_links" to "authenticated";

grant truncate on table "public"."calendar_google_links" to "authenticated";

grant update on table "public"."calendar_google_links" to "authenticated";

grant delete on table "public"."calendar_google_links" to "service_role";

grant insert on table "public"."calendar_google_links" to "service_role";

grant references on table "public"."calendar_google_links" to "service_role";

grant select on table "public"."calendar_google_links" to "service_role";

grant trigger on table "public"."calendar_google_links" to "service_role";

grant truncate on table "public"."calendar_google_links" to "service_role";

grant update on table "public"."calendar_google_links" to "service_role";

grant delete on table "public"."developers" to "anon";

grant insert on table "public"."developers" to "anon";

grant references on table "public"."developers" to "anon";

grant select on table "public"."developers" to "anon";

grant trigger on table "public"."developers" to "anon";

grant truncate on table "public"."developers" to "anon";

grant update on table "public"."developers" to "anon";

grant delete on table "public"."developers" to "authenticated";

grant insert on table "public"."developers" to "authenticated";

grant references on table "public"."developers" to "authenticated";

grant select on table "public"."developers" to "authenticated";

grant trigger on table "public"."developers" to "authenticated";

grant truncate on table "public"."developers" to "authenticated";

grant update on table "public"."developers" to "authenticated";

grant delete on table "public"."developers" to "service_role";

grant insert on table "public"."developers" to "service_role";

grant references on table "public"."developers" to "service_role";

grant select on table "public"."developers" to "service_role";

grant trigger on table "public"."developers" to "service_role";

grant truncate on table "public"."developers" to "service_role";

grant update on table "public"."developers" to "service_role";

grant delete on table "public"."google_oauth_tokens" to "anon";

grant insert on table "public"."google_oauth_tokens" to "anon";

grant references on table "public"."google_oauth_tokens" to "anon";

grant select on table "public"."google_oauth_tokens" to "anon";

grant trigger on table "public"."google_oauth_tokens" to "anon";

grant truncate on table "public"."google_oauth_tokens" to "anon";

grant update on table "public"."google_oauth_tokens" to "anon";

grant delete on table "public"."google_oauth_tokens" to "authenticated";

grant insert on table "public"."google_oauth_tokens" to "authenticated";

grant references on table "public"."google_oauth_tokens" to "authenticated";

grant select on table "public"."google_oauth_tokens" to "authenticated";

grant trigger on table "public"."google_oauth_tokens" to "authenticated";

grant truncate on table "public"."google_oauth_tokens" to "authenticated";

grant update on table "public"."google_oauth_tokens" to "authenticated";

grant delete on table "public"."google_oauth_tokens" to "service_role";

grant insert on table "public"."google_oauth_tokens" to "service_role";

grant references on table "public"."google_oauth_tokens" to "service_role";

grant select on table "public"."google_oauth_tokens" to "service_role";

grant trigger on table "public"."google_oauth_tokens" to "service_role";

grant truncate on table "public"."google_oauth_tokens" to "service_role";

grant update on table "public"."google_oauth_tokens" to "service_role";


  create policy "own google links"
  on "public"."calendar_google_links"
  as permissive
  for all
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));


CREATE TRIGGER trg_link_staff_on_staff_change BEFORE INSERT OR UPDATE OF email ON public.staff FOR EACH ROW EXECUTE FUNCTION public.link_staff_on_staff_change();


