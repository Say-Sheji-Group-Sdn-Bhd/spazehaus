/*
 * SPAZEHAUS PROJECT DETAIL PAGE
 * Design: White/light corporate theme with gold accents
 * Tabs: Overview, Lifecycle, Tasks, Quotations, Photos, Team
 *
 * Lifecycle tab implements the 2026 Annual Meeting workflow —
 * 29 stages, 5 Payment Collection Checkpoints (① ② ③ ④ ⑤),
 * 6 Document Sign Checkpoints (3 contracts + 3 drawing sign-offs).
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useLocation } from "wouter";
import { Upload, UserPlus, User, CheckSquare, MapPin, Maximize2, Phone, FileText, Receipt, Coins, PenSquare, Check, Clock, AlertCircle, Share2, Plus, Pencil, Trash2, Star, X, ImagePlus, CalendarClock, MoreHorizontal, Undo2, ChevronDown } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import AppHeader from "@/components/AppHeader";
import MarkCollectedSheet, { type MarkCollectedTarget } from "@/components/MarkCollectedSheet";
import SignDocumentSheet, { type SignDocumentTarget } from "@/components/SignDocumentSheet";
import { statusConfig, priorityConfig, DEFAULT_STATUS_CONFIG, DEFAULT_PRIORITY_CONFIG } from "@/lib/mockData";
import { statusConfig as qStatusConfig, computeTotals, formatRM } from "@/lib/quotationData";
import {
  LIFECYCLE_STAGES,
  paymentSummary,
  signatureSummary,
  stageStatus,
  phaseColors,
  checkpointStatusConfig,
  MANUAL_STAGE_STATUSES,
  type StagePhase,
  type CheckpointStatus,
  type ManualStageStatus,
} from "@/lib/lifecycleData";
import {
  useProject,
  useSetDefectPeriodDone,
  useAllStaff,
  useQuotations,
  useProjectLifecycle,
  useSeedProjectLifecycle,
  useProjectStageDates,
  useSetStageDate,
  useProjectStageStatuses,
  useSetStageStatus,
  useUpdatePayment,
  useUpdateSignature,
  useRevertPayment,
  useRevertSignature,
  type RevertResult,
  canEditPayments,
  canEditSignatures,
  canEditProjectData,
  useUpdateProject,
  resolveProjectRoster,
  useRegenerateClientToken,
  getSignatureDocUrl,
  isStorageDocRef,
  useProjectTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useProjectSitePhotos,
  useUploadSitePhoto,
  useDeleteSitePhoto,
  useSiteReports,
  useSetSiteReportSummary,
  getSitePhotoUrl,
  useProjectReviews,
  useDeleteReview,
  type ProjectTaskStatus,
  type PaymentRecord,
  type DocumentSignRecord,
} from "@/lib/queries";
import type { ProjectTaskRow, ProjectReviewRow, SitePhotoRow, StaffRow } from "@/lib/dbTypes";
import { useAuth } from "@/contexts/AuthContext";
import EditProjectSheet from "@/components/EditProjectSheet";
import ManageTeamSheet from "@/components/ManageTeamSheet";
import { toast } from "sonner";

const CARD_BG1 = "/hero/card1.jpg";
const CARD_BG2 = "/hero/card2.jpg";

const tabs = ["Overview", "Lifecycle", "Tasks", "Quotations", "Photos", "Reports", "Team"];

const TASK_STATUS_OPTIONS: { value: ProjectTaskStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed", label: "Done" },
];

/** Format a YYYY-MM-DD storage date as DD/MM/YYYY (Spazehaus convention). */
function fmtDueDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** "DD/MM/YYYY" → "YYYY-MM-DD" (native <input type=date> value). "" if unparseable. */
function ddmmToIsoDate(ddmm: string | undefined): string {
  if (!ddmm) return "";
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmm);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/** Inline estimated-date control for a lifecycle stage/checkpoint (Phase 2).
 *  Shows the date (or "Set est. date") and opens a native date picker on click.
 *  `value` is DD/MM/YYYY; `onSet` receives DD/MM/YYYY or null (cleared). */
function StageDateControl({
  value, canEdit, onSet, saving, pickLabel = "Set est. date", setPrefix = "Est.",
}: {
  value?: string; canEdit: boolean; onSet: (ddmm: string | null) => void; saving?: boolean;
  pickLabel?: string; setPrefix?: string;
}) {
  const [editing, setEditing] = useState(false);
  if (!canEdit && !value) return null;
  if (editing && canEdit) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={ddmmToIsoDate(value)}
        onBlur={() => setEditing(false)}
        onChange={(e) => {
          const v = e.target.value; // YYYY-MM-DD or ""
          onSet(v ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : null);
          setEditing(false);
        }}
        className="text-[9px] rounded-md px-1.5 py-0.5"
        style={{ background: "var(--s-2)", border: "1px solid var(--b-strong)", color: "var(--t-2)" }}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => canEdit && setEditing(true)}
      disabled={saving || !canEdit}
      className="text-[9px] font-label px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 shrink-0"
      style={{
        background: value ? "oklch(0.62 0.09 68 / 10%)" : "transparent",
        color: value ? "var(--acc-ink)" : "var(--t-5)",
        border: `1px dashed ${value ? "oklch(0.62 0.09 68 / 30%)" : "var(--b-strong)"}`,
        cursor: canEdit ? "pointer" : "default",
      }}
      title={canEdit ? pickLabel : undefined}
    >
      <CalendarClock size={9} />
      {value ? `${setPrefix} ${value}` : pickLabel}
    </button>
  );
}

/**
 * Manual per-stage status control (supervisor review, 7 Nov 2026).
 * Every stage after "New Inquiry" carries a staff-set status; this replaces the
 * passive status pill on the right of the row. A dropdown (not a 4-wide segmented
 * control) keeps it legible on a 375px phone and matches the app's ⋯ menu pattern:
 * the trigger shows the current status as a colored pill + chevron; the menu lists
 * the four options with a color dot and a check on the current one.
 *
 * Read-only / New-Inquiry rows fall back to the static pill.
 */
function StageStatusControl({
  status, canEdit, onChange, saving, interactive = true,
}: {
  status: CheckpointStatus;
  canEdit: boolean;
  onChange?: (next: ManualStageStatus) => void;
  saving?: boolean;
  interactive?: boolean;
}) {
  const cfg = checkpointStatusConfig[status];
  const pill = (
    <span
      className="text-[9px] font-label px-2 py-1 rounded-full shrink-0 inline-flex items-center gap-1"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, letterSpacing: "0.04em" }}
    >
      {cfg.label}
      {interactive && canEdit && <ChevronDown size={10} style={{ opacity: 0.7 }} />}
    </span>
  );

  if (!interactive || !canEdit || !onChange) return pill;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={saving}>
        <button
          type="button"
          aria-label={`Set stage status — currently ${cfg.label}`}
          className="shrink-0 rounded-full"
          style={{ cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}
        >
          {pill}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        {MANUAL_STAGE_STATUSES.map((s) => {
          const c = checkpointStatusConfig[s];
          const active = s === status;
          return (
            <DropdownMenuItem
              key={s}
              onSelect={() => { if (!active) onChange(s); }}
              className="gap-2 text-xs"
            >
              <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
              <span className="flex-1" style={{ color: "var(--t-2)" }}>{c.label}</span>
              {active && <Check size={13} style={{ color: c.color }} />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Build the checkpoint audit line (Phase 1): "Created by X · DATE · Collected by Y".
 *  Returns null when no audit info is available (e.g. legacy/seed rows). */
function checkpointAuditLine({
  createdBy, createdAt, actorBy, actorVerb, staffById,
}: {
  createdBy?: string; createdAt?: string; actorBy?: string;
  actorVerb: string; staffById?: Record<string, string>;
}): string | null {
  const name = (id?: string) => (id ? (staffById?.[id] ?? id) : undefined);
  const fmtTs = (iso?: string) => {
    if (!iso) return undefined;
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? undefined
      : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };
  const parts: string[] = [];
  const creator = name(createdBy);
  const createdLabel = fmtTs(createdAt);
  if (creator || createdLabel) {
    parts.push(`Created${creator ? ` by ${creator}` : ""}${createdLabel ? ` · ${createdLabel}` : ""}`);
  }
  const actor = name(actorBy);
  if (actor) parts.push(`${actorVerb} by ${actor}`);
  return parts.length ? parts.join(" · ") : null;
}

const taskStatusConfig: Record<string, { label: string; bg: string; color: string }> = {
  "completed":   { label: "Done",        bg: "oklch(0.55 0.09 145 / 12%)", color: "oklch(0.38 0.09 145)" },
  "in-progress": { label: "In Progress", bg: "oklch(0.55 0.09 240 / 12%)", color: "oklch(0.38 0.09 240)" },
  "pending":     { label: "Pending",     bg: "oklch(0.62 0.09 68 / 12%)",  color: "var(--acc-ink)" },
};

/** Read `?tab=` from the URL once on mount so deep-links from Checkpoints land on the right tab. */
function getInitialTab(): string {
  if (typeof window === "undefined") return "Overview";
  const params = new URLSearchParams(window.location.search);
  const t = params.get("tab");
  if (!t) return "Overview";
  // Normalise — accept any casing
  const lower = t.toLowerCase();
  return tabs.find((x) => x.toLowerCase() === lower) || "Overview";
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState(() => getInitialTab());

  const { data: project, isLoading, isError, refetch } = useProject(id);
  const { data: allStaff = [] } = useAllStaff();
  const { data: allQuotations = [] } = useQuotations();
  const { staff: me } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [manageTeamOpen, setManageTeamOpen] = useState(false);

  // Phase 1 — DB-backed tasks, site photos, and client reviews.
  const { data: tasks = [] } = useProjectTasks(id);
  const { data: reviews = [] } = useProjectReviews(id);
  const { data: photos = [] } = useProjectSitePhotos(id);
  const uploadPhoto = useUploadSitePhoto();
  const deletePhoto = useDeleteSitePhoto();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const deleteReview = useDeleteReview();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTaskRow | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverMenuOpen, setCoverMenuOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const updateCover = useUpdateProject();

  if (isLoading) {
    return (
      <div className="mobile-container" style={{ background: "var(--s-page)" }}>
        <AppHeader title="Loading…" subtitle="—" showBack compact />
      </div>
    );
  }
  // A failed query is NOT the same as "deleted" — show a retry, not "not found".
  if (isError) {
    return (
      <div className="mobile-container" style={{ background: "var(--s-page)" }}>
        <AppHeader title="Couldn't load project" subtitle="—" showBack compact />
        <div className="px-4 py-8 text-center space-y-3">
          <p className="text-sm" style={{ color: "var(--t-5)" }}>
            Something went wrong loading this project. Check your connection and try again.
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl text-sm font-label"
            style={{ background: "var(--acc-bright)", color: "oklch(1 0 0)", letterSpacing: "0.04em" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="mobile-container" style={{ background: "var(--s-page)" }}>
        <AppHeader title="Project not found" subtitle="—" showBack compact />
        <div className="px-4 py-8 text-center">
          <p className="text-sm" style={{ color: "var(--t-5)" }}>
            We couldn't find this project. It may have been deleted.
          </p>
        </div>
      </div>
    );
  }

  // Fall back to a neutral chip if a status/priority value isn't in the maps
  // (DB enums can drift from these hardcoded configs) — never crash on sc.bg.
  const sc = statusConfig[project.status as keyof typeof statusConfig] ?? DEFAULT_STATUS_CONFIG;
  const pc = priorityConfig[project.priority as keyof typeof priorityConfig] ?? DEFAULT_PRIORITY_CONFIG;
  // Full project roster (Lead Designer + PM + team) — single source of truth so
  // cards, the Team tab, the side rail, and the task-assignee pool never disagree.
  const rosterMembers = resolveProjectRoster(project, allStaff);
  const rosterStaff = rosterMembers.map((r) => r.staff);
  const roster = rosterMembers.map((r) => ({
    id: r.staff.id,
    name: r.staff.name,
    avatar_code: r.staff.avatar_code,
    job_title: r.staff.job_title,
    roleLabel: r.role,
  }));
  // Phase 5 — OPS tier OR a member of THIS project's team may edit its data.
  const canEdit = canEditProjectData(me, project);

  async function onCoverPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setCoverMenuOpen(false);
    if (!file || !project) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    try {
      await updateCover.mutateAsync({ id: project.id, imageFile: file });
      toast.success("Cover updated");
    } catch (err) {
      toast.error(`Cover update failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }
  async function handleRemoveCover() {
    setCoverMenuOpen(false);
    if (!project) return;
    try {
      await updateCover.mutateAsync({ id: project.id, removeImage: true });
      toast.success("Cover removed — default shown");
    } catch (err) {
      toast.error(`Remove failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  // Task helpers (real DB tasks replace the old sampleTasks mock).
  const staffById = new Map(allStaff.map((s) => [s.id, s]));
  const doneTasks = tasks.filter((t) => t.status === "completed").length;
  const totalTasks = tasks.length;
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const openAddTask = () => { setEditingTask(null); setTaskDialogOpen(true); };
  const openEditTask = (t: ProjectTaskRow) => { setEditingTask(t); setTaskDialogOpen(true); };

  const cycleTaskStatus = async (t: ProjectTaskRow) => {
    const order: ProjectTaskStatus[] = ["pending", "in-progress", "completed"];
    const next = order[(order.indexOf(t.status as ProjectTaskStatus) + 1) % order.length];
    try {
      await updateTask.mutateAsync({ id: t.id, projectId: project.id, status: next });
    } catch (err) {
      toast.error(`Couldn't update task: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

  const handleDeleteTask = async (t: ProjectTaskRow) => {
    if (!window.confirm(`Delete task "${t.title}"?`)) return;
    try {
      await deleteTask.mutateAsync({ id: t.id, projectId: project.id });
      toast.success("Task deleted");
    } catch (err) {
      toast.error(`Couldn't delete task: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

  const handleDeleteReview = async (r: ProjectReviewRow) => {
    if (!window.confirm("Delete this review?")) return;
    try {
      await deleteReview.mutateAsync({ id: r.id, projectId: project.id });
      toast.success("Review deleted");
    } catch (err) {
      toast.error(`Couldn't delete review: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

  const handleDeletePhoto = async (p: SitePhotoRow) => {
    if (!window.confirm("Delete this photo?")) return;
    try {
      await deletePhoto.mutateAsync({ id: p.id, projectId: project.id, storagePath: p.storage_path });
      toast.success("Photo deleted");
    } catch (err) {
      toast.error(`Couldn't delete photo: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

  const handlePhotosPicked = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) { toast.error("Please choose one or more image files"); return; }
    const t = new Date();
    const ddmmyyyy = `${String(t.getDate()).padStart(2, "0")}/${String(t.getMonth() + 1).padStart(2, "0")}/${t.getFullYear()}`;
    // The caption applies to every photo in this batch; clear it once consumed.
    const caption = photoCaption.trim() || undefined;
    let ok = 0;
    for (const file of files) {
      try {
        await uploadPhoto.mutateAsync({ projectId: project.id, file, photoDate: ddmmyyyy, uploadedById: me?.id, notes: caption });
        ok += 1;
      } catch (err) {
        toast.error(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
      }
    }
    if (ok > 0) {
      toast.success(ok === 1 ? "Photo uploaded" : `${ok} photos uploaded`);
      setPhotoCaption("");
    }
  };

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader
        title={project.name}
        subtitle={project.projectCode ? `${project.projectCode} · ${project.type.toUpperCase()}` : project.type.toUpperCase()}
        showBack
        compact
        rightAction={
          canEdit ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setEditOpen(true)}
              data-testid="project-edit"
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-label"
              style={{ background: "var(--s-2)", border: "1px solid var(--b-1)", color: "var(--acc-ink)", letterSpacing: "0.04em" }}
            >
              <PenSquare size={13} />
              Edit
            </motion.button>
          ) : undefined
        }
      />

      <div className="pb-24">
        {/* Hero image */}
        <div
          className="h-44 lg:h-96 xl:h-[28rem] 2xl:h-[32rem] relative overflow-hidden"
          style={{
            background: `linear-gradient(to bottom, oklch(0.11 0.004 285 / 0.3), oklch(0.11 0.004 285 / 0.75)), url(${project.heroImage ?? (project.type === "Residential" ? CARD_BG2 : CARD_BG1)}) center/cover no-repeat`,
          }}
        >
          {canEdit && (
            <div className="absolute top-3 right-3 lg:top-5 lg:right-5 z-10">
              <button
                type="button"
                data-testid="hero-cover-btn"
                onClick={() => setCoverMenuOpen((v) => !v)}
                disabled={updateCover.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-label"
                style={{ background: "oklch(0.11 0.004 285 / 0.55)", color: "white", border: "1px solid oklch(1 0 0 / 0.25)", backdropFilter: "blur(4px)", opacity: updateCover.isPending ? 0.6 : 1 }}
              >
                <ImagePlus size={13} />{updateCover.isPending ? "Saving…" : "Cover"}
              </button>
              {coverMenuOpen && !updateCover.isPending && (
                <div className="absolute right-0 mt-1.5 rounded-xl overflow-hidden min-w-[150px]" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 8px 28px oklch(0 0 0 / 0.22)" }}>
                  <button type="button" onClick={() => coverInputRef.current?.click()} className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs" style={{ color: "var(--t-2)" }}>
                    <ImagePlus size={13} style={{ color: "var(--acc-ink)" }} />{project.heroImage ? "Replace cover" : "Add cover"}
                  </button>
                  {project.heroImage && (
                    <button type="button" onClick={handleRemoveCover} className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs" style={{ color: "oklch(0.55 0.16 25)", borderTop: "1px solid var(--b-2)" }}>
                      <Trash2 size={13} />Remove cover
                    </button>
                  )}
                </div>
              )}
              <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={onCoverPicked} />
            </div>
          )}
          <div className="absolute bottom-4 left-4 right-4 lg:bottom-6 lg:left-8 lg:right-8">
            <div className="flex items-end justify-between">
              <div>
                <span className="status-pill" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>
                <p className="text-white font-display text-lg lg:text-3xl font-semibold mt-1">{project.name}</p>
                <div className="flex items-center gap-1 mt-0.5 lg:mt-1.5">
                  <MapPin size={10} className="lg:hidden" style={{ color: "var(--acc-bright)" }} />
                  <MapPin size={14} className="hidden lg:block" style={{ color: "var(--acc-bright)" }} />
                  <span className="text-xs lg:text-sm" style={{ color: "var(--acc-bright)" }}>{project.location}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60">Budget</p>
                <p className="text-white font-semibold text-sm lg:text-xl">RM {project.budget.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-3" style={{ background: "var(--s-card)", borderBottom: "1px solid var(--b-1)" }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs" style={{ color: "var(--t-5)" }}>Overall Progress — {project.tasksCompleted}/{project.taskCount} tasks</span>
            <span className="text-sm font-semibold" style={{ color: "var(--acc)" }}>{project.progress}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--b-2)" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${project.progress}%` }}
              transition={{ duration: 1 }}
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, var(--acc-strong), var(--acc-bright))" }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-4 py-3 flex gap-2" style={{ background: "var(--s-card)", borderBottom: "1px solid var(--b-1)" }}>
          {[
            { label: "Upload Photos", icon: Upload, action: () => { setActiveTab("Photos"); photoInputRef.current?.click(); } },
            { label: "Assign Tasks", icon: UserPlus, action: () => { setActiveTab("Tasks"); openAddTask(); } },
            { label: "Reviews", icon: CheckSquare, action: () => setActiveTab("Overview") },
          ].map((btn) => {
            const Icon = btn.icon;
            return (
              <motion.button
                key={btn.label}
                whileTap={{ scale: 0.95 }}
                onClick={btn.action}
                className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl"
                style={{ background: "var(--s-page)", border: "1px solid var(--b-1)" }}
              >
                <Icon size={16} style={{ color: "var(--acc)" }} />
                <span className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>{btn.label}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Tabs */}
        <div
          className="flex overflow-x-auto scrollbar-hide"
          style={{ background: "var(--s-card)", borderBottom: "1px solid var(--b-1)" }}
        >
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="shrink-0 px-4 py-3 text-xs font-label relative"
              style={{
                color: activeTab === tab ? "var(--acc)" : "var(--t-5)",
                letterSpacing: "0.04em",
                fontWeight: activeTab === tab ? 700 : 400,
              }}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="tabIndicator"
                  className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full"
                  style={{ background: "var(--acc-strong)" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ── Two-column split (main + side rail) only at xl: the fixed sidebar
            already eats ~200px, so a 360px rail only fits at ≥1280. Tablet
            (768–1279) stays single-column full-width. ── */}
        <div className="px-4 py-4 lg:px-8 lg:py-7 xl:grid xl:grid-cols-[1fr_360px] xl:gap-6 xl:items-start">

          {/* ── PRIMARY COLUMN (left) ── */}
          <div className="min-w-0">
            {activeTab === "Overview" && (
              <div className="space-y-4">
                <div className="rounded-2xl p-4" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
                  <h4 className="font-display text-base font-semibold mb-2" style={{ color: "var(--t-1)" }}>Description</h4>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--t-4)" }}>{project.description}</p>
                </div>

                <div className="rounded-2xl p-4" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
                  <h4 className="font-display text-base font-semibold mb-3" style={{ color: "var(--t-1)" }}>Project Areas</h4>
                  <div className="flex flex-wrap gap-2">
                    {project.areas.map((area) => (
                      <span
                        key={area}
                        className="px-3 py-1 rounded-full text-xs font-label"
                        style={{ background: "oklch(0.62 0.09 68 / 10%)", color: "var(--acc-ink)", border: "1px solid oklch(0.62 0.09 68 / 20%)", letterSpacing: "0.03em" }}
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  className="w-full rounded-2xl p-4 flex items-center justify-between"
                  style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
                  onClick={() => {
                    const num = project.clientContact?.replace(/[^\d+]/g, "");
                    if (num) window.location.href = `tel:${num}`;
                    else toast.info("No contact number on file");
                  }}
                >
                  <div>
                    <p className="text-sm font-semibold text-left" style={{ color: "var(--t-1)" }}>{project.client}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>{project.clientContact}</p>
                  </div>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "oklch(0.62 0.09 68 / 12%)" }}>
                    <Phone size={15} style={{ color: "var(--acc)" }} />
                  </div>
                </motion.button>

                {/* Client Reviews — submitted from the client portal, shown/managed here. */}
                <div className="rounded-2xl p-4" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-display text-base font-semibold" style={{ color: "var(--t-1)" }}>Client Reviews</h4>
                    {reviews.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <StarRow value={avgRating} size={13} />
                        <span className="text-xs font-semibold" style={{ color: "var(--acc-ink)" }}>{avgRating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  {reviews.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--t-5)" }}>No reviews yet. Clients can leave a review from their portal link.</p>
                  ) : (
                    <div className="space-y-3">
                      {reviews.map((r) => (
                        <div key={r.id} className="flex items-start gap-3 pb-3" style={{ borderBottom: "1px solid var(--b-2)" }}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <StarRow value={r.rating} size={12} />
                              <span className="text-xs font-semibold" style={{ color: "var(--t-2)" }}>{r.reviewer_name || "Client"}</span>
                            </div>
                            {r.comment && <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--t-4)" }}>{r.comment}</p>}
                            <p className="text-[10px] mt-1" style={{ color: "var(--t-6)" }}>{fmtDueDate(r.created_at)}</p>
                          </div>
                          {canEdit && (
                            <button onClick={() => handleDeleteReview(r)} title="Delete review" className="shrink-0 w-6 h-6 flex items-center justify-center" style={{ color: "oklch(0.58 0.12 25)" }}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Share client portal — copies the unauthenticated /portal/:token
                    link so staff can WhatsApp / email it to the client. */}
                <SharePortalButton token={project.clientAccessToken} clientName={project.client} projectId={project.id} canManage={canEdit} />

                {/* Project Details card — shown inline up to xl, moves to side rail at xl */}
                <div className="rounded-2xl p-4 space-y-3 xl:hidden" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
                  <h4 className="font-display text-base font-semibold" style={{ color: "var(--t-1)" }}>Project Details</h4>
                  {[
                    { label: "Client", value: project.client },
                    { label: "Type", value: `${project.type} · ${project.propertyType}` },
                    { label: "Size", value: `${project.size.toLocaleString()} sqft` },
                    { label: "Start Date", value: project.startDate },
                    { label: "Target Completion", value: project.targetDate },
                    { label: "Priority", value: pc.label, color: pc.color },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--t-5)" }}>{item.label}</span>
                      <span className="text-xs font-medium" style={{ color: item.color || "var(--t-2)" }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "Lifecycle" && (
              <LifecycleTab projectId={project.id} clientName={project.client} clientContact={project.clientContact} projectName={project.name} budget={project.budget} canManage={canEdit} />
            )}

            {activeTab === "Tasks" && (
              <div className="space-y-3">
                {/* Header: count + Add */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>
                    {totalTasks === 0 ? "NO TASKS YET" : `${doneTasks} of ${totalTasks} DONE`}
                  </p>
                  {canEdit && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={openAddTask}
                      data-testid="add-task"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-label"
                      style={{ background: "oklch(0.62 0.09 68 / 12%)", color: "var(--acc-ink)", border: "1px solid oklch(0.62 0.09 68 / 25%)", letterSpacing: "0.04em" }}
                    >
                      <Plus size={13} /> Add Task
                    </motion.button>
                  )}
                </div>

                {totalTasks === 0 ? (
                  <div className="rounded-2xl p-8 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                    <CheckSquare size={28} className="mx-auto mb-3" style={{ color: "var(--t-7)" }} />
                    <p className="text-sm font-semibold mb-1" style={{ color: "var(--t-1)" }}>No tasks yet</p>
                    <p className="text-xs" style={{ color: "var(--t-5)" }}>{canEdit ? "Add the first task to start tracking work." : "Tasks will appear here once added."}</p>
                  </div>
                ) : (
                  <div className="space-y-2 xl:space-y-0 xl:grid xl:grid-cols-2 xl:gap-2 xl:items-start">
                    {tasks.map((task, i) => {
                      const ts = taskStatusConfig[task.status] ?? taskStatusConfig.pending;
                      const assignee = task.assignee_id ? staffById.get(task.assignee_id) : undefined;
                      return (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="rounded-xl p-3 flex items-start gap-3"
                          style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
                        >
                          <button
                            onClick={() => canEdit && cycleTaskStatus(task)}
                            disabled={!canEdit}
                            title={canEdit ? "Click to change status" : undefined}
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: ts.bg, border: `1.5px solid ${ts.color}`, cursor: canEdit ? "pointer" : "default" }}
                          >
                            {task.status === "completed" && <span className="text-[8px]" style={{ color: ts.color }}>✓</span>}
                            {task.status === "in-progress" && <span className="w-1.5 h-1.5 rounded-full" style={{ background: ts.color }} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-snug" style={{ color: "var(--t-2)", textDecoration: task.status === "completed" ? "line-through" : "none" }}>{task.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {task.area && <span className="text-[10px]" style={{ color: "var(--t-5)" }}>{task.area}</span>}
                              {task.due_date && <span className="text-[10px]" style={{ color: "var(--t-6)" }}>· Due {fmtDueDate(task.due_date)}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="status-pill" style={{ background: ts.bg, color: ts.color }}>{ts.label}</span>
                            <div className="flex items-center gap-1">
                              {assignee && (
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                                  title={assignee.name}
                                  style={{ background: "oklch(0.62 0.09 68 / 12%)", color: "var(--acc-ink)" }}
                                >
                                  {assignee.avatar_code}
                                </div>
                              )}
                              {canEdit && (
                                <>
                                  <button onClick={() => openEditTask(task)} title="Edit task" className="w-6 h-6 flex items-center justify-center" style={{ color: "var(--t-5)" }}>
                                    <Pencil size={12} />
                                  </button>
                                  <button onClick={() => handleDeleteTask(task)} title="Delete task" className="w-6 h-6 flex items-center justify-center" style={{ color: "oklch(0.58 0.12 25)" }}>
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "Quotations" && (
              <div className="space-y-3">
                {(() => {
                  const projectQuotes = allQuotations.filter((q) => q.project_id === project.id);
                  return (
                    <>
                      {projectQuotes.length === 0 ? (
                        <div className="rounded-2xl p-8 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                          <FileText size={28} className="mx-auto mb-3" style={{ color: "var(--t-7)" }} />
                          <p className="text-sm font-semibold mb-1" style={{ color: "var(--t-1)" }}>No documents yet</p>
                          <p className="text-xs" style={{ color: "var(--t-5)" }}>Create a quotation for this project</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {projectQuotes.map((q, i) => {
                            const sc2 = qStatusConfig[q.status];
                            const { total } = computeTotals(q.items, q.tax_rate);
                            return (
                              <motion.div
                                key={q.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate(`/quotations/${q.id}`)}
                                className="rounded-2xl p-4 flex items-center gap-3"
                                style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
                              >
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.62 0.09 68 / 12%)" }}>
                                  <FileText size={17} style={{ color: "var(--acc)" }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold truncate" style={{ color: "var(--t-1)" }}>{q.id}</p>
                                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--t-5)" }}>{q.doc_type} · {q.issue_date}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-display font-semibold" style={{ color: "var(--acc)" }}>{formatRM(total)}</p>
                                  <span className="status-pill" style={{ background: sc2.bg, color: sc2.color }}>{sc2.label}</span>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate("/quotations/new")}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed"
                        style={{ borderColor: "oklch(0.62 0.09 68 / 35%)", color: "var(--acc)" }}
                      >
                        <FileText size={14} />
                        <span className="text-sm font-label" style={{ letterSpacing: "0.04em" }}>New Quotation / Invoice</span>
                      </motion.button>
                    </>
                  );
                })()}
              </div>
            )}

            {activeTab === "Photos" && (
              <div className="space-y-4">
                {canEdit && (
                  <div className="space-y-2">
                    <div>
                      <p className="sz-label mb-1.5">DESCRIPTION (OPTIONAL)</p>
                      <input
                        value={photoCaption}
                        onChange={(e) => setPhotoCaption(e.target.value)}
                        placeholder="e.g. Living room wiring — day 3"
                        className="w-full rounded-xl px-3 py-2.5 text-sm"
                        style={{ background: "var(--s-2)", border: "1px solid var(--b-1)", color: "var(--t-2)", outline: "none" }}
                      />
                    </div>
                    <div
                      className="rounded-2xl p-6 flex flex-col items-center gap-3 border-2 border-dashed cursor-pointer"
                      style={{ borderColor: "oklch(0.62 0.09 68 / 30%)", background: "oklch(0.62 0.09 68 / 4%)", opacity: uploadPhoto.isPending ? 0.6 : 1 }}
                      onClick={() => !uploadPhoto.isPending && photoInputRef.current?.click()}
                    >
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "oklch(0.62 0.09 68 / 12%)" }}>
                        <Upload size={20} style={{ color: "var(--acc)" }} />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>{uploadPhoto.isPending ? "Uploading…" : "Upload Photos"}</p>
                        <p className="text-xs mt-1" style={{ color: "var(--t-5)" }}>Pick one or many · JPG or PNG · the description applies to this batch</p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <p className="sz-label mb-3">RECENT UPLOADS ({photos.length})</p>
                  {photos.length === 0 ? (
                    <div className="rounded-2xl p-8 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                      <Upload size={26} className="mx-auto mb-3" style={{ color: "var(--t-7)" }} />
                      <p className="text-sm font-semibold mb-1" style={{ color: "var(--t-1)" }}>No photos yet</p>
                      <p className="text-xs" style={{ color: "var(--t-5)" }}>{canEdit ? "Upload the first site photo above." : "Photos will appear here once uploaded."}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 lg:grid-cols-4 xl:grid-cols-5">
                      {photos.map((p) => (
                        <SitePhotoThumb key={p.id} photo={p} canDelete={canEdit} onDelete={() => handleDeletePhoto(p)} onOpen={(url, label) => setLightbox({ url, label })} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "Reports" && (
              <ReportsTab projectId={project.id} projectName={project.name} canEdit={canEdit} />
            )}

            {/* Team tab */}
            {activeTab === "Team" && (
              <div className="space-y-3">
                {canEdit && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      data-testid="manage-team-btn"
                      onClick={() => setManageTeamOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-label font-semibold"
                      style={{ background: "var(--acc-bright)", color: "oklch(1 0 0)" }}
                    >
                      <UserPlus size={14} />Manage Team
                    </button>
                  </div>
                )}
                {roster.length === 0 ? (
                  <div className="rounded-2xl p-6 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                    <p className="text-sm" style={{ color: "var(--t-5)" }}>{canEdit ? "No one on this project yet — tap Manage Team to add a Lead Designer, PM and members." : "No team assigned yet."}</p>
                  </div>
                ) : (
                  <div className="xl:grid xl:grid-cols-2 xl:gap-3 xl:items-start space-y-3 xl:space-y-0">
                {roster.map((member, i) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="rounded-2xl p-4 flex items-center gap-3"
                    style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
                  >
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{
                        background: "linear-gradient(135deg, oklch(0.62 0.09 68 / 20%), oklch(0.52 0.08 65 / 20%))",
                        color: "var(--acc-ink)",
                        border: "1.5px solid oklch(0.62 0.09 68 / 25%)",
                      }}
                    >
                      {member.avatar_code}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>{member.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>{member.job_title}</p>
                    </div>
                    <span
                      className="text-xs font-label px-2 py-0.5 rounded-full"
                      style={{
                        background: member.roleLabel !== "Team" ? "oklch(0.62 0.09 68 / 12%)" : "var(--s-2)",
                        color: member.roleLabel !== "Team" ? "var(--acc-ink)" : "var(--t-5)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {member.roleLabel}
                    </span>
                  </motion.div>
                ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SIDE RAIL (right column, xl desktop only) ── */}
          <div className="hidden xl:flex xl:flex-col xl:gap-4">
            {/* Project Details */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
              <h4 className="font-display text-base font-semibold" style={{ color: "var(--t-1)" }}>Project Details</h4>
              {[
                { label: "Client", value: project.client },
                { label: "Type", value: `${project.type} · ${project.propertyType}` },
                { label: "Size", value: `${project.size.toLocaleString()} sqft` },
                { label: "Start Date", value: project.startDate },
                { label: "Target Completion", value: project.targetDate },
                { label: "Priority", value: pc.label, color: pc.color },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--t-5)" }}>{item.label}</span>
                  <span className="text-xs font-medium" style={{ color: item.color || "var(--t-2)" }}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Team members */}
            {roster.length > 0 && (
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
                <h4 className="font-display text-base font-semibold" style={{ color: "var(--t-1)" }}>Team</h4>
                {roster.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: "linear-gradient(135deg, oklch(0.62 0.09 68 / 20%), oklch(0.52 0.08 65 / 20%))",
                        color: "var(--acc-ink)",
                        border: "1.5px solid oklch(0.62 0.09 68 / 25%)",
                      }}
                    >
                      {member.avatar_code}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--t-1)" }}>{member.name}</p>
                      <p className="text-[10px] truncate" style={{ color: "var(--t-5)" }}>{member.job_title}</p>
                    </div>
                    <span
                      className="text-[10px] font-label px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: member.roleLabel !== "Team" ? "oklch(0.62 0.09 68 / 12%)" : "var(--s-2)",
                        color: member.roleLabel !== "Team" ? "var(--acc-ink)" : "var(--t-5)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {member.roleLabel}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Quick stats */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
              <h4 className="font-display text-base font-semibold" style={{ color: "var(--t-1)" }}>Quick Stats</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Tasks Done", value: `${project.tasksCompleted}/${project.taskCount}` },
                  { label: "Progress", value: `${project.progress}%` },
                  { label: "Photos", value: `${project.photoCount}` },
                  { label: "Budget", value: `RM ${(project.budget / 1000).toFixed(0)}k` },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl p-2.5 text-center"
                    style={{ background: "var(--s-page)", border: "1px solid var(--b-2)" }}
                  >
                    <p className="text-sm font-display font-semibold" style={{ color: "var(--acc)" }}>{stat.value}</p>
                    <p className="text-[10px] font-label mt-0.5" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>{stat.label.toUpperCase()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <EditProjectSheet project={project} open={editOpen} onClose={() => setEditOpen(false)} />
      <ManageTeamSheet project={project} staff={allStaff} open={manageTeamOpen} onClose={() => setManageTeamOpen(false)} />
      <PhotoLightbox photo={lightbox} onClose={() => setLightbox(null)} />
      <TaskDialog
        projectId={project.id}
        task={editingTask}
        teamMembers={rosterStaff}
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
      />
      {/* Hidden picker used by the Photos tab + "Upload Photos" action. */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { handlePhotosPicked(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAR ROW — read-only star rating display
// ─────────────────────────────────────────────────────────────────────────────

function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i - 0.25;
        return (
          <Star
            key={i}
            size={size}
            style={{ color: "oklch(0.72 0.14 75)" }}
            fill={filled ? "oklch(0.72 0.14 75)" : "none"}
            strokeWidth={filled ? 0 : 1.5}
          />
        );
      })}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SITE PHOTO THUMBNAIL — resolves a signed URL for the private storage object
// ─────────────────────────────────────────────────────────────────────────────

function SitePhotoThumb({ photo, canDelete, onDelete, onOpen }: { photo: SitePhotoRow; canDelete: boolean; onDelete: () => void; onOpen: (url: string, label: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!photo.storage_path) { setFailed(true); return; }
    getSitePhotoUrl(photo.storage_path).then((u) => {
      if (!alive) return;
      if (u) setUrl(u); else setFailed(true);
    });
    return () => { alive = false; };
  }, [photo.storage_path]);

  const dateLabel = fmtDueDate(photo.photo_date);

  return (
    <div className="space-y-1">
    <div className="aspect-square rounded-xl overflow-hidden relative" style={{ background: "var(--s-2)" }}>
      {url && !failed ? (
        <img
          src={url}
          alt={dateLabel}
          onClick={() => onOpen(url, dateLabel)}
          className="w-full h-full object-cover cursor-pointer transition-transform hover:scale-[1.03]"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Upload size={16} style={{ color: "var(--t-7)" }} />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 px-1.5 py-1" style={{ background: "linear-gradient(to top, oklch(0.11 0.004 285 / 0.7), transparent)" }}>
        <span className="text-[9px] text-white font-medium">{dateLabel}</span>
      </div>
      {canDelete && (
        <button
          onClick={onDelete}
          title="Delete photo"
          className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: "oklch(0.11 0.004 285 / 0.55)" }}
        >
          <Trash2 size={11} className="text-white" />
        </button>
      )}
    </div>
      {photo.notes && (
        <p className="text-[10px] leading-snug line-clamp-2" style={{ color: "var(--t-5)" }} title={photo.notes}>
          {photo.notes}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHOTO LIGHTBOX — tap a site photo to view it full-size
// ─────────────────────────────────────────────────────────────────────────────

function PhotoLightbox({ photo, onClose }: { photo: { url: string; label: string } | null; onClose: () => void }) {
  useEffect(() => {
    if (!photo) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [photo, onClose]);

  return (
    <AnimatePresence>
      {photo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: "oklch(0.08 0.004 285 / 0.88)", backdropFilter: "blur(6px)" }}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "oklch(1 0 0 / 14%)", border: "1px solid oklch(1 0 0 / 22%)" }}
          >
            <X size={18} className="text-white" />
          </button>
          <motion.img
            key={photo.url}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.18 }}
            src={photo.url}
            alt={photo.label}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[86vh] rounded-2xl object-contain"
            style={{ boxShadow: "0 20px 60px oklch(0 0 0 / 0.5)" }}
          />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full" style={{ background: "oklch(1 0 0 / 14%)", border: "1px solid oklch(1 0 0 / 20%)" }}>
            <span className="text-xs text-white font-medium">{photo.label}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK DIALOG — add / edit a project task
// ─────────────────────────────────────────────────────────────────────────────

function TaskDialog({
  projectId, task, teamMembers, open, onClose,
}: {
  projectId: string;
  task: ProjectTaskRow | null;
  teamMembers: StaffRow[];
  open: boolean;
  onClose: () => void;
}) {
  const { staff: me } = useAuth();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const isEdit = !!task;
  const pending = createTask.isPending || updateTask.isPending;

  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<ProjectTaskStatus>("pending");

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setArea(task?.area ?? "");
    setAssigneeId(task?.assignee_id ?? "");
    setDueDate(task?.due_date ?? "");
    setStatus((task?.status as ProjectTaskStatus) ?? "pending");
  }, [open, task]);

  const inputStyle: React.CSSProperties = {
    background: "var(--s-page)", border: "1px solid var(--b-1)",
    color: "var(--t-2)", borderRadius: "12px", padding: "0.7rem 0.9rem",
    fontSize: "0.875rem", width: "100%", outline: "none",
  };
  const labelStyle: React.CSSProperties = { color: "var(--t-5)", letterSpacing: "0.06em", fontWeight: 700 };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Task title is required"); return; }
    try {
      if (isEdit && task) {
        await updateTask.mutateAsync({
          id: task.id, projectId,
          title: title.trim(), area: area.trim() || null,
          assigneeId: assigneeId || null, dueDate: dueDate || null, status,
        });
        toast.success("Task updated");
      } else {
        await createTask.mutateAsync({
          projectId, title: title.trim(), area: area.trim() || null,
          assigneeId: assigneeId || null, dueDate: dueDate || null, status,
          sortOrder: Date.now() % 100000, createdBy: me?.id ?? null,
        });
        toast.success("Task added");
      }
      onClose();
    } catch (err) {
      toast.error(`Failed to ${isEdit ? "update" : "add"} task: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={() => !pending && onClose()}
            className="fixed inset-0 z-40"
            style={{ background: "oklch(0.11 0.004 285 / 0.45)", backdropFilter: "blur(4px)" }}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[460px] z-50 flex flex-col lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2"
            style={{ maxHeight: "92vh", background: "var(--s-card)", borderRadius: "24px 24px 0 0", boxShadow: "0 -12px 48px oklch(0 0 0 / 0.18)" }}
          >
            <div className="flex justify-center pt-2.5 pb-1.5 shrink-0 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: "var(--b-strong)" }} />
            </div>
            <div className="px-4 pt-3 lg:pt-5 pb-3 flex items-start justify-between shrink-0" style={{ borderBottom: "1px solid var(--b-2)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))" }}>
                  {isEdit ? <Pencil size={16} className="text-white" /> : <Plus size={16} className="text-white" />}
                </div>
                <div>
                  <p className="font-display text-base font-semibold leading-tight" style={{ color: "var(--t-1)" }}>
                    {isEdit ? "Edit Task" : "New Task"}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--t-5)" }}>{isEdit ? "Update this task" : "Add a task to this project"}</p>
                </div>
              </div>
              <button onClick={onClose} disabled={pending} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--s-2)", opacity: pending ? 0.5 : 1 }}>
                <X size={14} style={{ color: "var(--acc-ink)" }} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div>
                <label className="block text-[10px] font-label mb-1.5" style={labelStyle}>TASK TITLE *</label>
                <input data-testid="task-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Flooring installation" style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-label mb-1.5" style={labelStyle}>AREA</label>
                  <input type="text" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Kitchen" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[10px] font-label mb-1.5" style={labelStyle}>DUE DATE</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-label mb-1.5" style={labelStyle}>ASSIGNEE</label>
                  <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={inputStyle}>
                    <option value="">Unassigned</option>
                    {teamMembers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.avatar_code})</option>
                    ))}
                    {task?.assignee_id && !teamMembers.some((m) => m.id === task.assignee_id) && (
                      <option value={task.assignee_id}>{task.assignee_id} (not on team)</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-label mb-1.5" style={labelStyle}>STATUS</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as ProjectTaskStatus)} style={inputStyle}>
                    {TASK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              {teamMembers.length === 0 && (
                <p className="text-[11px]" style={{ color: "var(--t-5)" }}>Tip: add people on the Team tab → Manage Team, then they'll show up here to assign.</p>
              )}
            </div>

            <div className="px-4 py-3 flex gap-2 shrink-0" style={{ borderTop: "1px solid var(--b-2)" }}>
              <button onClick={onClose} disabled={pending} className="flex-1 py-3 rounded-xl text-sm font-label" style={{ background: "var(--s-2)", color: "var(--acc-ink)", border: "1px solid var(--b-1)", letterSpacing: "0.04em", opacity: pending ? 0.5 : 1 }}>
                Cancel
              </button>
              <motion.button whileTap={pending ? undefined : { scale: 0.96 }} onClick={handleSubmit} disabled={pending} data-testid="task-submit" className="flex-1 py-3 rounded-xl text-sm font-label font-semibold flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))", color: "oklch(1 0 0)", letterSpacing: "0.04em", opacity: pending ? 0.7 : 1 }}>
                {pending ? <span>{isEdit ? "Saving…" : "Adding…"}</span> : (<><Check size={15} />{isEdit ? "Save Task" : "Add Task"}</>)}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIFECYCLE TAB — vertical timeline of the 29 SPAZEHAUS workflow stages,
// with inline Payment Collection (5 gates) and Document Sign (6 items) badges.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS TAB — weekly site report (Phase 4): site photos bucketed by ISO week
// with an optional per-week staff summary. On-demand (only weeks with photos).
// ─────────────────────────────────────────────────────────────────────────────

/** Monday (ISO "YYYY-MM-DD") of the ISO week containing the given date. */
function mondayOfWeek(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const back = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekRangeLabel(mondayIso: string): string {
  const mon = new Date(mondayIso + "T00:00:00");
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(mon)} – ${fmt(sun)} ${sun.getFullYear()}`;
}

function WeekSummary({ initial, canEdit, onSave }: { initial: string; canEdit: boolean; onSave: (s: string) => void }) {
  const [val, setVal] = useState(initial);
  useEffect(() => { setVal(initial); }, [initial]);
  if (!canEdit) {
    return initial
      ? <p className="text-xs leading-relaxed" style={{ color: "var(--t-4)" }}>{initial}</p>
      : <p className="text-xs italic" style={{ color: "var(--t-6)" }}>No summary written for this week.</p>;
  }
  return (
    <textarea
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => { if (val !== initial) onSave(val); }}
      placeholder="Write this week's site summary (progress, issues, next steps)…"
      className="w-full rounded-lg px-2.5 py-2 text-xs leading-relaxed"
      style={{ background: "var(--s-page)", border: "1px solid var(--b-2)", color: "var(--t-2)", minHeight: 60, resize: "vertical" }}
    />
  );
}

function ReportsTab({ projectId, projectName, canEdit }: { projectId: string; projectName: string; canEdit: boolean }) {
  const { data: photos = [] } = useProjectSitePhotos(projectId);
  const { data: reports = {} } = useSiteReports(projectId);
  const setSummary = useSetSiteReportSummary();
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  // Bucket photos by Monday-of-week; weeks newest first (on-demand — only weeks
  // that actually have photos show up, no empty shells).
  const buckets = new Map<string, SitePhotoRow[]>();
  for (const p of photos) {
    const wk = mondayOfWeek(p.photo_date);
    if (!buckets.has(wk)) buckets.set(wk, []);
    buckets.get(wk)!.push(p);
  }
  const weeks = Array.from(buckets.keys()).sort().reverse();

  const saveSummary = (weekStart: string, summary: string) => {
    setSummary.mutate(
      { projectId, weekStart, summary },
      { onSuccess: () => toast.success("Weekly summary saved"), onError: (e) => toast.error(`Couldn't save: ${e instanceof Error ? e.message : "unknown error"}`) },
    );
  };

  if (photos.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
        <FileText size={26} className="mx-auto mb-3" style={{ color: "var(--t-7)" }} />
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--t-1)" }}>No weekly reports yet</p>
        <p className="text-xs" style={{ color: "var(--t-5)" }}>
          Weekly site reports build automatically from site photos. Upload photos on the Photos tab
          and they'll group into weeks here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="sz-label">WEEKLY SITE REPORT · {weeks.length} WEEK{weeks.length > 1 ? "S" : ""}</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="text-[10px] font-label px-2.5 py-1 rounded-md inline-flex items-center gap-1"
          style={{ background: "var(--s-2)", color: "var(--t-4)", border: "1px solid var(--b-1)" }}
          title="Print / save this report as PDF"
        >
          <Upload size={10} style={{ transform: "rotate(180deg)" }} /> Print / PDF
        </button>
      </div>
      {weeks.map((wk) => {
        const wkPhotos = buckets.get(wk)!;
        return (
          <div key={wk} className="rounded-2xl overflow-hidden" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
            <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: "var(--s-3)", borderBottom: "1px solid var(--b-1)" }}>
              <p className="text-xs font-label font-semibold" style={{ color: "var(--acc)", letterSpacing: "0.04em" }}>
                {weekRangeLabel(wk)}
              </p>
              <span className="text-[10px]" style={{ color: "var(--t-5)" }}>
                {wkPhotos.length} photo{wkPhotos.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="p-3 space-y-3">
              <WeekSummary initial={reports[wk]?.summary ?? ""} canEdit={canEdit} onSave={(s) => saveSummary(wk, s)} />
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-4 xl:grid-cols-5">
                {wkPhotos.map((p) => (
                  <SitePhotoThumb key={p.id} photo={p} canDelete={false} onDelete={() => {}} onOpen={(url, label) => setLightbox({ url, label })} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
      <PhotoLightbox photo={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}

function LifecycleTab({ projectId, clientName, clientContact, projectName, budget = 0, canManage = false }: { projectId: string; clientName?: string; clientContact?: string; projectName?: string; budget?: number; canManage?: boolean }) {
  const { data: lc, isLoading } = useProjectLifecycle(projectId);
  const { data: project } = useProject(projectId);
  const { data: rosterStaff = [] } = useAllStaff();
  const { data: stageDates = {} } = useProjectStageDates(projectId);
  const { data: stageStatuses = {} } = useProjectStageStatuses(projectId);
  const setStageDate = useSetStageDate();
  const setStageStatus = useSetStageStatus();
  const setDefectDone = useSetDefectPeriodDone(projectId);
  const updatePayment = useUpdatePayment();
  const updateSignature = useUpdateSignature();
  const revertPayment = useRevertPayment();
  const revertSignature = useRevertSignature();
  const { staff: me } = useAuth();
  // Phase 5 — OPS tier OR a member of this project's team may collect/sign/edit.
  const canCollect = canEditPayments(me?.role) || canManage;
  const canSign = canEditSignatures(me?.role) || canManage;
  // Resolve audit-trail staff ids → names for the checkpoint rows (Phase 1).
  const staffById: Record<string, string> = {};
  const staffByAvatar: Record<string, string> = {};
  for (const s of rosterStaff) {
    staffById[s.id] = s.name;
    staffByAvatar[s.avatar_code] = s.name;
  }

  // Defect Period (final stage) — stored completion marker; closing it flips the
  // project to "completed". Staff can always revert it (reopen the warranty window).
  const defectDone = !!project?.defectPeriodCompletedAt;
  const markDefectDone = () =>
    setDefectDone.mutate(
      { done: true, by: me?.avatar_code ?? null },
      {
        onSuccess: () => toast.success("Defect Period completed — project marked done"),
        onError: (e) => toast.error(`Couldn't complete: ${e instanceof Error ? e.message : "unknown error"}`),
      },
    );
  const reopenDefect = () =>
    setDefectDone.mutate(
      { done: false, by: null },
      {
        onSuccess: () => toast.success("Defect Period reopened"),
        onError: (e) => toast.error(`Couldn't reopen: ${e instanceof Error ? e.message : "unknown error"}`),
      },
    );

  // Phase 2 — set a milestone/checkpoint's estimated date. Routes by source:
  // milestones → project_stage_dates; payments → due_date; signatures →
  // signature_records.estimated_date. Status is never touched.
  const setMilestoneDate = (stageId: string, ddmm: string | null) => {
    setStageDate.mutate(
      { projectId, stageId, date: ddmm },
      { onError: (e) => toast.error(`Couldn't set date: ${e instanceof Error ? e.message : "unknown error"}`) },
    );
  };
  // Manual per-stage status (7 Nov 2026) — staff set each stage's status; nothing
  // auto-completes. The DB trigger re-mirrors current_stage_id from the statuses.
  const changeStageStatus = (stageId: string, next: ManualStageStatus) => {
    setStageStatus.mutate(
      { projectId, stageId, status: next, by: me?.avatar_code ?? null },
      {
        onSuccess: () => toast.success("Stage status updated"),
        onError: (e) => toast.error(`Couldn't update status: ${e instanceof Error ? e.message : "unknown error"}`),
      },
    );
  };
  const setPaymentDate = (id: number, ddmm: string | null) => {
    updatePayment.mutate(
      { id, projectId, dueDate: ddmm ?? "" },
      { onError: (e) => toast.error(`Couldn't set date: ${e instanceof Error ? e.message : "unknown error"}`) },
    );
  };
  const setSignatureDate = (id: number, ddmm: string | null) => {
    updateSignature.mutate(
      { id, projectId, estimatedDate: ddmm },
      { onError: (e) => toast.error(`Couldn't set date: ${e instanceof Error ? e.message : "unknown error"}`) },
    );
  };

  // Phase 3 — editable gate amounts (status untouched).
  const setPaymentAmount = (id: number, amount: number) => {
    updatePayment.mutate(
      { id, projectId, amount },
      {
        onSuccess: () => toast.success("Amount updated"),
        onError: (e) => toast.error(`Couldn't update amount: ${e instanceof Error ? e.message : "unknown error"}`),
      },
    );
  };

  // Phase 3 — revert a completed checkpoint, moving the lifecycle back.
  const revertResultToast = (label: string, r: { toLabel: string | null; from: string | null; to: string | null }) => {
    if (r.from && r.to && r.from !== r.to) {
      toast.info(r.toLabel ? `Project moved back to "${r.toLabel}"` : "Project stage recomputed", {
        description: `${label} reverted to pending`,
      });
    } else {
      toast.success(`${label} reverted to pending`);
    }
  };
  // Revert now goes through an in-app confirm dialog (not window.confirm).
  const [revertTarget, setRevertTarget] = useState<{ kind: "payment" | "signature"; id: number; label: string } | null>(null);
  const doRevertPayment = (p: PaymentRecord) => setRevertTarget({ kind: "payment", id: p.id, label: p.label });
  const doRevertSignature = (s: DocumentSignRecord) => setRevertTarget({ kind: "signature", id: s.id, label: s.label });
  const reverting = revertPayment.isPending || revertSignature.isPending;
  const confirmRevert = () => {
    if (!revertTarget) return;
    const { kind, id, label } = revertTarget;
    const opts = {
      onSuccess: (r: RevertResult) => {
        revertResultToast(label, r);
        // If the project had been marked complete, reverting a checkpoint regresses
        // its lifecycle — clear the Defect Period completion + reset status so it no
        // longer reads "Completed" while sitting at an earlier stage.
        if (defectDone) setDefectDone.mutate({ done: false, by: null });
      },
      onError: (e: unknown) => toast.error(`Revert failed: ${e instanceof Error ? e.message : "unknown error"}`),
    };
    if (kind === "payment") revertPayment.mutate({ id, projectId }, opts);
    else revertSignature.mutate({ id, projectId }, opts);
    setRevertTarget(null);
  };
  const [collectTarget, setCollectTarget] = useState<MarkCollectedTarget | null>(null);
  const [signTarget, setSignTarget] = useState<SignDocumentTarget | null>(null);

  // Phase 0A — self-heal. A project must never be button-less: if its lifecycle
  // scaffolding is missing (legacy direct-create before auto-seeding existed),
  // seed the 5 gates + 6 signatures on load so COLLECT/SIGN always render.
  // Gated to the OPS tier (the RPC also enforces it); attempt-once per mount.
  const seedLifecycle = useSeedProjectLifecycle();
  const healedRef = useRef(false);
  const needsHeal =
    Boolean(lc) && canCollect && (lc!.payments.length === 0 || lc!.signatures.length === 0);
  useEffect(() => {
    if (needsHeal && !healedRef.current && !seedLifecycle.isPending) {
      healedRef.current = true;
      seedLifecycle.mutate(
        { projectId, budget },
        { onError: (e) => toast.error(`Couldn't initialise lifecycle: ${e instanceof Error ? e.message : "unknown error"}`) },
      );
    }
  }, [needsHeal, projectId, budget, seedLifecycle]);

  // While healing (or still loading) show the loading state rather than a
  // flash of the empty "no lifecycle" view. If the seed errored, fall through
  // to the normal render (the error was toasted) so we never get stuck here.
  if (isLoading || (needsHeal && !seedLifecycle.isError)) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
        <p className="text-xs" style={{ color: "var(--t-5)" }}>Loading lifecycle…</p>
      </div>
    );
  }
  if (!lc) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
        <Clock size={28} className="mx-auto mb-3" style={{ color: "var(--t-7)" }} />
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--t-1)" }}>No lifecycle data</p>
        <p className="text-xs" style={{ color: "var(--t-5)" }}>This project hasn't been bound to the workflow engine yet.</p>
      </div>
    );
  }

  const pay = paymentSummary(lc);
  const sig = signatureSummary(lc);

  // Group stages by phase for the section headers
  const phases: StagePhase[] = ["Inquiry", "Design", "Pre-Build", "Build", "Closeout"];

  // Build a map of paymentGate -> all related payment records (gate 4 has multiples)
  const paymentsByGate = lc.payments.reduce((acc, p) => {
    (acc[p.gate] ||= []).push(p);
    return acc;
  }, {} as Record<number, typeof lc.payments>);

  // Build a map of signatureKey -> record
  const sigByKey = Object.fromEntries(lc.signatures.map((s) => [s.key, s]));

  // ── Next step (guide, don't block) ──────────────────────────────────────────
  // Stages no longer auto-complete (7 Nov 2026). The "DO THIS NEXT" guidance now
  // points at the FIRST stage (after New Inquiry) staff haven't marked Completed —
  // a hint, not a gate: staff can still act on any stage's payment/signature out of
  // order via its row. `lastStageId` (Defect Period) is handled by its own marker.
  const lastStageId = LIFECYCLE_STAGES[LIFECYCLE_STAGES.length - 1]?.id;
  const currentStage = LIFECYCLE_STAGES.find(
    (s) => s.order > 1 && s.id !== lastStageId && stageStatus(s, stageStatuses) !== "completed",
  );
  const nextPayments = currentStage?.paymentGate
    ? (paymentsByGate[currentStage.paymentGate] ?? []).filter((p) => p.status !== "completed" && p.status !== "skipped")
    : [];
  const nextSigRec = currentStage?.signatureKey ? sigByKey[currentStage.signatureKey] : undefined;
  const nextSignature = nextSigRec && nextSigRec.status !== "completed" && nextSigRec.status !== "skipped" ? nextSigRec : undefined;
  const hasNextAction = nextPayments.length > 0 || !!nextSignature;
  // Work is fully delivered once EVERY stage after New Inquiry (except the final
  // Defect Period) is manually marked Completed — order-independent, matching the
  // out-of-order reality. It's only TRULY complete once the Defect Period (warranty
  // window) is closed — until then the warranty is still active.
  const workDelivered = LIFECYCLE_STAGES.every(
    (s) => s.order === 1 || s.id === lastStageId || stageStatus(s, stageStatuses) === "completed",
  );
  const projectComplete = workDelivered && defectDone;
  const warrantyActive = workDelivered && !defectDone;
  const warrantyEndDate = stageDates["defect-period"];
  const nextParts: string[] = [
    ...nextPayments.map((p) => `collect ${p.label} (${formatRM(p.amount)})`),
    ...(nextSignature ? [`sign ${nextSignature.label}`] : []),
  ];
  const openCollect = (p: PaymentRecord) =>
    setCollectTarget({ id: p.id, projectId, label: p.label, amount: p.amount, gate: p.gate, reference: p.reference, notes: p.notes });
  const openSign = (s: DocumentSignRecord) =>
    setSignTarget({
      id: s.id, projectId, projectName, signatureKey: s.key, label: s.label, group: s.group,
      status: s.status, documentRef: s.documentRef, signedDate: s.signedDate, signedBy: s.signedBy,
      notes: s.notes, defaultSignedBy: clientName,
    });

  return (
    <div className="space-y-5">
      {/* Customer context (meeting note #3) — checkpoints belong to this client. */}
      {clientName && (
        <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
          <User size={13} style={{ color: "var(--acc)" }} />
          <p className="text-xs" style={{ color: "var(--t-3)" }}>
            <span style={{ color: "var(--t-5)" }}>Customer:</span> {clientName}
            {clientContact && <span style={{ color: "var(--t-5)" }}> · {clientContact}</span>}
          </p>
        </div>
      )}

      {/* —— Next step banner — the ONE action that advances the project —— */}
      {projectComplete ? (
        <div className="rounded-xl px-3.5 py-2.5 flex items-center gap-2.5" style={{ background: "oklch(0.55 0.09 145 / 10%)", border: "1px solid oklch(0.55 0.09 145 / 30%)" }}>
          <Check size={15} style={{ color: "oklch(0.45 0.10 145)" }} />
          <p className="text-xs font-medium" style={{ color: "oklch(0.40 0.10 145)" }}>
            Project completed — defect period closed
            {project?.defectPeriodCompletedAt
              ? ` on ${new Date(project.defectPeriodCompletedAt).toLocaleDateString("en-GB")}`
              : ""}.
          </p>
        </div>
      ) : hasNextAction ? (
        <div className="rounded-xl px-3.5 py-3 flex flex-col sm:flex-row sm:items-center gap-2.5" style={{ background: "oklch(0.62 0.09 68 / 8%)", border: "1px solid oklch(0.62 0.09 68 / 28%)" }}>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-label" style={{ color: "var(--acc)", letterSpacing: "0.1em" }}>NEXT STEP TO PROCEED</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--t-2)" }}>
              To advance past <span className="font-semibold">{currentStage?.label}</span>, {nextParts.join(" and ")}.
              {(nextPayments.length > 0 && nextSignature) && <span style={{ color: "var(--t-5)" }}> (needs both)</span>}
            </p>
          </div>
          {canManage && (
            <div className="flex items-center gap-2 shrink-0">
              {nextPayments.map((p) => (
                <button
                  key={`nx-${p.id}`}
                  type="button"
                  onClick={() => openCollect(p)}
                  className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[11px] font-label font-bold"
                  style={{ background: "oklch(0.55 0.09 145)", color: "oklch(1 0 0)", letterSpacing: "0.04em" }}
                >
                  <Check size={11} strokeWidth={3} /> COLLECT
                </button>
              ))}
              {nextSignature && (
                <button
                  type="button"
                  onClick={() => openSign(nextSignature)}
                  className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[11px] font-label font-bold"
                  style={{ background: "var(--acc-strong)", color: "oklch(1 0 0)", letterSpacing: "0.04em" }}
                >
                  <Upload size={11} /> SIGN
                </button>
              )}
            </div>
          )}
        </div>
      ) : warrantyActive ? (
        <div className="rounded-xl px-3.5 py-2.5 flex items-center gap-2.5" style={{ background: "oklch(0.62 0.09 68 / 8%)", border: "1px solid oklch(0.62 0.09 68 / 28%)" }}>
          <Clock size={15} style={{ color: "var(--acc-ink)" }} />
          <p className="text-xs font-medium" style={{ color: "var(--acc-ink)" }}>
            Work delivered — defect &amp; warranty period active
            {warrantyEndDate ? ` until ${warrantyEndDate}` : ""}. Mark it done below to close the project.
          </p>
        </div>
      ) : null}

      {/* —— Summary header: Payment + Document Sign progress —— */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          icon={Coins}
          label="Payment Collected"
          primary={`${pay.pct}%`}
          secondary={`${formatRM(pay.collected)} / ${formatRM(pay.total)}`}
          tint="oklch(0.55 0.09 145)"
          tintBg="oklch(0.55 0.09 145 / 10%)"
        />
        <SummaryCard
          icon={PenSquare}
          label="Documents Signed"
          primary={`${sig.signed}/${sig.total}`}
          secondary={`${sig.pending} pending sign-off`}
          tint="var(--acc-ink)"
          tintBg="oklch(0.62 0.09 68 / 10%)"
        />
      </div>

      {/* —— Phase timeline —— */}
      {phases.map((phase) => {
        const phaseStages = LIFECYCLE_STAGES.filter((s) => s.phase === phase);
        const pc = phaseColors[phase];
        return (
          <div key={phase}>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-0.5 w-6 rounded-full" style={{ background: pc.color, opacity: 0.5 }} />
              <p className="font-label text-xs" style={{ color: pc.color, letterSpacing: "0.12em" }}>
                {phase.toUpperCase()}
              </p>
              <div className="flex-1 h-px" style={{ background: "var(--b-2)" }} />
            </div>

            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
            >
              {phaseStages.map((stage, i) => {
                // Defect Period's status is the stored completion marker — but ONLY
                // once the project has actually reached the final stage (workDelivered).
                // Before that it stays "pending", so the Done button can't appear on a
                // project that's still mid-lifecycle. Every other stage (after New
                // Inquiry) shows its MANUAL status, which staff set via the selector.
                const status =
                  stage.id === "defect-period" && workDelivered
                    ? defectDone
                      ? "completed"
                      : "in-progress"
                    : stageStatus(stage, stageStatuses);
                // New Inquiry is always Completed (no selector); Defect Period uses its
                // own Done/Revert controls; every other stage gets the manual selector.
                const manualStatusStage = stage.order > 1 && stage.id !== "defect-period";
                const isLast = i === phaseStages.length - 1;
                const payments = stage.paymentGate ? paymentsByGate[stage.paymentGate] : undefined;
                const signature = stage.signatureKey ? sigByKey[stage.signatureKey] : undefined;

                return (
                  <div
                    key={stage.id}
                    className="px-3 py-3 flex gap-3"
                    style={{ borderBottom: isLast ? "none" : "1px solid var(--s-2)" }}
                  >
                    {/* Rail + dot */}
                    <div className="flex flex-col items-center shrink-0" style={{ width: 22 }}>
                      <StageDot status={status} type={stage.type} />
                      {!isLast && (
                        <div
                          className="flex-1 w-0.5 mt-1"
                          style={{
                            background:
                              status === "completed" ? "oklch(0.55 0.09 145 / 35%)" : "var(--b-2)",
                            minHeight: 18,
                          }}
                        />
                      )}
                    </div>

                    {/* Stage body */}
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p
                              className="text-sm font-medium leading-tight"
                              style={{
                                color:
                                  status === "completed"
                                    ? "var(--t-3)"
                                    : status === "in-progress"
                                    ? "var(--t-1)"
                                    : "var(--t-5)",
                              }}
                            >
                              {stage.label}
                            </p>
                            {stage.paymentGate && <GateBadge gate={stage.paymentGate} kind="payment" />}
                            {stage.type === "contract-sign" && <GateBadge kind="contract" />}
                            {stage.type === "drawing-sign" && <GateBadge kind="drawing" />}
                            {status === "in-progress" && (payments || signature) && (
                              <span className="text-[9px] font-label px-1.5 py-0.5 rounded-full" style={{ background: "var(--acc-bright)", color: "oklch(1 0 0)", letterSpacing: "0.04em", fontWeight: 700 }}>
                                DO THIS NEXT
                              </span>
                            )}
                          </div>
                          {stage.description && (
                            <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "var(--t-5)" }}>
                              {stage.description}
                            </p>
                          )}
                          {/* Defect Period (final stage): pick a warranty end date +
                              a Done button to close it (project → completed). Staff
                              can always revert (reopen the warranty window). Only when
                              the project has actually reached closeout (workDelivered). */}
                          {stage.id === "defect-period" && workDelivered ? (
                            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                              <StageDateControl
                                value={stageDates[stage.id]}
                                canEdit={canManage}
                                onSet={(d) => setMilestoneDate(stage.id, d)}
                                saving={setStageDate.isPending}
                                pickLabel="Pick Date"
                                setPrefix="Warranty ends"
                              />
                              {canManage &&
                                (defectDone ? (
                                  <button
                                    type="button"
                                    onClick={reopenDefect}
                                    disabled={setDefectDone.isPending}
                                    className="text-[10px] font-label px-2 py-1 rounded-md inline-flex items-center gap-1 shrink-0"
                                    style={{ background: "transparent", color: "var(--t-3)", border: "1px solid var(--b-strong)", cursor: "pointer" }}
                                  >
                                    <Undo2 size={10} /> Revert
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={markDefectDone}
                                    disabled={setDefectDone.isPending}
                                    className="text-[10px] font-label font-bold px-2.5 py-1 rounded-md inline-flex items-center gap-1 shrink-0"
                                    style={{ background: "oklch(0.55 0.09 145)", color: "oklch(1 0 0)", letterSpacing: "0.03em", cursor: "pointer" }}
                                  >
                                    <Check size={11} strokeWidth={3} /> Done
                                  </button>
                                ))}
                            </div>
                          ) : (
                            /* Estimated date for the other milestone stages (Phase 2).
                               Payment/signature stages carry their date on the row below. */
                            !payments && !signature && (
                              <div className="mt-1">
                                <StageDateControl
                                  value={stageDates[stage.id]}
                                  canEdit={canCollect}
                                  onSet={(d) => setMilestoneDate(stage.id, d)}
                                  saving={setStageDate.isPending}
                                />
                              </div>
                            )
                          )}
                          {stage.id === "defect-period" && workDelivered && defectDone && project?.defectPeriodCompletedAt && (
                            <p className="text-[10px] mt-1" style={{ color: "var(--t-5)" }}>
                              Closed {new Date(project.defectPeriodCompletedAt).toLocaleDateString("en-GB")}
                              {project.defectPeriodCompletedBy && staffByAvatar[project.defectPeriodCompletedBy]
                                ? ` · by ${staffByAvatar[project.defectPeriodCompletedBy]}`
                                : ""}
                            </p>
                          )}
                        </div>
                        <StageStatusControl
                          status={status}
                          canEdit={canCollect}
                          interactive={manualStatusStage}
                          saving={setStageStatus.isPending}
                          onChange={(next) => changeStageStatus(stage.id, next)}
                        />
                      </div>

                      {/* Payment detail (one or more rows for gate 4) */}
                      {payments && payments.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {payments.map((p, idx) => (
                            <PaymentRow
                              key={`${p.gate}-${idx}`}
                              payment={p}
                              projectId={projectId}
                              canCollect={canCollect}
                              isNext={status === "in-progress"}
                              staffById={staffById}
                              onSetDate={(d) => setPaymentDate(p.id, d)}
                              onSetAmount={(amt) => setPaymentAmount(p.id, amt)}
                              onRevert={() => doRevertPayment(p)}
                              reverting={revertPayment.isPending}
                              onCollect={() =>
                                setCollectTarget({
                                  id: p.id,
                                  projectId,
                                  label: p.label,
                                  amount: p.amount,
                                  gate: p.gate,
                                  reference: p.reference,
                                  notes: p.notes,
                                })
                              }
                              onEdit={() =>
                                setCollectTarget({
                                  id: p.id,
                                  projectId,
                                  label: p.label,
                                  amount: p.amount,
                                  gate: p.gate,
                                  reference: p.reference,
                                  notes: p.notes,
                                  collectedDate: p.collectedDate,
                                  mode: "edit",
                                })
                              }
                            />
                          ))}
                        </div>
                      )}

                      {/* Signature detail */}
                      {signature && (
                        <SignatureRow
                          signature={signature}
                          canSign={canSign}
                          isNext={status === "in-progress"}
                          staffById={staffById}
                          onSetDate={(d) => setSignatureDate(signature.id, d)}
                          onRevert={() => doRevertSignature(signature)}
                          reverting={revertSignature.isPending}
                          onSign={() =>
                            setSignTarget({
                              id: signature.id,
                              projectId,
                              projectName,
                              signatureKey: signature.key,
                              label: signature.label,
                              group: signature.group,
                              status: signature.status,
                              documentRef: signature.documentRef,
                              signedDate: signature.signedDate,
                              signedBy: signature.signedBy,
                              notes: signature.notes,
                              defaultSignedBy: clientName,
                            })
                          }
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* —— Footer note —— */}
      <p className="text-[10px] text-center font-label" style={{ color: "var(--t-6)", letterSpacing: "0.06em" }}>
        SPAZEHAUS · DESIGN & RENOVATION WORKFLOW · 5 PAYMENT GATES · 6 DOCUMENT SIGNATURES
      </p>

      {/* Mark-collected sheet */}
      <MarkCollectedSheet
        target={collectTarget}
        open={collectTarget !== null}
        onClose={() => setCollectTarget(null)}
      />

      {/* Sign-document sheet */}
      <SignDocumentSheet
        target={signTarget}
        open={signTarget !== null}
        onClose={() => setSignTarget(null)}
      />

      {/* In-app revert confirm (replaces window.confirm) */}
      <AlertDialog open={revertTarget !== null} onOpenChange={(o) => { if (!o) setRevertTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert “{revertTarget?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This sets the checkpoint back to {revertTarget?.kind === "payment" ? "pending" : "unsigned"} and clears its{" "}
              {revertTarget?.kind === "payment" ? "collected date and reference" : "signed date and document"}. It may move the
              project back to an earlier stage. The amount is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevert}
              disabled={reverting}
              style={{ background: "oklch(0.55 0.15 25)", color: "oklch(1 0 0)" }}
            >
              Revert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  primary,
  secondary,
  tint,
  tintBg,
}: {
  icon: typeof Coins;
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
      <p className="font-display text-xl font-semibold leading-none" style={{ color: "var(--t-1)" }}>
        {primary}
      </p>
      <p className="text-[10px] mt-1" style={{ color: "var(--t-5)" }}>
        {secondary}
      </p>
    </div>
  );
}

function StageDot({ status, type }: { status: CheckpointStatus; type: string }) {
  const isPay = type === "payment";
  const isSign = type === "contract-sign" || type === "drawing-sign";

  if (status === "completed") {
    return (
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{ background: "oklch(0.55 0.09 145)" }}
      >
        <Check size={11} className="text-white" strokeWidth={3} />
      </div>
    );
  }
  if (status === "in-progress") {
    return (
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ repeat: Infinity, duration: 1.6 }}
        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: isPay ? "var(--acc-strong)" : isSign ? "oklch(0.55 0.09 240)" : "var(--acc-strong)",
        }}
      >
        {isPay ? (
          <Coins size={10} className="text-white" />
        ) : isSign ? (
          <PenSquare size={10} className="text-white" />
        ) : (
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--s-card)]" />
        )}
      </motion.div>
    );
  }
  // pending
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: "var(--s-2)",
        border: "1.5px solid var(--b-strong)",
      }}
    >
      {isPay ? (
        <Coins size={9} style={{ color: "var(--t-6)" }} />
      ) : isSign ? (
        <PenSquare size={9} style={{ color: "var(--t-6)" }} />
      ) : (
        <div className="w-1 h-1 rounded-full" style={{ background: "var(--t-7)" }} />
      )}
    </div>
  );
}

function GateBadge({
  gate,
  kind,
}: {
  gate?: number;
  kind: "payment" | "contract" | "drawing";
}) {
  const config = {
    payment:  { label: gate ? `PAY ${["①", "②", "③", "④", "⑤"][gate - 1]}` : "PAY", color: "var(--acc-ink)",  bg: "oklch(0.62 0.09 68 / 12%)" },
    contract: { label: "CONTRACT",  color: "oklch(0.50 0.10 25)",  bg: "oklch(0.60 0.10 25 / 12%)" },
    drawing:  { label: "SIGN OFF",  color: "oklch(0.38 0.09 240)", bg: "oklch(0.55 0.09 240 / 12%)" },
  }[kind];
  return (
    <span
      className="text-[9px] font-label px-1.5 py-0.5 rounded-md"
      style={{ background: config.bg, color: config.color, letterSpacing: "0.06em", fontWeight: 700 }}
    >
      {config.label}
    </span>
  );
}

/** Overflow "⋯" menu for a completed checkpoint row — tucks Edit/Revert away so
 *  they aren't both always on screen (6-Nov follow-up). */
function CheckpointActionsMenu({ onEdit, onRevert, disabled }: { onEdit?: () => void; onRevert?: () => void; disabled?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" title="More actions" className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ color: "var(--t-5)" }}>
          <MoreHorizontal size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[8rem]">
        {onEdit && (
          <DropdownMenuItem onSelect={() => onEdit()} className="gap-2 text-xs">
            <Pencil size={12} /> Edit
          </DropdownMenuItem>
        )}
        {onRevert && (
          <DropdownMenuItem onSelect={() => onRevert()} disabled={disabled} className="gap-2 text-xs" style={{ color: "oklch(0.52 0.16 25)" }}>
            <Undo2 size={12} /> Revert
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PaymentRow({
  payment,
  canCollect,
  isNext = true,
  onCollect,
  onEdit,
  onSetDate,
  onSetAmount,
  onRevert,
  reverting,
  staffById,
}: {
  payment: PaymentRecord;
  projectId: string;
  canCollect: boolean;
  isNext?: boolean;
  onCollect: () => void;
  onEdit?: () => void;
  onSetDate?: (ddmm: string | null) => void;
  onSetAmount?: (amount: number) => void;
  onRevert?: () => void;
  reverting?: boolean;
  staffById?: Record<string, string>;
}) {
  const sc = checkpointStatusConfig[payment.status];
  const isOpen = payment.status !== "completed" && payment.status !== "skipped";
  const isCompleted = payment.status === "completed";
  const [editingAmount, setEditingAmount] = useState(false);
  const audit = checkpointAuditLine({
    createdBy: payment.createdBy,
    createdAt: payment.createdAt,
    actorBy: payment.collectedBy,
    actorVerb: "Collected",
    staffById,
  });
  return (
    <div className="space-y-1">
    <div
      className="rounded-lg px-2.5 py-2 flex items-center justify-between gap-2"
      style={{ background: "var(--s-page)", border: "1px solid var(--b-2)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {payment.status === "completed" ? (
          <Check size={11} style={{ color: sc.color }} />
        ) : payment.status === "in-progress" ? (
          <Clock size={11} style={{ color: sc.color }} />
        ) : payment.status === "overdue" ? (
          <AlertCircle size={11} style={{ color: sc.color }} />
        ) : (
          <Coins size={11} style={{ color: "var(--t-6)" }} />
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-medium truncate" style={{ color: "var(--t-2)" }}>
            {payment.label}
          </p>
          <p className="text-[9px]" style={{ color: "var(--t-5)" }}>
            {payment.status === "completed"
              ? `Collected ${payment.collectedDate} · ${payment.reference || "—"}`
              : payment.notes || "Pending collection"}
          </p>
          {audit && (
            <p className="text-[9px] truncate" style={{ color: "var(--t-6)" }} title={audit}>{audit}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isOpen && onSetDate && (
          <StageDateControl value={payment.dueDate} canEdit={canCollect} onSet={onSetDate} />
        )}
        {editingAmount && isOpen && canCollect && onSetAmount ? (
          <input
            type="number"
            autoFocus
            defaultValue={payment.amount}
            onBlur={(e) => {
              const v = Number(e.currentTarget.value);
              if (Number.isFinite(v) && v >= 0 && v !== payment.amount) onSetAmount(v);
              setEditingAmount(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditingAmount(false);
            }}
            className="w-24 text-[11px] rounded-md px-1.5 py-0.5 text-right"
            style={{ background: "var(--s-2)", border: "1px solid var(--b-strong)", color: "var(--t-1)" }}
          />
        ) : (
          <button
            type="button"
            onClick={() => isOpen && canCollect && onSetAmount && setEditingAmount(true)}
            disabled={!isOpen || !canCollect || !onSetAmount}
            className="text-[11px] font-display font-semibold inline-flex items-center gap-1"
            style={{ color: sc.color, cursor: isOpen && canCollect && onSetAmount ? "pointer" : "default" }}
            title={isOpen && canCollect && onSetAmount ? "Edit amount" : undefined}
          >
            {formatRM(payment.amount)}
            {isOpen && canCollect && onSetAmount && <Pencil size={9} style={{ color: "var(--t-5)" }} />}
          </button>
        )}
        {isCompleted && canCollect && (onEdit || onRevert) && (
          <CheckpointActionsMenu onEdit={onEdit} onRevert={onRevert} disabled={reverting} />
        )}
        {isOpen && canCollect && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={onCollect}
            title={isNext ? undefined : "Not the current step — recording this won't advance the project yet"}
            className="px-2 py-0.5 rounded-md flex items-center gap-1"
            style={{
              background: "oklch(0.55 0.09 145 / 12%)",
              color: "oklch(0.38 0.09 145)",
              border: "1px solid oklch(0.55 0.09 145 / 25%)",
              opacity: isNext ? 1 : 0.45,
            }}
          >
            <Check size={9} strokeWidth={3} />
            <span className="text-[9px] font-label" style={{ letterSpacing: "0.04em", fontWeight: 700 }}>
              COLLECT
            </span>
          </motion.button>
        )}
      </div>
    </div>
    </div>
  );
}

function SignatureRow({
  signature,
  canSign,
  isNext = true,
  onSign,
  onSetDate,
  onRevert,
  reverting,
  staffById,
}: {
  signature: DocumentSignRecord;
  canSign: boolean;
  isNext?: boolean;
  onSign: () => void;
  onSetDate?: (ddmm: string | null) => void;
  onRevert?: () => void;
  reverting?: boolean;
  staffById?: Record<string, string>;
}) {
  const sc = checkpointStatusConfig[signature.status];
  const isOpen = signature.status !== "completed" && signature.status !== "skipped";
  const isCompleted = signature.status === "completed";
  const audit = checkpointAuditLine({
    createdBy: signature.createdBy,
    createdAt: signature.createdAt,
    actorBy: signature.recordedBy,
    actorVerb: "Recorded",
    staffById,
  });
  const hasStoredDoc = isStorageDocRef(signature.documentRef);
  const hasLegacyDoc = !!signature.documentRef && !hasStoredDoc;
  const [viewLoading, setViewLoading] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const isPdf = (signature.documentRef || "").toLowerCase().endsWith(".pdf");
  useEffect(() => {
    if (!docUrl) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDocUrl(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [docUrl]);

  async function handleViewPdf(e: React.MouseEvent) {
    e.stopPropagation();
    if (!signature.documentRef) return;
    if (!hasStoredDoc) {
      toast.info(`Legacy reference: ${signature.documentRef}`);
      return;
    }
    setViewLoading(true);
    try {
      const url = await getSignatureDocUrl(signature.documentRef);
      if (url) {
        setDocUrl(url);
      } else {
        toast.error("Could not open document — link may have expired");
      }
    } finally {
      setViewLoading(false);
    }
  }

  return (
    <div className="mt-2 space-y-1">
    {docUrl && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "oklch(0 0 0 / 0.75)", backdropFilter: "blur(2px)" }} onClick={() => setDocUrl(null)}>
        <div className="relative rounded-xl overflow-hidden shadow-2xl" style={{ background: "#fff", maxWidth: "92vw", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => setDocUrl(null)} aria-label="Close" className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "oklch(0 0 0 / 0.6)" }}>
            <X size={18} className="text-white" />
          </button>
          {isPdf ? (
            <iframe title={signature.label} src={docUrl} style={{ width: "90vw", height: "85vh", border: 0 }} />
          ) : (
            <img src={docUrl} alt={signature.label} style={{ display: "block", maxWidth: "92vw", maxHeight: "90vh", objectFit: "contain" }} />
          )}
        </div>
      </div>
    )}
    <div
      className="rounded-lg px-2.5 py-2 flex items-center justify-between gap-2"
      style={{ background: "var(--s-page)", border: "1px solid var(--b-2)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {signature.status === "completed" ? (
          <Check size={11} style={{ color: sc.color }} />
        ) : signature.status === "in-progress" ? (
          <Clock size={11} style={{ color: sc.color }} />
        ) : (
          <PenSquare size={11} style={{ color: "var(--t-6)" }} />
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-medium truncate" style={{ color: "var(--t-2)" }}>
            {signature.label}
          </p>
          <p className="text-[9px]" style={{ color: "var(--t-5)" }}>
            {signature.status === "completed"
              ? `Signed ${signature.signedDate} · ${signature.signedBy}`
              : signature.notes || "Awaiting client signature"}
          </p>
          {audit && (
            <p className="text-[9px] truncate" style={{ color: "var(--t-6)" }} title={audit}>{audit}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isOpen && onSetDate && (
          <StageDateControl value={signature.estimatedDate} canEdit={canSign} onSet={onSetDate} />
        )}
        {isCompleted && canSign && onRevert && (
          <CheckpointActionsMenu onRevert={onRevert} disabled={reverting} />
        )}
        {(hasStoredDoc || hasLegacyDoc) && (
          <button
            onClick={handleViewPdf}
            disabled={viewLoading}
            className="text-[9px] font-label px-2 py-1 rounded-md flex items-center gap-1"
            style={{
              background: "oklch(0.62 0.09 68 / 10%)",
              color: "var(--acc-ink)",
              letterSpacing: "0.04em",
              opacity: viewLoading ? 0.6 : 1,
            }}
          >
            {viewLoading ? "…" : hasStoredDoc ? "VIEW" : "REF"}
          </button>
        )}
        {isOpen && canSign && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={(e) => {
              e.stopPropagation();
              onSign();
            }}
            title={isNext ? undefined : "Not the current step — recording this won't advance the project yet"}
            className="px-2 py-0.5 rounded-md flex items-center gap-1"
            style={{
              background: signature.group === "contract"
                ? "oklch(0.60 0.10 25 / 12%)"
                : "oklch(0.55 0.09 240 / 12%)",
              color: signature.group === "contract"
                ? "oklch(0.50 0.10 25)"
                : "oklch(0.38 0.09 240)",
              border: signature.group === "contract"
                ? "1px solid oklch(0.50 0.10 25 / 35%)"
                : "1px solid oklch(0.38 0.09 240 / 35%)",
              opacity: isNext ? 1 : 0.45,
            }}
          >
            <Upload size={9} />
            <span className="text-[9px] font-label" style={{ letterSpacing: "0.04em", fontWeight: 700 }}>
              SIGN
            </span>
          </motion.button>
        )}
      </div>
    </div>
    </div>
  );
}

// ─── SharePortalButton ────────────────────────────────────────────────────
// Copies the read-only /portal/:token URL to the clipboard so staff can
// WhatsApp / email it to the client. Falls back to a toast that shows the
// URL when clipboard API isn't available (e.g. older browsers, http://).
function SharePortalButton({ token, clientName, projectId, canManage }: { token: string; clientName: string; projectId: string; canManage: boolean }) {
  const [copied, setCopied] = useState(false);
  const regenerate = useRegenerateClientToken();
  const url = `${window.location.origin}/portal/${token}`;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast.success(`Portal link copied — share with ${clientName}`);
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.info(`Copy this link manually: ${url}`);
      }
    } catch {
      toast.error("Couldn't copy automatically — try long-pressing the URL");
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm("Generate a new portal link? The current link will stop working immediately.")) return;
    try {
      await regenerate.mutateAsync(projectId);
      toast.success("Portal link regenerated — the old link no longer works");
    } catch (err) {
      toast.error(`Couldn't regenerate: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

  return (
    <div className="space-y-1.5">
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={handleCopy}
      className="w-full rounded-2xl p-4 flex items-center justify-between"
      style={{
        background: copied
          ? "linear-gradient(135deg, oklch(0.55 0.09 145 / 8%), oklch(1 0 0))"
          : "linear-gradient(135deg, oklch(0.62 0.09 68 / 6%), oklch(1 0 0))",
        border: copied
          ? "1px solid oklch(0.55 0.09 145 / 30%)"
          : "1px solid oklch(0.62 0.09 68 / 25%)",
        boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)",
      }}
    >
      <div className="text-left min-w-0 flex-1 pr-3">
        <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>
          Share client portal
        </p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--t-5)" }}>
          {copied ? "Link copied to clipboard" : "Read-only progress view — no login needed"}
        </p>
      </div>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: copied ? "oklch(0.55 0.09 145 / 12%)" : "oklch(0.62 0.09 68 / 12%)",
        }}
      >
        {copied ? (
          <Check size={15} style={{ color: "oklch(0.38 0.09 145)" }} />
        ) : (
          <Share2 size={15} style={{ color: "var(--acc)" }} />
        )}
      </div>
    </motion.button>

    {canManage && (
      <button
        onClick={handleRegenerate}
        disabled={regenerate.isPending}
        className="text-[11px] font-label px-1"
        style={{ color: "var(--t-5)", letterSpacing: "0.02em", opacity: regenerate.isPending ? 0.5 : 1 }}
      >
        {regenerate.isPending ? "Regenerating…" : "Regenerate link (if leaked)"}
      </button>
    )}
    </div>
  );
}
