// Google Identity Services (GIS) OAuth token client — browser only.
// Obtains a short-lived access token for the calendar.events scope. No backend,
// no refresh token. Per-user consent, so it works for ANY Google account
// (personal @gmail.com and Workspace alike). Ported from the SayWorks app.

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

/** True when a Client ID is configured (build-time public env var). */
export const googleConfigured = Boolean(CLIENT_ID);

let scriptPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("GIS is browser-only"));
  const w = window as unknown as { google?: { accounts?: { oauth2?: unknown } } };
  if (w.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

let cachedToken: string | null = null;
let tokenExpiry = 0;

/** True while a still-valid access token is cached (≥1min headroom). */
export function hasGoogleToken(): boolean {
  return Boolean(cachedToken && Date.now() < tokenExpiry - 60_000);
}

export function clearGoogleToken(): void {
  cachedToken = null;
  tokenExpiry = 0;
}

/**
 * Resolve an access token, prompting the Google consent popup when needed.
 * `hint` = the signed-in staff's email. Passed to Google as `login_hint` so the
 * popup targets THAT Google account (their own calendar) instead of showing an
 * account chooser — and skips the chooser entirely when they're already signed
 * into it.
 */
export async function requestAccessToken(hint?: string, opts?: { silent?: boolean }): Promise<string> {
  if (!CLIENT_ID) throw new Error("Google Client ID not configured (VITE_GOOGLE_CLIENT_ID)");
  if (hasGoogleToken()) return cachedToken as string;
  await loadGis();

  const oauth2 = (window as unknown as {
    google: { accounts: { oauth2: { initTokenClient: (c: unknown) => { requestAccessToken: (o?: unknown) => void } } } };
  }).google.accounts.oauth2;

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      ...(hint ? { hint } : {}),
      // silent: no popup — succeeds only if the user already consented and has a
      // live Google session (used for background auto-sync on app open).
      ...(opts?.silent ? { prompt: "" } : {}),
      callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || "Google authorization failed"));
          return;
        }
        cachedToken = resp.access_token;
        tokenExpiry = Date.now() + Number(resp.expires_in ?? 3600) * 1000;
        resolve(resp.access_token);
      },
      // Fires when the popup is dismissed or a silent attempt can't complete —
      // reject so the caller (esp. the silent path) can swallow it quietly.
      error_callback: (err: { type?: string; message?: string }) => {
        reject(new Error(err?.message || err?.type || "Google authorization cancelled"));
      },
    });
    client.requestAccessToken();
  });
}

/**
 * Run the GIS *authorization-code* flow (for server-side offline access). Returns
 * a one-time auth code that a backend exchanges (with the client secret) for a
 * REFRESH token. Opens a consent popup → must be called from a user click.
 * `hint` pre-selects the user's Google account.
 */
export async function requestAuthCode(hint?: string): Promise<string> {
  if (!CLIENT_ID) throw new Error("Google Client ID not configured (VITE_GOOGLE_CLIENT_ID)");
  await loadGis();

  const oauth2 = (window as unknown as {
    google: { accounts: { oauth2: { initCodeClient: (c: unknown) => { requestCode: () => void } } } };
  }).google.accounts.oauth2;

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initCodeClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      ux_mode: "popup",
      ...(hint ? { hint } : {}),
      callback: (resp: { code?: string; error?: string }) => {
        if (resp.error || !resp.code) {
          reject(new Error(resp.error || "Google authorization failed"));
          return;
        }
        resolve(resp.code);
      },
      error_callback: (err: { type?: string; message?: string }) => {
        reject(new Error(err?.message || err?.type || "Google authorization cancelled"));
      },
    });
    client.requestCode();
  });
}
