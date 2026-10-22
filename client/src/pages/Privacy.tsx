/*
 * SPAZEHAUS — Privacy Policy (public, no auth)
 *
 * Reachable at /privacy without a Supabase session so it can be used as the
 * Google OAuth "privacy policy" link on the Google Cloud Branding page — a
 * prerequisite for publishing the OAuth app Testing → Production (which removes
 * the 7-day refresh-token expiry the Google Calendar auto-sync depends on).
 *
 * It deliberately discloses, in plain terms, how the app handles Google user
 * data (the Calendar `events` scope): what is accessed, how it is used, that it
 * is not sold or shared beyond the sync, and how a staff member revokes access.
 * This is what Google's OAuth verification looks for.
 */
const EMAIL = "info@spazehaus.com";
const UPDATED = "22 October 2026";

export default function Privacy() {
  return (
    <div className="min-h-screen" style={{ background: "oklch(0.985 0.004 80)" }}>
      <div className="mx-auto w-full max-w-[720px] px-5 py-10 sm:py-14">
        <header className="mb-8">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "oklch(0.62 0.09 68)" }}
          >
            Legal · 隐私政策
          </p>
          <h1
            className="mt-2 text-3xl font-bold tracking-tight"
            style={{ color: "oklch(0.18 0.008 65)" }}
          >
            Privacy Policy
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "oklch(0.45 0.01 65)" }}>
            How the SPAZEHAUS staff management app collects, uses and protects data — including the
            Google Calendar access used by its calendar sync feature.
          </p>
        </header>

        <article
          className="space-y-6 text-[15px] leading-relaxed [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:underline"
          style={{ color: "oklch(0.30 0.01 65)" }}
        >
          <p className="text-sm" style={{ color: "oklch(0.55 0.01 65)" }}>
            Last updated: {UPDATED}
          </p>

          <p>
            This Privacy Policy explains how <strong>Spazehaus Sdn Bhd</strong> (“SPAZEHAUS”, “we”,
            “us” or “our”), an interior design and renovation studio in Johor Bahru, Malaysia,
            handles data in our internal staff management application (the “App”, hosted at
            spazehaus.vercel.app). The App is used by SPAZEHAUS staff to manage projects, customers,
            calendars and related operations, and by clients through read-only portal links.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>1. Who uses the App</h2>
          <p>
            The App is an internal tool for SPAZEHAUS staff. Staff sign in with their work email via
            a one-time magic link. Clients may be given a read-only portal link to view their own
            project; no client account is created.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>2. Information we handle</h2>
          <ul>
            <li>
              <strong>Staff account data:</strong> name, work email, role and profile details needed
              to operate the App.
            </li>
            <li>
              <strong>Operational data:</strong> projects, customers, quotations, calendar events,
              reminders and similar records that staff create as part of their work.
            </li>
            <li>
              <strong>Google account data (optional):</strong> only if a staff member chooses to
              connect their Google Calendar — see section 3.
            </li>
          </ul>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>
            3. Google Calendar access &amp; Google user data
          </h2>
          <p>
            Connecting Google Calendar is <strong>optional</strong> and initiated by the staff member
            on their Profile page. When they connect, we request the Google{" "}
            <code>calendar.events</code> permission so the App can keep their Google Calendar in sync
            with the calendar events assigned to them in the App.
          </p>
          <ul>
            <li>
              <strong>What we access:</strong> the ability to create, update and delete calendar
              events on the connected user’s own Google Calendar.
            </li>
            <li>
              <strong>How we use it:</strong> solely to mirror events that the staff member created in
              the App, or that were assigned to them, onto their own Google Calendar. We do not read
              or process unrelated events on their calendar for any other purpose.
            </li>
            <li>
              <strong>Offline access:</strong> with the user’s consent we store a Google refresh token
              securely on our server (Supabase) so the sync can run automatically, even when the App
              is closed. This token is stored server-side only and is never exposed to the browser or
              to other users.
            </li>
            <li>
              <strong>Sharing:</strong> we do not sell Google user data and do not share it with third
              parties. It is not used for advertising. Our use of information received from Google
              APIs adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including its Limited Use requirements.
            </li>
          </ul>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>4. How we use information</h2>
          <ul>
            <li>To authenticate staff and operate the App’s features.</li>
            <li>To manage projects, customers, calendars and related workflows.</li>
            <li>To sync a connected staff member’s events to their own Google Calendar.</li>
          </ul>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>5. Where data is stored</h2>
          <p>
            App data is stored in Supabase (Postgres, Singapore region) and the App is hosted on
            Vercel. Access is protected by authentication and row-level security. Some providers may
            process data outside Malaysia; we take reasonable steps to ensure it is protected.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>6. Revoking Google access</h2>
          <p>A staff member can revoke the App’s access to their Google Calendar at any time:</p>
          <ul>
            <li>
              In their Google Account at{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
              >
                myaccount.google.com/permissions
              </a>
              , by removing access for SPAZEHAUS; and/or
            </li>
            <li>by disconnecting Google Calendar from their Profile page in the App.</li>
          </ul>
          <p>
            After revoking, the App stops syncing and the stored refresh token can no longer be used.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>7. Data retention</h2>
          <p>
            We keep operational records for as long as needed to run the business and meet legal
            obligations. Google tokens are kept only while a staff member keeps Google Calendar
            connected and are removed when access is revoked.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>8. Security</h2>
          <p>
            We take reasonable technical and organisational measures to protect data against loss,
            misuse and unauthorised access. No method of transmission over the internet is completely
            secure, but we work to safeguard information.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>9. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. The “last updated” date above
            reflects the latest revision.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>10. Contact</h2>
          <p>
            For any privacy questions or requests, contact <strong>Spazehaus Sdn Bhd</strong> at{" "}
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a> (phone / WhatsApp +60 12-679 6530), 8, Jalan
            Ekoperniagaan 2/7, Taman Ekoperniagaan, 81100 Johor Bahru, Johor, Malaysia.
          </p>
        </article>
      </div>
    </div>
  );
}
