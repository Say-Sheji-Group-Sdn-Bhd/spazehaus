/*
 * SPAZEHAUS — Google Calendar server sync (Supabase Edge Function)
 *
 * P2 of the calendar auto-sync build (plan: .claude/plan/26-10-22-calendar-auto-sync-build.plan.md).
 *
 * WHAT IT DOES
 *   Given a target Supabase auth user (or a batch, or "all connected users"),
 *   this function pushes the calendar events that user is CREATOR or ASSIGNEE of
 *   into THAT user's own Google Calendar — with no browser and no clicks. It is
 *   the server-side counterpart of the browser `exportEvents()` (client/src/lib/
 *   google/sync.ts): same reconcile model, but it mints its own access token from
 *   the stored refresh token instead of a GIS popup.
 *
 * AUTH (verify_jwt stays true — Supabase's gateway requires a valid JWT bearer):
 *   • Bearer == SUPABASE_SERVICE_ROLE_KEY  → server/cron mode. May sync explicit
 *     userIds, or ALL connected users when none are given (the pg_cron safety net).
 *   • Otherwise the bearer is treated as a signed-in staff member's JWT. Any
 *     authenticated staff may trigger a sync for any affected user (the app fires
 *     it for creator + every assignee of an event they just changed). With no
 *     userIds in the body it defaults to syncing just the caller.
 *
 * DATA MODEL BRIDGE (important):
 *   google_oauth_tokens.user_id and calendar_google_links.user_id are AUTH user
 *   ids. calendar_events.created_by / .staff_id and calendar_event_staff.staff_id
 *   are STAFF ids. staff.auth_user_id bridges the two. So for a given auth user we
 *   first resolve their staff id, then gather events by that staff id.
 *
 * Secrets (Supabase → Edge Functions → Secrets): GOOGLE_CLIENT_ID,
 * GOOGLE_CLIENT_SECRET. SUPABASE_URL / _SERVICE_ROLE_KEY / _ANON_KEY are injected.
 */
// @ts-expect-error — Deno runtime; esm.sh resolves at deploy, not for the local checker.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.4";

declare const Deno: { env: { get(key: string): string | undefined } };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping: Spazehaus calendar_events row → Google Calendar event body.
// PORTED from client/src/lib/google/map.ts — keep the two IN SYNC. (Deno can't
// import the client module: different module system + @/ path aliases.)
// ─────────────────────────────────────────────────────────────────────────────
const APP_TIMEZONE = "Asia/Kuala_Lumpur";
const DEFAULT_DURATION_MIN = 60;

type CalendarEventType = "project" | "meeting" | "leave" | "event";

interface CalendarEventRow {
  id: string;
  title: string;
  event_type: CalendarEventType;
  event_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  created_by: string | null;
  staff_id: string | null;
}

const TYPE_PREFIX: Record<CalendarEventType, string> = {
  project: "Project",
  meeting: "Meeting",
  leave: "Leave",
  event: "Event",
};

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const clamped = Math.min(total, 23 * 60 + 59);
  const nh = Math.floor(clamped / 60);
  const nm = clamped % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function nextDay(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface GoogleEventBody {
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  extendedProperties: { private: Record<string, string> };
}

function toGoogleEvent(event: CalendarEventRow, timeZone = APP_TIMEZONE): GoogleEventBody {
  const summary = `[${TYPE_PREFIX[event.event_type] ?? "Event"}] ${event.title}`;
  const allDay = !event.start_time;

  let start: GoogleEventBody["start"];
  let end: GoogleEventBody["end"];
  if (allDay) {
    start = { date: event.event_date };
    end = { date: nextDay(event.end_date ?? event.event_date) };
  } else {
    const startTime = (event.start_time as string).slice(0, 5);
    let endTime =
      event.end_time && event.end_time.slice(0, 5) > startTime
        ? event.end_time.slice(0, 5)
        : addMinutes(startTime, DEFAULT_DURATION_MIN);
    if (endTime <= startTime) endTime = "23:59";
    const endDay = event.end_date && event.end_date > event.event_date ? event.end_date : event.event_date;
    start = { dateTime: `${event.event_date}T${startTime}:00`, timeZone };
    end = { dateTime: `${endDay}T${endTime}:00`, timeZone };
  }

  const body: GoogleEventBody = {
    summary,
    start,
    end,
    extendedProperties: { private: { spazehaus_event_id: event.id } },
  };
  if (event.notes) body.description = event.notes;
  return body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Calendar REST (events.insert / patch / delete) + token refresh.
// ─────────────────────────────────────────────────────────────────────────────
const GCAL_BASE = "https://www.googleapis.com/calendar/v3/calendars";
const PRIMARY = "primary";

function eventsUrl(calendarId: string, eventId?: string): string {
  const base = `${GCAL_BASE}/${encodeURIComponent(calendarId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

async function gcalFetch(token: string, url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

interface GoogleEventResult {
  id: string;
  etag: string;
}

async function insertGoogleEvent(token: string, calendarId: string, body: GoogleEventBody): Promise<GoogleEventResult> {
  const res = await gcalFetch(token, eventsUrl(calendarId), { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Google insert failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, etag: data.etag };
}

async function patchGoogleEvent(
  token: string,
  calendarId: string,
  eventId: string,
  body: GoogleEventBody,
): Promise<GoogleEventResult | null> {
  const res = await gcalFetch(token, eventsUrl(calendarId, eventId), { method: "PATCH", body: JSON.stringify(body) });
  // The Google event was deleted out from under us (user removed it) → signal
  // the caller to re-create + relink instead of failing the whole run.
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`Google update failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, etag: data.etag };
}

async function deleteGoogleEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  const res = await gcalFetch(token, eventsUrl(calendarId, eventId), { method: "DELETE" });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google delete failed (${res.status})`);
  }
}

/** Exchange a stored refresh token for a fresh access token. */
async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number } | { error: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    // invalid_grant = the user revoked access or the refresh token expired.
    return { error: data.error || `refresh failed (${res.status})` };
  }
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in ?? 3600) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-user sync
// ─────────────────────────────────────────────────────────────────────────────
interface UserSyncResult {
  userId: string;
  status: "synced" | "not_connected" | "no_staff" | "reauth_required" | "error";
  created?: number;
  updated?: number;
  removed?: number;
  error?: string;
}

// deno-lint-ignore no-explicit-any
type Admin = any;

async function syncOneUser(
  admin: Admin,
  clientId: string,
  clientSecret: string,
  userId: string,
): Promise<UserSyncResult> {
  // 1. Load the stored token row for this auth user.
  const { data: tokenRow, error: tokErr } = await admin
    .from("google_oauth_tokens")
    .select("refresh_token, email")
    .eq("user_id", userId)
    .maybeSingle();
  if (tokErr) return { userId, status: "error", error: `token load: ${tokErr.message}` };
  if (!tokenRow?.refresh_token) return { userId, status: "not_connected" };

  // 2. Resolve the staff id for this auth user (events are keyed by staff id).
  const { data: staffRow, error: staffErr } = await admin
    .from("staff")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (staffErr) return { userId, status: "error", error: `staff load: ${staffErr.message}` };
  if (!staffRow?.id) return { userId, status: "no_staff" };
  const staffId = staffRow.id as string;

  // 3. Fresh access token from the refresh token.
  const refreshed = await refreshAccessToken(clientId, clientSecret, tokenRow.refresh_token);
  if ("error" in refreshed) {
    return { userId, status: "reauth_required", error: refreshed.error };
  }
  const accessToken = refreshed.accessToken;
  // Persist the new access token + expiry (keeps the row fresh; refresh token unchanged).
  await admin
    .from("google_oauth_tokens")
    .update({
      access_token: accessToken,
      expiry: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  // 4. Gather events where this staff is creator OR assignee (legacy + multi-staff).
  //    Full set (no date window) — the reconcile below deletes any link not in
  //    this set, so a narrower set would wrongly remove still-valid past events.
  const { data: ownEvents, error: ownErr } = await admin
    .from("calendar_events")
    .select("id, title, event_type, event_date, end_date, start_time, end_time, notes, created_by, staff_id")
    .or(`created_by.eq.${staffId},staff_id.eq.${staffId}`);
  if (ownErr) return { userId, status: "error", error: `events load: ${ownErr.message}` };

  const { data: assignRows, error: asgErr } = await admin
    .from("calendar_event_staff")
    .select("event_id")
    .eq("staff_id", staffId);
  if (asgErr) return { userId, status: "error", error: `assignees load: ${asgErr.message}` };

  const byId = new Map<string, CalendarEventRow>();
  for (const e of (ownEvents ?? []) as CalendarEventRow[]) byId.set(e.id, e);

  const missingAssigned = (assignRows ?? [])
    .map((r: { event_id: string }) => r.event_id)
    .filter((id: string) => !byId.has(id));
  if (missingAssigned.length > 0) {
    const { data: moreEvents, error: moreErr } = await admin
      .from("calendar_events")
      .select("id, title, event_type, event_date, end_date, start_time, end_time, notes, created_by, staff_id")
      .in("id", missingAssigned);
    if (moreErr) return { userId, status: "error", error: `assigned events load: ${moreErr.message}` };
    for (const e of (moreEvents ?? []) as CalendarEventRow[]) byId.set(e.id, e);
  }
  const events = [...byId.values()];
  const currentIds = new Set(events.map((e) => e.id));

  // 5. Load this user's existing event→Google links (service role: scope by user_id).
  const { data: linkRows, error: linkErr } = await admin
    .from("calendar_google_links")
    .select("event_id, google_event_id, google_calendar_id, etag")
    .eq("user_id", userId);
  if (linkErr) return { userId, status: "error", error: `links load: ${linkErr.message}` };
  const links = new Map<string, { google_event_id: string; google_calendar_id: string }>();
  for (const r of linkRows ?? []) links.set(r.event_id, r);

  let created = 0;
  let updated = 0;
  let removed = 0;

  // 6. Reconcile: insert new, patch existing, (re-create if vanished on Google).
  for (const event of events) {
    const body = toGoogleEvent(event);
    const existing = links.get(event.id);
    if (existing) {
      const patched = await patchGoogleEvent(accessToken, existing.google_calendar_id, existing.google_event_id, body);
      if (patched) {
        updated += 1;
      } else {
        // Was deleted on Google → recreate and relink.
        const re = await insertGoogleEvent(accessToken, PRIMARY, body);
        await admin.from("calendar_google_links").upsert({
          event_id: event.id,
          user_id: userId,
          google_calendar_id: PRIMARY,
          google_event_id: re.id,
          etag: re.etag,
          last_synced_at: new Date().toISOString(),
        });
        created += 1;
      }
    } else {
      const re = await insertGoogleEvent(accessToken, PRIMARY, body);
      await admin.from("calendar_google_links").upsert({
        event_id: event.id,
        user_id: userId,
        google_calendar_id: PRIMARY,
        google_event_id: re.id,
        etag: re.etag,
        last_synced_at: new Date().toISOString(),
      });
      created += 1;
    }
  }

  // 7. Anything previously synced but no longer creator/assignee → remove from Google.
  for (const [eventId, link] of links.entries()) {
    if (!currentIds.has(eventId)) {
      await deleteGoogleEvent(accessToken, link.google_calendar_id, link.google_event_id);
      await admin.from("calendar_google_links").delete().eq("event_id", eventId).eq("user_id", userId);
      removed += 1;
    }
  }

  return { userId, status: "synced", created, updated, removed };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP entry
// ─────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!url || !anon || !serviceKey || !clientId || !clientSecret) {
    return json({ error: "Server misconfigured: missing SUPABASE_* or GOOGLE_CLIENT_ID/SECRET" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearer) return json({ error: "Not authenticated" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const isServer = bearer === serviceKey;

  // Parse body: { userId?, userIds?: string[] }
  const body = await req.json().catch(() => ({}));
  let targets: string[] = [];
  if (Array.isArray(body?.userIds)) targets = body.userIds.filter((x: unknown) => typeof x === "string");
  else if (typeof body?.userId === "string") targets = [body.userId];

  if (!isServer) {
    // Caller is a signed-in staff member — verify their JWT identifies a user.
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Not authenticated" }, 401);
    // With no explicit targets, a staff caller syncs just themselves.
    if (targets.length === 0) targets = [userData.user.id];
  } else if (targets.length === 0) {
    // Server/cron mode with no targets → sync ALL connected users (safety net).
    const { data: allRows, error: allErr } = await admin.from("google_oauth_tokens").select("user_id");
    if (allErr) return json({ error: `listing connected users failed: ${allErr.message}` }, 500);
    targets = [...new Set((allRows ?? []).map((r: { user_id: string }) => r.user_id))];
  }

  if (targets.length === 0) return json({ synced: [], note: "no targets" });

  const results: UserSyncResult[] = [];
  for (const uid of targets) {
    try {
      results.push(await syncOneUser(admin, clientId, clientSecret, uid));
    } catch (e) {
      results.push({ userId: uid, status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }

  return json({ synced: results });
});
