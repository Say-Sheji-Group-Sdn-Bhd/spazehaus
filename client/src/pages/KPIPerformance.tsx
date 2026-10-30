/*
 * SPAZEHAUS KPI & PERFORMANCE PAGE
 * Design: Dark premium performance dashboard with charts
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import AppHeader from "@/components/AppHeader";
import { useAllStaff, useKpiRecords } from "@/lib/queries";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { ClipboardList } from "lucide-react";

const ratingColors: Record<string, { bg: string; color: string; border: string }> = {
  A: { bg: "oklch(0.62 0.09 68 / 12%)", color: "var(--acc)", border: "oklch(0.62 0.09 68 / 25%)" },
  B: { bg: "oklch(0.70 0.09 240 / 15%)", color: "oklch(0.70 0.09 240)", border: "oklch(0.70 0.09 240 / 30%)" },
  C: { bg: "oklch(0.68 0.12 25 / 15%)", color: "oklch(0.68 0.12 25)", border: "oklch(0.68 0.12 25 / 30%)" },
};

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl px-3 py-2" style={{ background: "var(--s-2)", border: "1px solid oklch(1 0 0 / 15%)" }}>
        <p className="text-xs font-label" style={{ color: "var(--t-5)" }}>{label}</p>
        <p className="text-sm font-semibold" style={{ color: "var(--acc)" }}>{payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export default function KPIPerformance() {
  const { data: staffMembers = [] } = useAllStaff();
  const { data: kpiRecords = [] } = useKpiRecords();

  // "Latest rating per staff" — pick the most recent month for each staff_id.
  const latestRatingByStaff = useMemo(() => {
    const map = new Map<string, string>();
    // kpiRecords is already sorted desc by year then month
    for (const r of kpiRecords) {
      if (!map.has(r.staff_id)) map.set(r.staff_id, r.rating);
    }
    return map;
  }, [kpiRecords]);

  const rating = (staffId: string): string =>
    latestRatingByStaff.get(staffId) ?? staffMembers.find((s) => s.id === staffId)?.kpi_grade ?? "B";

  const aCount = staffMembers.filter((s) => rating(s.id) === "A").length;
  const bCount = staffMembers.filter((s) => rating(s.id) === "B").length;
  const cCount = staffMembers.filter((s) => rating(s.id) === "C").length;

  // Monthly trend — average total_score per month for the current year.
  const chartData = useMemo(() => {
    const year = new Date().getFullYear();
    return MONTHS_SHORT.slice(0, new Date().getMonth() + 1).map((label, i) => {
      const month = i + 1;
      // total_score is nullable in the schema (computed lazily once all parts
      // are filled in). Treat null as zero for the rolling average.
      const rows = kpiRecords.filter((r) => r.year === year && r.month === month);
      const avg = rows.length === 0 ? 0 : rows.reduce((s, r) => s + (r.total_score ?? 0), 0) / rows.length;
      return { month: label, score: Math.round(avg) };
    });
  }, [kpiRecords]);

  // Honest empty state: the page is driven by monthly KPI reviews. With none
  // recorded, don't fabricate grades/zero-charts from the stored kpi_grade field.
  const hasData = kpiRecords.length > 0;

  // Label the ratings list by the most recent review month we actually have.
  const latestLabel = useMemo(() => {
    const top = kpiRecords[0];
    return top ? `${MONTHS_SHORT[top.month - 1] ?? ""} ${top.year}`.toUpperCase() : "";
  }, [kpiRecords]);

  return (
    <div className="mobile-container">
      <AppHeader title="KPI & Performance" subtitle="MONTHLY REVIEW" showBack compact />

      <div className="px-4 py-4 pb-24 space-y-5 lg:px-8 lg:py-7">
        {!hasData && (
          <div className="rounded-2xl p-8 flex flex-col items-center text-center gap-3" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "oklch(0.62 0.09 68 / 12%)" }}>
              <ClipboardList size={22} style={{ color: "var(--acc)" }} />
            </div>
            <p className="font-display text-base font-semibold" style={{ color: "var(--t-1)" }}>No KPI reviews yet</p>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: "var(--t-5)" }}>
              Monthly performance reviews will appear here once they're recorded. Ratings, score trends and the team breakdown stay empty until the first review is entered.
            </p>
          </div>
        )}

        {hasData && (<>
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Rating A", value: aCount, color: "var(--acc)" },
            { label: "Rating B", value: bCount, color: "oklch(0.70 0.09 240)" },
            { label: "Rating C", value: cCount, color: "oklch(0.68 0.12 25)" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
              <p className="text-2xl font-display font-semibold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-label mt-0.5" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Team chart */}
        <div className="rounded-2xl p-4" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
          <h4 className="font-display text-base font-semibold text-[color:var(--t-1)] mb-4">Monthly Score Trend</h4>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} barSize={20}>
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--t-5)", fontSize: 10, fontFamily: "Raleway, sans-serif" }}
              />
              <YAxis hide domain={[60, 100]} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "oklch(1 0 0 / 4%)" }} />
              <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.score >= 81 ? "var(--acc-bright)" : entry.score >= 61 ? "oklch(0.70 0.09 240)" : "oklch(0.68 0.12 25)"}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Staff KPI list */}
        <div>
          <p className="text-xs font-label mb-3" style={{ color: "var(--t-5)", letterSpacing: "0.08em" }}>STAFF RATINGS{latestLabel ? ` — ${latestLabel}` : ""}</p>
          <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
            {staffMembers.map((staff, i) => {
              const ratingKey = rating(staff.id);
              const rc = ratingColors[ratingKey] || ratingColors.B;
              return (
                <motion.div
                  key={staff.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-xl p-3 flex items-center gap-3"
                  style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: "oklch(0.62 0.09 68 / 12%)", color: "var(--acc)", border: "1px solid oklch(0.62 0.09 68 / 20%)" }}
                  >
                    {staff.avatar_code}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[color:var(--t-1)]">{staff.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>{staff.job_title}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-display font-bold"
                      style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}
                    >
                      {ratingKey}
                    </span>
                    <span className="text-[9px] font-label" style={{ color: "var(--t-5)" }}>
                      {ratingKey === "A" ? "81-100" : ratingKey === "B" ? "61-80" : "≤60"}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        </>)}
      </div>
    </div>
  );
}
