/*
 * SPAZEHAUS MANAGEMENT APP — MAIN ROUTER
 * Design: Dark premium mobile app with bottom navigation
 * Routes: Dashboard, Projects, Company, Calendar, Profile + sub-pages + Quotations
 *
 * Code-splitting policy: routes reachable from the bottom nav (Dashboard,
 * Projects, Company, CalendarPage, Profile) plus auth pages stay eagerly
 * imported — they're the most likely first-paint destinations and their
 * shared deps are already in the initial chunks. Everything else loads
 * via `React.lazy` so the user only pays for sub-pages they actually visit.
 *
 * In particular, KPIPerformance pulls in recharts (~75 KB gzip), and
 * QuotationDetail/CreateQuotation reach into the PDF stack via the
 * dynamic generatePDF import — those would otherwise be preloaded for
 * every visitor regardless of whether they ever open the page.
 */
import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { queryClient } from "./lib/queryClient";
import BottomNav from "./components/BottomNav";
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import NoStaffProfile from "./pages/NoStaffProfile";

// Main tabs — eager (likely first paint, already in initial chunk graph)
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Company from "./pages/Company";
import CalendarPage from "./pages/CalendarPage";
import Profile from "./pages/Profile";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors React.lazy's own ComponentType<any> signature
function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  const RELOAD_TS = "spz:chunk-reload-ts";
  const COOLDOWN_MS = 10_000;
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      // Auto-reload once to recover from a stale chunk 
      const last = Number(sessionStorage.getItem(RELOAD_TS) || 0);
      const now = Date.now();
      if (now - last > COOLDOWN_MS) {
        sessionStorage.setItem(RELOAD_TS, String(now));
        window.location.reload();
        // Never resolve — keep React suspended while the page reloads.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

// Sub-pages — lazy (each gets its own chunk, only fetched on navigation)
const ProjectDetail    = lazyWithReload(() => import("./pages/ProjectDetail"));
const CreateProject    = lazyWithReload(() => import("./pages/CreateProject"));
const StaffDirectory   = lazyWithReload(() => import("./pages/StaffDirectory"));
const StaffProfile     = lazyWithReload(() => import("./pages/StaffProfile"));
const LeaveManagement  = lazyWithReload(() => import("./pages/LeaveManagement"));
const Recruitment      = lazyWithReload(() => import("./pages/Recruitment"));
const KPIPerformance   = lazyWithReload(() => import("./pages/KPIPerformance"));      // pulls in recharts
const Announcements    = lazyWithReload(() => import("./pages/Announcements"));
const AuditLog         = lazyWithReload(() => import("./pages/AuditLog"));
const QuotationList    = lazyWithReload(() => import("./pages/QuotationList"));
const QuotationDetail  = lazyWithReload(() => import("./pages/QuotationDetail"));     // root of the PDF lazy chain
const CreateQuotation  = lazyWithReload(() => import("./pages/CreateQuotation"));
const Checkpoints      = lazyWithReload(() => import("./pages/Checkpoints"));
const CustomerDatabase = lazyWithReload(() => import("./pages/CustomerDatabase"));
const CustomerDetail   = lazyWithReload(() => import("./pages/CustomerDetail"));
const CreateCustomer   = lazyWithReload(() => import("./pages/CreateCustomer"));
const RemindersPage    = lazyWithReload(() => import("./pages/Reminders"));
const PerformanceReport = lazyWithReload(() => import("./pages/PerformanceReport"));
const CreateStaff      = lazyWithReload(() => import("./pages/CreateStaff"));
const Notifications    = lazyWithReload(() => import("./pages/Notifications"));
const Security         = lazyWithReload(() => import("./pages/Security"));
const Help             = lazyWithReload(() => import("./pages/Help"));
const SpacologyResults = lazyWithReload(() => import("./pages/SpacologyResults"));
// Public — reachable without a Supabase Auth session via /portal/:token.
const ClientPortal     = lazyWithReload(() => import("./pages/ClientPortal"));

// Pages that show bottom nav
const BOTTOM_NAV_PATHS = ["/", "/projects", "/company", "/calendar", "/profile"];

/** Minimal fallback rendered while a lazy route chunk is fetching. Sits inside
 *  the mobile-container frame so the BottomNav stays anchored and there's no
 *  layout shift when the page snaps in. */
function RouteFallback() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "oklch(0.985 0.004 80)" }}
    >
      <Loader2 size={20} className="animate-spin" style={{ color: "oklch(0.62 0.09 68)" }} />
    </div>
  );
}

function AppLayout() {
  const [location] = useLocation();
  const showNav = BOTTOM_NAV_PATHS.includes(location);

  return (
    <div
      className="min-h-screen flex lg:items-stretch items-center justify-center"
      style={{ background: "oklch(0.93 0.008 75)" }}
    >
      {/* Desktop/tablet left rail — hidden below lg, where BottomNav takes over */}
      <Sidebar />

      {/* Main content column. Mobile keeps the 430px app feel; lg+ widens into a
          centered work area beside the sidebar. Dense pages can opt into a wider
          frame per-page in later phases. */}
      <div className="flex-1 min-w-0 flex justify-center">
      <div className="w-full max-w-[430px] lg:max-w-[1100px] xl:max-w-[1440px] 2xl:max-w-[1760px] min-h-screen relative">
        <Suspense fallback={<RouteFallback />}>
          <Switch>
            {/* Main tabs */}
            <Route path="/" component={Dashboard} />
            <Route path="/projects" component={Projects} />
            <Route path="/company" component={Company} />
            <Route path="/calendar" component={CalendarPage} />
            <Route path="/profile" component={Profile} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/security" component={Security} />
            <Route path="/help" component={Help} />

            {/* Project sub-pages */}
            <Route path="/projects/new" component={CreateProject} />
            <Route path="/projects/:id" component={ProjectDetail} />

            {/* Company sub-pages */}
            <Route path="/company/staff" component={StaffDirectory} />
            <Route path="/company/staff/new" component={CreateStaff} />
            <Route path="/company/staff/:id" component={StaffProfile} />
            <Route path="/company/leave" component={LeaveManagement} />
            <Route path="/company/recruitment" component={Recruitment} />
            <Route path="/company/kpi" component={KPIPerformance} />
            <Route path="/company/announcements" component={Announcements} />
            <Route path="/company/audit" component={AuditLog} />

            {/* Quotation & Invoice module — order matters: /new before /:id */}
            <Route path="/quotations" component={QuotationList} />
            <Route path="/quotations/new" component={CreateQuotation} />
            <Route path="/quotations/:id" component={QuotationDetail} />

            {/* Important Checkpoints — Payment Collection + Document Sign SOP */}
            <Route path="/checkpoints" component={Checkpoints} />

            {/* Customer Database — Inquiry → Awarded funnel + categories */}
            <Route path="/customers" component={CustomerDatabase} />
            <Route path="/customers/new" component={CreateCustomer} />
            <Route path="/customers/:id" component={CustomerDetail} />

            {/* Reminders — Daily site photo + Weekly cadence SOP */}
            <Route path="/reminders" component={RemindersPage} />

            {/* Spacology — public quiz submissions from the marketing site */}
            <Route path="/spacology" component={SpacologyResults} />

            {/* Performance Report — Sales/GP targets + project timeline */}
            <Route path="/performance" component={PerformanceReport} />

            {/* Fallback */}
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>

        {showNav && <BottomNav />}
      </div>
      </div>
    </div>
  );
}

/**
 * AuthGate — splits the route tree:
 *   • /portal/:token         — purely public (client portal), no auth, no
 *                              redirect to /login. Bypasses the entire auth
 *                              state machine.
 *   • /login + /auth/callback — public for unauthenticated visitors,
 *                              redirect authed visitors to dashboard.
 *   • Everything else        — requires an authenticated staff session.
 *
 * Unauthenticated visitors hitting a protected URL are bounced to /login.
 * Authenticated visitors hitting /login are bounced to the dashboard.
 */
function AuthGate() {
  const [location, navigate] = useLocation();
  const { state } = useAuth();

  // Client portal is FULLY public — short-circuit before any auth state
  // matters, so the page loads immediately regardless of session status
  // (no "loading" flicker, no redirects, no auth side effects).
  if (location.startsWith("/portal/")) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Switch>
          <Route path="/portal/:token" component={ClientPortal} />
        </Switch>
      </Suspense>
    );
  }

  const isPublic = location === "/login" || location.startsWith("/auth/callback");

  // Redirect rules
  useEffect(() => {
    if (state.status === "loading") return;
    if (state.status === "unauthenticated" && !isPublic) {
      navigate("/login", { replace: true });
    }
    if (state.status === "authenticated" && location === "/login") {
      navigate("/", { replace: true });
    }
  }, [state.status, location, isPublic, navigate]);

  // While the session is resolving, show nothing (avoids a flash of /login)
  if (state.status === "loading") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "oklch(0.11 0.004 285)" }}
      />
    );
  }

  // Public routes
  if (isPublic) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/auth/callback" component={AuthCallback} />
      </Switch>
    );
  }

  // Authenticated session but no matching staff row → dedicated screen with a
  // way out, instead of a blank page (e.g. persisted session on a private path).
  if (state.status === "authenticated-no-staff") {
    return <NoStaffProfile />;
  }

  // Unauthenticated + private path → we're mid-redirect; render nothing briefly
  if (state.status !== "authenticated") {
    return null;
  }

  return <AppLayout />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <Toaster
                position="top-center"
                toastOptions={{
                  style: {
                    background: "oklch(1 0 0)",
                    border: "1px solid oklch(0.90 0.010 75)",
                    color: "oklch(0.14 0.008 65)",
                    fontFamily: "DM Sans, sans-serif",
                    boxShadow: "0 4px 24px oklch(0 0 0 / 0.08)",
                  },
                }}
              />
              <AuthGate />
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
