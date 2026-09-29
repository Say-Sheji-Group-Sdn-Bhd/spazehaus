/*
 * SPAZEHAUS SPACOLOGY RESULTS
 * Every completed Spacology personality quiz from the public marketing site
 * (spazehaus.com/spacology-quiz) — volume over time, which of the five space
 * personalities the market skews toward, and the full answer trail per visitor.
 *
 * Read-only by design: rows are written by the public `submit_spacology_result`
 * RPC and the database rejects edits to the submitted data. Staff can annotate
 * a row (ops tier) and admins can remove spam.
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search, Sparkles, TrendingUp, Users, Clock, ChevronDown, Trash2,
  StickyNote, Loader2, MessageSquare, Phone, Mail, Hammer, UserRound,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";
import { SPACE_TYPES, spaceType } from "@/lib/spacologyData";
import type { SpaceType, SpacologyResultRow } from "@/lib/dbTypes";
import {
  useSpacologyResults,
  useDeleteSpacologyResult,
  useUpdateSpacologyNote,
  computeSpacologySummary,
  parseSpacologyAnswers,
  parseSpacologyScores,
  canDeleteSpacologyResult,
  isSpacologyLead,
  whatsappHref,
} from "@/lib/queries";
import { useAuth } from "@/contexts/AuthContext";

const HERO_BG = "/hero/cool.jpg";

type Period = "All" | "7d" | "30d";
const PERIODS: Period[] = ["All", "7d", "30d"];

/** Leads = we have contact details. Renovating = said yes to the 3-6 month
 *  question, which is the queue worth calling first. */
type Audience = "All" | "Leads" | "Renovating";
const AUDIENCES: Audience[] = ["All", "Leads", "Renovating"];
const DAY = 86_400_000;

export default function SpacologyResults() {
  const { staff: me } = useAuth();
  const isAdmin = canDeleteSpacologyResult(me?.role);

  const { data: rows = [], isLoading, isError, error } = useSpacologyResults();
  const [typeFilter, setTypeFilter] = useState<SpaceType | "All">("All");
  const [period, setPeriod] = useState<Period>("All");
  const [audience, setAudience] = useState<Audience>("All");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const summary = useMemo(() => computeSpacologySummary(rows), [rows]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff = period === "7d" ? now - 7 * DAY : period === "30d" ? now - 30 * DAY : null;
    const q = search.trim().toLowerCase();

    return rows.filter((r) => {
      if (typeFilter !== "All" && r.result_type !== typeFilter) return false;
      if (audience === "Leads" && !isSpacologyLead(r)) return false;
      if (audience === "Renovating" && r.planning_renovation !== true) return false;
      if (cutoff !== null && new Date(r.submitted_at).getTime() < cutoff) return false;
      if (!q) return true;
      return [
        r.id, r.result_type, r.result_name_en, r.result_name_cn,
        r.name, r.email, r.phone, r.utm_source, r.utm_campaign, r.referrer, r.notes,
      ].some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, typeFilter, period, audience, search]);

  const pg = usePagination(filtered, 10, `${typeFilter}|${period}|${audience}|${search}`);

  // Distribution is scoped to the active time window (but not to the personality
  // filter — otherwise the chart would always show a single 100% bar).
  const windowRows = useMemo(() => {
    const now = Date.now();
    const cutoff = period === "7d" ? now - 7 * DAY : period === "30d" ? now - 30 * DAY : null;
    return cutoff === null ? rows : rows.filter((r) => new Date(r.submitted_at).getTime() >= cutoff);
  }, [rows, period]);
  const windowSummary = useMemo(() => computeSpacologySummary(windowRows), [windowRows]);
  const distMax = Math.max(...SPACE_TYPES.map((t) => windowSummary.byType[t]), 1);

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader title="Spacology" subtitle="QUIZ RESULTS · WEBSITE" bgImage={HERO_BG} showBack showNotification />

      <div className="px-4 py-4 space-y-5 pb-24 lg:px-8 lg:py-7">
        {isError ? (
          <EmptyCard
            icon={Sparkles}
            title="Couldn't load results"
            body={error instanceof Error ? error.message : "Please try again."}
          />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--acc-ink)" }} />
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                icon={Users}
                label="Total Submissions"
                primary={String(summary.total)}
                secondary={summary.total === 0 ? "No one has taken it yet" : `${summary.last30} in the last 30 days`}
                tint="var(--acc-ink)"
                tintBg="oklch(0.62 0.09 68 / 10%)"
              />
              <KpiCard
                icon={TrendingUp}
                label="Last 7 Days"
                primary={String(summary.last7)}
                secondary={summary.topSource ? `Top source: ${summary.topSource}` : "No source data"}
                tint="oklch(0.38 0.09 145)"
                tintBg="oklch(0.55 0.09 145 / 10%)"
              />
              <KpiCard
                icon={Sparkles}
                label="Most Common"
                primary={summary.topType ? spaceType(summary.topType).label : "—"}
                secondary={
                  summary.topType
                    ? `${summary.byType[summary.topType]} of ${summary.total} visitors`
                    : "Awaiting submissions"
                }
                tint="oklch(0.45 0.10 55)"
                tintBg="oklch(0.65 0.10 55 / 10%)"
              />
              <KpiCard
                icon={Hammer}
                label="Renovating Soon"
                primary={String(summary.renovatingSoon)}
                secondary={
                  summary.withContact === 0
                    ? "No contactable leads yet"
                    : `of ${summary.withContact} contactable lead${summary.withContact === 1 ? "" : "s"}`
                }
                tint="oklch(0.38 0.09 240)"
                tintBg="oklch(0.55 0.09 240 / 10%)"
              />
            </div>

            {/* Personality distribution */}
            <div
              className="rounded-2xl p-4"
              style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-label text-xs" style={{ color: "var(--t-2)", letterSpacing: "0.10em", fontWeight: 700 }}>
                  PERSONALITY MIX
                </p>
                <span className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>
                  {period === "All" ? "ALL TIME" : `LAST ${period.toUpperCase()}`}
                </span>
              </div>

              {windowSummary.total === 0 ? (
                <p className="text-xs py-3 text-center" style={{ color: "var(--t-5)" }}>
                  No submissions in this period
                </p>
              ) : (
                <div className="space-y-2.5">
                  {SPACE_TYPES.map((t, i) => {
                    const cfg = spaceType(t);
                    const count = windowSummary.byType[t];
                    const pct = (count / windowSummary.total) * 100;
                    return (
                      <div key={t}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--t-3)" }}>
                            <span aria-hidden="true">{cfg.emoji}</span>
                            {cfg.label}
                            <span className="text-[10px]" style={{ color: "var(--t-6)" }} lang="zh">
                              {cfg.labelCn}
                            </span>
                          </span>
                          <span className="text-xs font-display font-semibold" style={{ color: cfg.color }}>
                            {count} <span style={{ color: "var(--t-6)" }}>({pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--b-2)" }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(count / distMax) * 100}%` }}
                            transition={{ duration: 0.7, delay: i * 0.08 }}
                            className="h-full rounded-full"
                            style={{ background: cfg.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Time window */}
            <div className="flex rounded-xl p-1" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
              {PERIODS.map((w) => {
                const active = period === w;
                const counts: Record<Period, number> = { All: summary.total, "7d": summary.last7, "30d": summary.last30 };
                return (
                  <button
                    key={w}
                    onClick={() => setPeriod(w)}
                    className="flex-1 py-2 text-xs font-label rounded-lg transition-colors flex items-center justify-center gap-1"
                    style={{
                      background: active ? "oklch(0.62 0.09 68 / 10%)" : "transparent",
                      color: active ? "var(--acc-ink)" : "var(--t-5)",
                      letterSpacing: "0.04em",
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    {w === "All" ? "ALL TIME" : `LAST ${w.toUpperCase()}`}
                    <span className="text-[10px] opacity-70">({counts[w]})</span>
                  </button>
                );
              })}
            </div>

            {/* Audience filter — everyone / contactable leads / renovating soon */}
            <div className="flex rounded-xl p-1" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
              {AUDIENCES.map((a) => {
                const active = audience === a;
                const counts: Record<Audience, number> = {
                  All: summary.total,
                  Leads: summary.withContact,
                  Renovating: summary.renovatingSoon,
                };
                const labels: Record<Audience, string> = {
                  All: "EVERYONE",
                  Leads: "LEADS",
                  Renovating: "RENOVATING",
                };
                return (
                  <button
                    key={a}
                    onClick={() => setAudience(a)}
                    className="flex-1 py-2 text-xs font-label rounded-lg transition-colors flex items-center justify-center gap-1"
                    style={{
                      background: active ? "oklch(0.62 0.09 68 / 10%)" : "transparent",
                      color: active ? "var(--acc-ink)" : "var(--t-5)",
                      letterSpacing: "0.04em",
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    {labels[a]}
                    <span className="text-[10px] opacity-70">({counts[a]})</span>
                  </button>
                );
              })}
            </div>

            {/* Personality filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <FilterChip active={typeFilter === "All"} onClick={() => setTypeFilter("All")} label="All" count={rows.length} />
              {SPACE_TYPES.map((t) => {
                const cfg = spaceType(t);
                return (
                  <FilterChip
                    key={t}
                    active={typeFilter === t}
                    onClick={() => setTypeFilter(t)}
                    label={`${cfg.emoji} ${cfg.label}`}
                    count={summary.byType[t]}
                    color={cfg.color}
                    bg={cfg.bg}
                    border={cfg.border}
                  />
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
                placeholder="Search ID, personality, contact, campaign…"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "var(--t-2)" }}
              />
            </div>

            {/* Submissions */}
            {rows.length === 0 ? (
              <EmptyCard
                icon={Sparkles}
                title="No submissions yet"
                body="Results appear here as soon as visitors finish the quiz at spazehaus.com/spacology-quiz."
              />
            ) : filtered.length === 0 ? (
              <EmptyCard icon={Search} title="No matches" body="Try a different personality, period or search term." />
            ) : (
              <>
                <div className="space-y-2.5">
                  {pg.pageItems.map((row, i) => (
                    <ResultCard
                      key={row.id}
                      row={row}
                      index={i}
                      open={openId === row.id}
                      onToggle={() => setOpenId(openId === row.id ? null : row.id)}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
                <PaginationBar
                  page={pg.page}
                  pageCount={pg.pageCount}
                  onPage={pg.setPage}
                  from={pg.from}
                  to={pg.to}
                  total={pg.total}
                  label="submissions"
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── One submission ───────────────────────────────────────────────────────── */

function ResultCard({
  row, index, open, onToggle, isAdmin,
}: {
  row: SpacologyResultRow;
  index: number;
  open: boolean;
  onToggle: () => void;
  isAdmin: boolean;
}) {
  const cfg = spaceType(row.result_type);
  const answers = useMemo(() => parseSpacologyAnswers(row.answers), [row.answers]);
  const scores = useMemo(() => parseSpacologyScores(row.scores), [row.scores]);

  const [noteDraft, setNoteDraft] = useState(row.notes ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const saveNote = useUpdateSpacologyNote();
  const del = useDeleteSpacologyResult();

  const contact = [row.name, row.phone, row.email].filter(Boolean).join(" · ");
  const attribution = [row.utm_source, row.utm_medium, row.utm_campaign].filter(Boolean).join(" / ");
  const wa = whatsappHref(row.phone);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
    >
      <button onClick={onToggle} className="w-full p-4 flex items-start gap-3 text-left" aria-expanded={open}>
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-lg shrink-0"
          style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}
          aria-hidden="true"
        >
          {cfg.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* The person leads once we know who they are; the personality is
                what we know ABOUT them, so it drops to the supporting line. */}
            <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>
              {row.name?.trim() || row.result_name_en || cfg.label}
            </p>
            {row.planning_renovation === true && (
              <span
                className="status-pill inline-flex items-center gap-1"
                style={{ background: "oklch(0.55 0.09 240 / 12%)", color: "oklch(0.38 0.09 240)" }}
              >
                <Hammer size={10} /> Renovating
              </span>
            )}
            {row.is_tie && (
              <span className="status-pill" style={{ background: "oklch(0.65 0.10 55 / 12%)", color: "oklch(0.45 0.10 55)" }}>
                Tie
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--t-5)" }}>
            {row.name?.trim()
              ? `${cfg.emoji} ${row.result_name_en || cfg.label}${row.phone ? ` · ${row.phone}` : ""}`
              : contact || cfg.tagline}
          </p>
          <p className="text-[10px] font-label mt-1" style={{ color: "var(--t-6)", letterSpacing: "0.04em" }}>
            {formatWhen(row.submitted_at)}
            {row.locale ? ` · ${row.locale.toUpperCase()}` : ""}
            {attribution ? ` · ${attribution}` : ""}
          </p>
        </div>

        <ChevronDown
          size={16}
          className="shrink-0 mt-1 transition-transform"
          style={{ color: "var(--t-6)", transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid var(--b-2)" }}>
              {/* Contact — the point of the whole exercise, so it goes first */}
              <div className="pt-3">
                <p className="sz-label mb-2">CONTACT</p>
                {isSpacologyLead(row) ? (
                  <div className="space-y-2">
                    {row.name && (
                      <div className="flex items-center gap-2">
                        <UserRound size={13} style={{ color: "var(--t-6)" }} />
                        <span className="text-sm" style={{ color: "var(--t-2)" }}>{row.name}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-label font-semibold"
                          style={{ background: "oklch(0.55 0.09 145 / 12%)", color: "oklch(0.38 0.09 145)", letterSpacing: "0.03em" }}
                        >
                          <Phone size={13} /> WhatsApp {row.phone}
                        </a>
                      )}
                      {row.email && (
                        <a
                          href={`mailto:${row.email}`}
                          className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-label font-semibold truncate"
                          style={{ background: "oklch(0.62 0.09 68 / 10%)", color: "var(--acc-ink)", letterSpacing: "0.03em" }}
                        >
                          <Mail size={13} /> <span className="truncate">{row.email}</span>
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Hammer size={13} style={{ color: "var(--t-6)" }} />
                      <span className="text-xs" style={{ color: "var(--t-4)" }}>
                        Renovating in 3–6 months:{" "}
                        <b
                          style={{
                            color:
                              row.planning_renovation === true
                                ? "oklch(0.38 0.09 240)"
                                : row.planning_renovation === false
                                  ? "var(--t-4)"
                                  : "var(--t-6)",
                          }}
                        >
                          {row.planning_renovation === true
                            ? "Yes"
                            : row.planning_renovation === false
                              ? "No"
                              : "Not asked"}
                        </b>
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: "var(--t-5)" }}>
                    Anonymous — submitted before the quiz asked for contact details.
                  </p>
                )}
              </div>

              {/* Score breakdown */}
              <div>
                <p className="sz-label mb-2">SCORES</p>
                <div className="grid grid-cols-5 gap-2">
                  {SPACE_TYPES.map((t) => {
                    const tc = spaceType(t);
                    const won = t === row.result_type;
                    return (
                      <div
                        key={t}
                        className="rounded-xl p-2 text-center"
                        style={{
                          background: won ? tc.bg : "var(--b-2)",
                          border: `1px solid ${won ? tc.border : "transparent"}`,
                        }}
                      >
                        <p className="font-display text-base font-semibold" style={{ color: won ? tc.color : "var(--t-4)" }}>
                          {scores[t] ?? 0}
                        </p>
                        <p
                          className="text-[9px] font-label mt-0.5 leading-tight truncate"
                          style={{ color: won ? tc.color : "var(--t-6)", letterSpacing: "0.04em" }}
                        >
                          {tc.label.toUpperCase()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Answer trail */}
              <div>
                <p className="sz-label mb-2">ANSWERS ({row.answer_count})</p>
                {answers.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--t-5)" }}>
                    No answer detail was recorded for this submission.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {answers.map((a, i) => (
                      <li
                        key={i}
                        className="rounded-xl px-3 py-2"
                        style={{ background: "var(--b-2)" }}
                      >
                        <p className="text-[11px]" style={{ color: "var(--t-5)" }}>
                          {i + 1}. {a.question_en || `Question ${(a.index ?? i) + 1}`}
                        </p>
                        <p className="text-xs font-medium mt-0.5" style={{ color: "var(--t-2)" }}>
                          {a.option_en || `Option ${(a.option_index ?? 0) + 1}`}
                          {a.option_cn && (
                            <span className="text-[11px] font-normal" style={{ color: "var(--t-5)" }} lang="zh">
                              {" · "}{a.option_cn}
                            </span>
                          )}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Context */}
              <div>
                <p className="sz-label mb-2">CONTEXT</p>
                <div className="space-y-1.5">
                  <MetaRow icon={Clock} label="Time taken" value={row.duration_ms ? formatDuration(row.duration_ms) : "Not recorded"} />
                  <MetaRow icon={Sparkles} label="Quiz version" value={row.quiz_version} />
                  {row.inquiry_id && <MetaRow icon={Users} label="Linked inquiry" value={row.inquiry_id} mono />}
                </div>
              </div>

              {/* Staff note */}
              <div>
                <p className="sz-label mb-2">INTERNAL NOTE</p>
                {editingNote ? (
                  <div className="space-y-2">
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={3}
                      placeholder="e.g. Followed up on WhatsApp — interested in a 3-room condo"
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                      style={{ background: "var(--b-2)", border: "1px solid var(--b-1)", color: "var(--t-2)" }}
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={saveNote.isPending}
                        onClick={() =>
                          saveNote.mutate(
                            { id: row.id, notes: noteDraft },
                            {
                              onSuccess: () => {
                                setEditingNote(false);
                                toast.success("Note saved");
                              },
                              onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the note"),
                            },
                          )
                        }
                        className="px-3 py-1.5 rounded-full text-xs font-label font-semibold disabled:opacity-60"
                        style={{ background: "var(--acc-strong)", color: "oklch(1 0 0)", letterSpacing: "0.04em" }}
                      >
                        {saveNote.isPending ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => {
                          setNoteDraft(row.notes ?? "");
                          setEditingNote(false);
                        }}
                        className="px-3 py-1.5 rounded-full text-xs font-label"
                        style={{ background: "var(--b-2)", color: "var(--t-4)", letterSpacing: "0.04em" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingNote(true)}
                    className="w-full rounded-xl px-3 py-2.5 flex items-start gap-2 text-left"
                    style={{ background: "var(--b-2)" }}
                  >
                    {row.notes ? (
                      <StickyNote size={14} className="shrink-0 mt-0.5" style={{ color: "var(--acc-ink)" }} />
                    ) : (
                      <MessageSquare size={14} className="shrink-0 mt-0.5" style={{ color: "var(--t-6)" }} />
                    )}
                    <span className="text-xs" style={{ color: row.notes ? "var(--t-2)" : "var(--t-6)" }}>
                      {row.notes || "Add a note…"}
                    </span>
                  </button>
                )}
              </div>

              {isAdmin && (
                <button
                  disabled={del.isPending}
                  onClick={() => {
                    if (!confirm("Delete this submission? This cannot be undone.")) return;
                    del.mutate(row.id, {
                      onSuccess: () => toast.success("Submission deleted"),
                      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
                    });
                  }}
                  className="flex items-center gap-1.5 text-xs font-label disabled:opacity-60"
                  style={{ color: "oklch(0.50 0.12 25)", letterSpacing: "0.04em" }}
                >
                  <Trash2 size={13} /> {del.isPending ? "Deleting…" : "Delete submission"}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Small pieces ─────────────────────────────────────────────────────────── */

function KpiCard({
  icon: Icon, label, primary, secondary, tint, tintBg,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  primary: string;
  secondary: string;
  tint: string;
  tintBg: string;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5" style={{ background: tintBg }}>
        <Icon size={17} style={{ color: tint }} />
      </div>
      <p className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>
        {label.toUpperCase()}
      </p>
      <p className="font-display text-xl font-semibold mt-0.5" style={{ color: "var(--t-1)" }}>
        {primary}
      </p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--t-5)" }}>
        {secondary}
      </p>
    </div>
  );
}

function FilterChip({
  active, onClick, label, count, color = "var(--acc-ink)", bg = "oklch(0.62 0.09 68 / 10%)", border = "oklch(0.62 0.09 68 / 25%)",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: string;
  bg?: string;
  border?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 px-3 py-1.5 rounded-full text-xs font-label whitespace-nowrap transition-colors"
      style={{
        background: active ? bg : "var(--s-card)",
        color: active ? color : "var(--t-5)",
        border: `1px solid ${active ? border : "var(--b-1)"}`,
        letterSpacing: "0.03em",
        fontWeight: active ? 700 : 400,
      }}
    >
      {label} <span className="opacity-70">({count})</span>
    </button>
  );
}

function MetaRow({
  icon: Icon, label, value, mono = false,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={12} style={{ color: "var(--t-6)" }} />
      <span className="text-[11px] shrink-0" style={{ color: "var(--t-5)" }}>
        {label}
      </span>
      <span
        className="text-[11px] ml-auto text-right truncate"
        style={{ color: "var(--t-3)", fontFamily: mono ? "ui-monospace, monospace" : undefined }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyCard({
  icon: Icon, title, body,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl p-8 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
      <Icon size={28} className="mx-auto mb-3" style={{ color: "var(--t-7)" }} />
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--t-1)" }}>
        {title}
      </p>
      <p className="text-xs" style={{ color: "var(--t-5)" }}>
        {body}
      </p>
    </div>
  );
}

/* ── Formatters ───────────────────────────────────────────────────────────── */

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
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
