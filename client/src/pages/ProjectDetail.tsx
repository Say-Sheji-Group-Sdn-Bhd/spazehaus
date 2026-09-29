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
import { Upload, UserPlus, CheckSquare, MapPin, Maximize2, Phone, FileText, Receipt, Coins, PenSquare, Check, Clock, AlertCircle, Share2, Plus, Pencil, Trash2, Star, X } from "lucide-react";
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
  type StagePhase,
  type CheckpointStatus,
} from "@/lib/lifecycleData";
import {
  useProject,
  useAllStaff,
  useQuotations,
  useProjectLifecycle,
  canEditPayments,
  canEditSignatures,
  canEditProject,
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
import { toast } from "sonner";

const CARD_BG1 = "/hero/card1.jpg";
const CARD_BG2 = "/hero/card2.jpg";

const tabs = ["Overview", "Lifecycle", "Tasks", "Quotations", "Photos", "Team"];

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
  const canEdit = canEditProject(me?.role);

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

  const handlePhotoPicked = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    const t = new Date();
    const ddmmyyyy = `${String(t.getDate()).padStart(2, "0")}/${String(t.getMonth() + 1).padStart(2, "0")}/${t.getFullYear()}`;
    try {
      await uploadPhoto.mutateAsync({ projectId: project.id, file, photoDate: ddmmyyyy, uploadedById: me?.id });
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : "unknown error"}`);
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

        {/* ── Desktop two-column split: main content left, side rail right ── */}
        <div className="px-4 py-4 lg:px-8 lg:py-7 lg:grid lg:grid-cols-[1fr_360px] lg:gap-6 lg:items-start">

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

                {/* Project Details card — shown inline on mobile, moves to side rail on lg */}
                <div className="rounded-2xl p-4 space-y-3 lg:hidden" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
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
              <LifecycleTab projectId={project.id} clientName={project.client} projectName={project.name} />
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
                  <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:items-start">
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
                        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
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
                                  <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>{q.id}</p>
                                  <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>{q.doc_type} · {q.issue_date}</p>
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
                      <p className="text-xs mt-1" style={{ color: "var(--t-5)" }}>Site progress photos · JPG or PNG</p>
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
                        <SitePhotoThumb key={p.id} photo={p} canDelete={canEdit} onDelete={() => handleDeletePhoto(p)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Team tab */}
            {activeTab === "Team" && (
              <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
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

          {/* ── SIDE RAIL (right column, desktop only) ── */}
          <div className="hidden lg:flex lg:flex-col lg:gap-4">
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
        className="hidden"
        onChange={(e) => { handlePhotoPicked(e.target.files?.[0] ?? null); e.target.value = ""; }}
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

function SitePhotoThumb({ photo, canDelete, onDelete }: { photo: SitePhotoRow; canDelete: boolean; onDelete: () => void }) {
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
    <div className="aspect-square rounded-xl overflow-hidden relative" style={{ background: "var(--s-2)" }}>
      {url && !failed ? (
        <img src={url} alt={dateLabel} className="w-full h-full object-cover" onError={() => setFailed(true)} />
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
                <p className="text-[11px]" style={{ color: "var(--t-5)" }}>Tip: add team members via the Team tab to assign tasks to them.</p>
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

function LifecycleTab({ projectId, clientName, projectName }: { projectId: string; clientName?: string; projectName?: string }) {
  const { data: lc, isLoading } = useProjectLifecycle(projectId);
  const { staff: me } = useAuth();
  const canCollect = canEditPayments(me?.role);
  const canSign = canEditSignatures(me?.role);
  const [collectTarget, setCollectTarget] = useState<MarkCollectedTarget | null>(null);
  const [signTarget, setSignTarget] = useState<SignDocumentTarget | null>(null);
  if (isLoading) {
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

  return (
    <div className="space-y-5">
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
                const status = stageStatus(stage, lc.currentStageId);
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
                          </div>
                          {stage.description && (
                            <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "var(--t-5)" }}>
                              {stage.description}
                            </p>
                          )}
                        </div>
                        <span
                          className="text-[9px] font-label px-2 py-0.5 rounded-full shrink-0"
                          style={{
                            background: checkpointStatusConfig[status].bg,
                            color: checkpointStatusConfig[status].color,
                            border: `1px solid ${checkpointStatusConfig[status].border}`,
                            letterSpacing: "0.04em",
                          }}
                        >
                          {checkpointStatusConfig[status].label}
                        </span>
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
                            />
                          ))}
                        </div>
                      )}

                      {/* Signature detail */}
                      {signature && (
                        <SignatureRow
                          signature={signature}
                          canSign={canSign}
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

function PaymentRow({
  payment,
  canCollect,
  onCollect,
}: {
  payment: PaymentRecord;
  projectId: string;
  canCollect: boolean;
  onCollect: () => void;
}) {
  const sc = checkpointStatusConfig[payment.status];
  const isOpen = payment.status !== "completed" && payment.status !== "skipped";
  return (
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
              : `Due ${payment.dueDate || "TBD"}${payment.notes ? " · " + payment.notes : ""}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <p className="text-[11px] font-display font-semibold" style={{ color: sc.color }}>
          {formatRM(payment.amount)}
        </p>
        {isOpen && canCollect && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={onCollect}
            className="px-2 py-0.5 rounded-md flex items-center gap-1"
            style={{
              background: "oklch(0.55 0.09 145 / 12%)",
              color: "oklch(0.38 0.09 145)",
              border: "1px solid oklch(0.55 0.09 145 / 25%)",
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
  );
}

function SignatureRow({
  signature,
  canSign,
  onSign,
}: {
  signature: DocumentSignRecord;
  canSign: boolean;
  onSign: () => void;
}) {
  const sc = checkpointStatusConfig[signature.status];
  const isOpen = signature.status !== "completed" && signature.status !== "skipped";
  const hasStoredDoc = isStorageDocRef(signature.documentRef);
  const hasLegacyDoc = !!signature.documentRef && !hasStoredDoc;
  const [viewLoading, setViewLoading] = useState(false);

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
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Could not open document — link may have expired");
      }
    } finally {
      setViewLoading(false);
    }
  }

  return (
    <div
      className="mt-2 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2"
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
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
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
