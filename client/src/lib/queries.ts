/*
 * SPAZEHAUS — Supabase data hooks
 *
 * Every page that used to read from `lib/mockData.ts` / `customerData.ts` /
 * `lifecycleData.ts` / `quotationData.ts` now reads from these hooks instead.
 *
 * Each hook:
 *   • Queries Supabase via the auth-scoped client
 *   • Maps the snake_case DB rows into the camelCase shapes the UI expects
 *   • Returns the same field names the mocks used, so component diffs are minimal
 *
 * Mutations invalidate the query keys they touch, so the UI auto-refreshes.
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  ProjectRow,
  PaymentRecordRow,
  SignatureRecordRow,
  InquiryRow,
  StaffRow,
  QuotationRow,
  QuotationItemRow,
  LeaveRequestRow,
  LeaveStatus,
  CandidateRow,
  AnnouncementRow,
  SitePhotoRow,
  SalesTargetRow,
  CalendarEventRow,
  CalendarEventStaffRow,
  CalendarEventType,
  KpiRecordRow,
  AuditLogRow,
  AuditAction,
  ContactLogEntryDb,
  ProjectTaskRow,
  ProjectReviewRow,
  SpacologyResultRow,
  SpacologyAnswer,
  SpacologyScores,
  SpaceType,
  CustomerCategory,
  CustomerTier,
  InquiryStage,
} from "@/lib/dbTypes";
import type { TablesUpdate, TablesInsert } from "@/lib/database.types";
import type { PaymentGate, SignatureKey } from "@/lib/lifecycleData";
import type { LineItem } from "@/lib/quotationData";

// ─── DATE HELPERS ───────────────────────────────────────────────────────────
// DB stores YYYY-MM-DD; the UI was built around DD/MM/YYYY (Spazehaus convention).
// We map at the query boundary so components don't change.

function isoToDDMMYYYY(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function ddmmyyyyToIso(s: string): string | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// ─── APP-SHAPE TYPES ────────────────────────────────────────────────────────
// These mirror the shapes the UI components were built against (from mockData.ts).

export type Project = {
  id: string;
  name: string;
  client: string;
  clientContact: string;
  clientEmail?: string;
  type: string;
  propertyType: string;
  serviceType: string | null;  // "Design" | "Renovation" — drives the SD/SR project code
  projectCode: string | null;  // e.g. SD26-801 / SR26-801 (client-facing number; id stays PRJ0xx)
  location: string;
  size: number;
  budget: number;
  startDate: string;
  targetDate: string;
  status: string;
  priority: string;
  progress: number;
  designer: string;            // resolved name (joined from staff)
  designerId?: string;         // raw staff id (for the full roster)
  pm: string;                  // resolved name
  pmId?: string;               // raw staff id (for the full roster)
  team: string[];              // avatar codes
  heroImage?: string;          // public URL of the uploaded cover (undefined → use default)
  photoCount: number;
  taskCount: number;
  tasksCompleted: number;
  areas: string[];
  description: string;
  currentStageId: string | null;
  lifecycleStartedAt: string | null;
  clientAccessToken: string;   // UUID for the read-only /portal/:token route
};

export type PaymentRecord = {
  id: number;
  gate: 1 | 2 | 3 | 4 | 5;
  label: string;
  amount: number;
  status: PaymentRecordRow["status"];
  dueDate?: string;
  collectedDate?: string;
  reference?: string;
  instalment?: number;
  ofInstalments?: number;
  notes?: string;
};

export type DocumentSignRecord = {
  id: number;
  key: SignatureKey;
  label: string;
  group: "contract" | "drawing";
  status: SignatureRecordRow["status"];
  signedDate?: string;
  signedBy?: string;
  documentRef?: string;
  notes?: string;
};

export type ProjectLifecycle = {
  projectId: string;
  currentStageId: string;
  startedAt: string;
  payments: PaymentRecord[];
  signatures: DocumentSignRecord[];
};

// Re-export Inquiry / Staff shapes (close-enough to the existing mock types).
// `contact_log` is JSONB at the DB level (typed as `Json` in database.types.ts)
// but every row in the wild is an array of ContactLogEntryDb. Narrow at the app
// boundary so the UI doesn't have to cast on every read.
export type Inquiry = Omit<InquiryRow, "contact_log"> & {
  contact_log: ContactLogEntryDb[];
  // Aliases so the existing UI keeps working without per-component rewrites
  date: string;
  client: string;
  estimatedSize?: number;
  estimatedBudget?: number;
  assignedTo?: string;            // staff avatar code (resolved) — display only
  assignedToId?: string;          // staff id — stable key for attribution
  awardedProjectId?: string;
  awardedDate?: string;
  rejectedDate?: string;
  rejectionReason?: string;
  lastUpdated: string;
  propertyType: string;
  contactLog: ContactLogEntryDb[];
};

export type Staff = StaffRow;

// ─── ROW → APP-SHAPE MAPPERS ────────────────────────────────────────────────

type ProjectWithStaffJoin = ProjectRow & {
  designer: { id: string; name: string; avatar_code: string } | null;
  pm: { id: string; name: string; avatar_code: string } | null;
};

function mapProject(row: ProjectWithStaffJoin): Project {
  return {
    id: row.id,
    name: row.name,
    client: row.client_name,
    clientContact: row.client_contact ?? "",
    clientEmail: row.client_email ?? undefined,
    type: row.project_type,
    propertyType: row.property_type,
    serviceType: row.service_type ?? null,
    projectCode: row.project_code ?? null,
    location: row.location,
    size: row.size_sqft,
    budget: Number(row.budget),
    startDate: isoToDDMMYYYY(row.start_date),
    targetDate: isoToDDMMYYYY(row.target_date),
    status: row.status,
    priority: row.priority,
    progress: row.progress,
    designer: row.designer?.name ?? "",
    designerId: row.designer?.id ?? undefined,
    pm: row.pm?.name ?? "",
    pmId: row.pm?.id ?? undefined,
    team: row.team ?? [],
    heroImage: row.image_path
      ? supabase.storage.from("project-images").getPublicUrl(row.image_path).data.publicUrl
      : undefined,
    photoCount: row.photo_count,
    taskCount: row.task_count,
    tasksCompleted: row.tasks_completed,
    areas: row.areas ?? [],
    description: row.description ?? "",
    currentStageId: row.current_stage_id,
    lifecycleStartedAt: row.lifecycle_started_at,
    clientAccessToken: row.client_access_token,
  };
}

function mapPayment(row: PaymentRecordRow): PaymentRecord {
  return {
    id: row.id,
    // DB-level CHECK constraint enforces gate ∈ [1..5]; PostgREST schema
    // introspection widens to `number`. Cast at the boundary.
    gate: row.gate as PaymentGate,
    label: row.label,
    amount: Number(row.amount),
    status: row.status,
    dueDate: isoToDDMMYYYY(row.due_date) || undefined,
    collectedDate: isoToDDMMYYYY(row.collected_date) || undefined,
    reference: row.reference ?? undefined,
    instalment: row.instalment ?? undefined,
    ofInstalments: row.of_instalments ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function mapSignature(row: SignatureRecordRow): DocumentSignRecord {
  return {
    id: row.id,
    key: row.signature_key as SignatureKey,
    label: row.label,
    // DB-level CHECK constraint enforces group_name ∈ {contract, drawing};
    // PostgREST widens to `string`. Cast at the boundary.
    group: row.group_name as "contract" | "drawing",
    status: row.status,
    signedDate: isoToDDMMYYYY(row.signed_date) || undefined,
    signedBy: row.signed_by ?? undefined,
    documentRef: row.document_ref ?? undefined,
    notes: row.notes ?? undefined,
  };
}

function mapInquiry(row: InquiryRow, staffById: Map<string, StaffRow>): Inquiry {
  const assignedAvatar = row.assigned_to_id ? staffById.get(row.assigned_to_id)?.avatar_code : undefined;
  // `contact_log` is JSONB on the wire — narrow it here once.
  const contactLog = (row.contact_log ?? []) as ContactLogEntryDb[];
  return {
    ...row,
    date: isoToDDMMYYYY(row.inquiry_date),
    client: row.client_name,
    propertyType: row.property_type,
    estimatedSize: row.estimated_size ?? undefined,
    estimatedBudget: row.estimated_budget ?? undefined,
    assignedTo: assignedAvatar,
    assignedToId: row.assigned_to_id ?? undefined,
    awardedProjectId: row.awarded_project_id ?? undefined,
    awardedDate: isoToDDMMYYYY(row.awarded_date) || undefined,
    rejectedDate: isoToDDMMYYYY(row.rejected_date) || undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    lastUpdated: isoToDDMMYYYY(row.last_updated),
    contact_log: contactLog,
    contactLog,
  };
}

// ─── QUERY KEYS ─────────────────────────────────────────────────────────────

export const qk = {
  staff: ["staff"] as const,
  staffOne: (id: string) => ["staff", id] as const,
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  projectLifecycle: (id: string) => ["projects", id, "lifecycle"] as const,
  projectTasks: (id: string) => ["project_tasks", id] as const,
  projectReviews: (id: string) => ["project_reviews", id] as const,
  openPayments: ["payments", "open"] as const,
  openSignatures: ["signatures", "open"] as const,
  inquiries: ["inquiries"] as const,
  inquiry: (id: string) => ["inquiries", id] as const,
  quotations: ["quotations"] as const,
  quotation: (id: string) => ["quotations", id] as const,
  leaveRequests: ["leave_requests"] as const,
  candidates: ["candidates"] as const,
  announcements: ["announcements"] as const,
  salesTargets: ["sales_targets"] as const,
  kpiRecords: ["kpi_records"] as const,
  staffKpi: (id: string) => ["kpi_records", id] as const,
  calendarEvents: ["calendar_events"] as const,
  calendarEventStaff: ["calendar_event_staff"] as const,
  notificationPrefs: (staffId: string) => ["notification_preferences", staffId] as const,
  sitePhotos: ["site_photos"] as const,
  projectSitePhotos: (id: string) => ["site_photos", id] as const,
  auditLog: (filters?: AuditLogFilters) => ["audit_log", filters ?? {}] as const,
  spacologyResults: ["spacology_results"] as const,
};

// ─── AUDIT LOG ──────────────────────────────────────────────────────────────

export type AuditLogFilters = {
  table?: string;                     // exact table_name match
  action?: AuditAction;               // INSERT / UPDATE / DELETE
  daysBack?: number;                  // limit to events in the last N days
  pageSize?: number;                  // default 50, hard-capped at 200 per page
  rowId?: string;                     // exact row_id match (e.g. PRJ001)
};

/** One page of audit entries — `nextCursor` is the id of the oldest row in this
 *  page when the page was full (more results exist), or null when the page came
 *  back short (we've reached the end). Pagination is keyset on `audit_log.id`
 *  which is bigserial + monotonically increasing, so cursoring on id desc gives
 *  the same order as `changed_at desc` without any tie-breaker complexity. */
export type AuditLogPage = {
  entries: AuditEntry[];
  nextCursor: number | null;
};

// ─── STAFF ──────────────────────────────────────────────────────────────────

export function useAllStaff() {
  return useQuery({
    queryKey: qk.staff,
    queryFn: async (): Promise<StaffRow[]> => {
      const { data, error } = await supabase.from("staff").select("*").order("id");
      if (error) throw error;
      return (data ?? []) as StaffRow[];
    },
  });
}

// ─── PROJECTS ───────────────────────────────────────────────────────────────

/**
 * Resolve a project's `team` tokens to staff rows. Tolerant of BOTH the new
 * `staff.id` format and the legacy `avatar_code` format, so existing rows keep
 * working. Each token maps to exactly ONE staff member (id match preferred),
 * results de-duped, order preserved.
 */
export function resolveTeamMembers(team: string[] | null | undefined, staff: StaffRow[]): StaffRow[] {
  if (!team || team.length === 0) return [];
  const byId = new Map(staff.map((s) => [s.id, s]));
  const byCode = new Map<string, StaffRow>();
  for (const s of staff) if (!byCode.has(s.avatar_code)) byCode.set(s.avatar_code, s);
  const seen = new Set<string>();
  const out: StaffRow[] = [];
  for (const token of team) {
    const member = byId.get(token) ?? byCode.get(token);
    if (member && !seen.has(member.id)) {
      seen.add(member.id);
      out.push(member);
    }
  }
  return out;
}

export type ProjectRosterRole = "Lead Designer" | "PM" | "Team";
export type ProjectRosterMember = { staff: StaffRow; role: ProjectRosterRole };

/**
 * The FULL people-on-this-project roster — single source of truth for every
 * "team" view. `project.team` alone only holds the *extra* members; the Lead
 * Designer (`designerId`) and PM (`pmId`) live in their own columns and were
 * previously invisible on cards / dropdowns. Merges all three, designer + PM
 * first, then team, deduped + order-preserved.
 */
export function resolveProjectRoster(
  project: Pick<Project, "team" | "designerId" | "pmId">,
  staff: StaffRow[],
): ProjectRosterMember[] {
  const seen = new Set<string>();
  const out: ProjectRosterMember[] = [];
  const push = (s: StaffRow | undefined, role: ProjectRosterRole) => {
    if (!s || seen.has(s.id)) return;
    seen.add(s.id);
    out.push({ staff: s, role });
  };
  push(staff.find((s) => s.id === project.designerId), "Lead Designer");
  push(staff.find((s) => s.id === project.pmId), "PM");
  resolveTeamMembers(project.team, staff).forEach((m) => push(m, "Team"));
  return out;
}

const PROJECT_SELECT = `
  *,
  designer:staff!projects_designer_id_fkey(id,name,avatar_code),
  pm:staff!projects_pm_id_fkey(id,name,avatar_code)
`;

export function useProjects() {
  return useQuery({
    queryKey: qk.projects,
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select(PROJECT_SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as ProjectWithStaffJoin[]).map(mapProject);
    },
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: qk.project(id ?? ""),
    enabled: Boolean(id),
    queryFn: async (): Promise<Project | null> => {
      // `enabled: Boolean(id)` guarantees id is defined here — TS doesn't infer
      // that across the closure, so pin it.
      const safeId = id ?? "";
      const { data, error } = await supabase
        .from("projects")
        .select(PROJECT_SELECT)
        .eq("id", safeId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapProject(data as unknown as ProjectWithStaffJoin) : null;
    },
  });
}

/** Editable project-metadata fields (camelCase, mirroring the app `Project` shape).
 *  Only keys that are present are written — derived/system columns (progress,
 *  counts, current_stage_id, client_access_token) are intentionally absent. */
export type UpdateProjectArgs = {
  id: string;
  name?: string;
  client?: string;                       // → client_name
  clientContact?: string | null;         // → client_contact
  clientEmail?: string | null;           // → client_email
  location?: string;
  size?: number;                         // → size_sqft
  budget?: number;
  status?: ProjectRow["status"];
  priority?: ProjectRow["priority"];
  type?: string;                         // → project_type
  propertyType?: string;                 // → property_type
  description?: string | null;
  startDate?: string;                    // DD/MM/YYYY → start_date
  targetDate?: string;                   // DD/MM/YYYY → target_date
};

/** Update editable project metadata. Gated server-side by the Phase 0D
 *  `projects_write_ops` RLS policy to the OPS tier — see `canEditProject`. */
export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpdateProjectArgs): Promise<ProjectRow> => {
      const payload: TablesUpdate<"projects"> = {};
      if (args.name !== undefined) payload.name = args.name;
      if (args.client !== undefined) payload.client_name = args.client;
      if (args.clientContact !== undefined) payload.client_contact = args.clientContact;
      if (args.clientEmail !== undefined) payload.client_email = args.clientEmail;
      if (args.location !== undefined) payload.location = args.location;
      if (args.size !== undefined) payload.size_sqft = args.size;
      if (args.budget !== undefined) payload.budget = args.budget;
      if (args.status !== undefined) payload.status = args.status;
      if (args.priority !== undefined) payload.priority = args.priority;
      if (args.type !== undefined) payload.project_type = args.type;
      if (args.propertyType !== undefined) payload.property_type = args.propertyType;
      if (args.description !== undefined) payload.description = args.description;
      if (args.startDate !== undefined) payload.start_date = args.startDate ? ddmmyyyyToIso(args.startDate) : null;
      if (args.targetDate !== undefined) payload.target_date = args.targetDate ? ddmmyyyyToIso(args.targetDate) : null;

      const { data, error } = await supabase
        .from("projects")
        .update(payload)
        .eq("id", args.id)
        .select()
        .single();
      if (error) throw error;
      return data as ProjectRow;
    },
    onSuccess: (_row, args) => {
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.project(args.id) });
    },
  });
}

/** Fields captured by the New Project wizard (CreateProject.tsx). */
export type CreateProjectArgs = {
  name: string;
  client: string;                  // → client_name
  clientContact?: string | null;
  clientEmail?: string | null;
  type: string;                    // → project_type
  propertyType: string;
  serviceType: "Design" | "Renovation"; // → service_type; picks the SD/SR project code
  location: string;
  size?: number;                   // → size_sqft (NOT NULL → default 0)
  budget?: number;                 // NOT NULL → default 0
  startDate?: string | null;       // DD/MM/YYYY
  targetDate?: string | null;      // DD/MM/YYYY
  areas?: string[];
  description?: string | null;
  linkInquiryId?: string | null;   // optional: link back to a customer/inquiry (sets awarded_project_id)
  imageFile?: File | null;         // optional cover image → project-images bucket; empty = default
};

/** Create a brand-new project from the wizard. Server-side gating: the
 *  `projects_write_admin_or_ops` RLS policy means only the OPS tier can insert.
 *  Like staff, the `PRJ###` id isn't DB-generated — we compute the next one from
 *  the current max and retry on a unique-violation (concurrent-create race).
 *  New projects start at the first lifecycle stage (`new-inquiry`); payment and
 *  signature scaffolding is added later (the convert-from-inquiry flow seeds
 *  those up front, a blank create does not). */
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateProjectArgs): Promise<ProjectRow> => {
      const { data: existing, error: listErr } = await supabase.from("projects").select("id, project_code");
      if (listErr) throw listErr;
      const maxNum = (existing ?? []).reduce((max, r) => {
        const m = /^PRJ(\d+)$/.exec(r.id);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);

      // Client-facing code: SD (Design) / SR (Renovation) + 2-digit year + seq from 801.
      const CODE_START = 801;
      const codePrefix = `${args.serviceType === "Design" ? "SD" : "SR"}${String(new Date().getFullYear() % 100).padStart(2, "0")}-`;
      const maxCode = (existing ?? []).reduce((max, r) => {
        if (!r.project_code?.startsWith(codePrefix)) return max;
        const n = Number(r.project_code.slice(codePrefix.length));
        return Number.isNaN(n) ? max : Math.max(max, n);
      }, CODE_START - 1);

      const base: Omit<TablesInsert<"projects">, "id"> = {
        name: args.name,
        client_name: args.client,
        client_contact: args.clientContact ?? null,
        client_email: args.clientEmail ?? null,
        project_type: args.type,
        property_type: args.propertyType,
        service_type: args.serviceType,
        location: args.location,
        size_sqft: args.size ?? 0,
        budget: args.budget ?? 0,
        start_date: args.startDate ? ddmmyyyyToIso(args.startDate) : null,
        target_date: args.targetDate ? ddmmyyyyToIso(args.targetDate) : null,
        status: "assigned",
        priority: "medium",
        areas: args.areas ?? [],
        description: args.description ?? null,
        current_stage_id: "new-inquiry",
        lifecycle_started_at: new Date().toISOString(),
      };

      let created: ProjectRow | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const id = `PRJ${String(maxNum + 1 + attempt).padStart(3, "0")}`;
        const project_code = `${codePrefix}${String(maxCode + 1 + attempt).padStart(3, "0")}`;
        const { data, error } = await supabase
          .from("projects")
          .insert({ ...base, id, project_code })
          .select()
          .single();
        if (!error) { created = data as ProjectRow; break; }
        if (error.code !== "23505") throw error; // 23505 = unique_violation → next id
      }
      if (!created) {
        throw new Error("Could not allocate a unique project id after several attempts. Please retry.");
      }

      // Optional cover image — upload now that we have the id, then patch image_path.
      // Non-fatal: if the upload fails the project still exists and the app falls
      // back to the built-in default cover.
      if (args.imageFile) {
        const ext = args.imageFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${created.id}/cover-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("project-images")
          .upload(path, args.imageFile, { upsert: true, contentType: args.imageFile.type });
        if (!upErr) {
          const { data: upd } = await supabase
            .from("projects")
            .update({ image_path: path })
            .eq("id", created.id)
            .select()
            .single();
          if (upd) created = upd as ProjectRow;
        }
      }

      // Optional CRM link: mark the source customer/inquiry as awarded and point
      // it at this project so the customer page shows the "AWARDED PROJECT" banner.
      // Non-fatal: the project already exists even if the back-link fails.
      if (args.linkInquiryId) {
        await supabase
          .from("inquiries")
          .update({
            awarded_project_id: created.id,
            stage: "awarded",
            awarded_date: new Date().toISOString().slice(0, 10),
            last_updated: new Date().toISOString().slice(0, 10),
          })
          .eq("id", args.linkInquiryId);
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.inquiries });
    },
  });
}

/** Returns true when the role may edit project metadata — OPS tier, same as
 *  the payment/signature write gate (`canEditPayments`). */
export const canEditProject = canEditPayments;

// ─── PROJECT TASKS ──────────────────────────────────────────────────────────

export type ProjectTaskStatus = "pending" | "in-progress" | "completed";

/** All tasks for one project, ordered by sort_order then creation. */
export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: qk.projectTasks(projectId ?? ""),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<ProjectTaskRow[]> => {
      const { data, error } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId ?? "")
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as ProjectTaskRow[];
    },
  });
}

export type CreateTaskArgs = {
  projectId: string;
  title: string;
  area?: string | null;
  status?: ProjectTaskStatus;
  assigneeId?: string | null;
  dueDate?: string | null;      // YYYY-MM-DD
  sortOrder?: number;
  createdBy?: string | null;
};

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateTaskArgs): Promise<ProjectTaskRow> => {
      const base: Omit<TablesInsert<"project_tasks">, "id"> = {
        project_id: args.projectId,
        title: args.title.trim(),
        area: args.area?.trim() || null,
        status: args.status ?? "pending",
        assignee_id: args.assigneeId || null,
        due_date: args.dueDate || null,
        sort_order: args.sortOrder ?? 0,
        created_by: args.createdBy || null,
      };
      for (let attempt = 0; attempt < 5; attempt++) {
        const id = `TSK-${Date.now().toString(36)}${attempt}`;
        const { data, error } = await supabase.from("project_tasks").insert({ ...base, id }).select().single();
        if (!error) return data as ProjectTaskRow;
        if (error.code !== "23505") throw error;
      }
      throw new Error("Could not create the task. Please retry.");
    },
    onSuccess: (_row, args) => {
      qc.invalidateQueries({ queryKey: qk.projectTasks(args.projectId) });
      // Task counts roll up onto the project row (20260710000004 trigger) — refresh
      // the project list/dashboard cards + detail so X/Y tasks & progress stay in sync.
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.project(args.projectId) });
    },
  });
}

export type UpdateTaskArgs = {
  id: string;
  projectId: string;            // for cache invalidation
  title?: string;
  area?: string | null;
  status?: ProjectTaskStatus;
  assigneeId?: string | null;
  dueDate?: string | null;
};

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpdateTaskArgs): Promise<void> => {
      const patch: TablesUpdate<"project_tasks"> = {};
      if (args.title !== undefined) patch.title = args.title.trim();
      if (args.area !== undefined) patch.area = args.area?.trim() || null;
      if (args.status !== undefined) patch.status = args.status;
      if (args.assigneeId !== undefined) patch.assignee_id = args.assigneeId || null;
      if (args.dueDate !== undefined) patch.due_date = args.dueDate || null;
      const { data, error } = await supabase.from("project_tasks").update(patch).eq("id", args.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("You don't have permission to edit tasks.");
    },
    onSuccess: (_v, args) => {
      qc.invalidateQueries({ queryKey: qk.projectTasks(args.projectId) });
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.project(args.projectId) });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; projectId: string }): Promise<void> => {
      const { data, error } = await supabase.from("project_tasks").delete().eq("id", args.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("You don't have permission to delete tasks.");
    },
    onSuccess: (_v, args) => {
      qc.invalidateQueries({ queryKey: qk.projectTasks(args.projectId) });
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.project(args.projectId) });
    },
  });
}

// ─── PROJECT REVIEWS ────────────────────────────────────────────────────────

export function useProjectReviews(projectId: string | undefined) {
  return useQuery({
    queryKey: qk.projectReviews(projectId ?? ""),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<ProjectReviewRow[]> => {
      const { data, error } = await supabase
        .from("project_reviews")
        .select("*")
        .eq("project_id", projectId ?? "")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectReviewRow[];
    },
  });
}

export type CreateReviewArgs = {
  projectId: string;
  rating: number;               // 1..5
  reviewerName?: string | null;
  comment?: string | null;
  createdBy?: string | null;
};

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateReviewArgs): Promise<ProjectReviewRow> => {
      const rating = Math.max(1, Math.min(5, Math.round(args.rating)));
      const base: Omit<TablesInsert<"project_reviews">, "id"> = {
        project_id: args.projectId,
        rating,
        reviewer_name: args.reviewerName?.trim() || null,
        comment: args.comment?.trim() || null,
        created_by: args.createdBy || null,
      };
      for (let attempt = 0; attempt < 5; attempt++) {
        const id = `REV-${Date.now().toString(36)}${attempt}`;
        const { data, error } = await supabase.from("project_reviews").insert({ ...base, id }).select().single();
        if (!error) return data as ProjectReviewRow;
        if (error.code !== "23505") throw error;
      }
      throw new Error("Could not save the review. Please retry.");
    },
    onSuccess: (_row, args) => {
      qc.invalidateQueries({ queryKey: qk.projectReviews(args.projectId) });
    },
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; projectId: string }): Promise<void> => {
      const { data, error } = await supabase.from("project_reviews").delete().eq("id", args.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("You don't have permission to delete reviews.");
    },
    onSuccess: (_v, args) => {
      qc.invalidateQueries({ queryKey: qk.projectReviews(args.projectId) });
    },
  });
}

// ─── LIFECYCLE (PAYMENTS + SIGNATURES PER PROJECT) ──────────────────────────

export function useProjectLifecycle(projectId: string | undefined) {
  return useQuery({
    queryKey: qk.projectLifecycle(projectId ?? ""),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<ProjectLifecycle | null> => {
      // Two parallel reads — payments + signatures + the project's stage info
      const safeProjectId = projectId ?? "";
      const [proj, payRes, sigRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id, current_stage_id, lifecycle_started_at")
          .eq("id", safeProjectId)
          .maybeSingle(),
        supabase
          .from("payment_records")
          .select("*")
          .eq("project_id", safeProjectId)
          .order("gate")
          .order("instalment", { nullsFirst: true }),
        supabase
          .from("signature_records")
          .select("*")
          .eq("project_id", safeProjectId)
          .order("group_name")
          .order("signature_key"),
      ]);
      if (proj.error) throw proj.error;
      if (payRes.error) throw payRes.error;
      if (sigRes.error) throw sigRes.error;
      if (!proj.data) return null;

      return {
        projectId: proj.data.id,
        currentStageId: proj.data.current_stage_id ?? "",
        startedAt: isoToDDMMYYYY(proj.data.lifecycle_started_at),
        payments: (payRes.data ?? []).map(mapPayment),
        signatures: (sigRes.data ?? []).map(mapSignature),
      };
    },
  });
}

// ─── CROSS-PROJECT: OPEN PAYMENTS + SIGNATURES ──────────────────────────────

export type OpenPaymentRow = PaymentRecord & {
  projectId: string;
  projectName: string;
  client: string;
};
export type OpenSignatureRow = DocumentSignRecord & {
  projectId: string;
  projectName: string;
  client: string;
};

type PaymentWithProject = PaymentRecordRow & {
  project: { id: string; name: string; client_name: string } | null;
};
type SignatureWithProject = SignatureRecordRow & {
  project: { id: string; name: string; client_name: string } | null;
};

export function useOpenPayments() {
  return useQuery({
    queryKey: qk.openPayments,
    queryFn: async (): Promise<OpenPaymentRow[]> => {
      const { data, error } = await supabase
        .from("payment_records")
        .select("*, project:projects!inner(id,name,client_name)")
        .not("status", "in", '("completed","skipped")')
        .order("due_date", { nullsFirst: false });
      if (error) throw error;
      return ((data ?? []) as unknown as PaymentWithProject[])
        .filter((r) => r.project !== null)
        .map((r) => ({
          ...mapPayment(r),
          projectId: r.project!.id,
          projectName: r.project!.name,
          client: r.project!.client_name,
        }));
    },
  });
}

export function useOpenSignatures() {
  return useQuery({
    queryKey: qk.openSignatures,
    queryFn: async (): Promise<OpenSignatureRow[]> => {
      const { data, error } = await supabase
        .from("signature_records")
        .select("*, project:projects!inner(id,name,client_name)")
        .not("status", "in", '("completed","skipped")');
      if (error) throw error;
      return ((data ?? []) as unknown as SignatureWithProject[])
        .filter((r) => r.project !== null)
        .map((r) => ({
          ...mapSignature(r),
          projectId: r.project!.id,
          projectName: r.project!.name,
          client: r.project!.client_name,
        }));
    },
  });
}

// ─── PAYMENT MUTATIONS ──────────────────────────────────────────────────────
// Used by the Checkpoints page + ProjectDetail Lifecycle tab so admins can
// mark a payment gate (or instalment) as collected. RLS gates this to the
// OPS tier (principal/admin/admin_exec/pm/site_supervisor) — see Phase 0D.

export type UpdatePaymentArgs = {
  id: number;
  projectId: string;                  // required for cache invalidation
  status?: PaymentRecordRow["status"];
  collectedDate?: string;             // DD/MM/YYYY — null clears
  dueDate?: string;                   // DD/MM/YYYY — null clears
  reference?: string | null;
  notes?: string | null;
};

/**
 * Result of a checkpoint mutation that may have auto-advanced the project's
 * current stage server-side (see migration 20260513000006_tier1_stage_advancement).
 */
export type CheckpointMutationResult<TRow> = {
  row: TRow;
  /** Stage transition observed by comparing project.current_stage_id before vs after the update. */
  stageAdvanced?: {
    from: string;
    to: string;
    fromLabel: string | null;
    toLabel: string | null;
  };
};

/** Look up a project's current_stage_id + the stage's label in one round-trip. */
async function fetchProjectStage(projectId: string): Promise<{ id: string | null; label: string | null }> {
  const { data, error } = await supabase
    .from("projects")
    .select("current_stage_id, stage:lifecycle_stages(label)")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return { id: null, label: null };
  const stage = (data as { stage?: { label?: string } | null }).stage;
  return {
    id: data.current_stage_id ?? null,
    label: stage?.label ?? null,
  };
}

export function useUpdatePayment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: UpdatePaymentArgs): Promise<CheckpointMutationResult<PaymentRecordRow>> => {
      const payload: TablesUpdate<"payment_records"> = {};
      if (args.status !== undefined) payload.status = args.status;
      if (args.collectedDate !== undefined) {
        payload.collected_date = args.collectedDate ? ddmmyyyyToIso(args.collectedDate) : null;
      }
      if (args.dueDate !== undefined) {
        payload.due_date = args.dueDate ? ddmmyyyyToIso(args.dueDate) : null;
      }
      if (args.reference !== undefined) payload.reference = args.reference;
      if (args.notes !== undefined) payload.notes = args.notes;

      // Snapshot the project's stage before the write so we can detect any
      // server-side auto-advance triggered by the new completion status.
      const beforeStage = await fetchProjectStage(args.projectId);

      const { data, error } = await supabase
        .from("payment_records")
        .update(payload)
        .eq("id", args.id)
        .select()
        .single();
      if (error) throw error;

      const afterStage = await fetchProjectStage(args.projectId);

      return {
        row: data as PaymentRecordRow,
        stageAdvanced:
          beforeStage.id && afterStage.id && beforeStage.id !== afterStage.id
            ? {
                from: beforeStage.id,
                to: afterStage.id,
                fromLabel: beforeStage.label,
                toLabel: afterStage.label,
              }
            : undefined,
      };
    },
    onSuccess: (_result, args) => {
      qc.invalidateQueries({ queryKey: qk.openPayments });
      qc.invalidateQueries({ queryKey: qk.openSignatures });
      qc.invalidateQueries({ queryKey: qk.projectLifecycle(args.projectId) });
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.project(args.projectId) });
    },
  });
}

/** Convenience helper: returns true when the current staff role may write payments. */
export function canEditPayments(role: StaffRow["role"] | null | undefined): boolean {
  if (!role) return false;
  return role === "principal" || role === "admin" || role === "admin_exec"
      || role === "pm" || role === "site_supervisor";
}

/** Same OPS-tier predicate, named for the signature/document flow. */
export const canEditSignatures = canEditPayments;

/** True for the ADMIN tier (principal / admin / admin_exec). */
export function isAdminTier(role: StaffRow["role"] | null | undefined): boolean {
  return role === "principal" || role === "admin" || role === "admin_exec";
}

/**
 * Who may edit a given staff row. Mirrors the Phase 0D RLS:
 *   • admin tier may edit ANY staff row (`staff_write_admin`)
 *   • anyone may edit their OWN row (`staff_update_self`)
 * Non-admins editing their own row are restricted to safe fields in the UI
 * (phone / WhatsApp opt-in); the `guard_staff_sensitive_columns` trigger
 * (migration 20260602000001) enforces that server-side.
 */
export function canEditStaffRow(
  role: StaffRow["role"] | null | undefined,
  isOwnRow: boolean,
): boolean {
  return isAdminTier(role) || isOwnRow;
}

/**
 * Returns true when the current staff role is allowed to view the cross-system
 * audit log. Mirrors the Phase 0D `audit_log_read_admin` policy — only the
 * admin tier sees all activity. Non-admin users can still read their own
 * activity via the `audit_log_read_own` policy but the dedicated viewer is
 * admin-only for v1.
 */
export function canViewAuditLog(role: StaffRow["role"] | null | undefined): boolean {
  if (!role) return false;
  return role === "principal" || role === "admin" || role === "admin_exec";
}

/**
 * Audit log entry enriched with the actor's staff record (name + avatar +
 * role) when one can be resolved via auth_user_id.
 */
export type AuditEntry = AuditLogRow & {
  actor: { id: string; name: string; avatar_code: string; role: StaffRow["role"] } | null;
};

export function useAuditLog(filters?: AuditLogFilters) {
  return useInfiniteQuery({
    queryKey: qk.auditLog(filters),
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }): Promise<AuditLogPage> => {
      const pageSize = Math.min(filters?.pageSize ?? 50, 200);

      let q = supabase
        .from("audit_log")
        .select("*")
        // `id` is bigserial → monotonic w.r.t. insertion, so ordering on id desc
        // produces the same newest-first sequence as changed_at desc, but with
        // a stable unique key for cursoring (no millisecond tie-breakers).
        .order("id", { ascending: false })
        .limit(pageSize);

      if (filters?.table) q = q.eq("table_name", filters.table);
      if (filters?.action) q = q.eq("action", filters.action);
      if (filters?.rowId) q = q.eq("row_id", filters.rowId);
      if (filters?.daysBack && filters.daysBack > 0) {
        const since = new Date();
        since.setDate(since.getDate() - filters.daysBack);
        q = q.gte("changed_at", since.toISOString());
      }
      if (pageParam !== null) q = q.lt("id", pageParam);

      const [logRes, staffRes] = await Promise.all([
        q,
        supabase.from("staff").select("id, name, avatar_code, role, auth_user_id"),
      ]);
      if (logRes.error) throw logRes.error;
      if (staffRes.error) throw staffRes.error;

      const staffByAuth = new Map<
        string,
        { id: string; name: string; avatar_code: string; role: StaffRow["role"] }
      >();
      for (const s of (staffRes.data ?? []) as Array<
        { id: string; name: string; avatar_code: string; role: StaffRow["role"]; auth_user_id: string | null }
      >) {
        if (s.auth_user_id) {
          staffByAuth.set(s.auth_user_id, {
            id: s.id,
            name: s.name,
            avatar_code: s.avatar_code,
            role: s.role,
          });
        }
      }

      const rows = (logRes.data ?? []) as AuditLogRow[];
      const entries: AuditEntry[] = rows.map((row) => ({
        ...row,
        actor: row.changed_by ? staffByAuth.get(row.changed_by) ?? null : null,
      }));
      // If the page came back full, the oldest row's id is the cursor for the
      // next page. If short, we've reached the end of the filtered window.
      const nextCursor = rows.length === pageSize ? rows[rows.length - 1].id : null;
      return { entries, nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

// ─── SIGNATURE MUTATIONS + DOCUMENT UPLOAD (Tier 1 — e-sign) ────────────────
// `signature-docs` is a private Supabase Storage bucket; objects are fetched
// via short-lived signed URLs. Path pattern: {projectId}/{signatureKey}/{ts}.pdf

export type UpdateSignatureArgs = {
  id: number;
  projectId: string;                  // required for cache invalidation
  status?: SignatureRecordRow["status"];
  signedDate?: string | null;         // DD/MM/YYYY — null clears
  signedBy?: string | null;
  documentRef?: string | null;        // Storage path or legacy filename
  notes?: string | null;
};

export function useUpdateSignature() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: UpdateSignatureArgs): Promise<CheckpointMutationResult<SignatureRecordRow>> => {
      const payload: TablesUpdate<"signature_records"> = {};
      if (args.status !== undefined) payload.status = args.status;
      if (args.signedDate !== undefined) {
        payload.signed_date = args.signedDate ? ddmmyyyyToIso(args.signedDate) : null;
      }
      if (args.signedBy !== undefined) payload.signed_by = args.signedBy;
      if (args.documentRef !== undefined) payload.document_ref = args.documentRef;
      if (args.notes !== undefined) payload.notes = args.notes;

      // Snapshot the project's stage before the write to detect auto-advance.
      const beforeStage = await fetchProjectStage(args.projectId);

      const { data, error } = await supabase
        .from("signature_records")
        .update(payload)
        .eq("id", args.id)
        .select()
        .single();
      if (error) throw error;

      const afterStage = await fetchProjectStage(args.projectId);

      return {
        row: data as SignatureRecordRow,
        stageAdvanced:
          beforeStage.id && afterStage.id && beforeStage.id !== afterStage.id
            ? {
                from: beforeStage.id,
                to: afterStage.id,
                fromLabel: beforeStage.label,
                toLabel: afterStage.label,
              }
            : undefined,
      };
    },
    onSuccess: (_result, args) => {
      qc.invalidateQueries({ queryKey: qk.openSignatures });
      qc.invalidateQueries({ queryKey: qk.openPayments });
      qc.invalidateQueries({ queryKey: qk.projectLifecycle(args.projectId) });
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.project(args.projectId) });
    },
  });
}

export type UploadSignatureDocArgs = {
  signatureId: number;
  projectId: string;
  signatureKey: string;
  file: File;
};

/**
 * Upload a signature document (PDF or image) to the `signature-docs` bucket
 * and update the underlying signature_records row's `document_ref` to point
 * at the new storage path. Returns the storage path that was written.
 *
 * Does NOT change the signature's status — call useUpdateSignature separately
 * to mark it as completed (typically as part of the same submit handler).
 */
export function useUploadSignatureDoc() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: UploadSignatureDocArgs): Promise<string> => {
      const ext = args.file.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const path = `${args.projectId}/${args.signatureKey}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("signature-docs")
        .upload(path, args.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: args.file.type || "application/pdf",
        });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from("signature_records")
        .update({ document_ref: path })
        .eq("id", args.signatureId);
      if (dbErr) throw dbErr;

      return path;
    },
    onSuccess: (_path, args) => {
      qc.invalidateQueries({ queryKey: qk.openSignatures });
      qc.invalidateQueries({ queryKey: qk.projectLifecycle(args.projectId) });
    },
  });
}

/** Mint a short-lived signed URL for viewing a signature document. */
export async function getSignatureDocUrl(storagePath: string, expiresInSec = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("signature-docs")
    .createSignedUrl(storagePath, expiresInSec);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Returns true when a row's `document_ref` looks like a real Storage path
 * (contains a "/") rather than a legacy filename from the seed data.
 */
export function isStorageDocRef(documentRef: string | null | undefined): boolean {
  return typeof documentRef === "string" && documentRef.includes("/");
}

// ─── INQUIRIES ──────────────────────────────────────────────────────────────

export function useInquiries() {
  return useQuery({
    queryKey: qk.inquiries,
    queryFn: async (): Promise<Inquiry[]> => {
      const [inqRes, staffRes] = await Promise.all([
        supabase.from("inquiries").select("*").order("last_updated", { ascending: false }),
        supabase.from("staff").select("*"),
      ]);
      if (inqRes.error) throw inqRes.error;
      if (staffRes.error) throw staffRes.error;
      const staffById = new Map(((staffRes.data ?? []) as StaffRow[]).map((s) => [s.id, s]));
      return ((inqRes.data ?? []) as InquiryRow[]).map((r) => mapInquiry(r, staffById));
    },
  });
}

export function useInquiry(id: string | undefined) {
  return useQuery({
    queryKey: qk.inquiry(id ?? ""),
    enabled: Boolean(id),
    queryFn: async (): Promise<Inquiry | null> => {
      const safeId = id ?? "";
      const [inqRes, staffRes] = await Promise.all([
        supabase.from("inquiries").select("*").eq("id", safeId).maybeSingle(),
        supabase.from("staff").select("*"),
      ]);
      if (inqRes.error) throw inqRes.error;
      if (staffRes.error) throw staffRes.error;
      if (!inqRes.data) return null;
      const staffById = new Map(((staffRes.data ?? []) as StaffRow[]).map((s) => [s.id, s]));
      return mapInquiry(inqRes.data as InquiryRow, staffById);
    },
  });
}

/** Fields captured by the New Customer form (CreateCustomer.tsx). A customer IS
 *  an inquiry — the CRM's pre-sales record that can later convert into a project. */
export type CreateInquiryArgs = {
  clientName: string;
  contact?: string | null;
  email?: string | null;
  category: CustomerCategory;
  tier: CustomerTier;
  source?: string;
  propertyType: string;
  location: string;
  estimatedSize?: number | null;
  estimatedBudget?: number | null;
  stage?: InquiryStage;              // default new-inquiry
  assignedToId?: string | null;
  notes?: string | null;
};

/** Create a brand-new customer/inquiry. Insert is allowed for any authenticated
 *  user (`inquiries_insert_any_authenticated` RLS policy). The `INQ###` id isn't
 *  DB-generated — compute the next one from the current max and retry on a
 *  unique-violation (concurrent-create race), mirroring `useCreateProject`. */
export function useCreateInquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateInquiryArgs): Promise<InquiryRow> => {
      const { data: existing, error: listErr } = await supabase.from("inquiries").select("id");
      if (listErr) throw listErr;
      const maxNum = (existing ?? []).reduce((max, r) => {
        const m = /^INQ(\d+)$/.exec(r.id);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);

      const today = new Date().toISOString().slice(0, 10);
      const base: Omit<TablesInsert<"inquiries">, "id"> = {
        inquiry_date: today,
        client_name: args.clientName,
        contact: args.contact ?? null,
        email: args.email ?? null,
        category: args.category,
        tier: args.tier,
        source: args.source ?? "Direct",
        property_type: args.propertyType,
        location: args.location,
        estimated_size: args.estimatedSize ?? null,
        estimated_budget: args.estimatedBudget ?? null,
        stage: args.stage ?? "new-inquiry",
        assigned_to_id: args.assignedToId ?? null,
        notes: args.notes ?? null,
        contact_log: [],
        last_updated: today,
      };

      for (let attempt = 0; attempt < 5; attempt++) {
        const id = `INQ${String(maxNum + 1 + attempt).padStart(3, "0")}`;
        const { data, error } = await supabase
          .from("inquiries")
          .insert({ ...base, id })
          .select()
          .single();
        if (!error) return data as InquiryRow;
        if (error.code !== "23505") throw error; // 23505 = unique_violation → next id
      }
      throw new Error("Could not allocate a unique customer id after several attempts. Please retry.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.inquiries });
    },
  });
}

// ─── CONVERT INQUIRY MUTATION ───────────────────────────────────────────────

export type ConvertInquiryArgs = {
  inquiryId: string;
  projectName: string;
  designerName: string;
  pmName: string;
  designerAvatar: string;
  pmAvatar: string;
  startDate: string;     // DD/MM/YYYY
  targetDate: string;
  budget: number;
  priority: "high" | "medium" | "low";
  areas: string[];
  proposalDeposit: number;
  serviceType: "Design" | "Renovation"; // → p_service_type; picks the SD/SR project code
  assignedToAvatar?: string;
};

export function useConvertInquiry() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: ConvertInquiryArgs): Promise<string> => {
      // The RPC requires real ISO dates — fail fast with a clear error if the
      // form somehow let through a malformed DD/MM/YYYY string (`ddmmyyyyToIso`
      // returns null on parse failure).
      const startIso = ddmmyyyyToIso(args.startDate);
      const targetIso = ddmmyyyyToIso(args.targetDate);
      if (!startIso) throw new Error(`Invalid start date: ${args.startDate}`);
      if (!targetIso) throw new Error(`Invalid target date: ${args.targetDate}`);

      const { data, error } = await supabase.rpc("convert_inquiry_to_project", {
        p_inquiry_id: args.inquiryId,
        p_project_name: args.projectName,
        p_designer_name: args.designerName,
        p_pm_name: args.pmName,
        p_designer_avatar: args.designerAvatar,
        p_pm_avatar: args.pmAvatar,
        p_start_date: startIso,
        p_target_date: targetIso,
        p_budget: args.budget,
        p_priority: args.priority,
        p_areas: args.areas,
        p_proposal_deposit: args.proposalDeposit,
        p_service_type: args.serviceType,
        // RPC arg is optional `string | undefined` (CLI Args shape) — pass
        // undefined (omit) when caller didn't specify, never `null`.
        p_assigned_to_avatar: args.assignedToAvatar ?? undefined,
      });
      if (error) throw error;
      return data as string; // new project id (PRJ006…)
    },
    onSuccess: (_newId, args) => {
      // Invalidate everything that could now be stale
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.inquiries });
      qc.invalidateQueries({ queryKey: qk.inquiry(args.inquiryId) });
      qc.invalidateQueries({ queryKey: qk.openPayments });
      qc.invalidateQueries({ queryKey: qk.openSignatures });
    },
  });
}

// ─── CUSTOMER FUNNEL SUMMARY ────────────────────────────────────────────────

export type CustomerSummary = {
  total: number;
  newInquiry: number;
  showroomMeet: number;
  awarded: number;
  rejected: number;
  active: number;
  closedTotal: number;
  winRate: number;     // 0..1
  pipelineRM: number;
  awardedRM: number;
};

export function computeCustomerSummary(inquiries: Inquiry[]): CustomerSummary {
  const newInquiry = inquiries.filter((i) => i.stage === "new-inquiry").length;
  const showroomMeet = inquiries.filter((i) => i.stage === "showroom-meet").length;
  const awarded = inquiries.filter((i) => i.stage === "awarded").length;
  const rejected = inquiries.filter((i) => i.stage === "rejected").length;
  const active = newInquiry + showroomMeet;
  const closedTotal = awarded + rejected;
  const winRate = closedTotal === 0 ? 0 : awarded / closedTotal;
  const pipelineRM = inquiries
    .filter((i) => i.stage === "new-inquiry" || i.stage === "showroom-meet")
    .reduce((s, i) => s + (i.estimated_budget ?? 0), 0);
  const awardedRM = inquiries
    .filter((i) => i.stage === "awarded")
    .reduce((s, i) => s + (i.estimated_budget ?? 0), 0);
  return { total: inquiries.length, newInquiry, showroomMeet, awarded, rejected, active, closedTotal, winRate, pipelineRM, awardedRM };
}

// ─── CROSS-PROJECT CHECKPOINT SUMMARY ───────────────────────────────────────
// Pure function operating on already-fetched data. Same shape as the old
// `checkpointSummary()` from lifecycleData.ts, so existing UI keeps working.

import { bucketDate } from "@/lib/lifecycleData";

export type CheckpointSummary = {
  outstandingRM: number;
  overdueCount: number;
  overdueRM: number;
  thisWeekCount: number;
  pendingSignsCount: number;
  pendingContractsCount: number;
  pendingDrawingsCount: number;
  paymentsCount: number;
};

export function computeCheckpointSummary(
  payments: OpenPaymentRow[],
  signatures: OpenSignatureRow[],
  today: Date = getToday(),
): CheckpointSummary {
  const outstandingRM = payments.reduce((s, p) => s + p.amount, 0);
  const overdue = payments.filter((p) => bucketDate(p.dueDate, today) === "overdue");
  const thisWeek = payments.filter((p) => bucketDate(p.dueDate, today) === "this-week");

  return {
    outstandingRM,
    overdueCount: overdue.length,
    overdueRM: overdue.reduce((s, p) => s + p.amount, 0),
    thisWeekCount: thisWeek.length,
    pendingSignsCount: signatures.length,
    pendingContractsCount: signatures.filter((s) => s.group === "contract").length,
    pendingDrawingsCount: signatures.filter((s) => s.group === "drawing").length,
    paymentsCount: payments.length,
  };
}

// ─── QUOTATIONS ─────────────────────────────────────────────────────────────

/** App-shape line item (camelCase, matches the legacy `LineItem` in quotationData.ts). */
function mapQuotationItem(r: QuotationItemRow): LineItem {
  return {
    id: r.id,
    area: r.area,
    description: r.description,
    category: r.category,
    qty: Number(r.qty),
    unit: r.unit,
    unitPrice: Number(r.unit_price),
    discount: Number(r.discount),
  };
}

/**
 * App-shape quotation — keeps the snake_case row fields for direct DB access
 * (status updates, etc.) AND adds the legacy camelCase aliases the UI was
 * built around so existing components don't need a field-rename pass.
 */
export type QuotationWithItems = QuotationRow & {
  items: LineItem[];
  // legacy aliases (camelCase) for compatibility with the existing UI + PDF generator
  projectId: string;
  projectName: string;
  client: string;
  clientContact: string;
  clientEmail: string;
  clientAddress: string;
  type: QuotationRow["doc_type"];
  issueDate: string;            // DD/MM/YYYY
  validUntil?: string;
  dueDate?: string;
  taxRate: number;
};

type QuotationJoined = QuotationRow & {
  items: QuotationItemRow[];
  project: { id: string; name: string } | null;
};

function mapQuotation(row: QuotationJoined): QuotationWithItems {
  return {
    ...row,
    items: (row.items ?? []).map(mapQuotationItem),
    projectId: row.project_id ?? "",
    projectName: row.project?.name ?? row.project_id ?? "—",
    client: row.client_name,
    clientContact: row.client_contact ?? "",
    clientEmail: row.client_email ?? "",
    clientAddress: row.client_address ?? "",
    type: row.doc_type,
    issueDate: isoToDDMMYYYY(row.issue_date),
    validUntil: isoToDDMMYYYY(row.valid_until) || undefined,
    dueDate: isoToDDMMYYYY(row.due_date) || undefined,
    taxRate: Number(row.tax_rate),
  };
}

const QUOTATION_SELECT = "*, items:quotation_items(*), project:projects(id,name)";

export function useQuotations() {
  return useQuery({
    queryKey: qk.quotations,
    queryFn: async (): Promise<QuotationWithItems[]> => {
      const { data, error } = await supabase
        .from("quotations")
        .select(QUOTATION_SELECT)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as QuotationJoined[]).map(mapQuotation);
    },
  });
}

export function useQuotation(id: string | undefined) {
  return useQuery({
    queryKey: qk.quotation(id ?? ""),
    enabled: Boolean(id),
    queryFn: async (): Promise<QuotationWithItems | null> => {
      const safeId = id ?? "";
      const { data, error } = await supabase
        .from("quotations")
        .select(QUOTATION_SELECT)
        .eq("id", safeId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return mapQuotation(data as unknown as QuotationJoined);
    },
  });
}

export function useUpdateQuotationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: QuotationRow["status"] }) => {
      const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: qk.quotations });
      qc.invalidateQueries({ queryKey: qk.quotation(id) });
    },
  });
}

export type CreateQuotationArgs = {
  id: string;                             // ID26-801 (ID/INV/PI + 2-digit year + seq from 801)
  projectId: string;
  docType: QuotationRow["doc_type"];
  clientName: string;
  clientContact?: string;
  clientEmail?: string;
  clientAddress?: string;
  issueDate: string;                      // DD/MM/YYYY
  validUntil?: string;
  dueDate?: string;
  taxRate: number;
  notes?: string;
  terms?: string;
  items: Omit<LineItem, "id">[];
};

export function useCreateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateQuotationArgs): Promise<string> => {
      const issueIso = ddmmyyyyToIso(args.issueDate);
      if (!issueIso) throw new Error("Invalid issue date — expected DD/MM/YYYY");

      const { error: qErr } = await supabase.from("quotations").insert({
        id: args.id,
        project_id: args.projectId,
        doc_type: args.docType,
        status: "draft",
        client_name: args.clientName,
        client_contact: args.clientContact ?? null,
        client_email: args.clientEmail ?? null,
        client_address: args.clientAddress ?? null,
        issue_date: issueIso,
        valid_until: args.validUntil ? ddmmyyyyToIso(args.validUntil) : null,
        due_date: args.dueDate ? ddmmyyyyToIso(args.dueDate) : null,
        tax_rate: args.taxRate,
        notes: args.notes ?? null,
        terms: args.terms ?? null,
        revision: 1,
      });
      if (qErr) throw qErr;

      if (args.items.length > 0) {
        const rows = args.items.map((it, idx) => ({
          id: `${args.id}-${String(idx + 1).padStart(3, "0")}`,
          quotation_id: args.id,
          area: it.area,
          description: it.description,
          category: it.category,
          qty: it.qty,
          unit: it.unit,
          unit_price: it.unitPrice,
          discount: it.discount,
          sort_order: idx,
        }));
        const { error: iErr } = await supabase.from("quotation_items").insert(rows);
        if (iErr) throw iErr;
      }

      return args.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.quotations });
    },
  });
}

// ─── LEAVE REQUESTS ─────────────────────────────────────────────────────────

export type LeaveRequest = LeaveRequestRow & {
  staffName: string;
  staffAvatar: string;
  startDateLabel: string;        // DD/MM/YYYY
  endDateLabel: string;
  appliedDateLabel: string;
};

function mapLeaveRequest(row: LeaveRequestRow, staffById: Map<string, StaffRow>): LeaveRequest {
  const staff = staffById.get(row.staff_id);
  return {
    ...row,
    staffName: staff?.name ?? "—",
    staffAvatar: staff?.avatar_code ?? "?",
    startDateLabel: isoToDDMMYYYY(row.start_date),
    endDateLabel: isoToDDMMYYYY(row.end_date),
    appliedDateLabel: isoToDDMMYYYY(row.applied_date),
  };
}

export function useLeaveRequests() {
  return useQuery({
    queryKey: qk.leaveRequests,
    queryFn: async (): Promise<LeaveRequest[]> => {
      const [lvRes, staffRes] = await Promise.all([
        supabase.from("leave_requests").select("*").order("applied_date", { ascending: false }),
        supabase.from("staff").select("*"),
      ]);
      if (lvRes.error) throw lvRes.error;
      if (staffRes.error) throw staffRes.error;
      const staffById = new Map(((staffRes.data ?? []) as StaffRow[]).map((s) => [s.id, s]));
      return ((lvRes.data ?? []) as LeaveRequestRow[]).map((r) => mapLeaveRequest(r, staffById));
    },
  });
}

export function useUpdateLeaveStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, approverId }: { id: string; status: LeaveStatus; approverId?: string }) => {
      const payload: Partial<LeaveRequestRow> = { status };
      if (approverId) payload.approved_by_id = approverId;
      if (status !== "pending") payload.approved_at = new Date().toISOString();
      const { error } = await supabase.from("leave_requests").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.leaveRequests });
    },
  });
}

export type ApplyLeaveArgs = {
  id: string;
  staffId: string;
  leaveType: string;
  startDate: string;             // DD/MM/YYYY
  endDate: string;
  days: number;
  reason?: string;
};

export function useApplyLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: ApplyLeaveArgs) => {
      const startIso = ddmmyyyyToIso(args.startDate);
      const endIso = ddmmyyyyToIso(args.endDate);
      if (!startIso || !endIso) throw new Error("Invalid date — expected DD/MM/YYYY");
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("leave_requests").insert({
        id: args.id,
        staff_id: args.staffId,
        leave_type: args.leaveType,
        start_date: startIso,
        end_date: endIso,
        days: args.days,
        reason: args.reason ?? null,
        status: "pending",
        applied_date: today,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.leaveRequests });
    },
  });
}

// ─── CANDIDATES (RECRUITMENT) ───────────────────────────────────────────────

export type Candidate = CandidateRow & {
  appliedDateLabel: string;
};

function mapCandidate(row: CandidateRow): Candidate {
  return { ...row, appliedDateLabel: isoToDDMMYYYY(row.applied_date) };
}

export function useCandidates() {
  return useQuery({
    queryKey: qk.candidates,
    queryFn: async (): Promise<Candidate[]> => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .order("applied_date", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as CandidateRow[]).map(mapCandidate);
    },
  });
}

export function useAdvanceCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("candidates").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.candidates });
    },
  });
}

export type CreateCandidateArgs = {
  name: string;
  appliedForRole: string;
  source: string;
  experience?: string | null;
  portfolioUrl?: string | null;
  notes?: string | null;
};

/** Add a candidate to the recruitment pipeline. Admin/ops per candidates_write RLS. */
export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateCandidateArgs): Promise<CandidateRow> => {
      const id = `CAN-${Date.now().toString(36).toUpperCase()}`;
      const payload: TablesInsert<"candidates"> = {
        id,
        name: args.name.trim(),
        applied_for_role: args.appliedForRole.trim(),
        source: args.source,
        stage: "Sourced",
        applied_date: new Date().toISOString().slice(0, 10),
        experience: args.experience?.trim() || null,
        portfolio_url: args.portfolioUrl?.trim() || null,
        notes: args.notes?.trim() || null,
      };
      const { data, error } = await supabase.from("candidates").insert(payload).select().single();
      if (error) throw error;
      return data as CandidateRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.candidates });
    },
  });
}

export type UpdateCandidateArgs = {
  id: string;
  name?: string;
  appliedForRole?: string;
  source?: string;
  stage?: string;
  experience?: string | null;
  portfolioUrl?: string | null;
  notes?: string | null;
};

/** Edit an existing candidate (fix a wrong name/role, correct the stage, etc.). */
export function useUpdateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpdateCandidateArgs): Promise<void> => {
      const patch: TablesUpdate<"candidates"> = {};
      if (args.name !== undefined) patch.name = args.name.trim();
      if (args.appliedForRole !== undefined) patch.applied_for_role = args.appliedForRole.trim();
      if (args.source !== undefined) patch.source = args.source;
      if (args.stage !== undefined) patch.stage = args.stage;
      if (args.experience !== undefined) patch.experience = args.experience?.trim() || null;
      if (args.portfolioUrl !== undefined) patch.portfolio_url = args.portfolioUrl?.trim() || null;
      if (args.notes !== undefined) patch.notes = args.notes?.trim() || null;
      const { data, error } = await supabase.from("candidates").update(patch).eq("id", args.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("You don't have permission to update candidates.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.candidates });
    },
  });
}

/** Remove a candidate from the pipeline (e.g. after they're hired + added as staff). */
export function useDeleteCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("candidates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.candidates });
    },
  });
}

// ─── ANNOUNCEMENTS ──────────────────────────────────────────────────────────

export type Announcement = AnnouncementRow & {
  publishedDateLabel: string;
  authorName: string;
};

function mapAnnouncement(row: AnnouncementRow, staffById: Map<string, StaffRow>): Announcement {
  const author = row.author_id ? staffById.get(row.author_id) : null;
  return {
    ...row,
    publishedDateLabel: isoToDDMMYYYY(row.published_date),
    authorName: author?.name ?? "—",
  };
}

export function useAnnouncements() {
  return useQuery({
    queryKey: qk.announcements,
    queryFn: async (): Promise<Announcement[]> => {
      const [annRes, staffRes] = await Promise.all([
        supabase.from("announcements").select("*").order("published_date", { ascending: false }),
        supabase.from("staff").select("*"),
      ]);
      if (annRes.error) throw annRes.error;
      if (staffRes.error) throw staffRes.error;
      const staffById = new Map(((staffRes.data ?? []) as StaffRow[]).map((s) => [s.id, s]));
      return ((annRes.data ?? []) as AnnouncementRow[]).map((r) => mapAnnouncement(r, staffById));
    },
  });
}

export type CreateAnnouncementArgs = {
  title: string;
  content: string;
  priority: "high" | "medium" | "low";
  authorId: string;
};

/** Publish a new announcement. Server-side `announcements_write_admin` RLS
 *  restricts this to the ADMIN tier; the UI hides the compose button for others. */
export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateAnnouncementArgs): Promise<AnnouncementRow> => {
      const id = `ANN-${Date.now().toString(36).toUpperCase()}`;
      const payload: TablesInsert<"announcements"> = {
        id,
        title: args.title.trim(),
        content: args.content.trim(),
        priority: args.priority,
        author_id: args.authorId,
        published_date: new Date().toISOString().slice(0, 10),
      };
      const { data, error } = await supabase.from("announcements").insert(payload).select().single();
      if (error) throw error;
      return data as AnnouncementRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.announcements });
    },
  });
}

// ─── NOTIFICATION PREFERENCES ───────────────────────────────────────────────

export type NotificationPrefs = {
  notifications_enabled: boolean;
  reminders: boolean;
  announcements: boolean;
  payment_alerts: boolean;
  task_updates: boolean;
};

/** Defaults used when a staff member has never saved preferences (no row yet). */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  notifications_enabled: true,
  reminders: true,
  announcements: true,
  payment_alerts: true,
  task_updates: true,
};

export function useNotificationPrefs(staffId: string | undefined) {
  return useQuery({
    queryKey: qk.notificationPrefs(staffId ?? ""),
    enabled: !!staffId,
    queryFn: async (): Promise<NotificationPrefs> => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("staff_id", staffId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_NOTIFICATION_PREFS;
      return {
        notifications_enabled: data.notifications_enabled,
        reminders: data.reminders,
        announcements: data.announcements,
        payment_alerts: data.payment_alerts,
        task_updates: data.task_updates,
      };
    },
  });
}

export function useUpdateNotificationPrefs(staffId: string | undefined) {
  const qc = useQueryClient();
  const key = qk.notificationPrefs(staffId ?? "");
  return useMutation({
    mutationFn: async (prefs: NotificationPrefs): Promise<NotificationPrefs> => {
      if (!staffId) throw new Error("No staff profile loaded");
      const payload: TablesInsert<"notification_preferences"> = { staff_id: staffId, ...prefs };
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(payload, { onConflict: "staff_id" });
      if (error) throw error;
      return prefs;
    },
    // Optimistic: flip the toggle instantly in the UI, roll back if the write fails.
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<NotificationPrefs>(key);
      qc.setQueryData(key, next);
      return { prev };
    },
    onError: (_e, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

// ─── SALES TARGETS ──────────────────────────────────────────────────────────

export function useSalesTargets() {
  return useQuery({
    queryKey: qk.salesTargets,
    queryFn: async (): Promise<SalesTargetRow[]> => {
      const { data, error } = await supabase
        .from("sales_targets")
        .select("*")
        .order("staff_id");
      if (error) throw error;
      return (data ?? []) as SalesTargetRow[];
    },
  });
}

// ─── KPI RECORDS ────────────────────────────────────────────────────────────

export function useKpiRecords() {
  return useQuery({
    queryKey: qk.kpiRecords,
    queryFn: async (): Promise<KpiRecordRow[]> => {
      const { data, error } = await supabase
        .from("kpi_records")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as KpiRecordRow[];
    },
  });
}

export function useStaffKpiRecords(staffId: string | undefined) {
  return useQuery({
    queryKey: qk.staffKpi(staffId ?? ""),
    enabled: Boolean(staffId),
    queryFn: async (): Promise<KpiRecordRow[]> => {
      const safeId = staffId ?? "";
      const { data, error } = await supabase
        .from("kpi_records")
        .select("*")
        .eq("staff_id", safeId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return (data ?? []) as KpiRecordRow[];
    },
  });
}

// ─── CALENDAR EVENTS ────────────────────────────────────────────────────────

export function useCalendarEvents() {
  return useQuery({
    queryKey: qk.calendarEvents,
    queryFn: async (): Promise<CalendarEventRow[]> => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .order("event_date");
      if (error) throw error;
      return (data ?? []) as CalendarEventRow[];
    },
  });
}

/** Fetch all event ↔ staff assignments (junction table). */
export function useCalendarEventStaff() {
  return useQuery({
    queryKey: qk.calendarEventStaff,
    queryFn: async (): Promise<CalendarEventStaffRow[]> => {
      const { data, error } = await supabase.from("calendar_event_staff").select("*");
      if (error) throw error;
      return (data ?? []) as CalendarEventStaffRow[];
    },
  });
}

/** Per-type accent colour, kept in sync with the seed data + CalendarPage. */
export const CALENDAR_EVENT_COLORS: Record<CalendarEventType, string> = {
  project: "#046BD2",
  meeting: "#045CB4",
  leave: "#94A3B8",
  event: "#FCB900",
};

export type CreateCalendarEventArgs = {
  title: string;
  eventDate: string;               // YYYY-MM-DD (start day)
  endDate?: string | null;         // YYYY-MM-DD — omit/equal for a single-day event
  startTime?: string | null;       // HH:MM
  endTime?: string | null;
  eventType: CalendarEventType;
  projectId?: string | null;
  staffIds?: string[];             // zero or more staff members
  notes?: string | null;
  createdBy: string;               // current staff id — RLS requires created_by = current staff
};

/** Create a calendar event + its staff assignments in one atomic RPC — the
 *  function generates the id, mirrors the first assignee into staff_id for
 *  backward compatibility, and inserts the calendar_event_staff rows. */
export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateCalendarEventArgs): Promise<CalendarEventRow> => {
      const { data, error } = await supabase.rpc("create_calendar_event_with_staff", {
        p_title: args.title.trim(),
        p_event_date: args.eventDate,
        p_event_type: args.eventType,
        p_color: CALENDAR_EVENT_COLORS[args.eventType],
        p_end_date: args.endDate && args.endDate > args.eventDate ? args.endDate : undefined,
        p_start_time: args.startTime || undefined,
        p_end_time: args.endTime || undefined,
        p_project_id: args.projectId || undefined,
        p_notes: args.notes?.trim() || undefined,
        p_staff_ids: args.staffIds ?? [],
      });
      if (error) throw error;
      return data as CalendarEventRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.calendarEvents });
      qc.invalidateQueries({ queryKey: qk.calendarEventStaff });
    },
  });
}

// ─── STAFF (single) ─────────────────────────────────────────────────────────

export function useStaffById(id: string | undefined) {
  return useQuery({
    queryKey: qk.staffOne(id ?? ""),
    enabled: Boolean(id),
    queryFn: async (): Promise<StaffRow | null> => {
      const safeId = id ?? "";
      const { data, error } = await supabase
        .from("staff")
        .select("*")
        .eq("id", safeId)
        .maybeSingle();
      if (error) throw error;
      return (data as StaffRow | null) ?? null;
    },
  });
}

/** Editable staff fields. `role` / `status` are admin-only (UI hides them for
 *  self-editors; the `guard_staff_sensitive_columns` trigger also rejects them
 *  server-side for non-admins). `email` is intentionally not editable here —
 *  it's the magic-link auth key. */
export type UpdateStaffArgs = {
  id: string;
  name?: string;
  job_title?: string;
  dept?: string;
  phone?: string | null;
  whatsapp_opt_in?: boolean;
  role?: StaffRow["role"];
  status?: StaffRow["status"];
};

/** Update an editable staff record. Server-side gating: `staff_write_admin`
 *  (admin → any row) + `staff_update_self` (anyone → own row). See
 *  `canEditStaffRow`. */
export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: UpdateStaffArgs): Promise<StaffRow> => {
      const payload: TablesUpdate<"staff"> = {};
      if (args.name !== undefined) payload.name = args.name;
      if (args.job_title !== undefined) payload.job_title = args.job_title;
      if (args.dept !== undefined) payload.dept = args.dept;
      if (args.phone !== undefined) payload.phone = args.phone;
      if (args.whatsapp_opt_in !== undefined) payload.whatsapp_opt_in = args.whatsapp_opt_in;
      if (args.role !== undefined) payload.role = args.role;
      if (args.status !== undefined) payload.status = args.status;

      const { data, error } = await supabase
        .from("staff")
        .update(payload)
        .eq("id", args.id)
        .select()
        .single();
      if (error) throw error;
      return data as StaffRow;
    },
    onSuccess: (_row, args) => {
      qc.invalidateQueries({ queryKey: qk.staff });
      qc.invalidateQueries({ queryKey: qk.staffOne(args.id) });
      // Projects/inquiries embed the staff name + avatar_code (designer/PM
      // labels, team[], inquiry assignee chips), so a name/avatar change must
      // refresh them too — otherwise they show stale attribution until reload.
      qc.invalidateQueries({ queryKey: qk.projects });
      qc.invalidateQueries({ queryKey: qk.inquiries });
    },
  });
}

export type CreateStaffArgs = {
  name: string;
  email: string;
  job_title: string;
  dept: string;
  role: StaffRow["role"];
  status?: StaffRow["status"];
  phone?: string | null;
  whatsapp_opt_in?: boolean;
  join_date: string;          // ISO yyyy-mm-dd (the form converts from a date input)
  /** 2–3 char initials shown in avatars; auto-derived from `name` when omitted. */
  avatar_code?: string;
};

/** Default avatar code from a name: initials of the first two words, else the
 *  first two letters. Mirrors the seed convention (e.g. "John Tan" → "JT"). */
export function deriveAvatarCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? "?").slice(0, 2).toUpperCase();
}

/** Create a brand-new staff record. Server-side gating: the `staff_write_admin`
 *  RLS policy means only the ADMIN tier (principal / admin / admin_exec) can
 *  insert — see `isAdminTier`. The record is created directly; the existing
 *  `link_staff_to_auth_user` trigger links it to a Supabase Auth account by
 *  email the first time the person signs in (no invite/edge function needed).
 *
 *  `id` is a sequential `SH###` string generated from the current max — the
 *  staff PK isn't a DB-generated value, so we compute the next one here. */
export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CreateStaffArgs): Promise<StaffRow> => {
      // Snapshot existing ids + avatar codes once.
      const { data: existing, error: listErr } = await supabase
        .from("staff")
        .select("id, avatar_code");
      if (listErr) throw listErr;
      const rows = existing ?? [];

      const maxNum = rows.reduce((max, r) => {
        const m = /^SH(\d+)$/.exec(r.id);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);

      // Avatar codes drive inquiry/KPI attribution, so they must be unique.
      // If the chosen/derived code is taken, append a digit (JT → JT2 → JT3…).
      const taken = new Set(rows.map((r) => r.avatar_code?.toUpperCase()).filter(Boolean));
      let avatar = (args.avatar_code?.trim() || deriveAvatarCode(args.name)).toUpperCase();
      if (taken.has(avatar)) {
        for (let n = 2; n < 100; n++) {
          const candidate = `${avatar}${n}`;
          if (!taken.has(candidate)) { avatar = candidate; break; }
        }
      }

      // Insert with retry on PK collision: two admins creating staff at the same
      // instant can compute the same SH### (the scan-max is racy). On a unique
      // violation (23505) bump the number and retry rather than failing the user.
      const base: Omit<TablesInsert<"staff">, "id"> = {
        name: args.name,
        email: args.email,
        job_title: args.job_title,
        dept: args.dept,
        role: args.role,
        avatar_code: avatar,
        join_date: args.join_date,
        status: args.status ?? "active",
        phone: args.phone ?? null,
        whatsapp_opt_in: args.whatsapp_opt_in ?? true,
      };

      for (let attempt = 0; attempt < 5; attempt++) {
        const id = `SH${String(maxNum + 1 + attempt).padStart(3, "0")}`;
        const { data, error } = await supabase
          .from("staff")
          .insert({ ...base, id })
          .select()
          .single();
        if (!error) return data as StaffRow;
        // 23505 = unique_violation (id already taken) → try the next number.
        if (error.code !== "23505") throw error;
      }
      throw new Error("Could not allocate a unique staff id after several attempts. Please retry.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.staff });
    },
  });
}

/** Rotate a project's client-portal token, invalidating any previously-shared
 *  link. Use when a portal link leaks. OPS/admin only (enforced by the projects
 *  update RLS). */
export function useRegenerateClientToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string): Promise<string> => {
      const newToken = crypto.randomUUID();
      const { error } = await supabase
        .from("projects")
        .update({ client_access_token: newToken })
        .eq("id", projectId);
      if (error) throw error;
      return newToken;
    },
    onSuccess: (_token, projectId) => {
      qc.invalidateQueries({ queryKey: qk.project(projectId) });
      qc.invalidateQueries({ queryKey: qk.projects });
    },
  });
}

// ─── SITE PHOTOS (Phase 0C.2b) ──────────────────────────────────────────────

export function useSitePhotos() {
  return useQuery({
    queryKey: qk.sitePhotos,
    queryFn: async (): Promise<SitePhotoRow[]> => {
      const { data, error } = await supabase
        .from("site_photos")
        .select("*")
        .order("photo_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SitePhotoRow[];
    },
  });
}

export function useProjectSitePhotos(projectId: string | undefined) {
  return useQuery({
    queryKey: qk.projectSitePhotos(projectId ?? ""),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<SitePhotoRow[]> => {
      const safeProjectId = projectId ?? "";
      const { data, error } = await supabase
        .from("site_photos")
        .select("*")
        .eq("project_id", safeProjectId)
        .order("photo_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SitePhotoRow[];
    },
  });
}

export type UploadSitePhotoArgs = {
  projectId: string;
  photoDate: string;             // DD/MM/YYYY
  file: File;
  uploadedById?: string;
  notes?: string;
};

export function useUploadSitePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: UploadSitePhotoArgs): Promise<SitePhotoRow> => {
      const iso = ddmmyyyyToIso(args.photoDate);
      if (!iso) throw new Error("Invalid date — expected DD/MM/YYYY");

      // 1. Upload to Storage
      const ext = args.file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const filename = `${Date.now()}.${ext}`;
      const path = `${args.projectId}/${iso}/${filename}`;
      const { error: upErr } = await supabase.storage
        .from("site-photos")
        .upload(path, args.file, {
          cacheControl: "3600",
          upsert: false,
          contentType: args.file.type || "image/jpeg",
        });
      if (upErr) throw upErr;

      // 2. Insert row (upsert by unique project_id+photo_date — replaces if user re-uploads)
      const { data, error: dbErr } = await supabase
        .from("site_photos")
        .upsert(
          {
            project_id: args.projectId,
            photo_date: iso,
            storage_path: path,
            uploaded_by_id: args.uploadedById ?? null,
            notes: args.notes ?? null,
          },
          { onConflict: "project_id,photo_date" }
        )
        .select()
        .single();
      if (dbErr) throw dbErr;

      return data as SitePhotoRow;
    },
    onSuccess: (_row, args) => {
      qc.invalidateQueries({ queryKey: qk.sitePhotos });
      qc.invalidateQueries({ queryKey: qk.projectSitePhotos(args.projectId) });
    },
  });
}

/** Delete a site photo — removes the storage object (best-effort) then the row.
 *  `photo_count` rolls up onto the project row via the 20260710000004 trigger. */
export function useDeleteSitePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: number; projectId: string; storagePath: string | null }): Promise<void> => {
      if (args.storagePath) {
        await supabase.storage.from("site-photos").remove([args.storagePath]);
      }
      const { data, error } = await supabase.from("site_photos").delete().eq("id", args.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("You don't have permission to delete photos.");
    },
    onSuccess: (_v, args) => {
      qc.invalidateQueries({ queryKey: qk.sitePhotos });
      qc.invalidateQueries({ queryKey: qk.projectSitePhotos(args.projectId) });
      qc.invalidateQueries({ queryKey: qk.projects }); // photo_count rollup (20260710000004)
    },
  });
}

/** Generate a short-lived signed URL for a private site-photo storage path. */
export async function getSitePhotoUrl(storagePath: string, expiresInSec = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("site-photos")
    .createSignedUrl(storagePath, expiresInSec);
  if (error || !data) return null;
  return data.signedUrl;
}

// ─── SPACOLOGY QUIZ RESULTS ─────────────────────────────────────────────────
// Submissions from the public quiz on the marketing site (spazehaus.com/
// spacology-quiz). Staff read them here; the rows themselves are written by the
// `submit_spacology_result` RPC and are immutable except for `notes` and
// `inquiry_id`. See migration 20260827000000_spacology_results.sql.

/** Newest-first, capped — the page paginates client-side like the other lists.
 *  1,000 is far above the realistic volume for a 5-question marketing quiz and
 *  keeps a single fetch well inside PostgREST's default limits. */
export function useSpacologyResults() {
  return useQuery({
    queryKey: qk.spacologyResults,
    queryFn: async (): Promise<SpacologyResultRow[]> => {
      const { data, error } = await supabase
        .from("spacology_results")
        .select("*")
        .order("submitted_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as SpacologyResultRow[];
    },
  });
}

/** Staff annotation. The DB guard trigger rejects any attempt to touch the
 *  submitted answers, so this is deliberately narrow. */
export function useUpdateSpacologyNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; notes: string | null }): Promise<void> => {
      const { data, error } = await supabase
        .from("spacology_results")
        .update({ notes: args.notes?.trim() || null })
        .eq("id", args.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("You don't have permission to annotate Spacology results.");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.spacologyResults }),
  });
}

/** Admin-tier only (spam / test submissions). RLS returns zero rows rather than
 *  an error when the caller isn't admin, so we surface that as a real message. */
export function useDeleteSpacologyResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { data, error } = await supabase.from("spacology_results").delete().eq("id", id).select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Only an admin can delete Spacology submissions.");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.spacologyResults }),
  });
}

/** Mirrors the `spacology_results_delete_admin` policy (`is_admin_tier()`), so
 *  the UI hides a button the database would refuse anyway. The DB remains the
 *  actual gate — this is presentation only. */
export function canDeleteSpacologyResult(role: StaffRow["role"] | null | undefined): boolean {
  if (!role) return false;
  return role === "principal" || role === "admin" || role === "admin_exec";
}

export type SpacologySummary = {
  total: number;
  last7: number;
  last30: number;
  withContact: number;
  /** Answered "yes" to renovating in the next 3–6 months — the follow-up queue. */
  renovatingSoon: number;
  byType: Record<SpaceType, number>;
  topType: SpaceType | null;
  avgDurationMs: number | null;
  topSource: string | null;
};

/** A row counts as a lead once we know how to reach the person. Rows submitted
 *  before the quiz gained its contact gate have none, and never will. */
export function isSpacologyLead(row: SpacologyResultRow): boolean {
  return Boolean(row.name || row.email || row.phone);
}

/** `wa.me` wants digits only — no `+`, spaces or dashes. */
export function whatsappHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? `https://wa.me/${digits}` : null;
}

export function computeSpacologySummary(rows: SpacologyResultRow[]): SpacologySummary {
  const now = Date.now();
  const DAY = 86_400_000;

  const byType: Record<SpaceType, number> = { fruit: 0, flower: 0, leaf: 0, wood: 0, root: 0 };
  let last7 = 0;
  let last30 = 0;
  let withContact = 0;
  let renovatingSoon = 0;
  let durationSum = 0;
  let durationCount = 0;
  const sourceCounts = new Map<string, number>();

  for (const r of rows) {
    if (r.result_type in byType) byType[r.result_type as SpaceType] += 1;

    const age = now - new Date(r.submitted_at).getTime();
    if (age <= 7 * DAY) last7 += 1;
    if (age <= 30 * DAY) last30 += 1;

    if (isSpacologyLead(r)) withContact += 1;
    if (r.planning_renovation === true) renovatingSoon += 1;

    if (typeof r.duration_ms === "number" && r.duration_ms > 0) {
      durationSum += r.duration_ms;
      durationCount += 1;
    }

    const src = r.utm_source?.trim() || r.source?.trim();
    if (src) sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
  }

  let topType: SpaceType | null = null;
  for (const t of Object.keys(byType) as SpaceType[]) {
    if (byType[t] > 0 && (topType === null || byType[t] > byType[topType])) topType = t;
  }

  let topSource: string | null = null;
  let topSourceCount = 0;
  sourceCounts.forEach((n, src) => {
    if (n > topSourceCount) {
      topSource = src;
      topSourceCount = n;
    }
  });

  return {
    total: rows.length,
    last7,
    last30,
    withContact,
    renovatingSoon,
    byType,
    topType,
    avgDurationMs: durationCount > 0 ? Math.round(durationSum / durationCount) : null,
    topSource,
  };
}

/** `answers` is jsonb — validated on insert by the RPC, but a hand-edited or
 *  future-version row could still be anything, so parse defensively. */
export function parseSpacologyAnswers(value: unknown): SpacologyAnswer[] {
  if (!Array.isArray(value)) return [];
  return value.filter((a): a is SpacologyAnswer => typeof a === "object" && a !== null);
}

export function parseSpacologyScores(value: unknown): SpacologyScores {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: SpacologyScores = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number") out[k as SpaceType] = v;
  }
  return out;
}

// ─── ANALYTICS / COMPUTED VIEWS ─────────────────────────────────────────────
//
// These are pure functions operating on already-fetched data. Components
// fetch via the hooks above, then call these to derive the views they need.
// Mirrors the old performanceData.ts / reminderData.ts helpers but with
// no implicit dependency on mock arrays.

import {
  getToday,
  daysFromToday as _daysFromToday,
} from "@/lib/lifecycleData";

export { getToday };
export { _daysFromToday as daysFromToday };

function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfYear (d: Date): Date { return new Date(d.getFullYear(), 0, 1); }
function parseISODate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// ── Performance: per-staff sales metrics ──

export type StaffPerformance = {
  staffId: string;
  name: string;
  avatar: string;
  role: string;
  monthlyTarget: number;
  ytdTarget: number;
  gpTargetPct: number;
  awardedYTD: number;
  awardedThisMonth: number;
  awardedCount: number;
  pipelineRM: number;
  pipelineCount: number;
  projectedGP: number;
  ytdAchievementPct: number;
  monthAchievementPct: number;
};

export function computeStaffPerformance(
  staff: StaffRow,
  target: SalesTargetRow,
  inquiries: Inquiry[],
  today: Date = getToday(),
): StaffPerformance {
  const sMonth = startOfMonth(today);
  const sYear = startOfYear(today);
  // Attribute by staff id (immutable), NOT avatar_code — two staff can share
  // initials, which would cross-credit their pipeline/awards on the leaderboard.
  const mine = inquiries.filter((i) => i.assignedToId === staff.id);

  let awardedYTD = 0;
  let awardedThisMonth = 0;
  let awardedCount = 0;
  for (const inq of mine) {
    if (inq.stage !== "awarded") continue;
    const d = parseISODate(inq.awarded_date);
    if (!d || d < sYear) continue;
    awardedCount += 1;
    const v = Number(inq.estimated_budget ?? 0);
    awardedYTD += v;
    if (d >= sMonth) awardedThisMonth += v;
  }

  const pipeline = mine.filter((i) => i.stage === "new-inquiry" || i.stage === "showroom-meet");
  const pipelineRM = pipeline.reduce((s, i) => s + Number(i.estimated_budget ?? 0), 0);
  const projectedGP = awardedYTD * (Number(target.gp_target_pct) / 100);

  return {
    staffId: staff.id,
    name: staff.name,
    avatar: staff.avatar_code,
    role: staff.job_title,
    monthlyTarget: Number(target.monthly_target),
    ytdTarget: Number(target.ytd_target),
    gpTargetPct: Number(target.gp_target_pct),
    awardedYTD,
    awardedThisMonth,
    awardedCount,
    pipelineRM,
    pipelineCount: pipeline.length,
    projectedGP,
    ytdAchievementPct: Number(target.ytd_target) === 0 ? 0 : awardedYTD / Number(target.ytd_target),
    monthAchievementPct: Number(target.monthly_target) === 0 ? 0 : awardedThisMonth / Number(target.monthly_target),
  };
}

/** Returns a sorted leaderboard (top awarded YTD first). */
export function computeTeamPerformance(
  staffList: StaffRow[],
  targets: SalesTargetRow[],
  inquiries: Inquiry[],
  today: Date = getToday(),
): StaffPerformance[] {
  const staffById = new Map(staffList.map((s) => [s.id, s]));
  return targets
    .map((t) => {
      const s = staffById.get(t.staff_id);
      return s ? computeStaffPerformance(s, t, inquiries, today) : null;
    })
    .filter((p): p is StaffPerformance => p !== null)
    .sort((a, b) => b.awardedYTD - a.awardedYTD);
}

export type CompanyPerformance = {
  awardedYTD: number;
  awardedThisMonth: number;
  monthlyRevenueTarget: number;
  ytdRevenueTarget: number;
  monthAchievementPct: number;
  ytdAchievementPct: number;
  projectedGP: number;
  gpTargetPct: number;
  invoicedRM: number;
  collectedRM: number;
  pipelineRM: number;
};

export const COMPANY_GP_TARGET_PCT = 25;

export function computeCompanyPerformance(
  team: StaffPerformance[],
  targets: SalesTargetRow[],
  quotations: QuotationWithItems[],
): CompanyPerformance {
  const awardedYTD = team.reduce((s, p) => s + p.awardedYTD, 0);
  const awardedThisMonth = team.reduce((s, p) => s + p.awardedThisMonth, 0);
  const pipelineRM = team.reduce((s, p) => s + p.pipelineRM, 0);
  const ytdRevenueTarget = targets.reduce((s, t) => s + Number(t.ytd_target), 0);
  const monthlyRevenueTarget = targets.reduce((s, t) => s + Number(t.monthly_target), 0);

  let invoicedRM = 0;
  let collectedRM = 0;
  for (const q of quotations) {
    const isInvoice = q.doc_type === "Invoice" || q.status === "invoiced" || q.status === "paid";
    if (!isInvoice) continue;
    const total = q.items.reduce(
      (s, it) => s + it.qty * it.unitPrice * (1 - it.discount / 100),
      0,
    );
    const withTax = total * (1 + Number(q.tax_rate) / 100);
    invoicedRM += withTax;
    if (q.status === "paid") collectedRM += withTax;
  }

  return {
    awardedYTD,
    awardedThisMonth,
    monthlyRevenueTarget,
    ytdRevenueTarget,
    monthAchievementPct: monthlyRevenueTarget === 0 ? 0 : awardedThisMonth / monthlyRevenueTarget,
    ytdAchievementPct: ytdRevenueTarget === 0 ? 0 : awardedYTD / ytdRevenueTarget,
    projectedGP: awardedYTD * (COMPANY_GP_TARGET_PCT / 100),
    gpTargetPct: COMPANY_GP_TARGET_PCT,
    invoicedRM,
    collectedRM,
    pipelineRM,
  };
}

// ── Reminders: compose from real data ──

export type ReminderType = "daily-site-photo" | "weekly-payment-review" | "weekly-site-report";
export type ReminderStatus = "completed" | "pending" | "overdue" | "upcoming";

export type Reminder = {
  id: string;
  type: ReminderType;
  title: string;
  dueDate: string;             // DD/MM/YYYY
  assignee: string;            // avatar code
  projectId?: string;
  projectName?: string;
  status: ReminderStatus;
  completedAt?: string;
  note?: string;
};

export type SitePhotoMap = {
  // map of DD/MM/YYYY → photo metadata (uploaded if a row exists)
  projectId: string;
  photos: Record<string, { uploaded: boolean; uploadedAt?: string; by?: string; storagePath?: string }>;
};

function fmtDDMM(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function lastNDays(n: number, today: Date = getToday()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(fmtDDMM(d));
  }
  return out;
}

/** Build a 14-day photo map for each active project from real site_photos rows. */
export function buildSitePhotoMaps(
  activeProjectIds: string[],
  photos: SitePhotoRow[],
  staff: StaffRow[],
  today: Date = getToday(),
): SitePhotoMap[] {
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const days = lastNDays(14, today);
  return activeProjectIds.map((projectId) => {
    const log: SitePhotoMap["photos"] = {};
    for (const day of days) {
      const iso = ddmmyyyyToIso(day);
      const match = photos.find((p) => p.project_id === projectId && p.photo_date === iso);
      if (match) {
        const uploader = match.uploaded_by_id ? staffById.get(match.uploaded_by_id) : null;
        const uploadedDate = new Date(match.uploaded_at);
        const hh = String(uploadedDate.getHours()).padStart(2, "0");
        const mn = String(uploadedDate.getMinutes()).padStart(2, "0");
        log[day] = {
          uploaded: true,
          uploadedAt: `${hh}:${mn}`,
          by: uploader?.avatar_code,
          storagePath: match.storage_path ?? undefined,
        };
      } else {
        log[day] = { uploaded: false };
      }
    }
    return { projectId, photos: log };
  });
}

function upcomingFriday(today: Date): Date {
  const d = new Date(today);
  const diff = (5 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Generate the live reminder list from real projects + photo maps + active assignment. */
export function buildReminders(
  projects: Project[],
  photoMaps: SitePhotoMap[],
  today: Date = getToday(),
  paymentAdminAvatar = "DN",      // Denise Ng (Admin Exec) handles weekly payment review
): Reminder[] {
  const todayStr = fmtDDMM(today);
  const reminders: Reminder[] = [];

  // — Today's close-door photos —
  for (const map of photoMaps) {
    const project = projects.find((p) => p.id === map.projectId);
    if (!project) continue;
    const todayPhoto = map.photos[todayStr];
    const status: ReminderStatus = todayPhoto?.uploaded ? "completed" : "pending";
    reminders.push({
      id: `RM-${map.projectId}-PHOTO-${todayStr}`,
      type: "daily-site-photo",
      title: `Close-door photo · ${project.name}`,
      dueDate: todayStr,
      assignee: todayPhoto?.by || "LH",
      projectId: project.id,
      projectName: project.name,
      status,
      completedAt: todayPhoto?.uploaded ? todayPhoto.uploadedAt : undefined,
      note: status === "completed" ? `Uploaded ${todayPhoto?.uploadedAt}` : "Awaiting upload",
    });
  }

  // — Missed photos in the last 14 days —
  for (const map of photoMaps) {
    const project = projects.find((p) => p.id === map.projectId);
    if (!project) continue;
    for (const [day, photo] of Object.entries(map.photos)) {
      if (day === todayStr) continue;
      if (photo.uploaded) continue;
      reminders.push({
        id: `RM-${map.projectId}-PHOTO-${day}`,
        type: "daily-site-photo",
        title: `Missed: close-door photo · ${project.name}`,
        dueDate: day,
        assignee: "LH",
        projectId: project.id,
        projectName: project.name,
        status: "overdue",
        note: `No photo logged on ${day}`,
      });
    }
  }

  // — Weekly payment review (Friday) —
  const fri = upcomingFriday(today);
  const friStr = fmtDDMM(fri);
  const friDays = _daysFromToday(friStr, today) ?? 7;
  reminders.push({
    id: `RM-WEEKLY-PAYMENT-${friStr}`,
    type: "weekly-payment-review",
    title: "Weekly Payment Review",
    dueDate: friStr,
    assignee: paymentAdminAvatar,
    status: friDays === 0 ? "pending" : "upcoming",
    note: "Reconcile collected vs outstanding · review overdue gates",
  });

  // — Weekly site report per active project —
  const ACTIVE_STATUSES = new Set(["active", "assigned", "under-review"]);
  for (const project of projects) {
    if (!ACTIVE_STATUSES.has(project.status)) continue;
    reminders.push({
      id: `RM-${project.id}-SITE-REPORT-${friStr}`,
      type: "weekly-site-report",
      title: `Weekly Site Report · ${project.name}`,
      dueDate: friStr,
      assignee: project.team[0] || "WH",
      projectId: project.id,
      projectName: project.name,
      status: friDays === 0 ? "pending" : "upcoming",
      note: "Photos · progress · blockers · next-week plan",
    });
  }

  const order: Record<ReminderStatus, number> = { overdue: 0, pending: 1, upcoming: 2, completed: 3 };
  return reminders.sort((a, b) => {
    if (a.status !== b.status) return order[a.status] - order[b.status];
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export type ReminderSummary = {
  todayPending: number;
  todayCompleted: number;
  thisWeekUpcoming: number;
  overdue: number;
  streak: number;
  total: number;
};

export function reminderSummary(
  reminders: Reminder[],
  photoMaps: SitePhotoMap[],
  today: Date = getToday(),
): ReminderSummary {
  const todayStr = fmtDDMM(today);
  const todayItems = reminders.filter((r) => r.dueDate === todayStr);
  const todayPending = todayItems.filter((r) => r.status === "pending").length;
  const todayCompleted = todayItems.filter((r) => r.status === "completed").length;
  const thisWeekUpcoming = reminders.filter((r) => r.status === "upcoming").length;
  const overdue = reminders.filter((r) => r.status === "overdue").length;

  // Streak = consecutive days *before* today where every active site logged a photo
  let streak = 0;
  const days = lastNDays(14, today).slice().reverse();
  for (let i = 1; i < days.length; i++) {
    const day = days[i];
    const allUploaded = photoMaps.every((m) => m.photos[day]?.uploaded);
    if (allUploaded) streak += 1;
    else break;
  }

  return { todayPending, todayCompleted, thisWeekUpcoming, overdue, streak, total: reminders.length };
}

// ── Project timeline ──

export type TimelineRow = {
  projectId: string;
  name: string;
  client: string;
  status: string;
  designer: string;
  start: Date;
  end: Date;
  progressPct: number;
  budget: number;
};

function parseDDMMYYYYDate(s?: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
}

export function buildProjectTimeline(projects: Project[]): TimelineRow[] {
  return projects
    .map((p) => {
      const start = parseDDMMYYYYDate(p.startDate);
      const end = parseDDMMYYYYDate(p.targetDate);
      if (!start || !end) return null;
      return {
        projectId: p.id,
        name: p.name,
        client: p.client,
        status: p.status,
        designer: p.designer,
        start,
        end,
        progressPct: p.progress,
        budget: p.budget,
      } as TimelineRow;
    })
    .filter((r): r is TimelineRow => r !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function timelineBounds(rows: TimelineRow[]): { min: Date; max: Date } {
  if (rows.length === 0) return { min: new Date(2026, 0, 1), max: new Date(2026, 11, 31) };
  const minMs = Math.min(...rows.map((r) => r.start.getTime()));
  const maxMs = Math.max(...rows.map((r) => r.end.getTime()));
  return { min: new Date(minMs), max: new Date(maxMs) };
}

export function timelinePos(d: Date, bounds: { min: Date; max: Date }): number {
  const span = bounds.max.getTime() - bounds.min.getTime();
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (d.getTime() - bounds.min.getTime()) / span));
}

/** Compact RM formatter: 1,200,000 → RM 1.2M; 150,000 → RM 150K */
export function formatRMCompact(value: number): string {
  if (value >= 1_000_000) return `RM ${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `RM ${(value / 1_000).toFixed(0)}K`;
  return `RM ${value.toFixed(0)}`;
}
