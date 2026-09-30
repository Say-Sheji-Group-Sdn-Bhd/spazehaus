// Export-only reconcile: push the calendar events into the current user's own
// Google Calendar. Idempotent via calendar_google_links — re-running updates the
// same Google events instead of duplicating, and removes ones that disappeared.
// Ported from the SayWorks app.
import type { CalendarEventRow } from "@/lib/dbTypes";
import { toGoogleEvent } from "./map";
import { requestAccessToken } from "./gis";
import { insertGoogleEvent, patchGoogleEvent, deleteGoogleEvent } from "./calendar";
import { loadGoogleLinks, upsertGoogleLink, deleteGoogleLink } from "./links";

const PRIMARY = "primary";

export interface SyncResult {
  created: number;
  updated: number;
  removed: number;
}

/**
 * Reconcile `events` into the user's Google Calendar. Prompts the Google consent
 * popup on first run via requestAccessToken(). `userId` = the Supabase auth user id.
 */
export async function exportEvents(userId: string, events: CalendarEventRow[]): Promise<SyncResult> {
  const token = await requestAccessToken();
  const links = await loadGoogleLinks();
  const currentIds = new Set(events.map((e) => e.id));
  const result: SyncResult = { created: 0, updated: 0, removed: 0 };

  for (const event of events) {
    const body = toGoogleEvent(event);
    const existing = links[event.id];
    if (existing) {
      await patchGoogleEvent(token, existing.googleCalendarId, existing.googleEventId, body);
      result.updated += 1;
    } else {
      const created = await insertGoogleEvent(token, PRIMARY, body);
      await upsertGoogleLink(userId, {
        eventId: event.id,
        googleEventId: created.id,
        googleCalendarId: PRIMARY,
        etag: created.etag,
      });
      result.created += 1;
    }
  }

  // Anything previously exported but no longer present → remove from Google.
  for (const [eventId, link] of Object.entries(links)) {
    if (!currentIds.has(eventId)) {
      await deleteGoogleEvent(token, link.googleCalendarId, link.googleEventId);
      await deleteGoogleLink(eventId, userId);
      result.removed += 1;
    }
  }

  return result;
}
