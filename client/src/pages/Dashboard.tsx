/*
 * SPAZEHAUS DASHBOARD
 * Design: White/light corporate theme with warm gold accents
 * Hero section with generated background image (dark overlay preserved for readability)
 * Stats summary, quick actions, recent activity
 */
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  FolderOpen, Users, ClipboardCheck, TrendingUp,
  Plus, CalendarCheck, FileText, Camera,
  ChevronRight, Bell, AlertCircle, Coins, PenSquare
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import {
  useProjects,
  useOpenPayments,
  useOpenSignatures,
  useAllStaff,
  useAnnouncements,
  useAuditLog,
  computeCheckpointSummary,
} from "@/lib/queries";
import { summarizeAudit, relativeTime } from "@/lib/activityFeed";
import type { AuditAction } from "@/lib/dbTypes";
import { formatRM } from "@/lib/quotationData";

const HERO_BG = "/hero/warm.jpg";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } as const },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { staff } = useAuth();

  const { data: projects = [], isError: projectsError, refetch: refetchProjects } = useProjects();
  const { data: openPayments = [] } = useOpenPayments();
  const { data: openSignatures = [] } = useOpenSignatures();
  const { data: allStaff = [] } = useAllStaff();
  const { data: announcements = [] } = useAnnouncements();

  // Recent activity — live audit-log feed (newest first, last 14 days).
  // RLS limits non-admins to their own actions; the admin tier sees everything.
  const { data: auditData } = useAuditLog({ daysBack: 14, pageSize: 7 });
  const recentActivity = auditData?.pages[0]?.entries ?? [];

  const activeProjects = projects.filter((p) => p.status === "active" || p.status === "assigned").length;
  const pendingReview = projects.filter((p) => p.status === "under-review").length;
  const completedThisMonth = projects.filter((p) => p.status === "completed").length;
  const totalStaff = allStaff.length;

  // Cross-project SOP checkpoint summary (Phase 2 → 0C via TanStack Query)
  const ckpt = computeCheckpointSummary(openPayments, openSignatures);
  const hasUrgent = ckpt.overdueCount > 0 || ckpt.thisWeekCount > 0 || ckpt.pendingSignsCount > 0;

  const stats = [
    { label: "Active Projects", value: activeProjects, icon: FolderOpen, color: "var(--acc)", bg: "oklch(0.62 0.09 68 / 10%)" },
    { label: "Team Members", value: totalStaff, icon: Users, color: "oklch(0.45 0.09 240)", bg: "oklch(0.55 0.09 240 / 10%)" },
    { label: "Pending Review", value: pendingReview, icon: ClipboardCheck, color: "oklch(0.55 0.10 55)", bg: "oklch(0.65 0.10 55 / 10%)" },
    { label: "Completed", value: completedThisMonth, icon: TrendingUp, color: "oklch(0.45 0.09 145)", bg: "oklch(0.55 0.09 145 / 10%)" },
  ];

  const quickActions = [
    { label: "New Project", icon: Plus, color: "var(--acc)", bg: "oklch(0.62 0.09 68 / 10%)", path: "/projects/new" },
    { label: "Checkpoints", icon: AlertCircle, color: "oklch(0.50 0.12 25)", bg: "oklch(0.60 0.12 25 / 10%)", path: "/checkpoints" },
    { label: "Reminders", icon: Camera, color: "oklch(0.45 0.09 145)", bg: "oklch(0.55 0.09 145 / 10%)", path: "/reminders" },
    { label: "Customers", icon: Users, color: "oklch(0.45 0.09 240)", bg: "oklch(0.55 0.09 240 / 10%)", path: "/customers" },
    { label: "Leave", icon: CalendarCheck, color: "oklch(0.55 0.10 55)", bg: "oklch(0.65 0.10 55 / 10%)", path: "/company/leave" },
    { label: "Quotes", icon: FileText, color: "oklch(0.50 0.10 25)", bg: "oklch(0.60 0.10 25 / 10%)", path: "/quotations" },
  ];

  // Dot colour by audit action — green (created) / blue (updated) / red (deleted).
  const activityDot: Record<AuditAction, string> = {
    INSERT: "oklch(0.45 0.09 145)",
    UPDATE: "oklch(0.45 0.09 240)",
    DELETE: "oklch(0.50 0.12 25)",
  };

  return (
    <div className="mobile-container" data-testid="dashboard-root" style={{ background: "var(--s-page)" }}>
      {/* Hero Header — keeps dark overlay for contrast over image */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(to bottom, oklch(0.11 0.004 285 / 0.65) 0%, oklch(0.11 0.004 285 / 0.88) 70%, oklch(0.11 0.004 285) 100%), url(${HERO_BG}) center/cover no-repeat`,
          paddingTop: "env(safe-area-inset-top, 12px)",
        }}
      >
        {/* Gold accent line */}
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, transparent, var(--acc-bright), transparent)" }} />

        <div className="px-4 pt-4 pb-6">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs font-label" style={{ color: "var(--acc-bright)", letterSpacing: "0.12em" }}>SPAZEHAUS</p>
              <h1 className="font-display text-2xl font-semibold text-white leading-tight">Management</h1>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell variant="dark" />
              <div
                data-testid="hero-avatar"
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))", color: "white" }}
              >
                {staff?.avatar_code ?? "—"}
              </div>
            </div>
          </div>

          {/* Greeting */}
          <div>
            <p className="text-sm text-white/70">Good morning,</p>
            <p data-testid="hero-greeting" className="font-display text-xl font-semibold text-white">{staff?.name ?? ""}</p>
            <p data-testid="hero-jobtitle" className="text-xs mt-0.5" style={{ color: "var(--acc-bright)" }}>{staff?.job_title ?? ""}</p>
          </div>
        </div>
      </div>

      {/* Body — white background */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="px-4 py-5 pb-28 space-y-6 lg:px-8 lg:py-7"
        style={{ background: "var(--s-page)" }}
      >
        {projectsError && (
          <div
            data-testid="error-banner"
            className="rounded-2xl p-4 flex items-center justify-between gap-3"
            style={{ background: "oklch(0.58 0.12 25 / 8%)", border: "1px solid oklch(0.58 0.12 25 / 25%)" }}
          >
            <p className="text-[12px]" style={{ color: "oklch(0.45 0.12 25)" }}>
              Some data couldn't load. Figures may be incomplete.
            </p>
            <button
              onClick={() => refetchProjects()}
              data-testid="error-retry"
              className="text-[11px] font-label px-3 py-1.5 rounded-lg shrink-0"
              style={{ background: "oklch(0.58 0.12 25 / 12%)", color: "oklch(0.45 0.12 25)", letterSpacing: "0.04em" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Stats */}
        <motion.div variants={itemVariants}>
          <p className="sz-label mb-3">OVERVIEW</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                    <Icon size={18} style={{ color: s.color }} />
                  </div>
                  <div>
                    <p
                      data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}
                      className="text-2xl font-display font-bold"
                      style={{ color: "var(--t-1)" }}
                    >{s.value}</p>
                    <p className="text-xs leading-tight" style={{ color: "var(--t-5)" }}>{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* SOP Checkpoint Alerts — Phase 2 */}
        {hasUrgent && (
          <motion.div variants={itemVariants}>
            <div className="flex items-center justify-between mb-3">
              <p className="sz-label">URGENT CHECKPOINTS</p>
              <button
                onClick={() => navigate("/checkpoints")}
                data-testid="checkpoints-viewall"
                className="flex items-center gap-1 text-xs font-label"
                style={{ color: "var(--acc)", letterSpacing: "0.04em" }}
              >
                View All <ChevronRight size={12} />
              </button>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/checkpoints")}
              data-testid="checkpoints-card"
              className="w-full rounded-2xl p-4 text-left"
              style={{
                background: ckpt.overdueCount > 0
                  ? "linear-gradient(135deg, oklch(0.60 0.12 25 / 6%), oklch(1 0 0))"
                  : "oklch(1 0 0)",
                border: ckpt.overdueCount > 0
                  ? "1px solid oklch(0.60 0.12 25 / 30%)"
                  : "1px solid var(--b-1)",
                boxShadow: ckpt.overdueCount > 0
                  ? "0 1px 12px oklch(0.60 0.12 25 / 12%)"
                  : "0 1px 8px oklch(0 0 0 / 0.04)",
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: ckpt.overdueCount > 0
                      ? "oklch(0.60 0.12 25 / 12%)"
                      : "oklch(0.62 0.09 68 / 12%)",
                  }}
                >
                  <AlertCircle
                    size={18}
                    style={{
                      color: ckpt.overdueCount > 0 ? "oklch(0.50 0.12 25)" : "var(--acc-ink)",
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p data-testid="ckpt-status" className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>
                    {ckpt.overdueCount > 0 ? "Action required" : "All on track"}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>
                    Payment Collection · Document Sign SOP
                  </p>
                </div>
                <ChevronRight size={14} style={{ color: "var(--t-6)" }} />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div
                  className="rounded-xl p-2.5 text-center"
                  style={{
                    background: ckpt.overdueCount > 0 ? "oklch(0.60 0.12 25 / 8%)" : "var(--s-page)",
                  }}
                >
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Coins size={10} style={{ color: ckpt.overdueCount > 0 ? "oklch(0.50 0.12 25)" : "var(--t-5)" }} />
                    <p className="text-[9px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>OVERDUE</p>
                  </div>
                  <p
                    data-testid="ckpt-overdue"
                    className="font-display text-lg font-bold"
                    style={{ color: ckpt.overdueCount > 0 ? "oklch(0.50 0.12 25)" : "var(--t-3)" }}
                  >
                    {ckpt.overdueCount}
                  </p>
                </div>
                <div className="rounded-xl p-2.5 text-center" style={{ background: "var(--s-page)" }}>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <CalendarCheck size={10} style={{ color: "var(--t-5)" }} />
                    <p className="text-[9px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>THIS WEEK</p>
                  </div>
                  <p data-testid="ckpt-thisweek" className="font-display text-lg font-bold" style={{ color: "var(--t-3)" }}>
                    {ckpt.thisWeekCount}
                  </p>
                </div>
                <div className="rounded-xl p-2.5 text-center" style={{ background: "var(--s-page)" }}>
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <PenSquare size={10} style={{ color: "var(--t-5)" }} />
                    <p className="text-[9px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>SIGNS</p>
                  </div>
                  <p data-testid="ckpt-signs" className="font-display text-lg font-bold" style={{ color: "var(--t-3)" }}>
                    {ckpt.pendingSignsCount}
                  </p>
                </div>
              </div>

              <div
                className="flex items-center justify-between mt-3 pt-3"
                style={{ borderTop: "1px solid var(--b-2)" }}
              >
                <span className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>
                  TOTAL OUTSTANDING
                </span>
                <span data-testid="ckpt-outstanding" className="font-display text-sm font-semibold" style={{ color: "var(--acc-ink)" }}>
                  {formatRM(ckpt.outstandingRM)}
                </span>
              </div>
            </motion.button>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <p className="sz-label mb-3">QUICK ACTIONS</p>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.label}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => navigate(action.path)}
                  data-testid="quick-action"
                  data-action={action.path}
                  className="flex flex-col items-center gap-2 py-4 rounded-2xl"
                  style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: action.bg }}>
                    <Icon size={18} style={{ color: action.color }} />
                  </div>
                  <span className="text-[11px] font-label text-center leading-tight" style={{ color: "var(--t-3)", letterSpacing: "0.02em" }}>{action.label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Recent Projects */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-3">
            <p className="sz-label">RECENT PROJECTS</p>
            <button
              onClick={() => navigate("/projects")}
              data-testid="projects-viewall"
              className="flex items-center gap-1 text-xs font-label"
              style={{ color: "var(--acc)", letterSpacing: "0.04em" }}
            >
              View All <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-3" data-testid="recent-projects">
            {projects.slice(0, 3).map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/projects/${project.id}`)}
                data-testid="project-card"
                data-project-id={project.id}
                className="rounded-2xl p-4"
                style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
              >
                <div className="flex items-start justify-between mb-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--t-1)" }}>{project.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>{project.client}</p>
                  </div>
                  <span
                    data-testid="project-status"
                    className="status-pill ml-2 shrink-0"
                    style={{
                      background: project.status === "active" ? "oklch(0.62 0.09 68 / 12%)" :
                        project.status === "completed" ? "oklch(0.55 0.09 145 / 12%)" : "oklch(0.55 0.09 240 / 12%)",
                      color: project.status === "active" ? "var(--acc-ink)" :
                        project.status === "completed" ? "oklch(0.40 0.09 145)" : "oklch(0.40 0.09 240)",
                    }}
                  >
                    {project.status === "active" ? "Active" : project.status === "completed" ? "Done" : "Review"}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs" style={{ color: "var(--t-5)" }}>{project.progress}% complete</span>
                  <span className="text-xs" style={{ color: "var(--t-5)" }}>{project.tasksCompleted}/{project.taskCount} tasks</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--b-2)" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${project.progress}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, var(--acc-strong), var(--acc-bright))" }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity — live audit-log feed */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-3">
            <p className="sz-label">RECENT ACTIVITY</p>
            <button
              onClick={() => navigate("/company/audit")}
              className="flex items-center gap-1 text-xs font-label"
              style={{ color: "var(--acc)", letterSpacing: "0.04em" }}
            >
              View All <ChevronRight size={12} />
            </button>
          </div>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
            data-testid="recent-activity"
          >
            {recentActivity.length === 0 ? (
              <div className="px-4 py-6 text-center" data-testid="recent-activity-empty">
                <p className="text-xs" style={{ color: "var(--t-5)" }}>No recent activity</p>
              </div>
            ) : (
              recentActivity.map((entry, i) => (
                <div
                  key={entry.id}
                  data-testid="activity-item"
                  className="px-4 py-3 flex items-start gap-3"
                  style={{ borderBottom: i < recentActivity.length - 1 ? "1px solid var(--b-2)" : "none" }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                    style={{ background: activityDot[entry.action] || "var(--acc)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed" style={{ color: "var(--t-3)" }}>{summarizeAudit(entry)}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--t-5)" }}>
                      {entry.actor?.name ?? (entry.changed_by ? "Unknown user" : "System")}
                    </p>
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: "var(--t-6)" }}>{relativeTime(entry.changed_at)}</span>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Latest Announcement */}
        {announcements[0] && (
          <motion.div variants={itemVariants}>
            <p className="sz-label mb-3">LATEST ANNOUNCEMENT</p>
            <div
              data-testid="announcement-card"
              className="rounded-2xl p-4"
              style={{ background: "oklch(0.62 0.09 68 / 6%)", border: "1px solid oklch(0.62 0.09 68 / 20%)" }}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.62 0.09 68 / 15%)" }}>
                  <Bell size={14} style={{ color: "var(--acc)" }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>{announcements[0].title}</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--t-4)" }}>{announcements[0].content.substring(0, 100)}…</p>
                  <p className="text-[10px] mt-1.5 font-label" style={{ color: "var(--acc)", letterSpacing: "0.04em" }}>{announcements[0].publishedDateLabel}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
