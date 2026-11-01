/*
 * SPAZEHAUS REMINDERS DASHBOARD
 * Source: 2026 Annual Meeting PDF — "Reminder" pillar.
 *
 *   • Daily site status / close-door photo (per active site)
 *   • Weekly payment review
 *   • Weekly site report (per active project)
 *
 * Phase 0C.2 — all data now reads from Supabase via TanStack Query.
 * Photo uploads write to the `site-photos` Storage bucket + `site_photos` table.
 * The `getToday()` helper lives in lifecycleData.ts and returns the current
 * Date on every call (overridable via VITE_TODAY_OVERRIDE for demos).
 */
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  Camera, Coins, FileText, Check, Clock, AlertCircle, Calendar,
  Flame, ChevronRight, Upload, X, Loader2
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { toast } from "sonner";
import { validateUploadFile } from "@/lib/upload";
import {
  useProjects,
  useAllStaff,
  useSitePhotos,
  useUploadSitePhoto,
  buildSitePhotoMaps,
  buildReminders,
  reminderSummary,
  lastNDays,
  getToday,
  type Reminder,
  type ReminderType,
} from "@/lib/queries";
import { useAuth } from "@/contexts/AuthContext";
import { reminderTypeConfig, reminderStatusConfig } from "@/lib/reminderData";

const HERO_BG = "/hero/warm.jpg";

function fmtToday(): string {
  const t = getToday();
  const dd = String(t.getDate()).padStart(2, "0");
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${t.getFullYear()}`;
}

const typeIcon: Record<ReminderType, typeof Camera> = {
  "daily-site-photo": Camera,
  "weekly-payment-review": Coins,
  "weekly-site-report": FileText,
};

export default function Reminders() {
  const [, navigate] = useLocation();
  const { staff: me } = useAuth();
  const today = fmtToday();

  const { data: projects = [] } = useProjects();
  const { data: staff = [] } = useAllStaff();
  const { data: sitePhotos = [] } = useSitePhotos();
  const uploadPhoto = useUploadSitePhoto();

  // Build the working set: photo maps for every project currently in build phase
  // (active or assigned status). PRJ004 (completed) and PRJ002 (under-review,
  // pre-handover) are filtered out — they no longer require daily site photos.
  const activeProjectIds = projects
    .filter((p) => p.status === "active" || p.status === "assigned")
    .map((p) => p.id);

  const photoMaps = buildSitePhotoMaps(activeProjectIds, sitePhotos, staff);
  const all = buildReminders(projects, photoMaps);
  const summary = reminderSummary(all, photoMaps);

  const todayItems = all.filter((r) => r.dueDate === today);
  const overdueItems = all.filter((r) => r.status === "overdue");
  const upcomingItems = all.filter((r) => r.status === "upcoming");

  // Photo upload state
  const [uploadFor, setUploadFor] = useState<{ projectId: string; projectName: string; date: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openUpload(projectId: string, projectName: string, date: string) {
    setUploadFor({ projectId, projectName, date });
    // Open the native file picker right away
    setTimeout(() => fileInputRef.current?.click(), 0);
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so the same file can be re-picked later
    if (!file || !uploadFor) return;
    const err = validateUploadFile(file, ["image/*"]);
    if (err) { toast.error(err); setUploadFor(null); return; }
    try {
      await uploadPhoto.mutateAsync({
        projectId: uploadFor.projectId,
        photoDate: uploadFor.date,
        file,
        uploadedById: me?.id,
      });
      toast.success(`Photo uploaded for ${uploadFor.projectName}`);
    } catch (err) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setUploadFor(null);
    }
  }

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader title="Reminders" subtitle="DAILY · WEEKLY SOP" bgImage={HERO_BG} showBack />

      <div className="px-4 py-4 space-y-5 pb-24 lg:px-8 lg:py-7 lg:space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon={Calendar}
            label="Today"
            primary={`${summary.todayCompleted}/${summary.todayCompleted + summary.todayPending}`}
            secondary={summary.todayPending > 0 ? `${summary.todayPending} pending upload` : "All caught up"}
            tint="var(--acc-ink)"
            tintBg="oklch(0.62 0.09 68 / 10%)"
          />
          <KpiCard
            icon={AlertCircle}
            label="Missed"
            primary={String(summary.overdue)}
            secondary={summary.overdue > 0 ? "Catch up needed" : "Streak intact"}
            tint="oklch(0.50 0.12 25)"
            tintBg="oklch(0.60 0.12 25 / 10%)"
            urgent={summary.overdue > 0}
          />
          <KpiCard
            icon={Clock}
            label="This Week"
            primary={String(summary.thisWeekUpcoming)}
            secondary="Weekly review + reports"
            tint="oklch(0.45 0.10 55)"
            tintBg="oklch(0.65 0.10 55 / 10%)"
          />
          <KpiCard
            icon={Flame}
            label="Photo Streak"
            primary={`${summary.streak}d`}
            secondary={summary.streak >= 7 ? "On fire 🔥" : "Build the habit"}
            tint="oklch(0.38 0.09 145)"
            tintBg="oklch(0.55 0.09 145 / 10%)"
          />
        </div>

        {/* TODAY's section */}
        <section>
          <SectionHeader title="TODAY · DAILY DISCIPLINE" subtitle={`Close-door photos · ${today}`} icon={Camera} />
          {todayItems.length === 0 ? (
            <Empty message="No daily reminders today." />
          ) : (
            <div className="space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:items-start">
              {todayItems.map((r, i) => (
                <div key={r.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
                  <ReminderItem
                    reminder={r}
                    staff={staff}
                    isLast={true}
                    onAction={() => {
                      if (r.status === "completed") {
                        toast.success(`Already uploaded${r.completedAt ? ` at ${r.completedAt}` : ""}`);
                      } else if (r.type === "daily-site-photo" && r.projectId) {
                        openUpload(r.projectId, r.projectName ?? "site", r.dueDate);
                      } else {
                        toast.info(`Opening: ${r.title}`);
                      }
                    }}
                    onCardClick={() => r.projectId && navigate(`/projects/${r.projectId}`)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* OVERDUE / MISSED */}
        {overdueItems.length > 0 && (
          <section>
            <SectionHeader
              title="MISSED · CATCH UP"
              subtitle={`${overdueItems.length} reminder${overdueItems.length === 1 ? "" : "s"} from earlier`}
              icon={AlertCircle}
              tint="oklch(0.50 0.12 25)"
              tintBg="oklch(0.60 0.12 25 / 12%)"
            />
            <div className="space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:items-start">
              {overdueItems.map((r, i) => (
                <div key={r.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--s-card)", border: "1px solid oklch(0.60 0.12 25 / 30%)", boxShadow: "0 1px 12px oklch(0.60 0.12 25 / 8%)" }}>
                  <ReminderItem
                    reminder={r}
                    staff={staff}
                    isLast={true}
                    onAction={() => {
                      if (r.type === "daily-site-photo" && r.projectId) {
                        openUpload(r.projectId, r.projectName ?? "site", r.dueDate);
                      } else {
                        toast.info(`Logging late entry for ${r.dueDate}…`);
                      }
                    }}
                    onCardClick={() => r.projectId && navigate(`/projects/${r.projectId}`)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* THIS WEEK */}
        <section>
          <SectionHeader title="THIS WEEK · CADENCE" subtitle="Friday weekly review + site reports" icon={Clock} />
          {upcomingItems.length === 0 ? (
            <Empty message="No weekly cadences scheduled." />
          ) : (
            <div className="space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:items-start">
              {upcomingItems.map((r, i) => (
                <div key={r.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
                  <ReminderItem
                    reminder={r}
                    staff={staff}
                    isLast={true}
                    onAction={() => toast.info(`Opening: ${r.title}`)}
                    onCardClick={() => r.projectId && navigate(`/projects/${r.projectId}`)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 14-DAY PHOTO GRID */}
        <section>
          <SectionHeader title="14-DAY SITE PHOTO GRID" subtitle="Per active site · green = uploaded" icon={Camera} />
          {photoMaps.length === 0 ? (
            <div className="rounded-2xl p-4" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
              <p className="text-xs text-center py-3" style={{ color: "var(--t-5)" }}>
                No active sites — photo SOP only applies during BUILD phase.
              </p>
            </div>
          ) : (
            <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:items-start">
              {photoMaps.map((map) => {
                const project = projects.find((p) => p.id === map.projectId);
                if (!project) return null;
                const days = lastNDays(14);
                const uploaded = days.filter((d) => map.photos[d]?.uploaded).length;
                const pct = (uploaded / days.length) * 100;
                return (
                  <div key={map.projectId} className="rounded-2xl p-4 space-y-4" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold" style={{ color: "var(--t-2)" }}>
                          {project.name}
                        </p>
                        <span className="text-[10px] font-display font-semibold" style={{ color: "var(--acc-ink)" }}>
                          {uploaded}/{days.length} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="grid grid-cols-14 gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
                        {days.map((d) => {
                          const photo = map.photos[d];
                          const isToday = d === today;
                          const dayNum = d.split("/")[0];
                          return (
                            <button
                              type="button"
                              key={d}
                              onClick={() => openUpload(map.projectId, project.name, d)}
                              data-testid="photo-cell"
                              data-cell={`${map.projectId}:${d}`}
                              className="aspect-square rounded-md flex items-center justify-center"
                              title={`${d}${photo?.uploaded ? ` · uploaded ${photo.uploadedAt}${photo.by ? ` by ${photo.by}` : ""}` : " · click to upload"}`}
                              style={{
                                background: photo?.uploaded
                                  ? "oklch(0.55 0.09 145 / 80%)"
                                  : "oklch(0.60 0.12 25 / 60%)",
                                border: isToday ? "1.5px solid var(--acc-ink)" : "none",
                                color: "white",
                                fontSize: "8px",
                                fontWeight: 600,
                              }}
                            >
                              {photo?.uploaded ? <Check size={8} strokeWidth={4} /> : dayNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-2" style={{ borderTop: "1px solid var(--b-2)" }}>
                      <LegendDot color="oklch(0.55 0.09 145 / 80%)" label="Uploaded" />
                      <LegendDot color="oklch(0.60 0.12 25 / 60%)" label="Missed" />
                      <LegendDot color="oklch(1 0 0)" border="var(--acc-ink)" label="Today" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-[10px] text-center font-label pt-2" style={{ color: "var(--t-6)", letterSpacing: "0.06em" }}>
          SPAZEHAUS · DAILY + WEEKLY REMINDER SOP · 2026 ANNUAL MEETING
        </p>
      </div>

      {/* Hidden file picker used by all upload buttons + photo grid taps */}
      <input
        ref={fileInputRef}
        type="file"
        data-testid="reminder-file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFilePicked}
      />

      {/* Upload-in-progress overlay */}
      {uploadPhoto.isPending && uploadFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "oklch(0.10 0.004 285 / 0.55)", backdropFilter: "blur(6px)" }}
        >
          <div
            className="rounded-2xl px-6 py-5 flex items-center gap-3 shadow-2xl"
            style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
          >
            <Loader2 size={18} className="animate-spin" style={{ color: "var(--acc-ink)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>
                Uploading photo…
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>
                {uploadFor.projectName} · {uploadFor.date}
              </p>
            </div>
            <button
              onClick={() => setUploadFor(null)}
              className="ml-3"
              aria-label="Dismiss"
            >
              <X size={14} style={{ color: "var(--t-5)" }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  primary,
  secondary,
  tint,
  tintBg,
  urgent,
}: {
  icon: typeof Camera;
  label: string;
  primary: string;
  secondary: string;
  tint: string;
  tintBg: string;
  urgent?: boolean;
}) {
  return (
    <motion.div
      animate={urgent ? { scale: [1, 1.015, 1] } : undefined}
      transition={urgent ? { repeat: Infinity, duration: 2.4 } : undefined}
      className="rounded-2xl p-3"
      style={{
        background: "var(--s-card)",
        border: urgent ? `1px solid ${tint}` : "1px solid var(--b-1)",
        boxShadow: urgent ? `0 1px 12px ${tintBg}` : "0 1px 8px oklch(0 0 0 / 0.04)",
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: tintBg }}>
          <Icon size={14} style={{ color: tint }} />
        </div>
        <p className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>
          {label.toUpperCase()}
        </p>
      </div>
      <p className="font-display text-lg font-semibold leading-none truncate" style={{ color: urgent ? tint : "var(--t-1)" }}>
        {primary}
      </p>
      <p className="text-[10px] mt-1 truncate" style={{ color: "var(--t-5)" }}>
        {secondary}
      </p>
    </motion.div>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  tint,
  tintBg,
}: {
  title: string;
  subtitle: string;
  icon: typeof Camera;
  tint?: string;
  tintBg?: string;
}) {
  const c = tint || "var(--acc-ink)";
  const cb = tintBg || "oklch(0.62 0.09 68 / 10%)";
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: cb }}>
        <Icon size={16} style={{ color: c }} />
      </div>
      <div>
        <p className="font-label text-xs" style={{ color: "var(--t-2)", letterSpacing: "0.10em", fontWeight: 700 }}>
          {title}
        </p>
        <p className="text-[10px]" style={{ color: "var(--t-5)" }}>{subtitle}</p>
      </div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-2xl p-6 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
      <p className="text-xs" style={{ color: "var(--t-5)" }}>{message}</p>
    </div>
  );
}

function ReminderItem({
  reminder,
  staff,
  isLast,
  onAction,
  onCardClick,
}: {
  reminder: Reminder;
  staff: { id: string; name: string; avatar_code: string }[];
  isLast: boolean;
  onAction: () => void;
  onCardClick?: () => void;
}) {
  const tc = reminderTypeConfig[reminder.type];
  const sc = reminderStatusConfig[reminder.status];
  const Icon = typeIcon[reminder.type];
  const assignee = staff.find((s) => s.avatar_code === reminder.assignee);

  return (
    <div
      className="px-3 py-3 flex items-center gap-3"
      style={{ borderBottom: isLast ? "none" : "1px solid var(--s-2)" }}
    >
      <button
        onClick={onCardClick}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
        disabled={!onCardClick}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: tc.bg }}
        >
          <Icon size={15} style={{ color: tc.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--t-1)" }}>
            {reminder.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span
              className="text-[9px] font-label px-1.5 py-0.5 rounded-md"
              style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, letterSpacing: "0.04em", fontWeight: 700 }}
            >
              {sc.label.toUpperCase()}
            </span>
            <span className="text-[10px]" style={{ color: "var(--t-5)" }}>
              · {reminder.dueDate}
            </span>
            {assignee && (
              <span className="text-[10px]" style={{ color: "var(--t-5)" }}>
                · {assignee.name}
              </span>
            )}
          </div>
          {reminder.note && (
            <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--t-5)" }}>
              {reminder.note}
            </p>
          )}
        </div>
      </button>
      {reminder.status === "completed" ? (
        <Check size={14} style={{ color: sc.color }} strokeWidth={3} />
      ) : (
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={onAction}
          className="px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1"
          style={{
            background: reminder.status === "overdue" ? "oklch(0.60 0.12 25 / 12%)" : "oklch(0.62 0.09 68 / 12%)",
            color: reminder.status === "overdue" ? "oklch(0.50 0.12 25)" : "var(--acc-ink)",
          }}
        >
          {reminder.type === "daily-site-photo" ? (
            <Upload size={11} />
          ) : (
            <ChevronRight size={11} />
          )}
          <span className="text-[10px] font-label" style={{ letterSpacing: "0.04em", fontWeight: 700 }}>
            {reminder.type === "daily-site-photo" ? "UPLOAD" : "OPEN"}
          </span>
        </motion.button>
      )}
    </div>
  );
}

function LegendDot({ color, label, border }: { color: string; label: string; border?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-3 h-3 rounded-sm"
        style={{ background: color, border: border ? `1.5px solid ${border}` : "none" }}
      />
      <span className="text-[10px]" style={{ color: "var(--t-5)" }}>{label}</span>
    </div>
  );
}
