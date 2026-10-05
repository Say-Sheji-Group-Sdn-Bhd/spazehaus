/*
 * SPAZEHAUS — Google OAuth connect (Supabase Edge Function)
 *
 * Phase 1 of server-side auto-sync. The browser runs the GIS *code* flow
 * (google.accounts.oauth2.initCodeClient) → gets a one-time auth `code` → POSTs
 * it here with the signed-in user's Supabase JWT. This function exchanges the
 * code (using the confidential client secret) for an access + REFRESH token and
 * stores them in `google_oauth_tokens`, keyed by the Supabase user id.
 *
 * The refresh token is what lets the server sync the user's calendar later with
 * no further clicks. Stored service-role-only (RLS blocks all client reads).
 *
 * Secrets (Supabase → Edge Functions → Secrets): GOOGLE_CLIENT_ID,
 * GOOGLE_CLIENT_SECRET. SUPABASE_URL / _ANON_KEY / _SERVICE_ROLE_KEY are injected.
 * verify_jwt stays true (default) → only signed-in staff can call this.
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

  // Identify the caller from their Supabase JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "Not authenticated" }, 401);
  const user = userData.user;

  const { code } = await req.json().catch(() => ({ code: null }));
  if (!code) return json({ error: "Missing auth code" }, 400);

  // Exchange the one-time code for tokens. redirect_uri='postmessage' is the
  // value GIS's popup code flow expects for a confidential web client.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: "postmessage",
      grant_type: "authorization_code",
    }),
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok) return json({ error: "Token exchange failed", detail: token }, 400);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const expiry = new Date(Date.now() + Number(token.expires_in ?? 3600) * 1000).toISOString();
  const { error: upErr } = await admin.from("google_oauth_tokens").upsert(
    {
      user_id: user.id,
      email: user.email ?? null,
      access_token: token.access_token,
      // refresh_token comes back only on the FIRST consent — keep the stored one otherwise.
      ...(token.refresh_token ? { refresh_token: token.refresh_token } : {}),
      expiry,
      scope: token.scope ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (upErr) return json({ error: `Store failed: ${upErr.message}` }, 500);

  return json({ connected: true, gotRefreshToken: !!token.refresh_token });
});
