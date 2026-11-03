/*
 * SPAZEHAUS WEBSITE ENQUIRIES
 * Every Contact-form submission from the marketing site (spazehaus.com/contact).
 * Volume over time, lead status, and the full enquiry per visitor.
 *
 * Rows are written by the public `submit_website_enquiry` RPC and the database
 * rejects edits to the submitted data. Ops-tier staff set the status + a note;
 * admins can remove spam. See migration 20261103000000_website_enquiries.sql.
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search, Inbox, TrendingUp, Users, ChevronDown, Trash2, StickyNote, Loader2,
  MessageSquare, Phone, Mail, UserRound, MapPin, Home, Wallet, CalendarClock, Megaphone,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { usePagination } from "@/hooks/usePagination";
import PaginationBar from "@/components/PaginationBar";
import type { WebsiteEnquiryRow, EnquiryStatus } from "@/lib/dbTypes";
import {
  useWebsiteEnquiries,
  useUpdateEnquiry,
  useDeleteEnquiry,
  canEditEnquiry,
  canDeleteEnquiry,
  computeEnquirySummary,
  whatsappHref,
  ENQUIRY_STATUSES,
} from "@/lib/queries";
import { useAuth } from "@/contexts/AuthContext";

const HERO_BG = "/hero/cool.jpg";
const DAY = 86_400_000;

type Period = "All" | "7d" | "30d";
const PERIODS: Period[] = ["All", "7d", "30d"];

const STATUS_META: Record<EnquiryStatus, { label: string; color: string; bg: string }> = {
  new:         { label: "New",         color: "var(--acc-ink)",       bg: "oklch(0.62 0.09 68 / 12%)" },
  contacted:   { label: "Contacted",   color: "oklch(0.45 0.10 55)",  bg: "oklch(0.65 0.10 55 / 12%)" },
  qualified:   { label: "Qualified",   color: "oklch(0.38 0.09 145)", bg: "oklch(0.55 0.09 145 / 12%)" },
  consulted:   { label: "Consulted",   color: "oklch(0.38 0.09 240)", bg: "oklch(0.55 0.09 240 / 12%)" },
  unqualified: { label: "Unqualified", color: "var(--t-5)",           bg: "var(--b-2)" },
  spam:        { label: "Spam",        color: "oklch(0.50 0.12 25)",  bg: "oklch(0.60 0.12 25 / 12%)" },
};

export default function WebsiteEnquiries() {
  const { staff: me } = useAuth();
  const canEdit = canEditEnquiry(me?.role);
  const isAdmin = canDeleteEnquiry(me?.role);

  const { data: rows = [], isLoading, isError, error } = useWebsiteEnquiries();
  const [statusFilter, setStatusFilter] = useState<EnquiryStatus | "All">("All");
  const [period, setPeriod] = useState<Period>("All");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const summary = useMemo(() => computeEnquirySummary(rows), [rows]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff = period === "7d" ? now - 7 * DAY : period === "30d" ? now - 30 * DAY : null;
    const q = search.trim().toLowerCase();

    return rows.filter((r) => {
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (cutoff !== null && new Date(r.submitted_at).getTime() < cutoff) return false;
      if (!q) return true;
      return [
        r.id, r.name, r.phone, r.email, r.project_type, r.property, r.project_location,
        r.budget, r.timeline, r.heard_via, r.message, r.utm_source, r.utm_campaign, r.staff_note,
      ].some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, statusFilter, period, search]);

  const pg = usePagination(filtered, 10, `${statusFilter}|${period}|${search}`);

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader title="Enquiries" subtitle="CONTACT FORM · WEBSITE" bgImage={HERO_BG} showBack showNotification />

      <div className="px-4 py-4 space-y-5 pb-24 lg:px-8 lg:py-7">
        {isError ? (
          <EmptyCard icon={Inbox} title="Couldn't load enquiries" body={error instanceof Error ? error.message : "Please try again."} />
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--acc-ink)" }} />
          </div>
        ) : (
          <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3">
              <KpiCard icon={Users} label="Total Enquiries" primary={String(summary.total)}
                secondary={summary.total === 0 ? "None yet" : `${summary.last30} in the last 30 days`}
                tint="var(--acc-ink)" tintBg="oklch(0.62 0.09 68 / 10%)" />
              <KpiCard icon={TrendingUp} label="Last 7 Days" primary={String(summary.last7)}
                secondary={summary.topSource ? `Top source: ${summary.topSource}` : "No source data"}
                tint="oklch(0.38 0.09 145)" tintBg="oklch(0.55 0.09 145 / 10%)" />
              <KpiCard icon={Inbox} label="New / Untriaged" primary={String(summary.open)}
                secondary={summary.open === 0 ? "All triaged" : "Awaiting a first response"}
                tint="oklch(0.45 0.10 55)" tintBg="oklch(0.65 0.10 55 / 10%)" />
              <KpiCard icon={CalendarClock} label="Consulted" primary={String(summary.byStatus.consulted)}
                secondary={`${summary.byStatus.qualified} qualified lead${summary.byStatus.qualified === 1 ? "" : "s"}`}
                tint="oklch(0.38 0.09 240)" tintBg="oklch(0.55 0.09 240 / 10%)" />
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

            {/* Status filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <FilterChip active={statusFilter === "All"} onClick={() => setStatusFilter("All")} label="All" count={rows.length} />
              {ENQUIRY_STATUSES.map((s) => {
                const m = STATUS_META[s];
                return (
                  <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}
                    label={m.label} count={summary.byStatus[s]} color={m.color} bg={m.bg} border={m.color} />
                );
              })}
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
              <Search size={14} style={{ color: "var(--t-6)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, contact, project, campaign…"
                className="flex-1 bg-transparent outline-none text-sm" style={{ color: "var(--t-2)" }} />
            </div>

            {/* List */}
            {rows.length === 0 ? (
              <EmptyCard icon={Inbox} title="No enquiries yet"
                body="Submissions appear here as soon as visitors send the contact form at spazehaus.com/contact." />
            ) : filtered.length === 0 ? (
              <EmptyCard icon={Search} title="No matches" body="Try a different status, period or search term." />
            ) : (
              <>
                <div className="space-y-2.5">
                  {pg.pageItems.map((row, i) => (
                    <EnquiryCard key={row.id} row={row} index={i}
                      open={openId === row.id} onToggle={() => setOpenId(openId === row.id ? null : row.id)}
                      canEdit={canEdit} isAdmin={isAdmin} />
                  ))}
                </div>
                <PaginationBar page={pg.page} pageCount={pg.pageCount} onPage={pg.setPage}
                  from={pg.from} to={pg.to} total={pg.total} label="enquiries" />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── One enquiry ──────────────────────────────────────────────────────────── */

function EnquiryCard({
  row, index, open, onToggle, canEdit, isAdmin,
}: {
  row: WebsiteEnquiryRow;
  index: number;
  open: boolean;
  onToggle: () => void;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const m = STATUS_META[row.status] ?? STATUS_META.new;
  const wa = whatsappHref(row.phone);
  const attribution = [row.utm_source, row.utm_medium, row.utm_campaign].filter(Boolean).join(" / ");

  const [noteDraft, setNoteDraft] = useState(row.staff_note ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const update = useUpdateEnquiry();
  const del = useDeleteEnquiry();

  const summaryLine = [row.project_type, row.property, row.project_location].filter(Boolean).join(" · ");

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
      <button onClick={onToggle} className="w-full p-4 flex items-start gap-3 text-left" aria-expanded={open}>
        <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "oklch(0.62 0.09 68 / 10%)", border: "1.5px solid oklch(0.62 0.09 68 / 22%)" }} aria-hidden="true">
          <UserRound size={18} style={{ color: "var(--acc-ink)" }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>{row.name}</p>
            <span className="status-pill" style={{ background: m.bg, color: m.color }}>{m.label}</span>
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--t-5)" }}>
            {summaryLine || row.phone}
          </p>
          <p className="text-[10px] font-label mt-1" style={{ color: "var(--t-6)", letterSpacing: "0.04em" }}>
            {formatWhen(row.submitted_at)}
            {row.locale ? ` · ${row.locale.toUpperCase()}` : ""}
            {attribution ? ` · ${attribution}` : ""}
          </p>
        </div>

        <ChevronDown size={16} className="shrink-0 mt-1 transition-transform"
          style={{ color: "var(--t-6)", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} style={{ overflow: "hidden" }}>
            <div className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid var(--b-2)" }}>
              {/* Contact */}
              <div className="pt-3">
                <p className="sz-label mb-2">CONTACT</p>
                <div className="flex flex-wrap gap-2">
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer"
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-label font-semibold"
                      style={{ background: "oklch(0.55 0.09 145 / 12%)", color: "oklch(0.38 0.09 145)", letterSpacing: "0.03em" }}>
                      <Phone size={13} /> WhatsApp {row.phone}
                    </a>
                  )}
                  {row.email && (
                    <a href={`mailto:${row.email}`}
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-label font-semibold truncate"
                      style={{ background: "oklch(0.62 0.09 68 / 10%)", color: "var(--acc-ink)", letterSpacing: "0.03em" }}>
                      <Mail size={13} /> <span className="truncate">{row.email}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Enquiry detail */}
              <div>
                <p className="sz-label mb-2">ENQUIRY</p>
                <div className="space-y-1.5">
                  <MetaRow icon={Megaphone} label="Project type" value={row.project_type || "—"} />
                  <MetaRow icon={Home} label="Property" value={row.property || "—"} />
                  <MetaRow icon={MapPin} label="Location" value={row.project_location || "—"} />
                  <MetaRow icon={Wallet} label="Budget" value={row.budget || "—"} />
                  <MetaRow icon={CalendarClock} label="Timeline" value={row.timeline || "—"} />
                  <MetaRow icon={Inbox} label="Heard via" value={row.heard_via || "—"} />
                </div>
                {row.message && (
                  <div className="mt-2 rounded-xl px-3 py-2" style={{ background: "var(--b-2)" }}>
                    <p className="text-[11px] mb-0.5" style={{ color: "var(--t-5)" }}>Message</p>
                    <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--t-2)" }}>{row.message}</p>
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <p className="sz-label mb-2">STATUS</p>
                {canEdit ? (
                  <div className="flex gap-1.5 flex-wrap">
                    {ENQUIRY_STATUSES.map((s) => {
                      const sm = STATUS_META[s];
                      const active = row.status === s;
                      return (
                        <button key={s} disabled={update.isPending}
                          onClick={() => {
                            if (active) return;
                            update.mutate({ id: row.id, status: s }, {
                              onSuccess: () => toast.success(`Marked ${sm.label.toLowerCase()}`),
                              onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update status"),
                            });
                          }}
                          className="px-2.5 py-1.5 rounded-full text-xs font-label transition-colors disabled:opacity-60"
                          style={{ background: active ? sm.bg : "var(--b-2)", color: active ? sm.color : "var(--t-5)", border: `1px solid ${active ? sm.color : "transparent"}`, letterSpacing: "0.03em", fontWeight: active ? 700 : 400 }}>
                          {sm.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <span className="status-pill" style={{ background: m.bg, color: m.color }}>{m.label}</span>
                )}
              </div>

              {/* Context */}
              {(row.referrer || row.landing_path || attribution) && (
                <div>
                  <p className="sz-label mb-2">CONTEXT</p>
                  <div className="space-y-1.5">
                    {row.landing_path && <MetaRow icon={MapPin} label="Landing page" value={row.landing_path} />}
                    {attribution && <MetaRow icon={TrendingUp} label="Campaign" value={attribution} />}
                    {row.referrer && <MetaRow icon={Users} label="Referrer" value={row.referrer} />}
                    {row.inquiry_id && <MetaRow icon={Users} label="Linked inquiry" value={row.inquiry_id} mono />}
                  </div>
                </div>
              )}

              {/* Staff note */}
              <div>
                <p className="sz-label mb-2">INTERNAL NOTE</p>
                {editingNote ? (
                  <div className="space-y-2">
                    <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={3}
                      placeholder="e.g. Called back — wants a quote for a 3-room condo"
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                      style={{ background: "var(--b-2)", border: "1px solid var(--b-1)", color: "var(--t-2)" }} />
                    <div className="flex gap-2">
                      <button disabled={update.isPending}
                        onClick={() => update.mutate({ id: row.id, staff_note: noteDraft }, {
                          onSuccess: () => { setEditingNote(false); toast.success("Note saved"); },
                          onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the note"),
                        })}
                        className="px-3 py-1.5 rounded-full text-xs font-label font-semibold disabled:opacity-60"
                        style={{ background: "var(--acc-strong)", color: "oklch(1 0 0)", letterSpacing: "0.04em" }}>
                        {update.isPending ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => { setNoteDraft(row.staff_note ?? ""); setEditingNote(false); }}
                        className="px-3 py-1.5 rounded-full text-xs font-label"
                        style={{ background: "var(--b-2)", color: "var(--t-4)", letterSpacing: "0.04em" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => canEdit && setEditingNote(true)} disabled={!canEdit}
                    className="w-full rounded-xl px-3 py-2.5 flex items-start gap-2 text-left disabled:cursor-default"
                    style={{ background: "var(--b-2)" }}>
                    {row.staff_note ? (
                      <StickyNote size={14} className="shrink-0 mt-0.5" style={{ color: "var(--acc-ink)" }} />
                    ) : (
                      <MessageSquare size={14} className="shrink-0 mt-0.5" style={{ color: "var(--t-6)" }} />
                    )}
                    <span className="text-xs" style={{ color: row.staff_note ? "var(--t-2)" : "var(--t-6)" }}>
                      {row.staff_note || (canEdit ? "Add a note…" : "No note")}
                    </span>
                  </button>
                )}
              </div>

              {isAdmin && (
                <button disabled={del.isPending}
                  onClick={() => {
                    if (!confirm("Delete this enquiry? This cannot be undone.")) return;
                    del.mutate(row.id, {
                      onSuccess: () => toast.success("Enquiry deleted"),
                      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
                    });
                  }}
                  className="flex items-center gap-1.5 text-xs font-label disabled:opacity-60"
                  style={{ color: "oklch(0.50 0.12 25)", letterSpacing: "0.04em" }}>
                  <Trash2 size={13} /> {del.isPending ? "Deleting…" : "Delete enquiry"}
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
  label: string; primary: string; secondary: string; tint: string; tintBg: string;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5" style={{ background: tintBg }}>
        <Icon size={17} style={{ color: tint }} />
      </div>
      <p className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>{label.toUpperCase()}</p>
      <p className="font-display text-xl font-semibold mt-0.5" style={{ color: "var(--t-1)" }}>{primary}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--t-5)" }}>{secondary}</p>
    </div>
  );
}

function FilterChip({
  active, onClick, label, count, color = "var(--acc-ink)", bg = "oklch(0.62 0.09 68 / 10%)", border = "oklch(0.62 0.09 68 / 25%)",
}: {
  active: boolean; onClick: () => void; label: string; count: number; color?: string; bg?: string; border?: string;
}) {
  return (
    <button onClick={onClick}
      className="shrink-0 px-3 py-1.5 rounded-full text-xs font-label whitespace-nowrap transition-colors"
      style={{ background: active ? bg : "var(--s-card)", color: active ? color : "var(--t-5)", border: `1px solid ${active ? border : "var(--b-1)"}`, letterSpacing: "0.03em", fontWeight: active ? 700 : 400 }}>
      {label} <span className="opacity-70">({count})</span>
    </button>
  );
}

function MetaRow({
  icon: Icon, label, value, mono = false,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={12} style={{ color: "var(--t-6)" }} />
      <span className="text-[11px] shrink-0" style={{ color: "var(--t-5)" }}>{label}</span>
      <span className="text-[11px] ml-auto text-right truncate" style={{ color: "var(--t-3)", fontFamily: mono ? "ui-monospace, monospace" : undefined }} title={value}>
        {value}
      </span>
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
