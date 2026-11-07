/*
 * SPAZEHAUS — Reusable "add-column" uploader (Phase 2, 7 Nov 2026 supervisor review)
 *
 * User-named columns the staff fill in, each with a date and an OPTIONAL
 * full-resolution file (no compression), up to `maxColumns`. One component serves
 * every section (Drawings first; Site Inspections, Progressive Payment, Variation
 * Order reuse it later) via the `section` key + a few config props.
 *
 * Works on desktop (office) and mobile (on-site): cards stack 1-up on phones and
 * flow to 2–3 columns on wider screens.
 */
import { useRef, useState } from "react";
import { Plus, Trash2, Upload, FileText, ExternalLink, X, Loader2, CalendarClock, Coins } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  useProjectColumns,
  useAddColumn,
  useUpdateColumn,
  useUploadColumnFile,
  useRemoveColumnFile,
  useDeleteColumn,
  getColumnFileUrl,
  type ProjectColumn,
} from "@/lib/queries";

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
/** Native date input (YYYY-MM-DD) → DD/MM/YYYY for the mutation. "" → null. */
function inputDateToDDMM(v: string): string | null {
  if (!v) return null;
  const [y, m, d] = v.split("-");
  return y && m && d ? `${d}/${m}/${y}` : null;
}

export default function ColumnGrid({
  projectId,
  section,
  title,
  description,
  canManage = false,
  maxColumns = 10,
  withAmount = false,
  labelPlaceholder = "Name this column",
  addLabel = "Add column",
  accept,
  emptyHint,
}: {
  projectId: string;
  section: string;
  title: string;
  description?: string;
  canManage?: boolean;
  maxColumns?: number;
  withAmount?: boolean;
  labelPlaceholder?: string;
  addLabel?: string;
  accept?: string;
  emptyHint?: string;
}) {
  const { data: columns = [], isLoading } = useProjectColumns(projectId, section);
  const addColumn = useAddColumn();
  const { staff: me } = useAuth();

  const atMax = columns.length >= maxColumns;
  const handleAdd = () => {
    const lastSort = columns.length ? Math.max(...columns.map((c) => c.sort_order)) : 0;
    addColumn.mutate(
      { projectId, section, by: me?.avatar_code ?? null, afterSort: lastSort },
      { onError: (e) => toast.error(`Couldn't add: ${e instanceof Error ? e.message : "error"}`) },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>{title}</p>
          {description && <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>{description}</p>}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={atMax || addColumn.isPending}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-label"
            style={{
              background: atMax ? "var(--s-2)" : "var(--acc)",
              color: atMax ? "var(--t-5)" : "oklch(1 0 0)",
              cursor: atMax ? "not-allowed" : "pointer",
              letterSpacing: "0.03em",
            }}
            title={atMax ? `Max ${maxColumns} columns` : addLabel}
          >
            <Plus size={14} /> {addLabel}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-xl p-6 text-center text-xs" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", color: "var(--t-5)" }}>
          Loading…
        </div>
      ) : columns.length === 0 ? (
        <div className="rounded-xl p-6 text-center" style={{ background: "var(--s-card)", border: "1px dashed var(--b-strong)" }}>
          <FileText size={22} className="mx-auto mb-2" style={{ color: "var(--t-7)" }} />
          <p className="text-xs" style={{ color: "var(--t-5)" }}>
            {emptyHint ?? "No columns yet."}{canManage ? ` Use "${addLabel}" to start.` : ""}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {columns.map((col) => (
            <ColumnCard
              key={col.id}
              col={col}
              projectId={projectId}
              section={section}
              canManage={canManage}
              withAmount={withAmount}
              labelPlaceholder={labelPlaceholder}
              accept={accept}
            />
          ))}
        </div>
      )}

      {canManage && columns.length > 0 && (
        <p className="text-[10px]" style={{ color: "var(--t-6)" }}>
          {columns.length}/{maxColumns} columns · files are stored at full resolution.
        </p>
      )}
    </div>
  );
}

function ColumnCard({
  col, projectId, section, canManage, withAmount, labelPlaceholder, accept,
}: {
  col: ProjectColumn;
  projectId: string;
  section: string;
  canManage: boolean;
  withAmount: boolean;
  labelPlaceholder: string;
  accept?: string;
}) {
  const updateColumn = useUpdateColumn();
  const uploadFile = useUploadColumnFile();
  const removeFile = useRemoveColumnFile();
  const deleteColumn = useDeleteColumn();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [opening, setOpening] = useState(false);

  const common = { id: col.id, projectId, section };

  const saveLabel = (label: string) => {
    if (label === col.label) return;
    updateColumn.mutate({ ...common, label }, { onError: (e) => toast.error(`Couldn't save: ${e instanceof Error ? e.message : "error"}`) });
  };
  const saveDate = (v: string) => {
    updateColumn.mutate({ ...common, colDate: inputDateToDDMM(v) }, { onError: (e) => toast.error(`Couldn't save date: ${e instanceof Error ? e.message : "error"}`) });
  };
  const saveAmount = (v: string) => {
    const n = v === "" ? null : Number(v);
    if (n !== null && Number.isNaN(n)) return;
    updateColumn.mutate({ ...common, amount: n }, { onError: (e) => toast.error(`Couldn't save amount: ${e instanceof Error ? e.message : "error"}`) });
  };
  const onPickFile = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    uploadFile.mutate(
      { ...common, file, prevPath: col.file_path },
      {
        onSuccess: () => toast.success("File uploaded"),
        onError: (e) => toast.error(`Upload failed: ${e instanceof Error ? e.message : "error"}`),
      },
    );
    if (fileRef.current) fileRef.current.value = "";
  };
  const openFile = async () => {
    if (!col.file_path) return;
    setOpening(true);
    const url = await getColumnFileUrl(col.file_path);
    setOpening(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast.error("Couldn't open file");
  };

  const busy = uploadFile.isPending || updateColumn.isPending;

  return (
    <div className="rounded-xl p-3 flex flex-col gap-2.5" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
      {/* Label (staff-named) + delete */}
      <div className="flex items-center gap-1.5">
        {canManage ? (
          <input
            type="text"
            defaultValue={col.label}
            placeholder={labelPlaceholder}
            onBlur={(e) => saveLabel(e.target.value.trim())}
            className="flex-1 min-w-0 text-sm font-medium rounded-md px-2 py-1.5"
            style={{ background: "var(--s-2)", border: "1px solid var(--b-strong)", color: "var(--t-1)" }}
          />
        ) : (
          <p className="flex-1 min-w-0 text-sm font-medium truncate" style={{ color: col.label ? "var(--t-1)" : "var(--t-5)" }}>
            {col.label || "Untitled"}
          </p>
        )}
        {canManage && (
          confirmingDelete ? (
            <span className="inline-flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => deleteColumn.mutate({ ...common, path: col.file_path }, { onError: (e) => toast.error(`Couldn't delete: ${e instanceof Error ? e.message : "error"}`) })}
                className="text-[10px] font-label px-1.5 py-1 rounded-md"
                style={{ background: "oklch(0.60 0.16 25 / 14%)", color: "oklch(0.50 0.16 25)", border: "1px solid oklch(0.60 0.16 25 / 30%)", cursor: "pointer" }}
              >
                Delete
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="p-1 rounded-md" style={{ color: "var(--t-5)", cursor: "pointer" }} aria-label="Cancel delete">
                <X size={13} />
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="p-1.5 rounded-md shrink-0" style={{ color: "var(--t-6)", cursor: "pointer" }} aria-label="Delete column">
              <Trash2 size={14} />
            </button>
          )
        )}
      </div>

      {/* Date */}
      <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--t-5)" }}>
        <CalendarClock size={12} />
        <input
          type="date"
          defaultValue={col.col_date ?? ""}
          disabled={!canManage}
          onChange={(e) => saveDate(e.target.value)}
          className="flex-1 text-[11px] rounded-md px-1.5 py-1"
          style={{ background: "var(--s-2)", border: "1px solid var(--b-strong)", color: "var(--t-2)" }}
        />
      </label>

      {/* Amount (progressive payment only) */}
      {withAmount && (
        <label className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--t-5)" }}>
          <Coins size={12} />
          <span style={{ color: "var(--t-5)" }}>RM</span>
          <input
            type="number"
            inputMode="decimal"
            defaultValue={col.amount ?? ""}
            disabled={!canManage}
            placeholder="0"
            onBlur={(e) => saveAmount(e.target.value)}
            className="flex-1 w-full text-[12px] rounded-md px-1.5 py-1 text-right"
            style={{ background: "var(--s-2)", border: "1px solid var(--b-strong)", color: "var(--t-1)" }}
          />
        </label>
      )}

      {/* File */}
      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={(e) => onPickFile(e.target.files)} />
      {col.file_path ? (
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ background: "var(--s-2)", border: "1px solid var(--b-1)" }}>
          <FileText size={14} style={{ color: "var(--acc-ink)", flexShrink: 0 }} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] truncate" style={{ color: "var(--t-2)" }}>{col.file_name ?? "File"}</p>
            {col.file_size ? <p className="text-[9px]" style={{ color: "var(--t-6)" }}>{formatBytes(col.file_size)}</p> : null}
          </div>
          <button type="button" onClick={openFile} disabled={opening} className="p-1 rounded-md" style={{ color: "var(--acc-ink)", cursor: "pointer" }} aria-label="Open file">
            {opening ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
          </button>
          {canManage && (
            <>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="text-[9px] font-label px-1.5 py-1 rounded-md" style={{ color: "var(--t-3)", border: "1px solid var(--b-strong)", cursor: "pointer" }}>
                Replace
              </button>
              <button type="button" onClick={() => removeFile.mutate({ ...common, path: col.file_path! }, { onError: (e) => toast.error(`Couldn't remove: ${e instanceof Error ? e.message : "error"}`) })} className="p-1 rounded-md" style={{ color: "var(--t-6)", cursor: "pointer" }} aria-label="Remove file">
                <X size={13} />
              </button>
            </>
          )}
        </div>
      ) : canManage ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadFile.isPending}
          className="flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-label"
          style={{ background: "transparent", color: "var(--acc-ink)", border: "1px dashed var(--b-strong)", cursor: "pointer" }}
        >
          {uploadFile.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploadFile.isPending ? "Uploading…" : "Upload file (optional)"}
        </button>
      ) : (
        <p className="text-[10px] italic" style={{ color: "var(--t-6)" }}>No file</p>
      )}
    </div>
  );
}
