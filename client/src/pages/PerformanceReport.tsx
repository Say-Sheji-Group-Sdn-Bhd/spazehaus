/*
 * SPAZEHAUS PERFORMANCE REPORT
 * Source: 2026 Annual Meeting PDF — "Performance Report" pillar.
 *
 *   • Team & Personal Performance — sales target, gross profit target
 *   • Project timeline
 *   • Generate report / analysis
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, Target, Coins, Award, Briefcase, Calendar, Download, Trophy, AlertCircle
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { toast } from "sonner";
import {
  useProjects,
  useAllStaff,
  useInquiries,
  useQuotations,
  useSalesTargets,
  computeTeamPerformance,
  computeStaffPerformance,
  computeCompanyPerformance,
  buildProjectTimeline,
  timelineBounds,
  timelinePos,
  formatRMCompact,
  getToday,
  type StaffPerformance,
} from "@/lib/queries";
import { useAuth } from "@/contexts/AuthContext";
import { formatRM } from "@/lib/quotationData";

const HERO_BG = "/hero/warm.jpg";

type View = "Team" | "Personal";

export default function PerformanceReport() {
  const [view, setView] = useState<View>("Team");
  const { staff: authStaff } = useAuth();

  const { data: projects = [] } = useProjects();
  const { data: allStaff = [] } = useAllStaff();
  const { data: inquiries = [] } = useInquiries();
  const { data: quotations = [] } = useQuotations();
  const { data: targets = [] } = useSalesTargets();

  // Derived data
  const team = useMemo(
    () => computeTeamPerformance(allStaff, targets, inquiries),
    [allStaff, targets, inquiries],
  );
  const company = useMemo(
    () => computeCompanyPerformance(team, targets, quotations),
    [team, targets, quotations],
  );

  // Personal view uses the logged-in staff. Falls back to the top sales staff
  // (whoever's first in the leaderboard) if the current user doesn't have a target.
  const me = useMemo<StaffPerformance | undefined>(() => {
    if (!authStaff) return team[0];
    const myTarget = targets.find((t) => t.staff_id === authStaff.id);
    if (myTarget) return computeStaffPerformance(authStaff, myTarget, inquiries);
    return team[0];
  }, [authStaff, targets, inquiries, team]);

  const timeline = useMemo(() => buildProjectTimeline(projects), [projects]);
  const [exporting, setExporting] = useState(false);

  const handleGeneratePDF = async () => {
    setExporting(true);
    toast.info("Generating report…");
    try {
      const { generatePerformancePDF } = await import("@/lib/generatePDF");
      await generatePerformancePDF({
        monthLabel: monthLabel(getToday()),
        hasTargets: targets.length > 0,
        company,
        team,
        timeline,
      });
      toast.success("Performance report downloaded");
    } catch (e) {
      toast.error("Report export failed. Please try again.");
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader title="Performance" subtitle="REPORT · TARGETS" bgImage={HERO_BG} showBack showNotification />

      <div className="px-4 py-4 space-y-5 pb-24 lg:px-8 lg:py-7 lg:space-y-6">
        {/* View toggle */}
        <div
          className="flex rounded-xl p-1"
          style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
        >
          {(["Team", "Personal"] as View[]).map((t) => {
            const active = view === t;
            return (
              <button
                key={t}
                onClick={() => setView(t)}
                className="flex-1 py-2 text-xs font-label rounded-lg transition-colors"
                style={{
                  background: active ? "oklch(0.62 0.09 68 / 10%)" : "transparent",
                  color: active ? "var(--acc-ink)" : "var(--t-5)",
                  letterSpacing: "0.04em",
                  fontWeight: active ? 700 : 400,
                }}
              >
                {t.toUpperCase()}
              </button>
            );
          })}
        </div>

        {view === "Team" ? (
          <TeamView company={company} team={team} hasTargets={targets.length > 0} onPickStaff={() => setView("Personal")} />
        ) : (
          <PersonalView staff={me} />
        )}

        {/* Project timeline — visible on both views */}
        <Section title="PROJECT TIMELINE" subtitle="All projects · Jan – Jul 2026">
          <ProjectGantt rows={timeline} />
        </Section>

        {/* Generate report button */}
        <motion.button
          whileTap={exporting ? undefined : { scale: 0.98 }}
          onClick={handleGeneratePDF}
          disabled={exporting}
          data-testid="perf-generate"
          className="w-full rounded-2xl py-3.5 flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))",
            color: "white",
            boxShadow: "0 4px 16px oklch(0.62 0.09 68 / 0.25)",
            opacity: exporting ? 0.7 : 1,
          }}
        >
          <Download size={16} />
          <span className="text-sm font-label" style={{ letterSpacing: "0.06em", fontWeight: 700 }}>
            {exporting ? "GENERATING…" : "GENERATE REPORT (PDF)"}
          </span>
        </motion.button>

        <p className="text-[10px] text-center font-label pt-2" style={{ color: "var(--t-6)", letterSpacing: "0.06em" }}>
          SPAZEHAUS · PERFORMANCE REPORT · {monthLabel(getToday())}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM view
// ─────────────────────────────────────────────────────────────────────────────

function TeamView({
  company,
  team,
  hasTargets,
  onPickStaff: _onPickStaff,
}: {
  company: ReturnType<typeof computeCompanyPerformance>;
  team: StaffPerformance[];
  hasTargets: boolean;
  onPickStaff: () => void;
}) {
  return (
    <>
      {/* No-targets notice — revenue/pipeline below are live; achievement %
          only appears once sales targets are configured. */}
      {!hasTargets && (
        <div className="rounded-xl px-3.5 py-2.5 flex items-start gap-2.5" style={{ background: "oklch(0.65 0.10 55 / 8%)", border: "1px solid oklch(0.65 0.10 55 / 20%)" }}>
          <AlertCircle size={15} style={{ color: "oklch(0.50 0.10 55)", marginTop: 1 }} className="shrink-0" />
          <p className="text-xs leading-relaxed" style={{ color: "var(--t-3)" }}>
            No sales targets set yet. Revenue, pipeline and cash flow below are live — achievement % will appear once targets are configured.
          </p>
        </div>
      )}
      {/* Company KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={TrendingUp}
          label="YTD Revenue"
          primary={formatRMCompact(company.awardedYTD)}
          secondary={hasTargets ? `${(company.ytdAchievementPct * 100).toFixed(0)}% of ${formatRMCompact(company.ytdRevenueTarget)}` : "No target set"}
          tint="var(--acc-ink)"
          tintBg="oklch(0.62 0.09 68 / 10%)"
          progress={hasTargets ? company.ytdAchievementPct : undefined}
        />
        <KpiCard
          icon={Calendar}
          label="This Month"
          primary={formatRMCompact(company.awardedThisMonth)}
          secondary={hasTargets ? `${(company.monthAchievementPct * 100).toFixed(0)}% of ${formatRMCompact(company.monthlyRevenueTarget)}` : "No target set"}
          tint="oklch(0.45 0.10 55)"
          tintBg="oklch(0.65 0.10 55 / 10%)"
          progress={hasTargets ? company.monthAchievementPct : undefined}
        />
        <KpiCard
          icon={Coins}
          label="Projected GP"
          primary={formatRMCompact(company.projectedGP)}
          secondary={`@ ${company.gpTargetPct}% target`}
          tint="oklch(0.38 0.09 145)"
          tintBg="oklch(0.55 0.09 145 / 10%)"
        />
        <KpiCard
          icon={Briefcase}
          label="Pipeline"
          primary={formatRMCompact(company.pipelineRM)}
          secondary="Active inquiries"
          tint="oklch(0.38 0.09 240)"
          tintBg="oklch(0.55 0.09 240 / 10%)"
        />
      </div>

      {/* Cash flow + Leaderboard — side-by-side on desktop */}
      <div className="space-y-5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
        {/* Cash flow snapshot */}
        <div
          className="rounded-2xl p-4"
          style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
        >
          <p className="font-label text-xs mb-3" style={{ color: "var(--t-2)", letterSpacing: "0.10em", fontWeight: 700 }}>
            CASH FLOW
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>INVOICED</p>
              <p className="font-display text-base font-semibold" style={{ color: "var(--acc-ink)" }}>
                {formatRM(company.invoicedRM)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>COLLECTED</p>
              <p className="font-display text-base font-semibold" style={{ color: "oklch(0.38 0.09 145)" }}>
                {formatRM(company.collectedRM)}
              </p>
            </div>
          </div>
          <div className="mt-2.5 h-2 rounded-full overflow-hidden" style={{ background: "var(--b-2)" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${company.invoicedRM === 0 ? 0 : (company.collectedRM / company.invoicedRM) * 100}%` }}
              transition={{ duration: 1 }}
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, oklch(0.55 0.09 145), oklch(0.65 0.09 145))" }}
            />
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: "var(--t-5)" }}>
            {company.invoicedRM === 0 ? 0 : ((company.collectedRM / company.invoicedRM) * 100).toFixed(0)}% of invoiced is in the bank
          </p>
        </div>

        {/* Sales leaderboard */}
        <Section title="SALES LEADERBOARD" subtitle={hasTargets ? "YTD awarded vs target" : "YTD awarded"}>
          <div className="space-y-3">
            {team.map((p, i) => (
              <StaffRow key={p.staffId} perf={p} rank={i + 1} />
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSONAL view
// ─────────────────────────────────────────────────────────────────────────────

function PersonalView({ staff }: { staff: StaffPerformance | undefined }) {
  if (!staff) {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>No personal target set</p>
        <p className="text-xs mt-1" style={{ color: "var(--t-5)" }}>
          Sales/GP targets are configured for Sales Consultants and Principal Designer.
        </p>
      </div>
    );
  }

  const ytdAch = staff.ytdAchievementPct;
  const monthAch = staff.monthAchievementPct;

  return (
    <>
      {/* Hero card */}
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: "linear-gradient(135deg, oklch(0.62 0.09 68 / 8%), oklch(1 0 0))", border: "1px solid oklch(0.62 0.09 68 / 25%)", boxShadow: "0 1px 12px oklch(0 0 0 / 0.04)" }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))", color: "white" }}
        >
          {staff.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-base font-semibold" style={{ color: "var(--t-1)" }}>
            {staff.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>{staff.role}</p>
        </div>
        {ytdAch >= 1 && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg shrink-0"
            style={{ background: "oklch(0.55 0.09 145 / 12%)" }}
          >
            <Trophy size={12} style={{ color: "oklch(0.38 0.09 145)" }} />
            <span className="text-[10px] font-label" style={{ color: "oklch(0.38 0.09 145)", letterSpacing: "0.06em", fontWeight: 700 }}>
              EXCEEDED
            </span>
          </div>
        )}
      </div>

      {/* Gauges + stats + variance — two-column on desktop */}
      <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
        {/* Left col: gauges + stats */}
        <div className="space-y-3">
          {/* Big gauges — YTD + Month */}
          <div className="grid grid-cols-2 gap-3">
            <Gauge
              label="YTD ACHIEVEMENT"
              pct={ytdAch}
              primary={formatRMCompact(staff.awardedYTD)}
              secondary={`/ ${formatRMCompact(staff.ytdTarget)}`}
            />
            <Gauge
              label="THIS MONTH"
              pct={monthAch}
              primary={formatRMCompact(staff.awardedThisMonth)}
              secondary={`/ ${formatRMCompact(staff.monthlyTarget)}`}
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <MiniStat icon={Award} label="DEALS WON" value={String(staff.awardedCount)} tint="oklch(0.38 0.09 145)" />
            <MiniStat icon={Briefcase} label="PIPELINE" value={String(staff.pipelineCount)} sub={formatRMCompact(staff.pipelineRM)} tint="oklch(0.38 0.09 240)" />
            <MiniStat icon={Coins} label="GP @ TARGET" value={formatRMCompact(staff.projectedGP)} sub={`${staff.gpTargetPct}%`} tint="var(--acc-ink)" />
          </div>
        </div>

        {/* Right col: variance summary */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: ytdAch >= 1 ? "oklch(0.55 0.09 145 / 6%)" : ytdAch >= 0.7 ? "oklch(0.65 0.10 55 / 6%)" : "oklch(0.60 0.12 25 / 6%)",
            border: `1px solid ${ytdAch >= 1 ? "oklch(0.55 0.09 145 / 30%)" : ytdAch >= 0.7 ? "oklch(0.65 0.10 55 / 30%)" : "oklch(0.60 0.12 25 / 30%)"}`,
          }}
        >
          <p className="font-label text-xs mb-2" style={{ color: "var(--t-2)", letterSpacing: "0.10em", fontWeight: 700 }}>
            VARIANCE TO TARGET
          </p>
          <p className="text-sm font-semibold" style={{ color: "var(--t-2)" }}>
            {ytdAch >= 1
              ? `On track — exceeded YTD by ${formatRMCompact(staff.awardedYTD - staff.ytdTarget)} (${((ytdAch - 1) * 100).toFixed(0)}%)`
              : ytdAch >= 0.7
              ? `Behind by ${formatRMCompact(staff.ytdTarget - staff.awardedYTD)} — recoverable with current pipeline`
              : `Significantly behind — ${formatRMCompact(staff.ytdTarget - staff.awardedYTD)} gap to close`}
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--t-5)" }}>
            Pipeline coverage: {staff.ytdTarget === 0 ? "—" : `${((staff.pipelineRM / Math.max(staff.ytdTarget - staff.awardedYTD, 1)) * 100).toFixed(0)}% of remaining gap`}
          </p>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable bits
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-label text-xs" style={{ color: "var(--t-2)", letterSpacing: "0.10em", fontWeight: 700 }}>{title}</p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--t-5)" }}>{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  primary,
  secondary,
  tint,
  tintBg,
  progress,
}: {
  icon: typeof Target;
  label: string;
  primary: string;
  secondary: string;
  tint: string;
  tintBg: string;
  progress?: number;
}) {
  return (
    <div
      className="rounded-2xl p-3"
      style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: tintBg }}>
          <Icon size={14} style={{ color: tint }} />
        </div>
        <p className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>
          {label.toUpperCase()}
        </p>
      </div>
      <p className="font-display text-lg font-semibold leading-none truncate" style={{ color: "var(--t-1)" }}>
        {primary}
      </p>
      <p className="text-[10px] mt-1 truncate" style={{ color: "var(--t-5)" }}>
        {secondary}
      </p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--b-2)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress * 100, 100)}%` }}
            transition={{ duration: 0.8 }}
            className="h-full rounded-full"
            style={{ background: tint }}
          />
        </div>
      )}
    </div>
  );
}

function Gauge({
  label,
  pct,
  primary,
  secondary,
}: {
  label: string;
  pct: number;
  primary: string;
  secondary: string;
}) {
  const clamped = Math.min(pct, 1.5); // cap visual at 150%
  const exceeded = pct >= 1;
  const tint = exceeded ? "oklch(0.38 0.09 145)" : pct >= 0.7 ? "oklch(0.45 0.10 55)" : "oklch(0.50 0.12 25)";
  return (
    <div
      className="rounded-2xl p-3"
      style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
    >
      <p className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>
        {label}
      </p>
      <div className="flex items-baseline gap-1.5 mt-1">
        <p className="font-display text-2xl font-semibold leading-none" style={{ color: tint }}>
          {(pct * 100).toFixed(0)}%
        </p>
        <p className="text-[10px]" style={{ color: "var(--t-5)" }}>achieved</p>
      </div>
      <p className="text-xs font-display font-semibold mt-1.5" style={{ color: "var(--t-2)" }}>
        {primary}
      </p>
      <p className="text-[10px]" style={{ color: "var(--t-5)" }}>{secondary}</p>
      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--b-2)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(clamped / 1.5) * 100}%` }}
          transition={{ duration: 0.8 }}
          className="h-full rounded-full"
          style={{ background: tint }}
        />
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  sub?: string;
  tint: string;
}) {
  return (
    <div
      className="rounded-xl p-2.5 text-center"
      style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
    >
      <Icon size={14} className="mx-auto mb-1" style={{ color: tint }} />
      <p className="font-display text-base font-semibold" style={{ color: "var(--t-1)" }}>{value}</p>
      <p className="text-[9px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>{label}</p>
      {sub && <p className="text-[9px] mt-0.5" style={{ color: tint }}>{sub}</p>}
    </div>
  );
}

function StaffRow({ perf, rank }: { perf: StaffPerformance; rank: number }) {
  const ach = perf.ytdAchievementPct;
  const tint = ach >= 1 ? "oklch(0.38 0.09 145)" : ach >= 0.7 ? "oklch(0.45 0.10 55)" : "oklch(0.50 0.12 25)";

  return (
    <div
      className="rounded-2xl p-3"
      style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{
            background: rank === 1 ? "var(--acc-strong)" : rank === 2 ? "var(--t-5)" : "var(--s-2)",
            color: rank <= 2 ? "white" : "var(--acc-ink)",
            border: rank === 3 ? "1.5px solid var(--acc-strong)" : "none",
          }}
        >
          #{rank}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>{perf.name}</p>
          <p className="text-[10px]" style={{ color: "var(--t-5)" }}>{perf.role}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-sm font-semibold" style={{ color: tint }}>
            {(ach * 100).toFixed(0)}%
          </p>
          <p className="text-[10px]" style={{ color: "var(--t-5)" }}>YTD</p>
        </div>
      </div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px]" style={{ color: "var(--t-5)" }}>
          {formatRMCompact(perf.awardedYTD)} / {formatRMCompact(perf.ytdTarget)}
        </span>
        <span className="text-[10px]" style={{ color: "var(--t-5)" }}>
          {perf.awardedCount} won · {perf.pipelineCount} active
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--b-2)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(ach * 100, 100)}%` }}
          transition={{ duration: 0.8 }}
          className="h-full rounded-full"
          style={{ background: tint }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Project gantt
// ─────────────────────────────────────────────────────────────────────────────

function ProjectGantt({ rows }: { rows: ReturnType<typeof buildProjectTimeline> }) {
  const bounds = timelineBounds(rows);
  const todayPos = timelinePos(getToday(), bounds);

  // Build a few month-tick labels along the timeline
  const tickMonths = [];
  const cur = new Date(bounds.min.getFullYear(), bounds.min.getMonth(), 1);
  while (cur <= bounds.max) {
    tickMonths.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }

  const statusColor: Record<string, string> = {
    active: "oklch(0.55 0.09 240)",
    assigned: "var(--acc-strong)",
    "under-review": "oklch(0.65 0.10 55)",
    completed: "oklch(0.55 0.09 145)",
    "on-hold": "var(--t-5)",
  };

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
    >
      {/* Month ticks */}
      <div className="relative h-4 mb-2">
        {tickMonths.map((m, i) => {
          const left = timelinePos(m, bounds) * 100;
          return (
            <span
              key={i}
              className="absolute text-[8px] font-label"
              style={{
                left: `${left}%`,
                color: "var(--t-5)",
                letterSpacing: "0.04em",
                transform: "translateX(-50%)",
              }}
            >
              {m.toLocaleString("en-US", { month: "short" }).toUpperCase()}
            </span>
          );
        })}
      </div>

      {/* Today line */}
      <div className="relative">
        <div
          className="absolute top-0 bottom-0 w-px z-10"
          style={{
            left: `${todayPos * 100}%`,
            background: "oklch(0.50 0.12 25)",
            transform: "translateX(-0.5px)",
          }}
        />
        <div
          className="absolute -top-1 text-[8px] font-label px-1 rounded-sm z-20"
          style={{
            left: `${todayPos * 100}%`,
            background: "oklch(0.50 0.12 25)",
            color: "white",
            transform: "translateX(-50%)",
            letterSpacing: "0.04em",
          }}
        >
          TODAY
        </div>

        <div className="space-y-2.5 pt-3">
          {rows.map((r) => {
            const startPos = timelinePos(r.start, bounds) * 100;
            const endPos = timelinePos(r.end, bounds) * 100;
            const width = Math.max(endPos - startPos, 4);
            const tint = statusColor[r.status] || "var(--acc-ink)";

            return (
              <div key={r.projectId}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold truncate" style={{ color: "var(--t-2)" }}>
                    {r.name}
                  </p>
                  <span className="text-[10px]" style={{ color: tint }}>{r.progressPct}%</span>
                </div>
                <div className="relative h-3 rounded-full" style={{ background: "var(--s-2)" }}>
                  <div
                    className="absolute top-0 h-full rounded-full"
                    style={{
                      left: `${startPos}%`,
                      width: `${width}%`,
                      background: `${tint}40`,
                      border: `1px solid ${tint}80`,
                    }}
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${width * (r.progressPct / 100)}%` }}
                    transition={{ duration: 0.8 }}
                    className="absolute top-0 h-full rounded-full"
                    style={{
                      left: `${startPos}%`,
                      background: tint,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function monthLabel(d: Date): string {
  return d.toLocaleString("en-US", { month: "long", year: "numeric" }).toUpperCase();
}
