/*
 * SPAZEHAUS SIGN-DOCUMENT SHEET
 * Bottom-sheet form used to upload a signature document (PDF / image) for a
 * project's contract or drawing checkpoint, optionally marking the row as
 * signed in the same submit.
 *
 * Flow:
 *   1. Pick a PDF (or image) — uploaded to the `signature-docs` Storage bucket
 *      at path `{projectId}/{signatureKey}/{timestamp}.{ext}`. The row's
 *      `document_ref` is updated to the new path.
 *   2. Optionally fill in Signed Date + Signed By + Notes — when present,
 *      the row's status flips to `completed`.
 *
 * RLS gates both writes to the OPS tier (principal / admin / admin_exec /
 * pm / site_supervisor) — see Phase 0D + Tier 1 signature-docs migration.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Receipt, Check, AlertCircle, Upload, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { validateUploadFile } from "@/lib/upload";
import {
  useUploadSignatureDoc,
  useUpdateSignature,
  getSignatureDocUrl,
  isStorageDocRef,
} from "@/lib/queries";
import { useIsDesktop } from "@/hooks/useMobile";

function pad(n: number) { return String(n).padStart(2, "0"); }
function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isoToDDMM(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

export type SignDocumentTarget = {
  id: number;
  projectId: string;
  projectName?: string;
  signatureKey: string;
  label: string;
  group: "contract" | "drawing";
  status: "completed" | "in-progress" | "pending" | "overdue" | "skipped";
  documentRef?: string | null;
  signedDate?: string;             // DD/MM/YYYY (if already signed)
  signedBy?: string | null;
  notes?: string | null;
  defaultSignedBy?: string;        // pre-fill — typically the client name
};

export default function SignDocumentSheet({
  target,
  open,
  onClose,
}: {
  target: SignDocumentTarget | null;
  open: boolean;
  onClose: () => void;
}) {
  const uploadDoc = useUploadSignatureDoc();
  const updateSig = useUpdateSignature();
  const isDesktop = useIsDesktop();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [signedDateIso, setSignedDateIso] = useState(isoToday());
  const [signedBy, setSignedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [markSigned, setMarkSigned] = useState(true);
  const [viewLoading, setViewLoading] = useState(false);

  // Reset form whenever the sheet opens against a new target
  useEffect(() => {
    if (open && target) {
      setPickedFile(null);
      setSignedDateIso(target.signedDate ? toIso(target.signedDate) : isoToday());
      setSignedBy(target.signedBy ?? target.defaultSignedBy ?? "");
      setNotes(target.notes ?? "");
      setMarkSigned(target.status !== "completed");
    }
  }, [open, target]);

  if (!target) return null;

  const isContract = target.group === "contract";
  const Icon = isContract ? FileText : Receipt;
  const accent = isContract ? "oklch(0.50 0.10 25)" : "oklch(0.38 0.09 240)";
  const accentBg = isContract ? "oklch(0.60 0.10 25 / 12%)" : "oklch(0.55 0.09 240 / 12%)";
  const accentGradient = isContract
    ? "linear-gradient(135deg, oklch(0.50 0.10 25), oklch(0.42 0.10 25))"
    : "linear-gradient(135deg, oklch(0.38 0.09 240), oklch(0.32 0.09 240))";

  const isPending = uploadDoc.isPending || updateSig.isPending;
  const hasUploadedRef = isStorageDocRef(target.documentRef);
  const signedDateDDMM = isoToDDMM(signedDateIso);

  async function handleViewCurrent() {
    if (!target?.documentRef || !isStorageDocRef(target.documentRef)) return;
    setViewLoading(true);
    try {
      const url = await getSignatureDocUrl(target.documentRef);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Could not open document — link may have expired");
      }
    } finally {
      setViewLoading(false);
    }
  }

  async function handleSubmit() {
    if (!target) return;
    if (!pickedFile && !hasUploadedRef) {
      toast.error("Pick a file to upload");
      return;
    }
    if (markSigned) {
      if (!signedDateDDMM) {
        toast.error("Pick the signed date");
        return;
      }
      if (!signedBy.trim()) {
        toast.error("Who signed it? (client name / contact)");
        return;
      }
    }

    try {
      // 1. Upload if a new file was picked
      if (pickedFile) {
        await uploadDoc.mutateAsync({
          signatureId: target.id,
          projectId: target.projectId,
          signatureKey: target.signatureKey,
          file: pickedFile,
        });
      }

      // 2. Update status / signed_by / signed_date / notes
      const result = await updateSig.mutateAsync({
        id: target.id,
        projectId: target.projectId,
        status: markSigned ? "completed" : "in-progress",
        signedDate: markSigned ? signedDateDDMM : null,
        signedBy: markSigned ? signedBy.trim() : null,
        notes: notes.trim() || null,
      });

      toast.success(
        markSigned
          ? `${target.label} marked signed`
          : `${target.label} document uploaded`,
        { description: target.projectName },
      );

      // Stage advancement (only happens when status flipped to completed)
      if (result.stageAdvanced) {
        const { toLabel, fromLabel } = result.stageAdvanced;
        setTimeout(() => {
          toast.info(
            toLabel ? `Project advanced to "${toLabel}"` : "Project advanced",
            {
              description: fromLabel
                ? `From "${fromLabel}" · auto-advanced by SOP`
                : "Auto-advanced by SOP",
            },
          );
        }, 350);
      }
      onClose();
    } catch (err) {
      toast.error(`Update failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => !isPending && onClose()}
            className="fixed inset-0 z-40"
            style={{ background: "oklch(0.11 0.004 285 / 0.55)", backdropFilter: "blur(4px)" }}
          />

          {/* Bottom sheet */}
          <motion.div
            initial={isDesktop ? { opacity: 0, scale: 0.96 } : { y: "100%" }}
            animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.96 } : { y: "100%" }}
            transition={isDesktop ? { duration: 0.18 } : { type: "spring", damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 flex flex-col lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:max-w-[480px]"
            style={{
              maxHeight: "92vh",
              background: "var(--s-card)",
              borderRadius: isDesktop ? 28 : "28px 28px 0 0",
              boxShadow: "0 -12px 48px oklch(0 0 0 / 0.18)",
            }}
          >
            {/* Drag handle (mobile bottom-sheet affordance only) */}
            <div className="flex justify-center pt-2.5 pb-1.5 shrink-0 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: "var(--b-strong)" }} />
            </div>

            {/* Header */}
            <div
              className="px-4 pb-3 flex items-start justify-between shrink-0"
              style={{ borderBottom: "1px solid var(--b-2)" }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: accentGradient }}
                >
                  <Icon size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold leading-tight truncate" style={{ color: "var(--t-1)" }}>
                    Sign Document
                  </p>
                  <p className="text-[11px] truncate" style={{ color: "var(--t-5)" }}>
                    {target.label} · {isContract ? "Contract" : "Drawing"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={isPending}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "var(--s-2)", opacity: isPending ? 0.5 : 1 }}
              >
                <X size={14} style={{ color: "var(--acc-ink)" }} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Project summary */}
              {target.projectName && (
                <div
                  className="rounded-2xl p-3 flex items-center gap-3"
                  style={{
                    background: `linear-gradient(135deg, ${accentBg}, oklch(1 0 0))`,
                    border: `1px solid ${accent}40`,
                  }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: accentBg }}>
                    <Icon size={15} style={{ color: accent }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>PROJECT</p>
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--t-1)" }}>{target.projectName}</p>
                  </div>
                </div>
              )}

              {/* Current document — view + replace */}
              {hasUploadedRef && (
                <div
                  className="rounded-xl p-3 flex items-center justify-between gap-2"
                  style={{ background: "var(--s-page)", border: "1px solid var(--b-2)" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} style={{ color: accent }} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold" style={{ color: "var(--t-2)" }}>
                        Current document
                      </p>
                      <p className="text-[10px] truncate" style={{ color: "var(--t-5)" }}>
                        {target.documentRef?.split("/").pop()}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleViewCurrent}
                    disabled={viewLoading}
                    className="px-2.5 py-1 rounded-md flex items-center gap-1 shrink-0"
                    style={{
                      background: accentBg,
                      color: accent,
                      border: `1px solid ${accent}40`,
                    }}
                  >
                    {viewLoading ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <ExternalLink size={11} />
                    )}
                    <span className="text-[10px] font-label" style={{ letterSpacing: "0.04em", fontWeight: 700 }}>
                      VIEW
                    </span>
                  </motion.button>
                </div>
              )}

              {/* File picker */}
              <FieldGroup
                label={hasUploadedRef ? "REPLACE FILE (OPTIONAL)" : "UPLOAD PDF *"}
                hint={`PDF / JPG / PNG up to 20MB.${hasUploadedRef ? " Leave empty to keep the current file." : ""}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  data-testid="sign-file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    const err = validateUploadFile(f, ["application/pdf", "image/jpeg", "image/png"]);
                    if (err) { toast.error(err); return; }
                    setPickedFile(f);
                  }}
                />
                {pickedFile ? (
                  <div
                    className="rounded-xl p-3 flex items-center justify-between gap-2"
                    style={{ background: "oklch(0.55 0.09 145 / 6%)", border: "1px solid oklch(0.55 0.09 145 / 25%)" }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={14} style={{ color: "oklch(0.38 0.09 145)" }} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: "var(--t-2)" }}>
                          {pickedFile.name}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--t-5)" }}>
                          {(pickedFile.size / 1024).toFixed(0)} KB · ready to upload
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setPickedFile(null)}
                      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "var(--s-2)" }}
                    >
                      <X size={11} style={{ color: "var(--t-5)" }} />
                    </button>
                  </div>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-xl py-3 flex items-center justify-center gap-2 border-2 border-dashed"
                    style={{ borderColor: `${accent}40`, color: accent }}
                  >
                    <Upload size={14} />
                    <span className="text-xs font-label" style={{ letterSpacing: "0.04em", fontWeight: 700 }}>
                      {hasUploadedRef ? "PICK A NEW FILE" : "PICK A FILE"}
                    </span>
                  </motion.button>
                )}
              </FieldGroup>

              {/* Mark-signed toggle */}
              <button
                onClick={() => setMarkSigned((v) => !v)}
                data-testid="sign-mark-toggle"
                className="w-full rounded-xl p-3 flex items-center gap-3"
                style={{
                  background: markSigned ? "oklch(0.55 0.09 145 / 8%)" : "var(--s-2)",
                  border: `1px solid ${markSigned ? "oklch(0.55 0.09 145 / 30%)" : "var(--b-1)"}`,
                }}
              >
                <div
                  className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                  style={{
                    background: markSigned ? "oklch(0.55 0.09 145)" : "oklch(1 0 0)",
                    border: `1.5px solid ${markSigned ? "oklch(0.55 0.09 145)" : "var(--t-7)"}`,
                  }}
                >
                  {markSigned && <Check size={12} className="text-white" strokeWidth={3} />}
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>
                    {markSigned ? "This document is signed" : "Not signed yet"}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--t-5)" }}>
                    {markSigned
                      ? "We'll record who signed it and the date below."
                      : "Just saving the file for now — you can mark it signed later."}
                  </p>
                </div>
              </button>

              {/* Signed date + signed by — only when marking signed */}
              {markSigned && (
                <>
                  <FieldGroup label="SIGNED DATE *">
                    <input
                      type="date"
                      data-testid="sign-date"
                      value={signedDateIso}
                      onChange={(e) => setSignedDateIso(e.target.value)}
                      max={isoToday()}
                      style={inputStyle}
                    />
                  </FieldGroup>

                  <FieldGroup label="SIGNED BY *" hint="Client name or signatory">
                    <input
                      type="text"
                      data-testid="sign-by"
                      value={signedBy}
                      onChange={(e) => setSignedBy(e.target.value)}
                      placeholder={target.defaultSignedBy ?? "e.g. Mr. & Mrs. Lim"}
                      style={inputStyle}
                    />
                  </FieldGroup>
                </>
              )}

              {/* Notes (optional) */}
              <FieldGroup label="NOTES" hint="Optional — internal context (revision count, etc.)">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Revision 2 after material change…"
                  style={{ ...inputStyle, minHeight: 70, resize: "none" }}
                />
              </FieldGroup>

              {/* Caution row */}
              <div
                className="rounded-xl p-3 flex items-start gap-2"
                style={{ background: "oklch(0.62 0.09 68 / 5%)", border: "1px solid oklch(0.62 0.09 68 / 18%)" }}
              >
                <AlertCircle size={13} className="shrink-0 mt-0.5" style={{ color: "var(--acc-ink)" }} />
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--t-3)" }}>
                  Documents are stored privately and viewed via short-lived signed URLs.
                  The OPS tier (admin / PM / site supervisor) can upload and edit; every
                  change is captured in the audit log.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div
              className="px-4 py-3 flex gap-2 shrink-0"
              style={{ borderTop: "1px solid var(--b-2)" }}
            >
              <button
                onClick={onClose}
                disabled={isPending}
                className="flex-1 py-3 rounded-xl text-sm font-label"
                style={{
                  background: "var(--s-2)",
                  color: "var(--t-3)",
                  border: "1px solid var(--b-1)",
                  letterSpacing: "0.04em",
                  opacity: isPending ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <motion.button
                whileTap={isPending ? undefined : { scale: 0.96 }}
                onClick={handleSubmit}
                disabled={isPending}
                data-testid="sign-submit"
                className="flex-1 py-3 rounded-xl text-sm font-label font-semibold flex items-center justify-center gap-2"
                style={{
                  background: accentGradient,
                  color: "oklch(1 0 0)",
                  letterSpacing: "0.04em",
                  boxShadow: isPending ? "none" : `0 4px 16px ${accent}59`,
                  opacity: isPending ? 0.7 : 1,
                }}
              >
                {isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{uploadDoc.isPending ? "Uploading…" : "Saving…"}</span>
                  </>
                ) : (
                  <>
                    {markSigned ? <Check size={15} /> : <Upload size={15} />}
                    {markSigned ? "Mark Signed" : "Upload Only"}
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** DD/MM/YYYY → YYYY-MM-DD (for the <input type="date" /> default value). */
function toIso(ddmm: string): string {
  const m = ddmm.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return isoToday();
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-[10px] font-label mb-1.5"
        style={{ color: "var(--t-5)", letterSpacing: "0.06em", fontWeight: 700 }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[10px] mt-1" style={{ color: "var(--t-5)" }}>{hint}</p>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--s-3)",
  border: "1px solid var(--b-1)",
  color: "var(--t-2)",
  borderRadius: "0.75rem",
  padding: "0.7rem 0.9rem",
  fontSize: "0.875rem",
  width: "100%",
  outline: "none",
};
