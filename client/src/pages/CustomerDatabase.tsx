/*
 * SPAZEHAUS CUSTOMER DATABASE
 * Cross-project view of every inquiry — pipeline funnel, win rate,
 * category breakdown, and a filterable customer list.
 *
 * Source: 2026 Annual Meeting PDF — "Customer Database" pillar
 * (Inquiry vs Awarded · Categories customer)
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Search, ChevronRight, TrendingUp, Users, Award, XCircle, UserPlus } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";
import {
  stageConfig,
  categoryConfig,
  tierConfig,
} from "@/lib/customerData";
import type { InquiryStage, CustomerCategory } from "@/lib/dbTypes";
import { useInquiries, useCustomers, computeCustomerSummary } from "@/lib/queries";
import { formatRM } from "@/lib/quotationData";

const HERO_BG = "/hero/cool.jpg";

type FilterTab = "All" | "Active" | "Awarded" | "Rejected";
const filterTabs: FilterTab[] = ["All", "Active", "Awarded", "Rejected"];

export default function CustomerDatabase() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<FilterTab>("All");
  const [search, setSearch] = useState("");

  const { data: inquiries = [] } = useInquiries();
  const { data: customers = [] } = useCustomers();
  const summary = computeCustomerSummary(inquiries);
  const catCounts = inquiries.reduce(
    (acc, i) => {
      acc[i.category] = (acc[i.category] ?? 0) + 1;
      return acc;
    },
    { Residential: 0, Commercial: 0, "F&B": 0, Office: 0, Investor: 0 } as Record<CustomerCategory, number>,
  );

  // Build the funnel — stage volumes
  const funnel = [
    { key: "new-inquiry" as InquiryStage,   value: summary.newInquiry + summary.showroomMeet + summary.awarded + summary.rejected, label: "All Inquiries" },
    { key: "showroom-meet" as InquiryStage, value: summary.showroomMeet + summary.awarded + summary.rejected,                       label: "Showroom Meet" },
    { key: "awarded" as InquiryStage,       value: summary.awarded,                                                                  label: "Awarded" },
  ];
  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);

  // One card per CUSTOMER (Phase 5). Roll up a display stage from the customer's
  // opportunities and keep the funnel/KPIs above on the aggregate inquiry set.
  const customerRows = customers.map(({ customer, opportunities }) => {
    const stage: InquiryStage =
      opportunities.some((o) => o.stage === "showroom-meet") ? "showroom-meet"
      : opportunities.some((o) => o.stage === "new-inquiry") ? "new-inquiry"
      : opportunities.some((o) => o.stage === "awarded") ? "awarded"
      : opportunities.length > 0 ? "rejected" : "new-inquiry";
    const lastUpdated = opportunities[0]?.lastUpdated ?? customer.created_at.slice(0, 10);
    return { customer, opportunities, stage, lastUpdated };
  });
  const filtered = customerRows
    .filter((r) => {
      if (filter === "Active") return r.opportunities.some((o) => o.stage === "new-inquiry" || o.stage === "showroom-meet");
      if (filter === "Awarded") return r.opportunities.some((o) => o.stage === "awarded");
      if (filter === "Rejected") return r.opportunities.length > 0 && r.opportunities.every((o) => o.stage === "rejected");
      return true;
    })
    .filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.customer.name.toLowerCase().includes(q) ||
        r.customer.id.toLowerCase().includes(q) ||
        r.customer.category.toLowerCase().includes(q) ||
        r.opportunities.some((o) => o.location.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
  const pg = usePagination(filtered, 9, `${filter}|${search}`);

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader
        title="Customers"
        subtitle="DATABASE · CRM"
        bgImage={HERO_BG}
        showBack
        showNotification
        rightAction={
          <button
            data-testid="new-customer-btn"
            onClick={() => navigate("/customers/new")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-label font-semibold"
            style={{ background: "var(--acc-strong)", color: "oklch(1 0 0)", letterSpacing: "0.04em" }}
          >
            <UserPlus size={14} /> New
          </button>
        }
      />

      <div className="px-4 py-4 space-y-5 pb-24 lg:px-8 lg:py-7">
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            icon={Users}
            label="Total Inquiries"
            primary={String(summary.total)}
            secondary={`${summary.active} active in pipeline`}
            tint="var(--acc-ink)"
            tintBg="oklch(0.62 0.09 68 / 10%)"
          />
          <KpiCard
            icon={TrendingUp}
            label="Pipeline Value"
            primary={formatRM(summary.pipelineRM)}
            secondary={`${formatRM(summary.awardedRM)} already awarded`}
            tint="oklch(0.45 0.10 55)"
            tintBg="oklch(0.65 0.10 55 / 10%)"
          />
          <KpiCard
            icon={Award}
            label="Awarded"
            primary={String(summary.awarded)}
            secondary={`${formatRM(summary.awardedRM)} secured`}
            tint="oklch(0.38 0.09 145)"
            tintBg="oklch(0.55 0.09 145 / 10%)"
          />
          <KpiCard
            icon={XCircle}
            label="Win Rate"
            primary={`${(summary.winRate * 100).toFixed(0)}%`}
            secondary={`${summary.awarded} of ${summary.closedTotal} closed`}
            tint="oklch(0.50 0.12 25)"
            tintBg="oklch(0.60 0.12 25 / 10%)"
          />
        </div>

        {/* Funnel */}
        <div
          className="rounded-2xl p-4"
          style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="font-label text-xs" style={{ color: "var(--t-2)", letterSpacing: "0.10em", fontWeight: 700 }}>
              CONVERSION FUNNEL
            </p>
            <span className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>
              INQUIRY → AWARDED
            </span>
          </div>
          <div className="space-y-2">
            {funnel.map((f, i) => {
              const sc = stageConfig[f.key];
              const pct = (f.value / funnelMax) * 100;
              return (
                <div key={f.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: "var(--t-3)" }}>{f.label}</span>
                    <span className="text-xs font-display font-semibold" style={{ color: sc.color }}>{f.value}</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--b-2)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className="h-full rounded-full"
                      style={{ background: sc.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className="mt-3 pt-3 flex items-center justify-between"
            style={{ borderTop: "1px solid var(--b-2)" }}
          >
            <span className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>
              CONVERSION
            </span>
            <span className="font-display text-sm font-semibold" style={{ color: "oklch(0.38 0.09 145)" }}>
              {summary.awarded} / {summary.total} ({((summary.awarded / Math.max(summary.total, 1)) * 100).toFixed(0)}%)
            </span>
          </div>
        </div>

        {/* Categories breakdown */}
        <div
          className="rounded-2xl p-4"
          style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
        >
          <p className="font-label text-xs mb-3" style={{ color: "var(--t-2)", letterSpacing: "0.10em", fontWeight: 700 }}>
            CUSTOMER CATEGORIES
          </p>
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(catCounts) as CustomerCategory[]).map((cat) => {
              const count = catCounts[cat];
              const cc = categoryConfig[cat];
              return (
                <div
                  key={cat}
                  className="rounded-xl p-2 text-center"
                  style={{ background: cc.bg, border: `1px solid ${cc.color}25` }}
                >
                  <p className="font-display text-base font-semibold" style={{ color: cc.color }}>
                    {count}
                  </p>
                  <p
                    className="text-[9px] font-label mt-0.5 leading-tight truncate"
                    style={{ color: cc.color, letterSpacing: "0.04em" }}
                  >
                    {cat.toUpperCase()}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter tabs */}
        <div
          className="flex rounded-xl p-1"
          style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
        >
          {filterTabs.map((t) => {
            const active = filter === t;
            const counts: Record<FilterTab, number> = {
              All: summary.total,
              Active: summary.active,
              Awarded: summary.awarded,
              Rejected: summary.rejected,
            };
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="flex-1 py-2 text-xs font-label rounded-lg transition-colors flex items-center justify-center gap-1"
                style={{
                  background: active ? "oklch(0.62 0.09 68 / 10%)" : "transparent",
                  color: active ? "var(--acc-ink)" : "var(--t-5)",
                  letterSpacing: "0.04em",
                  fontWeight: active ? 700 : 400,
                }}
              >
                {t.toUpperCase()}
                <span className="text-[10px] opacity-70">({counts[t]})</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
        >
          <Search size={14} style={{ color: "var(--t-6)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, location, category…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--t-2)" }}
          />
        </div>

        {/* Customer cards */}
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
          >
            <Users size={28} className="mx-auto mb-3" style={{ color: "var(--t-7)" }} />
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--t-1)" }}>No matches</p>
            <p className="text-xs" style={{ color: "var(--t-5)" }}>Try a different filter or search term</p>
          </div>
        ) : (
          <div className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:items-start">
            {pg.pageItems.map((row, i) => {
              const { customer, opportunities, stage } = row;
              const sc = stageConfig[stage];
              const cc = categoryConfig[customer.category];
              const tc = tierConfig[customer.tier];
              const initials = customer.name
                .split(/[\s.&-]+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((s) => s[0]?.toUpperCase() || "")
                .join("");
              const awardedCount = opportunities.filter((o) => o.stage === "awarded").length;

              return (
                <motion.button
                  key={customer.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  data-testid="customer-card"
                  data-customer-id={customer.id}
                  className="w-full rounded-2xl p-4 flex items-start gap-3 text-left"
                  style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
                >
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: cc.bg, color: cc.color, border: `1.5px solid ${cc.color}30` }}
                  >
                    {initials || "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--t-1)" }}>
                        {customer.name}
                      </p>
                      {customer.tier !== "Standard" && (
                        <span
                          className="text-[9px] font-label px-1.5 py-0.5 rounded-md"
                          style={{ background: tc.bg, color: tc.color, letterSpacing: "0.06em", fontWeight: 700 }}
                        >
                          {customer.tier.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span
                        className="text-[10px] font-label px-1.5 py-0.5 rounded-md"
                        style={{ background: cc.bg, color: cc.color, letterSpacing: "0.04em", fontWeight: 600 }}
                      >
                        {customer.category}
                      </span>
                      <span className="text-[11px]" style={{ color: "var(--t-5)" }}>
                        · {opportunities.length} project{opportunities.length === 1 ? "" : "s"}
                        {awardedCount > 0 ? ` · ${awardedCount} awarded` : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span
                        className="text-[10px] font-label px-2 py-0.5 rounded-full"
                        style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, letterSpacing: "0.04em", fontWeight: 700 }}
                      >
                        {sc.label.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="shrink-0 mt-1" style={{ color: "var(--t-6)" }} />
                </motion.button>
              );
            })}
          </div>
        )}

        <PaginationBar page={pg.page} pageCount={pg.pageCount} onPage={pg.setPage} from={pg.from} to={pg.to} total={pg.total} label="customers" />

        <p className="text-[10px] text-center font-label pt-2" style={{ color: "var(--t-6)", letterSpacing: "0.06em" }}>
          SPAZEHAUS · CUSTOMER DATABASE · 2026 ANNUAL MEETING SOP
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI tile
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  primary,
  secondary,
  tint,
  tintBg,
}: {
  icon: typeof Users;
  label: string;
  primary: string;
  secondary: string;
  tint: string;
  tintBg: string;
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
    </div>
  );
}
