/*
 * SPAZEHAUS WHATSAPP CLICKS
 * Anonymous, cookieless log of taps on the marketing site's WhatsApp links
 * (floating button, "WhatsApp us", CTAs). Totals, a breakdown by the pre-filled
 * FIRST MESSAGE each link carries, and a recent-clicks list.
 *
 * Tracks *clicks* (intent to message), NOT messages. Whether someone actually
 * messaged the line comes from the WhatsApp Business app → Statistics.
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  MessageCircle, MousePointerClick, TrendingUp, Calendar, Loader2, Trash2, Info, Smartphone,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";
import type { WaClickRow } from "@/lib/dbTypes";
import {
  useWaClicks, useDeleteWaClick, canDeleteWaClick, computeWaClickSummary,
} from "@/lib/queries";
import { useAuth } from "@/contexts/AuthContext";

const HERO_BG = "/hero/cool.jpg";
const DAY = 86_400_000;

type Period = "All" | "7d" | "30d";
const PERIODS: Period[] = ["All", "7d", "30d"];

const SOURCE_META: Record<string, { label: string; color: string; bg: string }> = {
  fab:     { label: "Floating button", color: "oklch(0.38 0.09 145)", bg: "oklch(0.55 0.09 145 / 12%)" },
  contact: { label: "Contact page",    color: "var(--acc-ink)",       bg: "oklch(0.62 0.09 68 / 12%)" },
  consult: { label: "Consultation CTA", color: "oklch(0.38 0.09 240)", bg: "oklch(0.55 0.09 240 / 12%)" },
  career:  { label: "Careers",         color: "oklch(0.45 0.10 55)",  bg: "oklch(0.65 0.10 55 / 12%)" },
  nav:     { label: "Nav bar",         color: "oklch(0.45 0.10 25)",  bg: "oklch(0.60 0.10 25 / 12%)" },
  cta:     { label: "CTA",             color: "oklch(0.50 0.10 300)", bg: "oklch(0.60 0.10 300 / 12%)" },
  link:    { label: "Other link",      color: "var(--t-5)",           bg: "var(--b-2)" },
};
const sourceMeta = (s: string) => SOURCE_META[s] ?? SOURCE_META.link;

export default function WhatsAppClicks() {
  const { staff: me } = useAuth();
  const isAdmin = canDeleteWaClick(me?.role);

  const { data: rows = [], isLoading, isError, error } = useWaClicks();
  const [period, setPeriod] = useState<Period>("All");

  const summary = useMemo(() => computeWaClickSummary(rows), [rows]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff = period === "7d" ? now - 7 * DAY : period === "30d" ? now - 30 * DAY : null;
    return cutoff === null ? rows : rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  }, [rows, period]);

  const windowSummary = useMemo(() => computeWaClickSummary(filtered), [filtered]);
  const pg = usePagination(filtered, 15, period);
  const msgMax = Math.max(...windowSummary.byMessage.map((g) => g.count), 1);

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader title="WhatsApp Clicks" subtitle="LINK TAPS · WEBSITE" bgImage={HERO_BG} showBack showNotification />

      <div className="px-4 py-4 space-y-5 pb-24 lg:px-8 lg:py-7">
        {isError ? (
          <EmptyCard icon={MessageCircle} title="Couldn't load clicks" body={error instanceof Error ? error.message : "Please try again."} />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--acc-ink)" }} />
          </div>
        ) : (
          <>
            {/* Clicks ≠ messages — set expectations up front */}
            <div className="rounded-2xl p-3.5 flex items-start gap-2.5"
              style={{ background: "oklch(0.62 0.09 68 / 8%)", border: "1px solid oklch(0.62 0.09 68 / 18%)" }}>
              <Info size={15} className="shrink-0 mt-0.5" style={{ color: "var(--acc-ink)" }} />
              <p className="text-xs leading-relaxed" style={{ color: "var(--t-3)" }}>
                These are <b>clicks</b> — taps on a WhatsApp link. Whether someone actually messaged the line comes from the
                <b> WhatsApp Business app → Statistics</b> (clicks can't see what happens after the tap).
              </p>
            </div>

            {/* Time window */}
            <div className="flex rounded-xl p-1" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
              {PERIODS.map((w) => {
                const active = period === w;
                const counts: Record<Period, number> = { All: summary.total, "7d": summary.last7, "30d": summary.last30 };
                return (
                  <button key={w} onClick={() => setPeriod(w)}
                    className="flex-1 py-2 text-xs font-label rounded-lg transition-colors flex items-center justify-center gap-1"
                    style={{ background: active ? "oklch(0.62 0.09 68 / 10%)" : "transparent", color: active ? "var(--acc-ink)" : "var(--t-5)", letterSpacing: "0.04em", fontWeight: active ? 700 : 400 }}>
                    {w === "All" ? "ALL TIME" : `LAST ${w.toUpperCase()}`}
                    <span className="text-[10px] opacity-70">({counts[w]})</span>
                  </button>
                );
              })}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <KpiCard icon={MousePointerClick} label="Total Clicks" value={String(summary.total)} tint="oklch(0.38 0.09 145)" tintBg="oklch(0.55 0.09 145 / 10%)" />
              <KpiCard icon={TrendingUp} label="Last 7 Days" value={String(summary.last7)} tint="var(--acc-ink)" tintBg="oklch(0.62 0.09 68 / 10%)" />
              <KpiCard icon={Calendar} label="Last 30 Days" value={String(summary.last30)} tint="oklch(0.45 0.10 55)" tintBg="oklch(0.65 0.10 55 / 10%)" />
            </div>

            {rows.length === 0 ? (
              <EmptyCard icon={MessageCircle} title="No clicks yet"
                body="Taps on the WhatsApp button and links appear here once visitors start using them." />
            ) : (
              <>
                {/* By first message — the heart of it */}
                <div className="rounded-2xl p-4" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-label text-xs" style={{ color: "var(--t-2)", letterSpacing: "0.10em", fontWeight: 700 }}>
                      BY FIRST MESSAGE
                    </p>
                    <span className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>
                      {period === "All" ? "ALL TIME" : `LAST ${period.toUpperCase()}`}
                    </span>
                  </div>
                  {windowSummary.byMessage.length === 0 ? (
                    <p className="text-xs py-3 text-center" style={{ color: "var(--t-5)" }}>No clicks in this period</p>
                  ) : (
                    <div className="space-y-3">
                      {windowSummary.byMessage.map((g, i) => {
                        const sm = sourceMeta(g.topSource);
                        return (
                          <div key={g.message}>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-sm flex-1" style={{ color: "var(--t-2)" }}>
                                &ldquo;{g.message}&rdquo;
                              </p>
                              <span className="text-sm font-display font-semibold shrink-0" style={{ color: sm.color }}>
                                {g.count}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--b-2)" }}>
                                <motion.div initial={{ width: 0 }} animate={{ width: `${(g.count / msgMax) * 100}%` }}
                                  transition={{ duration: 0.6, delay: i * 0.06 }} className="h-full rounded-full" style={{ background: sm.color }} />
                              </div>
                              <span className="status-pill shrink-0" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recent clicks */}
                <div>
                  <p className="font-label text-xs mb-2.5 px-1" style={{ color: "var(--t-4)", letterSpacing: "0.10em", fontWeight: 700 }}>
                    RECENT CLICKS
                  </p>
                  <div className="space-y-2">
                    {pg.pageItems.map((row, i) => (
                      <ClickRow key={row.id} row={row} index={i} isAdmin={isAdmin} />
                    ))}
                  </div>
                  <PaginationBar page={pg.page} pageCount={pg.pageCount} onPage={pg.setPage} from={pg.from} to={pg.to} total={pg.total} label="clicks" />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── One click ────────────────────────────────────────────────────────────── */

function ClickRow({ row, index, isAdmin }: { row: WaClickRow; index: number; isAdmin: boolean }) {
  const sm = sourceMeta(row.source);
  const del = useDeleteWaClick();
  const attribution = [row.utm_source, row.utm_medium, row.utm_campaign].filter(Boolean).join(" / ");

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}
      className="rounded-xl p-3 flex items-start gap-3" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: sm.bg }} aria-hidden="true">
        <Smartphone size={14} style={{ color: sm.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="status-pill" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
          {row.message && (
            <span className="text-xs truncate" style={{ color: "var(--t-3)" }}>&ldquo;{row.message}&rdquo;</span>
          )}
        </div>
        <p className="text-[10px] font-label mt-1" style={{ color: "var(--t-6)", letterSpacing: "0.04em" }}>
          {formatWhen(row.created_at)}
          {row.page ? ` · ${row.page}` : ""}
          {row.locale ? ` · ${row.locale.toUpperCase()}` : ""}
          {attribution ? ` · ${attribution}` : ""}
        </p>
      </div>
      {isAdmin && (
        <button
          disabled={del.isPending}
          onClick={() => {
            if (!confirm("Delete this click record?")) return;
            del.mutate(row.id, {
              onSuccess: () => toast.success("Click removed"),
              onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
            });
          }}
          className="shrink-0 p-1.5 rounded-lg disabled:opacity-60"
          style={{ color: "oklch(0.55 0.10 25)" }}
          aria-label="Delete click">
          <Trash2 size={13} />
        </button>
      )}
    </motion.div>
  );
}

/* ── Small pieces ─────────────────────────────────────────────────────────── */

function KpiCard({
  icon: Icon, label, value, tint, tintBg,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string; value: string; tint: string; tintBg: string;
}) {
  return (
    <div className="rounded-2xl p-3.5" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: tintBg }}>
        <Icon size={15} style={{ color: tint }} />
      </div>
      <p className="text-[9px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>{label.toUpperCase()}</p>
      <p className="font-display text-lg font-semibold mt-0.5" style={{ color: "var(--t-1)" }}>{value}</p>
    </div>
  );
}

function EmptyCard({
  icon: Icon, title, body,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  title: string; body: string;
}) {
  return (
    <div className="rounded-2xl p-8 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
      <Icon size={28} className="mx-auto mb-3" style={{ color: "var(--t-7)" }} />
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--t-1)" }}>{title}</p>
      <p className="text-xs" style={{ color: "var(--t-5)" }}>{body}</p>
    </div>
  );
}

/** Relative for the last day, then DD/MM/YYYY HH:mm — the Spazehaus convention. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)}h ago`;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
