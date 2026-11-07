/*
 * SPAZEHAUS IMPORTANT CHECKPOINTS DASHBOARD
 * Cross-project view of every pending Payment Collection (① ② ③ ④ ⑤)
 * and Document Sign (3 contracts + 3 drawing sign-offs).
 *
 * Source SOP: 2026 Annual Meeting PDF — "Important Checkpoint" pillar.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Coins, PenSquare, AlertCircle, Clock, ChevronRight, FileText, Receipt, CalendarDays, Check, Upload } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import MarkCollectedSheet, { type MarkCollectedTarget } from "@/components/MarkCollectedSheet";
import SignDocumentSheet, { type SignDocumentTarget } from "@/components/SignDocumentSheet";
import {
  bucketLabel,
  bucketTone,
  checkpointStatusConfig,
  bucketDate,
  daysFromToday,
  effectivePaymentStatus,
  type DueBucket,
} from "@/lib/lifecycleData";
import {
  useOpenPayments,
  useOpenSignatures,
  computeCheckpointSummary,
  canEditPayments,
  canEditSignatures,
  type OpenPaymentRow,
  type OpenSignatureRow,
} from "@/lib/queries";
import { useAuth } from "@/contexts/AuthContext";
import { formatRM } from "@/lib/quotationData";

const HERO_BG = "/hero/portfolio.jpg";

type FilterTab = "All" | "Payments" | "Documents";
const filterTabs: FilterTab[] = ["All", "Payments", "Documents"];

type EnrichedPayment = OpenPaymentRow & { bucket: DueBucket; daysFromToday: number | null; effectiveStatus: OpenPaymentRow["status"] };

export default function Checkpoints() {
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<FilterTab>("All");
  const [collectTarget, setCollectTarget] = useState<MarkCollectedTarget | null>(null);
  const [signTarget, setSignTarget] = useState<SignDocumentTarget | null>(null);
  const { staff: me } = useAuth();
  const canCollect = canEditPayments(me?.role);
  const canSign = canEditSignatures(me?.role);

  const { data: openPayments = [] } = useOpenPayments();
  const { data: openSignatures = [] } = useOpenSignatures();
  const summary = computeCheckpointSummary(openPayments, openSignatures);

  // Enrich each payment with its bucket + days-from-today + effective status
  const payments: EnrichedPayment[] = openPayments.map((p) => {
    const days = daysFromToday(p.dueDate);
    return {
      ...p,
      bucket: bucketDate(p.dueDate),
      daysFromToday: days,
      // Payments only ever carry the 5 checkpoint statuses (never the manual
      // stage-only "refer"/"not-yet"), so narrow back to the payment status type.
      effectiveStatus: effectivePaymentStatus({ status: p.status, dueDate: p.dueDate } as Parameters<typeof effectivePaymentStatus>[0]) as OpenPaymentRow["status"],
    };
  });

  // Group payments by bucket — overdue first
  const buckets: DueBucket[] = ["overdue", "this-week", "this-month", "later", "no-date"];
  const paymentsByBucket = buckets
    .map((b) => ({ bucket: b, rows: payments.filter((r) => r.bucket === b) }))
    .filter((g) => g.rows.length > 0);

  // Group signatures by contract / drawing
  const contracts = openSignatures.filter((s) => s.group === "contract");
  const drawings = openSignatures.filter((s) => s.group === "drawing");

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader title="Checkpoints" subtitle="IMPORTANT · SOP" bgImage={HERO_BG} showBack showNotification />

      <div className="px-4 py-4 space-y-5 pb-24 lg:px-8 lg:py-7 lg:space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon={Coins}
            label="Outstanding"
            primary={formatRM(summary.outstandingRM)}
            secondary={`${summary.paymentsCount} open payments`}
            tint="var(--acc-ink)"
            tintBg="oklch(0.62 0.09 68 / 10%)"
          />
          <KpiCard
            icon={AlertCircle}
            label="Overdue"
            primary={String(summary.overdueCount)}
            secondary={summary.overdueRM > 0 ? formatRM(summary.overdueRM) : "All on track"}
            tint="oklch(0.50 0.12 25)"
            tintBg="oklch(0.60 0.12 25 / 10%)"
            urgent={summary.overdueCount > 0}
          />
          <KpiCard
            icon={CalendarDays}
            label="Due This Week"
            primary={String(summary.thisWeekCount)}
            secondary={summary.thisWeekCount === 1 ? "1 payment" : `${summary.thisWeekCount} payments`}
            tint="oklch(0.45 0.10 55)"
            tintBg="oklch(0.65 0.10 55 / 10%)"
          />
          <KpiCard
            icon={PenSquare}
            label="Pending Signs"
            primary={String(summary.pendingSignsCount)}
            secondary={`${summary.pendingContractsCount} contract · ${summary.pendingDrawingsCount} drawing`}
            tint="oklch(0.38 0.09 240)"
            tintBg="oklch(0.55 0.09 240 / 10%)"
          />
        </div>

        {/* Filter tabs */}
        <div
          className="flex rounded-xl p-1"
          style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
        >
          {filterTabs.map((t) => {
            const active = filter === t;
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                data-testid={`checkpoints-tab-${t.toLowerCase()}`}
                className="flex-1 py-2 text-xs font-label rounded-lg transition-colors relative"
                style={{
                  background: active ? "oklch(0.62 0.09 68 / 10%)" : "transparent",
                  color: active ? "var(--acc-ink)" : "var(--t-5)",
                  letterSpacing: "0.04em",
                  fontWeight: active ? 700 : 400,
                }}
              >
                {t.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Payment Collection sections */}
        {(filter === "All" || filter === "Payments") && (
          <div className="space-y-4 lg:space-y-6">
            <SectionHeader icon={Coins} title="PAYMENT COLLECTION" subtitle="5-gate SOP across all projects" />

            {paymentsByBucket.length === 0 ? (
              <EmptyCard icon={Coins} title="All payments collected" subtitle="No open invoices across any project" />
            ) : (
              <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-3 lg:items-start">
                {paymentsByBucket.map((group) => {
                  const tone = bucketTone[group.bucket];
                  return (
                    <div key={group.bucket}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-0.5 w-5 rounded-full" style={{ background: tone.color, opacity: 0.6 }} />
                        <p className="font-label text-[10px]" style={{ color: tone.color, letterSpacing: "0.12em" }}>
                          {bucketLabel[group.bucket]} ({group.rows.length})
                        </p>
                        <div className="flex-1 h-px" style={{ background: "var(--b-2)" }} />
                      </div>
                      <div
                        className="rounded-2xl overflow-hidden"
                        style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
                      >
                        {group.rows.map((row, i) => (
                          <PaymentItem
                            key={`${row.projectId}-${row.gate}-${i}`}
                            row={row}
                            isLast={i === group.rows.length - 1}
                            canCollect={canCollect}
                            onClick={() => navigate(`/projects/${row.projectId}?tab=Lifecycle`)}
                            onCollect={() =>
                              setCollectTarget({
                                id: row.id,
                                projectId: row.projectId,
                                projectName: row.projectName,
                                label: row.label,
                                amount: row.amount,
                                gate: row.gate,
                                reference: row.reference,
                                notes: row.notes,
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Document Sign sections */}
        {(filter === "All" || filter === "Documents") && (
          <div className="space-y-4 lg:space-y-6">
            <SectionHeader icon={PenSquare} title="DOCUMENT SIGN" subtitle="6-checkpoint SOP — 3 contracts + 3 drawings" />

            <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
              <SignatureGroup
                title="CONTRACT SIGNS"
                icon={FileText}
                tint="oklch(0.50 0.10 25)"
                tintBg="oklch(0.60 0.10 25 / 12%)"
                rows={contracts}
                canSign={canSign}
                onRowClick={(r) => navigate(`/projects/${r.projectId}?tab=Lifecycle`)}
                onSign={(r) =>
                  setSignTarget({
                    id: r.id,
                    projectId: r.projectId,
                    projectName: r.projectName,
                    signatureKey: r.key,
                    label: r.label,
                    group: r.group,
                    status: r.status,
                    documentRef: r.documentRef,
                    signedDate: r.signedDate,
                    signedBy: r.signedBy,
                    notes: r.notes,
                    defaultSignedBy: r.client,
                  })
                }
              />

              <SignatureGroup
                title="DRAWING SIGN-OFFS"
                icon={Receipt}
                tint="oklch(0.38 0.09 240)"
                tintBg="oklch(0.55 0.09 240 / 12%)"
                rows={drawings}
                canSign={canSign}
                onRowClick={(r) => navigate(`/projects/${r.projectId}?tab=Lifecycle`)}
                onSign={(r) =>
                  setSignTarget({
                    id: r.id,
                    projectId: r.projectId,
                    projectName: r.projectName,
                    signatureKey: r.key,
                    label: r.label,
                    group: r.group,
                    status: r.status,
                    documentRef: r.documentRef,
                    signedDate: r.signedDate,
                    signedBy: r.signedBy,
                    notes: r.notes,
                    defaultSignedBy: r.client,
                  })
                }
              />
            </div>
          </div>
        )}

        <p className="text-[10px] text-center font-label pt-2" style={{ color: "var(--t-6)", letterSpacing: "0.06em" }}>
          SPAZEHAUS · IMPORTANT CHECKPOINT SOP · 2026 ANNUAL MEETING
        </p>
      </div>

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

// ─────────────────────────────────────────────────────────────────────────────
// KPI cards
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
  icon: typeof Coins;
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

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Coins;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.62 0.09 68 / 10%)" }}>
        <Icon size={16} style={{ color: "var(--acc-ink)" }} />
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

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyCard({ icon: Icon, title, subtitle }: { icon: typeof Coins; title: string; subtitle: string }) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col items-center gap-2 text-center"
      style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.55 0.09 145 / 10%)" }}>
        <Icon size={18} style={{ color: "oklch(0.38 0.09 145)" }} />
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>{title}</p>
      <p className="text-xs" style={{ color: "var(--t-5)" }}>{subtitle}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment row
// ─────────────────────────────────────────────────────────────────────────────

function PaymentItem({
  row,
  isLast,
  canCollect,
  onClick,
  onCollect,
}: {
  row: EnrichedPayment;
  isLast: boolean;
  canCollect: boolean;
  onClick: () => void;
  onCollect: () => void;
}) {
  const sc = checkpointStatusConfig[row.effectiveStatus];
  const gateLabel = ["①", "②", "③", "④", "⑤"][row.gate - 1];
  const dueText =
    row.daysFromToday === null
      ? row.dueDate || "TBD"
      : row.daysFromToday < 0
      ? `Due ${row.dueDate} · ${Math.abs(row.daysFromToday)}d late`
      : row.daysFromToday === 0
      ? `Due today`
      : row.daysFromToday <= 7
      ? `Due ${row.dueDate} · in ${row.daysFromToday}d`
      : `Due ${row.dueDate}`;

  return (
    <div
      className="w-full px-3 py-3 flex items-center gap-3"
      style={{ borderBottom: isLast ? "none" : "1px solid var(--s-2)" }}
      data-testid="payment-row"
      data-payment-key={`${row.projectId}-${row.gate}`}
    >
      {/* Row body — tapping navigates to the project's Lifecycle tab */}
      <motion.button
        whileTap={{ scale: 0.99 }}
        onClick={onClick}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-display text-sm font-semibold"
          style={{
            background: row.effectiveStatus === "overdue" ? "oklch(0.60 0.12 25 / 12%)" : "oklch(0.62 0.09 68 / 10%)",
            color: row.effectiveStatus === "overdue" ? "oklch(0.50 0.12 25)" : "var(--acc-ink)",
          }}
        >
          {gateLabel}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--t-1)" }}>
              {row.label}
            </p>
          </div>
          <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--t-5)" }}>
            {row.projectName} · {row.client}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            {row.effectiveStatus === "overdue" ? (
              <AlertCircle size={10} style={{ color: sc.color }} />
            ) : (
              <Clock size={10} style={{ color: sc.color }} />
            )}
            <p className="text-[10px]" style={{ color: sc.color }}>{dueText}</p>
          </div>
        </div>
      </motion.button>

      {/* Right side — amount + action stack */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <p
          className="font-display text-sm font-semibold"
          style={{ color: row.effectiveStatus === "overdue" ? "oklch(0.50 0.12 25)" : "var(--acc-ink)" }}
        >
          {formatRM(row.amount)}
        </p>
        {canCollect ? (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={onCollect}
            data-testid="payment-collect"
            className="px-2.5 py-1 rounded-md flex items-center gap-1"
            style={{
              background: "oklch(0.55 0.09 145 / 12%)",
              color: "oklch(0.38 0.09 145)",
              border: "1px solid oklch(0.55 0.09 145 / 25%)",
            }}
          >
            <Check size={10} strokeWidth={3} />
            <span className="text-[10px] font-label" style={{ letterSpacing: "0.04em", fontWeight: 700 }}>
              COLLECT
            </span>
          </motion.button>
        ) : (
          <ChevronRight size={12} style={{ color: "var(--t-6)" }} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature group
// ─────────────────────────────────────────────────────────────────────────────

function SignatureGroup({
  title,
  icon: Icon,
  tint,
  tintBg,
  rows,
  canSign,
  onRowClick,
  onSign,
}: {
  title: string;
  icon: typeof Coins;
  tint: string;
  tintBg: string;
  rows: OpenSignatureRow[];
  canSign: boolean;
  onRowClick: (row: OpenSignatureRow) => void;
  onSign: (row: OpenSignatureRow) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="h-0.5 w-5 rounded-full" style={{ background: tint, opacity: 0.6 }} />
        <p className="font-label text-[10px]" style={{ color: tint, letterSpacing: "0.12em" }}>
          {title} ({rows.length})
        </p>
        <div className="flex-1 h-px" style={{ background: "var(--b-2)" }} />
      </div>

      {rows.length === 0 ? (
        <div
          className="rounded-2xl p-4 text-center"
          style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
        >
          <p className="text-xs" style={{ color: "var(--t-5)" }}>All signed off</p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
        >
          {rows.map((row, i) => {
            const sc = checkpointStatusConfig[row.status];
            return (
              <div
                key={`${row.projectId}-${row.key}`}
                className="w-full px-3 py-3 flex items-center gap-3"
                style={{ borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--s-2)" }}
                data-testid="signature-row"
                data-signature-key={`${row.projectId}-${row.key}`}
              >
                <motion.button
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onRowClick(row)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: tintBg }}
                  >
                    <Icon size={15} style={{ color: tint }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--t-1)" }}>
                      {row.label}
                    </p>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--t-5)" }}>
                      {row.projectName} · {row.client}
                    </p>
                    {row.notes && (
                      <p className="text-[10px] truncate mt-0.5" style={{ color: "var(--t-5)" }}>
                        {row.notes}
                      </p>
                    )}
                  </div>
                </motion.button>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className="text-[9px] font-label px-2 py-0.5 rounded-full"
                    style={{
                      background: sc.bg,
                      color: sc.color,
                      border: `1px solid ${sc.border}`,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {sc.label}
                  </span>
                  {canSign ? (
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => onSign(row)}
                      data-testid="signature-sign"
                      className="px-2.5 py-1 rounded-md flex items-center gap-1"
                      style={{
                        background: tintBg,
                        color: tint,
                        border: `1px solid ${tint}40`,
                      }}
                    >
                      <Upload size={10} />
                      <span className="text-[10px] font-label" style={{ letterSpacing: "0.04em", fontWeight: 700 }}>
                        SIGN
                      </span>
                    </motion.button>
                  ) : (
                    <ChevronRight size={12} style={{ color: "var(--t-6)" }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
