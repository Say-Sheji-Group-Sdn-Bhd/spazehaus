/*
 * SPAZEHAUS PROJECTS LIST PAGE
 * Design: White/light corporate theme with warm gold accents
 * Shows project cards with progress, team, deadline
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Plus, Search, MapPin, Calendar, FileText, Receipt, AlertCircle, Users, ChevronRight } from "lucide-react";
import { computeTotals, formatRM } from "@/lib/quotationData";
import AppHeader from "@/components/AppHeader";
import { statusConfig, priorityConfig, DEFAULT_PRIORITY_CONFIG } from "@/lib/mockData";
import { useProjects, useAllStaff, resolveProjectRoster, useOpenPayments, useOpenSignatures, useInquiries, useQuotations, computeCheckpointSummary, computeCustomerSummary } from "@/lib/queries";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";

const HERO_BG = "/hero/portfolio.jpg";

const statusFilters = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "assigned", label: "Assigned" },
  { key: "under-review", label: "Review" },
  { key: "completed", label: "Done" },
];

// Light-theme status config
const lightStatus: Record<string, { bg: string; color: string }> = {
  active:       { bg: "oklch(0.62 0.09 68 / 12%)",  color: "var(--acc-ink)" },
  assigned:     { bg: "oklch(0.55 0.09 240 / 12%)", color: "oklch(0.38 0.09 240)" },
  "under-review": { bg: "oklch(0.65 0.10 55 / 12%)", color: "oklch(0.45 0.10 55)" },
  completed:    { bg: "oklch(0.55 0.09 145 / 12%)", color: "oklch(0.38 0.09 145)" },
  "on-hold":    { bg: "oklch(0.55 0.006 68 / 12%)", color: "var(--t-4)" },
};

export default function Projects() {
  const [, navigate] = useLocation();
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: projects = [], isLoading, isError, refetch } = useProjects();
  const { data: allStaff = [] } = useAllStaff();
  const { data: openPayments = [] } = useOpenPayments();
  const { data: openSignatures = [] } = useOpenSignatures();
  const { data: inquiries = [] } = useInquiries();
  const { data: quotations = [] } = useQuotations();

  const filtered = projects.filter((p) => {
    const matchStatus = activeFilter === "all" || p.status === activeFilter;
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });
  const pg = usePagination(filtered, 9, `${activeFilter}|${search}`);

  const stats = [
    { label: "Total", value: projects.length },
    { label: "Active", value: projects.filter((p) => p.status === "active").length },
    { label: "Review", value: projects.filter((p) => p.status === "under-review").length },
    { label: "Done", value: projects.filter((p) => p.status === "completed").length },
  ];

  // Cross-project checkpoint summary for the banner
  const ckpt = computeCheckpointSummary(openPayments, openSignatures);

  // Customer/inquiry summary for the banner
  const cust = computeCustomerSummary(inquiries);

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader title="Projects" subtitle="DESIGN PORTFOLIO" bgImage={HERO_BG} showNotification />

      <div className="px-4 py-4 space-y-4 pb-24 lg:px-8 lg:py-7 lg:space-y-6">
        {/* Quotations + Checkpoints shortcuts (Phase 2) */}
        <div className="grid grid-cols-2 gap-2.5">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/quotations")}
            className="rounded-2xl p-3 flex flex-col gap-1.5 text-left"
            style={{ background: "var(--s-card)", border: "1px solid oklch(0.62 0.09 68 / 25%)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.62 0.09 68 / 12%)" }}>
                <FileText size={14} style={{ color: "var(--acc)" }} />
              </div>
              <Receipt size={12} style={{ color: "var(--t-6)" }} />
            </div>
            <p className="text-xs font-semibold mt-1" style={{ color: "var(--t-1)" }}>Quotations</p>
            <p className="text-[10px]" style={{ color: "var(--t-5)" }}>
              {quotations.length} docs · RM {quotations.reduce((s, q) => s + computeTotals(q.items, q.taxRate).total, 0).toLocaleString("en-MY", { minimumFractionDigits: 0 })}
            </p>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/checkpoints")}
            className="rounded-2xl p-3 flex flex-col gap-1.5 text-left"
            style={{
              background: ckpt.overdueCount > 0
                ? "linear-gradient(135deg, oklch(0.60 0.12 25 / 6%), oklch(1 0 0))"
                : "oklch(1 0 0)",
              border: ckpt.overdueCount > 0
                ? "1px solid oklch(0.60 0.12 25 / 30%)"
                : "1px solid oklch(0.62 0.09 68 / 25%)",
              boxShadow: ckpt.overdueCount > 0
                ? "0 1px 12px oklch(0.60 0.12 25 / 12%)"
                : "0 1px 8px oklch(0 0 0 / 0.04)",
            }}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: ckpt.overdueCount > 0 ? "oklch(0.60 0.12 25 / 12%)" : "oklch(0.62 0.09 68 / 12%)" }}
              >
                <AlertCircle
                  size={14}
                  style={{ color: ckpt.overdueCount > 0 ? "oklch(0.50 0.12 25)" : "var(--acc)" }}
                />
              </div>
              {ckpt.overdueCount > 0 && (
                <span
                  className="text-[9px] font-label px-1.5 py-0.5 rounded-md"
                  style={{ background: "oklch(0.60 0.12 25 / 12%)", color: "oklch(0.50 0.12 25)", letterSpacing: "0.04em", fontWeight: 700 }}
                >
                  {ckpt.overdueCount} OVERDUE
                </span>
              )}
            </div>
            <p className="text-xs font-semibold mt-1" style={{ color: "var(--t-1)" }}>Checkpoints</p>
            <p className="text-[10px]" style={{ color: "var(--t-5)" }}>
              {ckpt.paymentsCount} payments · {ckpt.pendingSignsCount} signs
            </p>
          </motion.button>
        </div>

        {/* Customer Database banner — Phase 3 (full-width with mini funnel) */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/customers")}
          className="w-full rounded-2xl p-4 text-left"
          style={{
            background: "linear-gradient(135deg, oklch(0.55 0.09 240 / 5%), oklch(1 0 0))",
            border: "1px solid oklch(0.55 0.09 240 / 25%)",
            boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "oklch(0.55 0.09 240 / 12%)" }}
            >
              <Users size={18} style={{ color: "oklch(0.38 0.09 240)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>
                Customer Database
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--t-5)" }}>
                Inquiry → Awarded · {cust.total} total · {(cust.winRate * 100).toFixed(0)}% win rate
              </p>
            </div>
            <ChevronRightIcon />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MiniStat
              label="ACTIVE"
              value={cust.active}
              color="oklch(0.45 0.10 55)"
              bg="oklch(0.65 0.10 55 / 8%)"
            />
            <MiniStat
              label="AWARDED"
              value={cust.awarded}
              color="oklch(0.38 0.09 145)"
              bg="oklch(0.55 0.09 145 / 8%)"
            />
            <MiniStat
              label="PIPELINE"
              value={formatRM(cust.pipelineRM)}
              color="oklch(0.38 0.09 240)"
              bg="oklch(0.55 0.09 240 / 8%)"
              isCurrency
            />
          </div>
        </motion.button>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 6px oklch(0 0 0 / 0.03)" }}>
              <p className="text-xl font-display font-semibold" style={{ color: "var(--t-1)" }}>{s.value}</p>
              <p className="text-[10px] font-label mt-0.5" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
          <Search size={14} style={{ color: "var(--t-6)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects or clients..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--t-1)" }}
          />
        </div>

        {/* Status filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {statusFilters.map((f) => (
            <motion.button
              key={f.key}
              whileTap={{ scale: 0.92 }}
              onClick={() => setActiveFilter(f.key)}
              className="shrink-0 px-4 py-1.5 rounded-full text-xs font-label"
              style={{
                background: activeFilter === f.key ? "var(--acc-strong)" : "oklch(1 0 0)",
                color: activeFilter === f.key ? "oklch(1 0 0)" : "var(--t-4)",
                border: activeFilter === f.key ? "none" : "1px solid var(--b-1)",
                letterSpacing: "0.04em",
                fontWeight: activeFilter === f.key ? 600 : 400,
              }}
            >
              {f.label}
            </motion.button>
          ))}
        </div>

        {/* Load error — distinct from a genuinely empty list */}
        {isError && (
          <div
            className="rounded-2xl p-4 mb-3 flex items-center justify-between gap-3"
            style={{ background: "oklch(0.58 0.12 25 / 8%)", border: "1px solid oklch(0.58 0.12 25 / 25%)" }}
          >
            <p className="text-[12px]" style={{ color: "oklch(0.45 0.12 25)" }}>
              Couldn't load projects. Check your connection.
            </p>
            <button
              onClick={() => refetch()}
              className="text-[11px] font-label px-3 py-1.5 rounded-lg shrink-0"
              style={{ background: "oklch(0.58 0.12 25 / 12%)", color: "oklch(0.45 0.12 25)", letterSpacing: "0.04em" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Project cards */}
        <AnimatePresence mode="popLayout">
          <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:items-start">
            {pg.pageItems.map((project, i) => {
              const ls = lightStatus[project.status] || lightStatus["on-hold"];
              const pc = priorityConfig[project.priority as keyof typeof priorityConfig] ?? DEFAULT_PRIORITY_CONFIG;
              return (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  data-testid="project-list-card"
                  data-project-id={project.id}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 2px 12px oklch(0 0 0 / 0.05)" }}
                >
                  {/* Gold top accent */}
                  <div className="h-0.5" style={{ background: "linear-gradient(90deg, var(--acc-strong), oklch(0.72 0.09 68 / 40%), transparent)" }} />

                  {/* Card header */}
                  <div className="px-4 pt-3.5 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold leading-snug" style={{ color: "var(--t-1)" }}>{project.name}</h3>
                        <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>{project.client}</p>
                        {project.projectCode && (
                          <p className="text-[10px] font-label mt-0.5" style={{ color: "var(--acc)", letterSpacing: "0.06em" }}>{project.projectCode}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="status-pill" style={{ background: ls.bg, color: ls.color }}>
                          {project.status === "active" ? "Active" : project.status === "completed" ? "Done" : project.status === "under-review" ? "Review" : project.status === "assigned" ? "Assigned" : "On Hold"}
                        </span>
                        <span className="text-[10px] font-label" style={{ color: pc.color }}>
                          ● {pc.label} Priority
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1">
                        <MapPin size={10} style={{ color: "var(--t-6)" }} />
                        <span className="text-[11px]" style={{ color: "var(--t-5)" }}>{project.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={10} style={{ color: "var(--t-6)" }} />
                        <span className="text-[11px]" style={{ color: "var(--t-5)" }}>{project.targetDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="px-4 pb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px]" style={{ color: "var(--t-5)" }}>
                        {project.tasksCompleted}/{project.taskCount} tasks
                      </span>
                      <span className="text-xs font-semibold" style={{ color: "var(--acc)" }}>{project.progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--b-2)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${project.progress}%`,
                          background: "linear-gradient(90deg, var(--acc-strong), var(--acc-bright))",
                        }}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div
                    className="px-4 py-2.5 flex items-center justify-between"
                    style={{ borderTop: "1px solid var(--b-2)", background: "var(--s-page)" }}
                  >
                    <div className="flex -space-x-1">
                      {resolveProjectRoster(project, allStaff).map(({ staff: member, role }) => (
                        <div
                          key={member.id}
                          title={`${member.name} · ${role}`}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2"
                          style={{
                            background: "linear-gradient(135deg, oklch(0.62 0.09 68 / 20%), oklch(0.52 0.08 65 / 20%))",
                            borderColor: "oklch(1 0 0)",
                            color: "var(--acc-ink)",
                          }}
                        >
                          {member.avatar_code}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px]" style={{ color: "var(--t-5)" }}>
                        📷 {project.photoCount}
                      </span>
                      <span className="text-[11px] font-semibold" style={{ color: "var(--acc-ink)" }}>
                        RM {(project.budget / 1000).toFixed(0)}k
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
        <PaginationBar page={pg.page} pageCount={pg.pageCount} onPage={pg.setPage} from={pg.from} to={pg.to} total={pg.total} label="projects" />
      </div>

      {/* FAB */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => navigate("/projects/new")}
        data-testid="new-project-fab"
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full flex items-center justify-center z-40"
        style={{
          background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))",
          boxShadow: "0 4px 20px oklch(0.62 0.09 68 / 40%)",
        }}
      >
        <Plus size={22} style={{ color: "oklch(1 0 0)" }} />
      </motion.button>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function ChevronRightIcon() {
  return <ChevronRight size={14} style={{ color: "var(--t-6)" }} />;
}

function MiniStat({
  label,
  value,
  color,
  bg,
  isCurrency,
}: {
  label: string;
  value: number | string;
  color: string;
  bg: string;
  isCurrency?: boolean;
}) {
  return (
    <div className="rounded-xl p-2.5 text-center" style={{ background: bg }}>
      <p
        className={`font-display font-bold ${isCurrency ? "text-[11px]" : "text-lg"}`}
        style={{ color }}
      >
        {value}
      </p>
      <p
        className="text-[9px] font-label mt-0.5"
        style={{ color, letterSpacing: "0.04em", opacity: 0.85 }}
      >
        {label}
      </p>
    </div>
  );
}
