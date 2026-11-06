/*
 * SPAZEHAUS QUOTATION DETAIL PAGE
 * Full quotation/invoice view with status management and PDF export
 * Design: Dark premium document viewer
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoute, useLocation } from "wouter";
import {
  Download, Send, CheckCircle2, XCircle, FileText, Receipt,
  ChevronDown, ChevronUp, Building2, Phone, Mail, MapPin, Loader2, User, PenLine
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { useQuotation, useUpdateQuotationStatus, useAllStaff } from "@/lib/queries";
import { statusConfig, computeTotals, formatRM, categoryColors } from "@/lib/quotationData";
import type { QuotationStatus } from "@/lib/dbTypes";
import { toast } from "sonner";

/** Format an ISO timestamp (quotations.created_at) as "6 Nov 2026". */
function fmtCreatedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
// `generateQuotationPDF` is dynamically imported below so the ~600 KB jspdf
// + html2canvas + dompurify stack is fetched only when the user actually
// taps "Download PDF". Keeps the initial route payload lean.

const statusFlow: Record<string, { next: string; label: string; icon: typeof Send }[]> = {
  draft: [{ next: "sent", label: "Mark as Sent", icon: Send }],
  sent: [
    { next: "accepted", label: "Mark Accepted", icon: CheckCircle2 },
    { next: "rejected", label: "Mark Rejected", icon: XCircle },
  ],
  accepted: [{ next: "invoiced", label: "Convert to Invoice", icon: Receipt }],
  invoiced: [{ next: "paid", label: "Mark as Paid", icon: CheckCircle2 }],
  rejected: [],
  paid: [],
};

export default function QuotationDetail() {
  const [, params] = useRoute("/quotations/:id");
  const [, navigate] = useLocation();
  const id = params?.id || "";

  const { data: quotation, isLoading } = useQuotation(id);
  const { data: allStaff = [] } = useAllStaff();
  const updateStatus = useUpdateQuotationStatus();

  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);

  if (isLoading) {
    return (
      <div className="mobile-container flex items-center justify-center min-h-screen">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--t-5)" }} />
      </div>
    );
  }
  if (!quotation) {
    return (
      <div className="mobile-container flex items-center justify-center min-h-screen">
        <p style={{ color: "var(--t-5)" }}>Quotation not found</p>
      </div>
    );
  }

  const sc = statusConfig[quotation.status];
  const { subtotal, taxAmount, total } = computeTotals(quotation.items, quotation.taxRate);
  const isInvoice = quotation.type === "Invoice" || quotation.type === "Proforma Invoice";

  // Who created this quotation, and when (meeting note #3a). created_by / created_at
  // live on the quotation row; resolve the creator's name from the staff roster.
  const creatorName = quotation.created_by
    ? (allStaff.find((s) => s.id === quotation.created_by)?.name ?? quotation.created_by)
    : null;
  const createdAtLabel = fmtCreatedAt(quotation.created_at);

  // Group items by area
  const areaMap: Record<string, typeof quotation.items> = {};
  quotation.items.forEach((item) => {
    const area = item.area || "General";
    if (!areaMap[area]) areaMap[area] = [];
    areaMap[area].push(item);
  });

  const toggleArea = (area: string) => {
    setExpandedAreas((prev) => ({ ...prev, [area]: !prev[area] }));
  };

  const advanceStatus = async (nextStatus: string) => {
    try {
      await updateStatus.mutateAsync({ id: quotation.id, status: nextStatus as QuotationStatus });
      toast.success(`Status updated to ${statusConfig[nextStatus]?.label || nextStatus}`);
    } catch (err) {
      toast.error(`Update failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    toast.info("Generating PDF…");
    try {
      // Lazy-load the PDF stack (jspdf + html2canvas + dompurify, ~180 KB
      // gzipped) only when the user actually requests an export.
      const { generateQuotationPDF } = await import("@/lib/generatePDF");
      // The PDF generator was built against the legacy Quotation shape — coerce
      // nullable fields to strings here so the type contract matches.
      await generateQuotationPDF({
        ...quotation,
        notes: quotation.notes ?? "",
        terms: quotation.terms ?? "",
      });
      toast.success("PDF downloaded successfully!");
    } catch (e) {
      toast.error("PDF export failed. Please try again.");
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const actions = statusFlow[quotation.status] || [];

  return (
    <div className="mobile-container">
      <AppHeader title={quotation.id} subtitle={quotation.type.toUpperCase()} showBack compact />

      <div className="px-4 py-4 pb-32 space-y-4">
        {/* Document header card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
        >
          {/* Gold top bar */}
          <div className="h-1" style={{ background: "linear-gradient(90deg, var(--acc-bright), var(--acc-2))" }} />

          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: isInvoice ? "oklch(0.70 0.09 240 / 15%)" : "oklch(0.62 0.09 68 / 12%)" }}
                >
                  {isInvoice
                    ? <Receipt size={18} style={{ color: "oklch(0.70 0.09 240)" }} />
                    : <FileText size={18} style={{ color: "var(--acc)" }} />
                  }
                </div>
                <div>
                  <p className="text-base font-display font-semibold text-[color:var(--t-1)]">{quotation.id}</p>
                  <p className="text-xs" style={{ color: "var(--t-5)" }}>Rev {quotation.revision} · {quotation.issueDate}</p>
                </div>
              </div>
              <span
                className="status-pill"
                style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}
              >
                {sc.label}
              </span>
            </div>

            {/* Customer block — name, project, and contact details (meeting note #3a) */}
            <div className="space-y-1.5">
              {[
                { icon: User, label: quotation.client },
                { icon: Building2, label: quotation.projectName },
                { icon: Phone, label: quotation.clientContact },
                { icon: Mail, label: quotation.clientEmail },
                { icon: MapPin, label: quotation.clientAddress },
              ].map(({ icon: Icon, label }) => label && (
                <div key={label} className="flex items-start gap-2">
                  <Icon size={12} className="shrink-0 mt-0.5" style={{ color: "var(--acc)" }} />
                  <p className="text-xs leading-relaxed" style={{ color: "var(--t-4)" }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Dates */}
            <div className="mt-3 pt-3 flex gap-4" style={{ borderTop: "1px solid var(--b-1)" }}>
              <div>
                <p className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>ISSUED</p>
                <p className="text-xs text-[color:var(--t-1)]">{quotation.issueDate}</p>
              </div>
              {quotation.validUntil && (
                <div>
                  <p className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>VALID UNTIL</p>
                  <p className="text-xs text-[color:var(--t-1)]">{quotation.validUntil}</p>
                </div>
              )}
              {quotation.dueDate && (
                <div>
                  <p className="text-[10px] font-label" style={{ color: "oklch(0.68 0.12 25)", letterSpacing: "0.04em" }}>DUE DATE</p>
                  <p className="text-xs" style={{ color: "oklch(0.68 0.12 25)" }}>{quotation.dueDate}</p>
                </div>
              )}
            </div>

            {/* Creator attribution (meeting note #3a) */}
            {(creatorName || createdAtLabel) && (
              <div className="mt-3 pt-3 flex items-center gap-1.5" style={{ borderTop: "1px solid var(--b-1)" }}>
                <PenLine size={11} className="shrink-0" style={{ color: "var(--t-5)" }} />
                <p className="text-[11px]" style={{ color: "var(--t-5)" }}>
                  Created by <span style={{ color: "var(--t-3)" }}>{creatorName ?? "—"}</span>
                  {createdAtLabel && <> · {createdAtLabel}</>}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Line items by area */}
        <div>
          <p className="text-xs font-label mb-2" style={{ color: "var(--t-5)", letterSpacing: "0.08em" }}>
            SCOPE OF WORKS — {quotation.items.length} ITEMS
          </p>
          <div className="space-y-2">
            {Object.entries(areaMap).map(([area, areaItems]) => {
              const areaTotal = areaItems.reduce((s, i) => s + i.qty * i.unitPrice * (1 - i.discount / 100), 0);
              const isOpen = expandedAreas[area] !== false; // default open

              return (
                <div
                  key={area}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
                >
                  {/* Area header */}
                  <button
                    className="w-full flex items-center justify-between px-4 py-3"
                    style={{ background: "var(--s-3)" }}
                    onClick={() => toggleArea(area)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-label font-semibold" style={{ color: "var(--acc)", letterSpacing: "0.06em" }}>
                        {area.toUpperCase()}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--t-5)" }}>
                        {areaItems.length} item{areaItems.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: "var(--acc)" }}>{formatRM(areaTotal)}</span>
                      {isOpen ? <ChevronUp size={13} style={{ color: "var(--t-5)" }} /> : <ChevronDown size={13} style={{ color: "var(--t-5)" }} />}
                    </div>
                  </button>

                  {/* Items */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        {areaItems.map((item, i) => {
                          const lineTotal = item.qty * item.unitPrice * (1 - item.discount / 100);
                          return (
                            <div
                              key={item.id}
                              className="px-4 py-3 flex items-start gap-3"
                              style={{ borderTop: "1px solid var(--b-2)" }}
                            >
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
                                style={{ background: `${categoryColors[item.category] || "var(--acc-bright)"} / 15%`, color: categoryColors[item.category] || "var(--acc-bright)" }}
                              >
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-[color:var(--t-1)] leading-snug">{item.description}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span
                                    className="text-[9px] font-label px-1.5 py-0.5 rounded"
                                    style={{
                                      background: `${categoryColors[item.category] || "var(--acc-bright)"} / 12%`,
                                      color: categoryColors[item.category] || "var(--acc-bright)",
                                      letterSpacing: "0.03em",
                                    }}
                                  >
                                    {item.category}
                                  </span>
                                  <span className="text-[10px]" style={{ color: "var(--t-5)" }}>
                                    {item.qty} {item.unit} × RM {item.unitPrice.toLocaleString()}
                                    {item.discount > 0 && <span style={{ color: "oklch(0.70 0.09 145)" }}> (−{item.discount}%)</span>}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs font-semibold shrink-0" style={{ color: "var(--acc)" }}>
                                {formatRM(lineTotal)}
                              </p>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-2xl p-4 space-y-2.5" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
          <div className="flex justify-between">
            <span className="text-sm" style={{ color: "var(--t-5)" }}>Subtotal</span>
            <span className="text-sm text-[color:var(--t-1)]">{formatRM(subtotal)}</span>
          </div>
          {quotation.taxRate > 0 && (
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: "var(--t-5)" }}>Tax / SST ({quotation.taxRate}%)</span>
              <span className="text-sm text-[color:var(--t-1)]">{formatRM(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2.5" style={{ borderTop: "1px solid var(--b-1)" }}>
            <span className="text-base font-semibold text-[color:var(--t-1)]">Total</span>
            <span className="text-xl font-display font-bold" style={{ color: "var(--acc)" }}>{formatRM(total)}</span>
          </div>
        </div>

        {/* Notes & Terms */}
        {(quotation.notes || quotation.terms) && (
          <div className="grid grid-cols-1 gap-3">
            {quotation.notes && (
              <div className="rounded-xl p-3" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                <p className="text-[10px] font-label mb-1.5" style={{ color: "var(--acc)", letterSpacing: "0.06em" }}>NOTES</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--t-5)" }}>{quotation.notes}</p>
              </div>
            )}
            {quotation.terms && (
              <div className="rounded-xl p-3" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                <p className="text-[10px] font-label mb-1.5" style={{ color: "var(--acc)", letterSpacing: "0.06em" }}>PAYMENT TERMS</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--t-5)" }}>{quotation.terms}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 py-4 space-y-2 lg:static lg:translate-x-0 lg:max-w-none"
        style={{ background: "var(--s-page)", borderTop: "1px solid var(--b-1)", backdropFilter: "blur(16px)" }}
      >
        {/* Status actions */}
        {actions.length > 0 && (
          <div className="flex gap-2">
            {actions.map(({ next, label, icon: Icon }) => (
              <motion.button
                key={next}
                whileTap={{ scale: 0.95 }}
                onClick={() => advanceStatus(next)}
                data-testid={`quotation-status-${next}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-label"
                style={{
                  background: next === "rejected" ? "oklch(0.68 0.12 25 / 15%)" : "oklch(0.62 0.09 68 / 12%)",
                  color: next === "rejected" ? "oklch(0.45 0.10 25)" : "var(--acc-ink)",
                  border: `1px solid ${next === "rejected" ? "oklch(0.68 0.12 25 / 25%)" : "oklch(0.62 0.09 68 / 20%)"}`,
                  letterSpacing: "0.04em",
                }}
              >
                <Icon size={13} />
                {label}
              </motion.button>
            ))}
          </div>
        )}

        {/* Export PDF */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleExportPDF}
          disabled={exporting}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-label font-semibold"
          style={{
            background: exporting ? "var(--b-2)" : "linear-gradient(135deg, var(--acc-strong), var(--acc-2))",
            color: exporting ? "var(--t-5)" : "oklch(1 0 0)",
            boxShadow: exporting ? "none" : "0 4px 16px oklch(0.62 0.09 68 / 35%)",
            letterSpacing: "0.04em",
          }}
        >
          <Download size={16} />
          {exporting ? "Generating PDF…" : "Export PDF"}
        </motion.button>
      </div>
    </div>
  );
}
