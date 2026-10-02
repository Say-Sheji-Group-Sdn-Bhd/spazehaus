// Convert a Spazehaus calendar_events row into a Google Calendar event body
// (export-only). Ported from SayWorks and adapted to this app's schema.
import type { CalendarEventRow, CalendarEventType } from "@/lib/dbTypes";

// v1 timezone (Malaysia). Per-user TZ can come later.
export const APP_TIMEZONE = "Asia/Kuala_Lumpur";

const DEFAULT_DURATION_MIN = 60;

const TYPE_PREFIX: Record<CalendarEventType, string> = {
  project: "Project",
  meeting: "Meeting",
  leave: "Leave",
  event: "Event",
};

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const clamped = Math.min(total, 23 * 60 + 59); // never spill past the same day (v1)
  const nh = Math.floor(clamped / 60);
  const nm = clamped % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function nextDay(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface GoogleEventBody {
  summary: string;
  description?: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  extendedProperties: { private: Record<string, string> };
}

/** Convert a Spazehaus calendar event into a Google Calendar event body. */
export function toGoogleEvent(event: CalendarEventRow, timeZone: string = APP_TIMEZONE): GoogleEventBody {
  const summary = `[${TYPE_PREFIX[event.event_type] ?? "Event"}] ${event.title}`;
  const allDay = !event.start_time;

  let start: GoogleEventBody["start"];
  let end: GoogleEventBody["end"];
  if (allDay) {
    start = { date: event.event_date };
    end = { date: nextDay(event.end_date ?? event.event_date) };
  } else {
    const startTime = (event.start_time as string).slice(0, 5); // HH:MM (non-null in this branch)
    let endTime =
      event.end_time && event.end_time.slice(0, 5) > startTime
        ? event.end_time.slice(0, 5)
        : addMinutes(startTime, DEFAULT_DURATION_MIN);
    if (endTime <= startTime) endTime = "23:59";
    // A timed event can still span multiple days — use end_date for the end
    // when it's later than the start day (otherwise it collapses to one day).
    const endDay = event.end_date && event.end_date > event.event_date ? event.end_date : event.event_date;
    start = { dateTime: `${event.event_date}T${startTime}:00`, timeZone };
    end = { dateTime: `${endDay}T${endTime}:00`, timeZone };
  }

  const body: GoogleEventBody = {
    summary,
    start,
    end,
    extendedProperties: {
      private: { spazehaus_event_id: event.id },
    },
  };
  if (event.notes) body.description = event.notes;
  return body;
}
