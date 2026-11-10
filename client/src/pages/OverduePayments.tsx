/*
 * SPAZEHAUS — Overdue Payments (Flow 2, note action #11)
 *
 * A dedicated view of every payment that is past its due date and not yet
 * collected, across all projects. "Overdue" = a pending/active payment whose
 * due date is before today (the applied default — A3 has no fixed-% rule; this
 * is date-driven and refines once the client confirms a rule).
 */
import { useMemo } from "react";
import { useLocation } from "wouter";
import { AlertCircle, ChevronRight, Coins } from "lucide-react";
import { useOpenPayments } from "@/lib/queries";
import { effectivePaymentStatus, getToday, daysFromToday } from "@/lib/lifecycleData";
import { formatRM } from "@/lib/quotationData";

export default function OverduePayments() {
  const [, navigate] = useLocation();
  const { data: openPayments = [], isLoading } = useOpenPayments();
  const today = getToday();

  const overdue = useMemo(
    () =>
      openPayments
        .filter(p => effectivePaymentStatus(p, today) === "overdue")
        .sort((a, b) => (daysFromToday(a.dueDate, today) ?? 0) - (daysFromToday(b.dueDate, today) ?? 0)),
    [openPayments, today]
  );

  const totalRM = overdue.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="px-4 py-5 space-y-4 pb-24 lg:px-8">
      <div className="flex items-center gap-2.5">
        <AlertCircle size={18} style={{ color: "oklch(0.55 0.12 25)" }} />
        <h1 className="text-lg font-semibold" style={{ color: "var(--t-1)" }}>
          Overdue Payments
        </h1>
      </div>

      <div
        className="rounded-2xl p-4 flex items-center justify-between"
        style={{ background: "oklch(0.60 0.12 25 / 8%)", border: "1px solid oklch(0.60 0.12 25 / 25%)" }}
      >
        <div>
          <p className="text-[11px] font-label" style={{ color: "oklch(0.50 0.12 25)", letterSpacing: "0.08em" }}>
            OUTSTANDING & OVERDUE
          </p>
          <p className="text-2xl font-semibold mt-0.5" style={{ color: "var(--t-1)" }}>
            {formatRM(totalRM)}
          </p>
        </div>
        <p className="text-sm" style={{ color: "var(--t-5)" }}>
          {overdue.length} {overdue.length === 1 ? "payment" : "payments"}
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--t-5)" }}>Loading…</p>
      ) : overdue.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
        >
          <Coins size={22} className="mx-auto mb-2" style={{ color: "oklch(0.55 0.09 145)" }} />
          <p className="text-sm" style={{ color: "var(--t-5)" }}>
            No overdue payments. Every due payment is collected.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {overdue.map(p => {
            const late = -(daysFromToday(p.dueDate, today) ?? 0);
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/projects/${p.projectId}`)}
                className="w-full flex items-center gap-3 rounded-2xl p-3.5 text-left"
                style={{ background: "var(--s-card)", border: "1px solid oklch(0.60 0.12 25 / 25%)" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--t-1)" }}>
                    {p.projectName}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>
                    {p.label} · {p.client}
                  </p>
                  <p className="text-[11px] mt-0.5 font-medium" style={{ color: "oklch(0.55 0.12 25)" }}>
                    {formatRM(p.amount)} · {late > 0 ? `${late} day${late === 1 ? "" : "s"} overdue` : "due today"}
                    {p.dueDate ? ` · was due ${p.dueDate}` : ""}
                  </p>
                </div>
                <ChevronRight size={16} style={{ color: "var(--t-6)" }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
