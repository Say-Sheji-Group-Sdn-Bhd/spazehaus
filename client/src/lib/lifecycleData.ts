/*
 * SPAZEHAUS PROJECT LIFECYCLE — Types, constants, and pure helpers
 * Source: 2026 Annual Meeting PDF — Design & Renovation Workflow
 *
 * 29 canonical stages across 5 phases (Inquiry → Design → Pre-Build → Build → Closeout)
 * 5 Payment Collection Checkpoints (① ② ③ ④ ⑤)
 * 6 Document Sign Checkpoints — 3 Contracts + 3 Drawings
 *
 * The historical per-project `projectLifecycles` mock array + its accessor
 * helpers (getLifecycle / getOpenPayments / getOpenSignatures / checkpointSummary)
 * were removed once the app moved to Supabase. The Lifecycle tab, the
 * Checkpoints dashboard, and the cross-project KPIs all read from
 * `useProjectLifecycle()` / `useOpenPayments()` / `useOpenSignatures()` in
 * queries.ts now.
 *
 * What remains here is pure: the 29-stage catalogue, the in-app TypeScript
 * shapes for a lifecycle / payment / signature, palette tokens, and a small
 * set of date helpers (`getToday`, `daysFromToday`, `bucketDate`, etc.)
 * plus the summary helpers consumed by the ProjectDetail Lifecycle tab.
 */

export type StagePhase = "Proposal" | "Design" | "Pre build" | "Renovation" | "Handover";

/**
 * Which side of the Flow 2 two-project split a stage belongs to. Phase 3 stores
 * this as additive metadata on every stage (it does NOT yet scope the catalogue or
 * recompute by side — the single unified flow still runs until Phase 4 splits the
 * project rows). Phase 4 uses it to render each project's own side only.
 */
export type ServiceSide = "Design" | "Renovation";

export type StageType =
  | "milestone"      // generic workflow step
  | "payment"        // payment collection checkpoint
  | "contract-sign"  // formal contract signature (Group A: 3 items)
  | "drawing-sign"   // drawing / selection client sign-off (Group B: 3 items)
  | "loop";          // revision loop (e.g. revised design proposal)

export type PaymentGate = 1 | 2 | 3 | 4 | 5;

export type SignatureKey =
  | "design-contract"
  | "design-commission-contract"
  | "renovation-contract"
  | "reno-commission-contract"
  | "handover"
  | "revised-3d"
  | "material-selection"
  | "2d-shopping";

export type LifecycleStage = {
  id: string;
  order: number;
  label: string;
  type: StageType;
  phase: StagePhase;
  /** Flow 2 side (additive metadata; see {@link ServiceSide}). */
  serviceType?: ServiceSide;
  paymentGate?: PaymentGate;
  signatureKey?: SignatureKey;
  description?: string;
};

/**
 * The full 29-step workflow, in canonical order.
 * Numbering matches the yellow ① ② ③ ④ ⑤ payment circles and
 * the pink/brown ① ② ③ document-sign circles in the PDF.
 *
 * KEEP IN LOCKSTEP with the `lifecycle_stages` table seeded in
 * supabase/migrations/20260513000006_tier1_stage_advancement.sql.
 * That table powers the server-side `maybe_advance_project_stage()`
 * function that auto-advances `projects.current_stage_id` when
 * payment / signature checkpoints flip to completed.
 */
export const LIFECYCLE_STAGES: LifecycleStage[] = [
  // —— PROPOSAL (Design project, ID26) ——
  { id: "new-inquiry",          order: 1,  label: "New Inquiry",                  type: "milestone", phase: "Proposal", serviceType: "Design" },
  { id: "inquiry-form",         order: 2,  label: "Fill In Inquiry Form",         type: "milestone", phase: "Proposal", serviceType: "Design" },
  { id: "showroom-meet",        order: 3,  label: "First Meet-Up",                type: "milestone", phase: "Proposal", serviceType: "Design" },
  { id: "proposal-deposit",     order: 4,  label: "Proposal Deposit Collected",   type: "payment",   phase: "Proposal", serviceType: "Design", paymentGate: 1, description: "Triggers design work" },
  { id: "design-proposal",      order: 5,  label: "Design Proposal",              type: "milestone", phase: "Proposal", serviceType: "Design", description: "Supports multiple revisions, each with an amount" },
  { id: "proposal-meeting",     order: 6,  label: "Design Proposal Meeting",      type: "milestone", phase: "Proposal", serviceType: "Design", description: "Revisions — date + remark note each" },

  // —— DESIGN ——
  { id: "design-contract",      order: 7,  label: "Design Contract Signed",       type: "contract-sign", phase: "Design", serviceType: "Design", signatureKey: "design-contract", description: "Sign + amount · mints SD26" },
  { id: "design-commission-contract", order: 8, label: "Design Commission Contract Signed", type: "contract-sign", phase: "Design", serviceType: "Design", signatureKey: "design-commission-contract", description: "Commission sign-off" },
  { id: "design-progressive-pay", order: 9, label: "Progressive Payment",        type: "milestone", phase: "Design", serviceType: "Design", description: "Design side instalments (Mark as paid)" },
  { id: "storage-handbook",     order: 10, label: "Storage Handbook From Client", type: "milestone", phase: "Design", serviceType: "Design", description: "Optional upload" },
  { id: "revised-3d",           order: 11, label: "3D Design — Signed",           type: "drawing-sign", phase: "Design", serviceType: "Design", signatureKey: "revised-3d", description: "Merged 3D drawing + meeting + revised 3D; multiple submissions" },

  // —— PRE BUILD (design-side deliverables + design closeout) ——
  { id: "reno-quotation",       order: 12, label: "Renovation Quotation",         type: "milestone", phase: "Pre build", serviceType: "Design", description: "Supports multiple revisions" },
  { id: "shopping-list",        order: 13, label: "Shopping List",                type: "milestone", phase: "Pre build", serviceType: "Design", description: "Design side shopping list" },
  { id: "2d-shopping",          order: 14, label: "2D Drawings & Material Board — Signed", type: "drawing-sign", phase: "Pre build", serviceType: "Design", signatureKey: "2d-shopping", description: "Merged material selection + 2D; sign-off kicks off Renovation" },
  { id: "design-site-marking",  order: 15, label: "Site Marking",                 type: "milestone", phase: "Pre build", serviceType: "Design", description: "Design side site marking" },
  { id: "design-contractor-brief", order: 16, label: "Contractor Briefing",       type: "milestone", phase: "Pre build", serviceType: "Design", description: "Design side contractor briefing" },
  { id: "design-completion",    order: 17, label: "Design Project Completion",    type: "milestone", phase: "Pre build", serviceType: "Design", description: "Design side completion" },
  { id: "design-commission-release", order: 18, label: "Design Project Commission Release", type: "milestone", phase: "Pre build", serviceType: "Design", description: "Design side commission release" },

  // —— RENOVATION (renovation project, SR26 — the reno project starts here; no Pre-build) ——
  { id: "reno-contract",        order: 19, label: "Renovation Contract Signed",   type: "contract-sign", phase: "Renovation", serviceType: "Renovation", signatureKey: "renovation-contract", description: "Mints SR26" },
  { id: "reno-commission-contract", order: 20, label: "Renovation Commission Contract Signed", type: "contract-sign", phase: "Renovation", serviceType: "Renovation", signatureKey: "reno-commission-contract" },
  { id: "work-schedule",        order: 21, label: "Site Work Schedule",           type: "milestone", phase: "Renovation", serviceType: "Renovation" },
  { id: "cidb-authority",       order: 22, label: "CIDB / Authority / Insurance", type: "milestone", phase: "Renovation", serviceType: "Renovation", description: "One submission step" },
  { id: "kick-off",             order: 23, label: "Site Marking",                 type: "milestone", phase: "Renovation", serviceType: "Renovation" },
  { id: "contractor-brief",     order: 24, label: "Contractor Briefing Meeting",  type: "milestone", phase: "Renovation", serviceType: "Renovation" },
  { id: "project-po",           order: 25, label: "Project PO",                   type: "milestone", phase: "Renovation", serviceType: "Renovation", description: "Confirm within 2 weeks" },
  { id: "site-inspection",      order: 26, label: "Site Inspection",              type: "milestone", phase: "Renovation", serviceType: "Renovation", description: "Multiple inspections" },
  { id: "site-report",          order: 27, label: "Site Report",                  type: "milestone", phase: "Renovation", serviceType: "Renovation", description: "To client before each payment" },
  { id: "progressive-pay",      order: 28, label: "Progressive Payment",          type: "payment",   phase: "Renovation", serviceType: "Renovation", paymentGate: 4, description: "Repeating; staff-entered amounts" },

  // —— HANDOVER ——
  { id: "site-completed",       order: 29, label: "Client Site Inspection",       type: "milestone", phase: "Handover", serviceType: "Renovation" },
  { id: "furniture-delivery",   order: 30, label: "Supplier Delivery & Installation", type: "milestone", phase: "Handover", serviceType: "Renovation" },
  { id: "handover",             order: 31, label: "Handover Document / As-Built Drawings — Signed", type: "contract-sign", phase: "Handover", serviceType: "Renovation", signatureKey: "handover", description: "Client-signed; issue as-built early" },
  { id: "handover-meeting",     order: 32, label: "Handover Meeting",             type: "milestone", phase: "Handover", serviceType: "Renovation" },
  { id: "final-payment",        order: 33, label: "Final Payment",                type: "payment",   phase: "Handover", serviceType: "Renovation", paymentGate: 5 },
  { id: "project-statement-review", order: 34, label: "Project Statement Review", type: "milestone", phase: "Handover", serviceType: "Renovation" },
  { id: "completion",           order: 35, label: "Renovation Project Completion", type: "milestone", phase: "Handover", serviceType: "Renovation" },
  { id: "reno-commission-release", order: 36, label: "Renovation Project Commission Release", type: "milestone", phase: "Handover", serviceType: "Renovation", description: "Commission released to the renovation team" },
  { id: "defect-period",        order: 37, label: "Warranty Follow-Up",           type: "milestone", phase: "Handover", serviceType: "Renovation", description: "Free-form follow-up dates" },
];

// —————————————————————————————————————————————————————————————
// Per-project lifecycle state — in-app TypeScript shapes
// Live row mapping happens in queries.ts via `useProjectLifecycle()`.
// —————————————————————————————————————————————————————————————

export type CheckpointStatus = "completed" | "in-progress" | "pending" | "overdue" | "skipped" | "refer" | "not-yet";

/**
 * The MANUAL status a staff member sets on every stage after "New Inquiry"
 * (supervisor review, 7 Nov 2026). This is the subset of CheckpointStatus that
 * the stored `project_stage_dates.status` column can hold — stages no longer
 * auto-complete from a payment/signature; staff drive each stage's status.
 */
export type ManualStageStatus = "completed" | "pending" | "refer" | "not-yet";

/** The four manual statuses, in the order shown in the selector. */
export const MANUAL_STAGE_STATUSES: readonly ManualStageStatus[] = [
  "completed",
  "pending",
  "refer",
  "not-yet",
] as const;

export type PaymentRecord = {
  gate: PaymentGate;
  label: string;
  amount: number;            // RM
  status: CheckpointStatus;
  dueDate?: string;          // DD/MM/YYYY
  collectedDate?: string;
  reference?: string;        // bank ref / receipt no
  instalment?: number;       // for gate 4 progressive payments
  ofInstalments?: number;
  notes?: string;
};

export type DocumentSignRecord = {
  key: SignatureKey;
  label: string;
  group: "contract" | "drawing";
  status: CheckpointStatus;
  signedDate?: string;
  signedBy?: string;        // client name
  documentRef?: string;     // file ref
  notes?: string;
};

export type ProjectLifecycle = {
  projectId: string;
  currentStageId: string;
  startedAt: string;        // DD/MM/YYYY
  payments: PaymentRecord[];
  signatures: DocumentSignRecord[];
};

/**
 * Helpers to look up stage metadata.
 */
export const stageById = (id: string) => LIFECYCLE_STAGES.find((s) => s.id === id);
export const stageOrder = (id: string) => stageById(id)?.order ?? 0;

/**
 * Phase color tokens (matches the existing warm-gold palette).
 */
export const phaseColors: Record<StagePhase, { color: string; bg: string; border: string }> = {
  "Proposal":   { color: "oklch(0.45 0.10 55)",  bg: "oklch(0.65 0.10 55 / 10%)",  border: "oklch(0.65 0.10 55 / 25%)" },
  "Design":     { color: "oklch(0.42 0.09 68)",  bg: "oklch(0.62 0.09 68 / 10%)",  border: "oklch(0.62 0.09 68 / 25%)" },
  "Pre build":  { color: "oklch(0.38 0.09 240)", bg: "oklch(0.55 0.09 240 / 10%)", border: "oklch(0.55 0.09 240 / 25%)" },
  "Renovation": { color: "oklch(0.50 0.10 25)",  bg: "oklch(0.60 0.10 25 / 10%)",  border: "oklch(0.60 0.10 25 / 25%)" },
  "Handover":   { color: "oklch(0.38 0.09 145)", bg: "oklch(0.55 0.09 145 / 10%)", border: "oklch(0.55 0.09 145 / 25%)" },
};

export const checkpointStatusConfig: Record<CheckpointStatus, { label: string; color: string; bg: string; border: string }> = {
  completed:    { label: "Completed",   color: "oklch(0.38 0.09 145)", bg: "oklch(0.55 0.09 145 / 12%)", border: "oklch(0.55 0.09 145 / 25%)" },
  "in-progress":{ label: "In Progress", color: "oklch(0.38 0.09 240)", bg: "oklch(0.55 0.09 240 / 12%)", border: "oklch(0.55 0.09 240 / 25%)" },
  pending:      { label: "Pending",     color: "oklch(0.42 0.09 68)",  bg: "oklch(0.62 0.09 68 / 12%)",  border: "oklch(0.62 0.09 68 / 25%)" },
  overdue:      { label: "Overdue",     color: "oklch(0.50 0.12 25)",  bg: "oklch(0.60 0.12 25 / 12%)",  border: "oklch(0.60 0.12 25 / 25%)" },
  skipped:      { label: "Skipped",     color: "oklch(0.55 0.006 80)", bg: "oklch(0.55 0.006 80 / 12%)", border: "oklch(0.55 0.006 80 / 25%)" },
  refer:        { label: "Refer",       color: "oklch(0.45 0.13 285)", bg: "oklch(0.58 0.13 285 / 12%)", border: "oklch(0.58 0.13 285 / 28%)" },
  "not-yet":    { label: "Not Yet",     color: "oklch(0.50 0.015 60)", bg: "oklch(0.60 0.015 60 / 14%)", border: "oklch(0.55 0.015 60 / 28%)" },
};

// —————————————————————————————————————————————————————————————
// Per-lifecycle aggregation helpers — consumed by ProjectDetail Lifecycle tab
// —————————————————————————————————————————————————————————————

export function paymentSummary(lc: ProjectLifecycle) {
  const collected = lc.payments
    .filter((p) => p.status === "completed")
    .reduce((s, p) => s + p.amount, 0);
  const outstanding = lc.payments
    .filter((p) => p.status !== "completed" && p.status !== "skipped")
    .reduce((s, p) => s + p.amount, 0);
  const total = collected + outstanding;
  return { collected, outstanding, total, pct: total === 0 ? 0 : Math.round((collected / total) * 100) };
}

export function signatureSummary(lc: ProjectLifecycle) {
  const signed = lc.signatures.filter((s) => s.status === "completed").length;
  const total = lc.signatures.length;
  const pending = total - signed;
  return { signed, pending, total, pct: total === 0 ? 0 : Math.round((signed / total) * 100) };
}

/**
 * Resolve the *displayed* status for a stage from the MANUAL per-stage status
 * map (supervisor review, 7 Nov 2026 — stages no longer auto-complete).
 *
 * "New Inquiry" (the first stage) is always implicitly Completed and carries no
 * selector. Every other stage shows the status staff set; a stage with no stored
 * status yet defaults to "pending".
 */
export function stageStatus(
  stage: LifecycleStage,
  statusMap: Record<string, ManualStageStatus>,
): CheckpointStatus {
  if (stage.id === "new-inquiry") return "completed";
  return statusMap[stage.id] ?? "pending";
}

// —————————————————————————————————————————————————————————————
// Date helpers — used by Checkpoints buckets + queries.ts
// —————————————————————————————————————————————————————————————

/**
 * "Today" anchor for all relative-date logic (overdue / due-this-week buckets,
 * gantt today-line, photo grids).
 *
 * Returns the current Date on every call so a long-running SPA tab stays
 * accurate across midnight. Override via `VITE_TODAY_OVERRIDE=YYYY-MM-DD`
 * (build-time) for screenshots, demos, or deterministic tests — when unset,
 * tracks real wall-clock time.
 */
export function getToday(): Date {
  const override = import.meta.env?.VITE_TODAY_OVERRIDE;
  if (typeof override === "string" && /^\d{4}-\d{2}-\d{2}$/.test(override)) {
    const [y, m, d] = override.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  // Normalize to LOCAL midnight. `new Date()` carries the time-of-day, while
  // parseDDMMYYYY returns midnight — so a date due *today* would compute to a
  // fraction of a day and floor to -1 (= "overdue"). The override branch
  // already returns midnight, which is why this bug never showed in test mode.
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/** Parse a Spazehaus DD/MM/YYYY date string into a Date. Returns null for "TBD" / invalid. */
function parseDDMMYYYY(s: string | undefined): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(parseInt(yyyy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
}

/** Days from today to a date string. Negative = overdue. Null if undated. */
export function daysFromToday(dateStr: string | undefined, today: Date = getToday()): number | null {
  const d = parseDDMMYYYY(dateStr);
  if (!d) return null;
  const ms = d.getTime() - today.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export type DueBucket = "overdue" | "this-week" | "this-month" | "later" | "no-date";

/** Bucket a due date relative to today. */
export function bucketDate(dateStr: string | undefined, today: Date = getToday()): DueBucket {
  const days = daysFromToday(dateStr, today);
  if (days === null) return "no-date";
  if (days < 0) return "overdue";
  if (days <= 7) return "this-week";
  if (days <= 30) return "this-month";
  return "later";
}

/** Compute the effective status — promotes "pending"/"in-progress" to "overdue" if the date has passed. */
export function effectivePaymentStatus(p: PaymentRecord, today: Date = getToday()): CheckpointStatus {
  if (p.status === "completed" || p.status === "skipped" || p.status === "overdue") return p.status;
  const days = daysFromToday(p.dueDate, today);
  if (days !== null && days < 0) return "overdue";
  return p.status;
}

export const bucketLabel: Record<DueBucket, string> = {
  overdue: "OVERDUE",
  "this-week": "DUE THIS WEEK",
  "this-month": "DUE THIS MONTH",
  later: "LATER",
  "no-date": "NO DATE SET",
};

export const bucketTone: Record<DueBucket, { color: string; bg: string }> = {
  overdue:      { color: "oklch(0.50 0.12 25)",  bg: "oklch(0.60 0.12 25 / 8%)" },
  "this-week":  { color: "oklch(0.45 0.10 55)",  bg: "oklch(0.65 0.10 55 / 8%)" },
  "this-month": { color: "oklch(0.42 0.09 68)",  bg: "oklch(0.62 0.09 68 / 8%)" },
  later:        { color: "oklch(0.38 0.09 240)", bg: "oklch(0.55 0.09 240 / 8%)" },
  "no-date":    { color: "oklch(0.55 0.006 80)", bg: "oklch(0.55 0.006 80 / 8%)" },
};
