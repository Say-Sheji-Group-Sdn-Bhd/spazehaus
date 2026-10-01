// Read/write the calendar_google_links mapping (RLS scopes rows to the current
// user). One row per (calendar event, user) = the Google event created in that
// user's calendar, so re-syncing UPDATES the same event instead of duplicating.
import { supabase } from "@/lib/supabase";

export interface GoogleLink {
  eventId: string;
  googleEventId: string;
  googleCalendarId: string;
  etag: string | null;
}

/** All of the current user's event → Google-event links, keyed by app event id. */
export async function loadGoogleLinks(): Promise<Record<string, GoogleLink>> {
  const { data, error } = await supabase.from("calendar_google_links").select("*");
  if (error) {
    throw new Error(
      error.code === "PGRST205" || error.message?.includes("calendar_google_links")
        ? "The calendar_google_links table is missing — run its migration in Supabase."
        : `Loading Google links failed: ${error.message}`,
    );
  }
  const map: Record<string, GoogleLink> = {};
  for (const row of data ?? []) {
    map[row.event_id] = {
      eventId: row.event_id,
      googleEventId: row.google_event_id,
      googleCalendarId: row.google_calendar_id,
      etag: row.etag,
    };
  }
  return map;
}

export async function upsertGoogleLink(userId: string, link: GoogleLink): Promise<void> {
  const { error } = await supabase.from("calendar_google_links").upsert({
    event_id: link.eventId,
    user_id: userId,
    google_calendar_id: link.googleCalendarId,
    google_event_id: link.googleEventId,
    etag: link.etag,
  });
  if (error) throw new Error(`Saving a Google link failed: ${error.message}`);
}

export async function deleteGoogleLink(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("calendar_google_links")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) throw new Error(`Deleting a Google link failed: ${error.message}`);
}
