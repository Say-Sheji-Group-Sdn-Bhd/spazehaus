/*
 * SPAZEHAUS — Database row types (app-facing aliases)
 *
 * Every type in this file is *derived* from `Database` in
 * `client/src/lib/database.types.ts`. That schema mapping is the single
 * source of truth and is replaceable via:
 *
 *   export SUPABASE_ACCESS_TOKEN=...
 *   bun x supabase gen types typescript --project-id exajkbvaqjqdedqavbvs \
 *     > client/src/lib/database.types.ts
 *
 * Aliases below exist because the rest of the codebase imports `StaffRow`,
 * `ProjectRow`, etc. by name. Keep this file as a thin re-export layer.
 */

import type { Database, Tables, Enums } from "@/lib/database.types";

// ─── ENUMS ──────────────────────────────────────────────────────────────────

export type StaffRole = Enums<"staff_role">;
export type StaffStatus = Enums<"staff_status">;

export type ProjectStatus = Enums<"project_status">;
export type ProjectPriority = Enums<"project_priority">;

export type InquiryStage = Enums<"inquiry_stage">;
export type CustomerCategory = Enums<"customer_category">;
export type CustomerTier = Enums<"customer_tier">;

export type CheckpointStatus = Enums<"checkpoint_status">;

export type QuotationType = Enums<"quotation_type">;
export type QuotationStatus = Enums<"quotation_status">;
export type LineItemCategory = Enums<"line_item_category">;

export type LeaveStatus = Enums<"leave_status">;
export type CalendarEventType = Enums<"calendar_event_type">;

// kpi_records.rating + audit_log.action are constrained by CHECK constraints
// rather than enums, so they live on the table row shapes directly. Re-export
// the literal types for callers that need them.
export type KpiRating = Tables<"kpi_records">["rating"];
export type AuditAction = Tables<"audit_log">["action"];

// ─── ROW SHAPES (Select / Insert / Update from `Database`) ──────────────────

export type StaffRow = Tables<"staff">;
export type ProjectRow = Tables<"projects">;
export type PaymentRecordRow = Tables<"payment_records">;
export type SignatureRecordRow = Tables<"signature_records">;
export type InquiryRow = Tables<"inquiries">;
export type QuotationRow = Tables<"quotations">;
export type QuotationItemRow = Tables<"quotation_items">;
export type LeaveRequestRow = Tables<"leave_requests">;
export type CandidateRow = Tables<"candidates">;
export type AnnouncementRow = Tables<"announcements">;
export type SitePhotoRow = Tables<"site_photos">;
export type SalesTargetRow = Tables<"sales_targets">;
export type AuditLogRow = Tables<"audit_log">;
export type CalendarEventRow = Tables<"calendar_events">;
export type CalendarEventStaffRow = Tables<"calendar_event_staff">;
export type KpiRecordRow = Tables<"kpi_records">;
export type LifecycleStageRow = Tables<"lifecycle_stages">;
export type ProjectTaskRow = Tables<"project_tasks">;
export type ProjectReviewRow = Tables<"project_reviews">;
export type SpacologyResultRow = Tables<"spacology_results">;

// ─── EMBEDDED JSON SHAPES ───────────────────────────────────────────────────
// inquiry.contact_log is typed as JSON in the Database schema, but the app
// reads it with a stable structure. Keep this shape declared here so callers
// don't have to cast on every read.

export type ContactLogEntryDb = {
  date: string;                  // DD/MM/YYYY
  type: "call" | "email" | "whatsapp" | "meet" | "site-visit";
  note: string;
  by: string;
};

// spacology_results.scores + .answers are jsonb. The submit RPC validates their
// shape on the way in, so readers can rely on these structures.

export type SpaceType = "fruit" | "flower" | "leaf" | "wood" | "root";

export type SpacologyScores = Partial<Record<SpaceType, number>>;

export type SpacologyAnswer = {
  index: number;                 // 0-based question position
  question_en?: string;          // question text as it read at submission time
  question_cn?: string;
  option_index: number;          // 0-based option position
  option_en?: string;
  option_cn?: string;
  scores?: SpacologyScores;      // what this option contributed
};

// ─── WEBSITE ENQUIRIES ──────────────────────────────────────────────────────
// Contact-form submissions from the marketing site (spazehaus.com/contact),
// written by the public `submit_website_enquiry` RPC. Immutable except for the
// workflow columns (status / staff_note / inquiry_id). See migration
// 20261103000000_website_enquiries.sql.
//
// NOTE: hand-written on purpose — the `website_enquiries` table isn't in
// `database.types.ts` until the migration is applied AND `bun run gen:types` is
// re-run. After that, replace this block with:
//   export type WebsiteEnquiryRow = Tables<"website_enquiries">;
// (the shape below mirrors the migration exactly, so nothing else needs to change).

export type EnquiryStatus = "new" | "contacted" | "qualified" | "unqualified" | "consulted" | "spam";

export type WebsiteEnquiryRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  project_location: string | null;
  project_type: string | null;
  property: string | null;
  budget: string | null;
  timeline: string | null;
  heard_via: string | null;
  message: string | null;
  locale: string | null;
  source: string;
  referrer: string | null;
  landing_path: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  user_agent: string | null;
  status: EnquiryStatus;
  staff_note: string | null;
  inquiry_id: string | null;
  submitted_at: string;
  created_at: string;
};

// ─── RE-EXPORT `Database` ITSELF (for advanced callers) ─────────────────────

export type { Database } from "@/lib/database.types";
