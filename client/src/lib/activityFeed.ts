/*
 * SHARED ACTIVITY-FEED HELPERS
 * Pure formatters for turning raw `audit_log` rows into human-readable feed
 * lines. Used by both the admin Audit Log viewer (full diff list) and the
 * Dashboard "Recent Activity" card (compact summary). Kept dependency-free so
 * either surface can import without dragging in page concerns.
 */
import type { AuditEntry } from "@/lib/queries";
import type { AuditAction } from "@/lib/dbTypes";

/** Past-tense verb per audit action — the generic fallback wording. */
export const ACTION_VERB: Record<AuditAction, string> = {
  INSERT: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
};

/** Relative time formatter — "just now", "5m ago", "2h ago", "3d ago", "12 Feb". */
export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}

/** Smart one-line summary for an audit entry. Falls back to a generic verb + table. */
export function summarizeAudit(entry: AuditEntry): string {
  const { table_name, action, before_data, after_data } = entry;
  const after = (after_data ?? {}) as Record<string, unknown>;
  const before = (before_data ?? {}) as Record<string, unknown>;

  if (table_name === "payment_records") {
    const gate = (after.gate ?? before.gate) as number | undefined;
    const gateLabel = gate ? ["①", "②", "③", "④", "⑤"][gate - 1] : "?";
    if (action === "UPDATE" && before.status !== "completed" && after.status === "completed") {
      const amount = after.amount as number | undefined;
      return `Marked payment ${gateLabel} collected${amount ? ` — RM ${Number(amount).toLocaleString()}` : ""}`;
    }
    if (action === "INSERT") {
      return `New payment ${gateLabel}${after.amount ? ` — RM ${Number(after.amount).toLocaleString()}` : ""}`;
    }
  }

  if (table_name === "signature_records") {
    const label = (after.label ?? before.label) as string | undefined;
    if (action === "UPDATE") {
      if (before.status !== "completed" && after.status === "completed") {
        return `Signed ${label ?? "document"}${after.signed_by ? ` by ${after.signed_by}` : ""}`;
      }
      if (before.document_ref !== after.document_ref && after.document_ref) {
        return `Uploaded document for ${label ?? "signature"}`;
      }
    }
  }

  if (table_name === "projects") {
    if (action === "INSERT") {
      return `New project ${after.name ?? entry.row_id}`;
    }
    if (action === "UPDATE" && before.current_stage_id !== after.current_stage_id) {
      // Manual-status model (7 Nov 2026): the stage mirrors the earliest unfinished
      // stage, so it can move either direction — keep the wording neutral.
      return `Stage moved ${before.current_stage_id ?? "—"} → ${after.current_stage_id ?? "—"}`;
    }
    if (action === "UPDATE" && before.status !== after.status) {
      return `Project ${after.name ?? entry.row_id} status: ${after.status}`;
    }
  }

  if (table_name === "inquiries") {
    if (action === "INSERT") return `New inquiry from ${after.client_name ?? entry.row_id}`;
    if (action === "UPDATE" && before.stage !== after.stage) {
      return `Inquiry ${entry.row_id} → ${after.stage}`;
    }
  }

  if (table_name === "leave_requests") {
    if (action === "INSERT") return `Leave request from staff ${after.staff_id ?? entry.row_id}`;
    if (action === "UPDATE" && before.status !== after.status) {
      return `Leave ${entry.row_id} ${after.status}`;
    }
  }

  if (table_name === "quotations") {
    if (action === "INSERT") return `New ${(after.doc_type ?? "quotation")} ${entry.row_id}`;
    if (action === "UPDATE" && before.status !== after.status) {
      return `Quotation ${entry.row_id} → ${after.status}`;
    }
  }

  if (table_name === "staff") {
    if (action === "INSERT") return `New staff ${after.name ?? entry.row_id}`;
    if (action === "UPDATE" && before.auth_user_id !== after.auth_user_id && after.auth_user_id) {
      return `Linked auth account to ${after.name ?? entry.row_id}`;
    }
  }

  // Fallback
  return `${ACTION_VERB[action]} ${table_name} ${entry.row_id || ""}`.trim();
}
