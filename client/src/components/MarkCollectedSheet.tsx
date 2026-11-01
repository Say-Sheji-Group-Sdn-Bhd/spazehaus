/*
 * SPAZEHAUS MARK-COLLECTED SHEET
 * Bottom-sheet form used to mark a Payment Collection gate (or instalment)
 * as collected from the Checkpoints page or the ProjectDetail Lifecycle tab.
 *
 * On submit:
 *   • payment_records.status      → "completed"
 *   • payment_records.collected_date → today (DD/MM/YYYY input)
 *   • payment_records.reference   → user-supplied (txn id / cheque no)
 *   • payment_records.notes       → optional
 *
 * RLS gates the underlying mutation to the OPS tier
 * (principal / admin / admin_exec / pm / site_supervisor) — see Phase 0D.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Coins, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useUpdatePayment } from "@/lib/queries";
import { formatRM } from "@/lib/quotationData";
import { useIsDesktop } from "@/hooks/useMobile";

/** YYYY-MM-DD → DD/MM/YYYY (DB → SPAZEHAUS canonical) */
function isoToDDMM(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type MarkCollectedTarget = {
  id: number;
  projectId: string;
  projectName?: string;
  label: string;
  amount: number;
  gate: 1 | 2 | 3 | 4 | 5;
  reference?: string;
  notes?: string;
};

export default function MarkCollectedSheet({
  target,
  open,
  onClose,
}: {
  target: MarkCollectedTarget | null;
  open: boolean;
  onClose: () => void;
}) {
  const updatePayment = useUpdatePayment();
  const isDesktop = useIsDesktop();
  const [amount, setAmount] = useState("");
  const [collectedDateIso, setCollectedDateIso] = useState(isoToday());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Reset the form whenever the sheet opens against a new target
  useEffect(() => {
    if (open && target) {
      setAmount(target.amount ? String(target.amount) : "");
      setCollectedDateIso(isoToday());
      setReference(target.reference ?? "");
      setNotes(target.notes ?? "");
    }
  }, [open, target]);

  if (!target) return null;

  const gateLabel = ["①", "②", "③", "④", "⑤"][target.gate - 1];
  const collectedDDMM = isoToDDMM(collectedDateIso);
  const isValidDate = collectedDDMM.length > 0;

  const amountNum = Number(amount);

  async function handleSubmit() {
    if (!target) return;
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Enter the amount collected");
      return;
    }
    if (!isValidDate) {
      toast.error("Pick a collected date");
      return;
    }
    if (!reference.trim()) {
      toast.error("Reference is required (txn id / cheque no / bank slip)");
      return;
    }
    try {
      const result = await updatePayment.mutateAsync({
        id: target.id,
        projectId: target.projectId,
        amount: amountNum,
        status: "completed",
        collectedDate: collectedDDMM,
        reference: reference.trim(),
        notes: notes.trim() || null,
      });
      toast.success(`Payment ${gateLabel} marked collected`, {
        description: `${formatRM(amountNum)} · ${reference.trim()}`,
      });
      // Server-side advancement trigger may have moved the project forward
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
            onClick={() => !updatePayment.isPending && onClose()}
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
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, oklch(0.55 0.09 145), oklch(0.45 0.09 145))" }}
                >
                  <Coins size={16} className="text-white" />
                </div>
                <div>
                  <p className="font-display text-base font-semibold leading-tight" style={{ color: "var(--t-1)" }}>
                    Mark Collected
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--t-5)" }}>
                    {target.label} · {gateLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={updatePayment.isPending}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "var(--s-2)", opacity: updatePayment.isPending ? 0.5 : 1 }}
              >
                <X size={14} style={{ color: "var(--acc-ink)" }} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Amount summary card */}
              <div
                className="rounded-2xl p-4 flex items-center justify-between"
                style={{
                  background: "linear-gradient(135deg, oklch(0.55 0.09 145 / 8%), oklch(1 0 0))",
                  border: "1px solid oklch(0.55 0.09 145 / 25%)",
                }}
              >
                <div>
                  <p className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>
                    AMOUNT
                  </p>
                  <p className="font-display text-xl font-semibold" style={{ color: "oklch(0.38 0.09 145)" }}>
                    {formatRM(Number.isFinite(amountNum) ? amountNum : 0)}
                  </p>
                  {target.projectName && (
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--t-5)" }}>
                      {target.projectName}
                    </p>
                  )}
                </div>
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-display"
                  style={{ background: "oklch(0.55 0.09 145 / 12%)", color: "oklch(0.38 0.09 145)" }}
                >
                  {gateLabel}
                </div>
              </div>

              {/* Amount collected — editable: the gate amount is an estimate (and is
                  RM0 on a blank project), so record the real figure received here. */}
              <FieldGroup label="AMOUNT COLLECTED (RM) *" hint="The actual amount received for this gate.">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  data-testid="collect-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  style={inputStyle}
                />
              </FieldGroup>

              {/* Collected date */}
              <FieldGroup label="COLLECTED DATE *">
                <input
                  type="date"
                  data-testid="collect-date"
                  value={collectedDateIso}
                  onChange={(e) => setCollectedDateIso(e.target.value)}
                  max={isoToday()}
                  style={inputStyle}
                />
              </FieldGroup>

              {/* Reference */}
              <FieldGroup label="REFERENCE *" hint="Bank transaction ID, cheque number, or bank slip ref.">
                <input
                  type="text"
                  data-testid="collect-reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. TXN20260513-001 or MBB-CHQ-882"
                  style={inputStyle}
                  autoCapitalize="characters"
                />
              </FieldGroup>

              {/* Notes (optional) */}
              <FieldGroup label="NOTES" hint="Optional — internal context for the audit log">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Partial payment received, balance carried forward…"
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
                  This will mark the payment as <strong>completed</strong> and log the change in the audit
                  trail. Only the OPS tier (admin / PM / site supervisor) can perform this action.
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
                disabled={updatePayment.isPending}
                className="flex-1 py-3 rounded-xl text-sm font-label"
                style={{
                  background: "var(--s-2)",
                  color: "var(--t-3)",
                  border: "1px solid var(--b-1)",
                  letterSpacing: "0.04em",
                  opacity: updatePayment.isPending ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <motion.button
                whileTap={updatePayment.isPending ? undefined : { scale: 0.96 }}
                onClick={handleSubmit}
                disabled={updatePayment.isPending}
                data-testid="collect-submit"
                className="flex-1 py-3 rounded-xl text-sm font-label font-semibold flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, oklch(0.55 0.09 145), oklch(0.45 0.09 145))",
                  color: "oklch(1 0 0)",
                  letterSpacing: "0.04em",
                  boxShadow: updatePayment.isPending
                    ? "none"
                    : "0 4px 16px oklch(0.55 0.09 145 / 0.35)",
                  opacity: updatePayment.isPending ? 0.7 : 1,
                }}
              >
                {updatePayment.isPending ? (
                  <span>Saving…</span>
                ) : (
                  <>
                    <Check size={15} />
                    Mark Collected
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

// ─── Form primitives ────────────────────────────────────────────────────────

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
