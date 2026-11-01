/*
 * SPAZEHAUS — Terms of Service (public, no auth)
 *
 * Reachable at /terms without a Supabase session so it can be used as the
 * Google OAuth "Terms of Service" link on the Google Cloud consent screen —
 * recommended for the OAuth verification submission (Option B). Mirrors the
 * Privacy page's layout and discloses the terms for using the internal staff
 * app, including the optional Google Calendar sync.
 */
const EMAIL = "info@spazehaus.com";
const UPDATED = "1 November 2026";

export default function Terms() {
  return (
    <div className="min-h-screen" style={{ background: "oklch(0.985 0.004 80)" }}>
      <div className="mx-auto w-full max-w-[720px] px-5 py-10 sm:py-14">
        <header className="mb-8">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "oklch(0.62 0.09 68)" }}
          >
            Legal · 服务条款
          </p>
          <h1
            className="mt-2 text-3xl font-bold tracking-tight"
            style={{ color: "oklch(0.18 0.008 65)" }}
          >
            Terms of Service
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "oklch(0.45 0.01 65)" }}>
            The terms for using the SPAZEHAUS staff management app, including the optional Google
            Calendar sync feature.
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
            These Terms of Service (“Terms”) govern your access to and use of the internal staff
            management application (the “App”, hosted at spazehaus.vercel.app) provided by{" "}
            <strong>Spazehaus Sdn Bhd</strong> (“SPAZEHAUS”, “we”, “us” or “our”), an interior design
            and renovation studio in Johor Bahru, Malaysia. By accessing or using the App you agree to
            these Terms. If you do not agree, do not use the App.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>1. The service</h2>
          <p>
            The App is a private, internal tool used by SPAZEHAUS staff to manage projects, customers,
            quotations, calendars, reminders and related operations. Clients may be given a read-only
            portal link to view their own project; no client account is created. We may add, change or
            remove features at any time.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>2. Who may use it</h2>
          <ul>
            <li>
              <strong>Staff:</strong> authorised SPAZEHAUS personnel sign in with their work email via
              a one-time magic link. You are responsible for keeping your account access secure and for
              activity carried out under your account.
            </li>
            <li>
              <strong>Clients:</strong> may view their own project through a private portal link shared
              by SPAZEHAUS. The link is for the intended recipient only and should not be shared
              publicly.
            </li>
          </ul>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>3. Acceptable use</h2>
          <p>When using the App you agree not to:</p>
          <ul>
            <li>access data or features you are not authorised to use;</li>
            <li>attempt to disrupt, reverse-engineer, or gain unauthorised access to the App or its data;</li>
            <li>use the App for any unlawful purpose or in breach of these Terms; or</li>
            <li>upload content you do not have the right to use.</li>
          </ul>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>4. Google Calendar integration</h2>
          <p>
            Connecting Google Calendar is <strong>optional</strong> and initiated by a staff member on
            their Profile page. When connected, the App uses the Google <code>calendar.events</code>{" "}
            permission solely to keep the staff member’s own Google Calendar in sync with the calendar
            events assigned to them in the App. Our handling of Google user data is described in our{" "}
            <a href="/privacy">Privacy Policy</a> and follows the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including its Limited Use requirements. You may revoke this access at any time from your
            Google Account or by disconnecting it in the App.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>5. Data</h2>
          <p>
            Data you enter belongs to SPAZEHAUS and is handled as described in our{" "}
            <a href="/privacy">Privacy Policy</a>. You are responsible for ensuring the information you
            enter is accurate and that you have the right to provide it.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>6. Intellectual property</h2>
          <p>
            The App, its design and its content are owned by SPAZEHAUS or its licensors and are
            protected by applicable laws. These Terms do not grant you any ownership of the App.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>7. Availability &amp; disclaimer</h2>
          <p>
            The App is provided on an “as is” and “as available” basis. We do not warrant that it will
            be uninterrupted, error-free, or that data will always be available. We may suspend or
            restrict access for maintenance, security or operational reasons.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>8. Limitation of liability</h2>
          <p>
            To the extent permitted by law, SPAZEHAUS will not be liable for any indirect, incidental
            or consequential loss arising from your use of, or inability to use, the App.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>9. Termination</h2>
          <p>
            We may suspend or end access to the App (including a staff account or a client portal link)
            at any time, for example when someone leaves the company or misuses the App.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>10. Governing law</h2>
          <p>
            These Terms are governed by the laws of Malaysia, and any disputes are subject to the
            jurisdiction of the Malaysian courts.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>11. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. The “last updated” date above reflects the
            latest revision; continued use of the App means you accept the updated Terms.
          </p>

          <h2 style={{ color: "oklch(0.18 0.008 65)" }}>12. Contact</h2>
          <p>
            For any questions about these Terms, contact <strong>Spazehaus Sdn Bhd</strong> at{" "}
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a> (phone / WhatsApp +60 12-679 6530), 8, Jalan
            Ekoperniagaan 2/7, Taman Ekoperniagaan, 81100 Johor Bahru, Johor, Malaysia.
          </p>
        </article>
      </div>
    </div>
  );
}
