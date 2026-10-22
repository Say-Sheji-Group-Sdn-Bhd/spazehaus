// Server-side connect: run the GIS code flow, then hand the one-time code to the
// google-oauth-connect Edge Function, which exchanges it (with the client secret)
// for a refresh token stored server-side. After this, the server can auto-sync
// the user's calendar with no further clicks.
import { supabase } from "@/lib/supabase";
import { requestAuthCode } from "./gis";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export interface ConnectResult {
  connected: boolean;
  gotRefreshToken: boolean;
}

// Per-browser marker that THIS user has completed the real OAuth connect (a
// refresh token is stored server-side). Lets the "Sync Google" button decide
// between "connect for the first time" (needs the consent popup, which must open
// inside the click gesture) and "just re-sync now". The server is the source of
// truth — this is only a UI hint, cleared when a sync comes back not_connected.
function markerKey(userId: string): string {
  return `spz:gcal-connected:${userId}`;
}

export function isGoogleConnectedLocally(userId: string | undefined): boolean {
  if (!userId) return false;
  try {
    return Boolean(localStorage.getItem(markerKey(userId)));
  } catch {
    return false;
  }
}

export function setGoogleConnectedLocally(userId: string | undefined, connected: boolean): void {
  if (!userId) return;
  try {
    if (connected) localStorage.setItem(markerKey(userId), "1");
    else localStorage.removeItem(markerKey(userId));
  } catch {
    /* storage unavailable (private mode / blocked) — the server still knows */
  }
}

/**
 * Run the real OAuth connect: GIS code flow → google-oauth-connect Edge Function
 * stores the refresh token. On success, records the local "connected" marker so
 * later clicks re-sync instead of re-prompting for consent.
 */
export async function connectGoogleCalendar(hint?: string): Promise<ConnectResult> {
  const code = await requestAuthCode(hint);
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const userId = sessionData.session?.user?.id;
  if (!token) throw new Error("Not signed in");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/google-oauth-connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Connect failed (${res.status})`);
  const result = data as ConnectResult;
  if (result.connected) setGoogleConnectedLocally(userId, true);
  return result;
}

export type ResyncStatus = "synced" | "not_connected" | "reauth_required" | "no_staff" | "error";

/**
 * Ask the server to re-sync the signed-in user's own calendar now (no popup).
 * Returns that user's status from the google-calendar-sync Edge Function. With
 * an empty body the function defaults to syncing just the caller.
 */
export async function resyncGoogleCalendar(): Promise<ResyncStatus> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/google-calendar-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Sync failed (${res.status})`);
  const status = data?.synced?.[0]?.status as ResyncStatus | undefined;
  return status ?? "error";
}
