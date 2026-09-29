/*
 * SPAZEHAUS COMPANY MANAGEMENT HUB
 * Design: White/light corporate hub with warm gold accents
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Users, CalendarCheck, UserSearch, BarChart3, Megaphone, ChevronRight, TrendingUp, ShieldCheck, Sparkles } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import {
  useAllStaff,
  useLeaveRequests,
  useCandidates,
  useAnnouncements,
  useInquiries,
  useQuotations,
  useSalesTargets,
  useSpacologyResults,
  computeTeamPerformance,
  computeCompanyPerformance,
  canViewAuditLog,
  formatRMCompact,
} from "@/lib/queries";
import { useAuth } from "@/contexts/AuthContext";

const HERO_BG = "/hero/cool.jpg";

const deptColors: Record<string, { color: string; bg: string }> = {
  Design:     { color: "var(--acc-ink)",  bg: "oklch(0.62 0.09 68 / 10%)" },
  Operations: { color: "oklch(0.38 0.09 240)", bg: "oklch(0.55 0.09 240 / 10%)" },
  Sales:      { color: "oklch(0.38 0.09 145)", bg: "oklch(0.55 0.09 145 / 10%)" },
  Admin:      { color: "oklch(0.45 0.10 55)",  bg: "oklch(0.65 0.10 55 / 10%)" },
};

export default function Company() {
  const [, navigate] = useLocation();
  const { staff: me } = useAuth();

  const { data: staffMembers = [] } = useAllStaff();
  const { data: leaveRequests = [] } = useLeaveRequests();
  const { data: candidates = [] } = useCandidates();
  const { data: announcements = [] } = useAnnouncements();
  const { data: inquiries = [] } = useInquiries();
  const { data: quotations = [] } = useQuotations();
  const { data: targets = [] } = useSalesTargets();
  const { data: spacology = [] } = useSpacologyResults();
  const showAudit = canViewAuditLog(me?.role);

  const company = useMemo(() => {
    const team = computeTeamPerformance(staffMembers, targets, inquiries);
    return computeCompanyPerformance(team, targets, quotations);
  }, [staffMembers, targets, inquiries, quotations]);

  const modules = [
    { id: "staff",         title: "Staff Directory",     subtitle: "Team profiles & roles",         icon: Users,        color: "var(--acc-ink)",  bg: "oklch(0.62 0.09 68 / 10%)",  path: "/company/staff",         stat: `${staffMembers.length} member${staffMembers.length === 1 ? "" : "s"}` },
    { id: "performance",   title: "Performance Report",  subtitle: "Sales · GP · Project timeline", icon: TrendingUp,   color: "oklch(0.50 0.10 25)",  bg: "oklch(0.60 0.10 25 / 10%)",  path: "/performance",            stat: `${formatRMCompact(company.awardedYTD)} YTD` },
    { id: "leave",         title: "Leave Management",    subtitle: "Applications & approvals",      icon: CalendarCheck, color: "oklch(0.38 0.09 240)", bg: "oklch(0.55 0.09 240 / 10%)", path: "/company/leave",         stat: `${leaveRequests.filter((l) => l.status === "pending").length} pending` },
    { id: "recruitment",   title: "Recruitment",         subtitle: "Talent pipeline & candidates",  icon: UserSearch,   color: "oklch(0.45 0.10 55)",  bg: "oklch(0.65 0.10 55 / 10%)",  path: "/company/recruitment",   stat: `${candidates.length} candidate${candidates.length === 1 ? "" : "s"}` },
    { id: "kpi",           title: "KPI & Performance",   subtitle: "Monthly scores & reviews",      icon: BarChart3,    color: "oklch(0.38 0.09 145)", bg: "oklch(0.55 0.09 145 / 10%)", path: "/company/kpi",           stat: "Monthly review" },
    { id: "announcements", title: "Announcements",       subtitle: "Company news & updates",        icon: Megaphone,    color: "oklch(0.45 0.10 25)",  bg: "oklch(0.60 0.10 25 / 10%)",  path: "/company/announcements", stat: `${announcements.length} post${announcements.length === 1 ? "" : "s"}` },
    { id: "spacology",     title: "Spacology Results",   subtitle: "Website quiz · space personalities", icon: Sparkles,     color: "oklch(0.52 0.13 55)", bg: "oklch(0.66 0.13 55 / 10%)",  path: "/spacology",             stat: `${spacology.length} submission${spacology.length === 1 ? "" : "s"}` },
    ...(showAudit
      ? [{ id: "audit", title: "Audit Log", subtitle: "System activity history (admin)", icon: ShieldCheck, color: "var(--acc-ink)", bg: "oklch(0.62 0.09 68 / 10%)", path: "/company/audit", stat: "Admin only" }]
      : []),
  ];

  const byDept = staffMembers.reduce((acc, s) => {
    acc[s.dept] = (acc[s.dept] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader title="Company" subtitle="MANAGEMENT" bgImage={HERO_BG} showNotification />

      <div className="px-4 py-4 space-y-5 pb-24 lg:px-8 lg:py-7 lg:space-y-8">
        {/* Department summary */}
        <div>
          <p className="sz-label mb-3">TEAM OVERVIEW</p>
          <div className="grid grid-cols-4 lg:grid-cols-5 gap-2 lg:gap-3">
            {Object.entries(byDept).map(([dept, count]) => {
              const dc = deptColors[dept] || { color: "var(--acc-ink)", bg: "oklch(0.62 0.09 68 / 10%)" };
              return (
                <div
                  key={dept}
                  className="rounded-xl p-3 text-center"
                  style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 6px oklch(0 0 0 / 0.03)" }}
                >
                  <p className="text-xl font-display font-semibold" style={{ color: dc.color }}>{count}</p>
                  <p className="text-[9px] font-label mt-0.5" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>{dept}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Module cards */}
        <div>
          <p className="sz-label mb-3">MODULES</p>
          <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
            {modules.map((mod, i) => {
              const Icon = mod.icon;
              return (
                <motion.button
                  key={mod.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(mod.path)}
                  className="relative w-full rounded-2xl p-4 flex items-center gap-4 text-left overflow-hidden"
                  style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
                >
                  {/* Gold left accent bar */}
                  <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full" style={{ background: mod.color, opacity: 0.4 }} />
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: mod.bg }}>
                    <Icon size={22} style={{ color: mod.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>{mod.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>{mod.subtitle}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-label" style={{ color: mod.color, letterSpacing: "0.02em" }}>{mod.stat}</span>
                    <ChevronRight size={14} style={{ color: "var(--t-6)" }} />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Staff on leave today */}
        <div>
          <p className="sz-label mb-3">ON LEAVE TODAY</p>
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
            {staffMembers.filter((s) => s.status === "on-leave").map((s, i, arr) => (
              <div
                key={s.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--b-2)" : "none" }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "oklch(0.60 0.10 25 / 12%)", color: "oklch(0.45 0.10 25)", border: "1.5px solid oklch(0.60 0.10 25 / 25%)" }}
                >
                  {s.avatar_code}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "var(--t-1)" }}>{s.name}</p>
                  <p className="text-xs" style={{ color: "var(--t-5)" }}>{s.job_title}</p>
                </div>
                <span className="status-pill" style={{ background: "oklch(0.60 0.10 25 / 12%)", color: "oklch(0.45 0.10 25)" }}>On Leave</span>
              </div>
            ))}
            {staffMembers.filter((s) => s.status === "on-leave").length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm" style={{ color: "var(--t-5)" }}>No staff on leave today</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
