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

export async function connectGoogleCalendar(hint?: string): Promise<ConnectResult> {
  const code = await requestAuthCode(hint);
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/google-oauth-connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Connect failed (${res.status})`);
  return data as ConnectResult;
}
