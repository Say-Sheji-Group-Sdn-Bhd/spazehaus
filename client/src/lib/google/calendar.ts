// Thin fetch wrappers over the Google Calendar REST API (events.insert/patch/delete).
// Authenticated with the Bearer access token from gis.ts. Ported from SayWorks.
import type { GoogleEventBody } from "./map";

const BASE = "https://www.googleapis.com/calendar/v3/calendars";

function eventsUrl(calendarId: string, eventId?: string): string {
  const base = `${BASE}/${encodeURIComponent(calendarId)}/events`;
  return eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
}

async function authFetch(token: string, url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export interface GoogleEventResult {
  id: string;
  etag: string;
  htmlLink?: string;
}

export async function insertGoogleEvent(
  token: string,
  calendarId: string,
  body: GoogleEventBody,
): Promise<GoogleEventResult> {
  const res = await authFetch(token, eventsUrl(calendarId), { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Google Calendar insert failed (${res.status})`);
  const data = await res.json();
  return { id: data.id, etag: data.etag, htmlLink: data.htmlLink };
}

export async function patchGoogleEvent(
  token: string,
  calendarId: string,
  eventId: string,
  body: GoogleEventBody,
): Promise<GoogleEventResult> {
  const res = await authFetch(token, eventsUrl(calendarId, eventId), { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Google Calendar update failed (${res.status})`);
  const data = await res.json();
  return { id: data.id, etag: data.etag, htmlLink: data.htmlLink };
}

export async function deleteGoogleEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  const res = await authFetch(token, eventsUrl(calendarId, eventId), { method: "DELETE" });
  // 404/410 = already gone → treat as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar delete failed (${res.status})`);
  }
}
