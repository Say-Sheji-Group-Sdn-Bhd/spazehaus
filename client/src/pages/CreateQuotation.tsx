/*
 * SPAZEHAUS CREATE QUOTATION
 * Multi-step form: Document Info → Line Items → Review & Totals
 * Design: Dark premium form with dynamic line item builder
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Plus, Trash2, Check } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { useProjects, useQuotations, useCreateQuotation } from "@/lib/queries";
import SearchableSelect from "@/components/SearchableSelect";
import { LineItem, computeTotals, formatRM, categoryColors } from "@/lib/quotationData";
import type { QuotationType } from "@/lib/dbTypes";
import { toast } from "sonner";
import { nanoid } from "nanoid";

const steps = [
  { id: 1, title: "Document Info", subtitle: "Type, client & dates" },
  { id: 2, title: "Line Items", subtitle: "Scope of work & pricing" },
  { id: 3, title: "Review & Submit", subtitle: "Confirm totals" },
];

const CATEGORIES = ["Design", "Material", "Labour", "Furniture", "Electrical", "Plumbing", "Others"] as const;
const UNITS = ["sqft", "unit", "set", "ft", "lump sum", "m", "m²", "lot", "pcs"];

const inputStyle = {
  background: "var(--s-2)",
  border: "1px solid var(--b-1)",
  color: "var(--t-2)",
  borderRadius: "0.75rem",
  padding: "0.65rem 0.875rem",
  fontSize: "0.8125rem",
  width: "100%",
  outline: "none",
} as React.CSSProperties;

const labelStyle = {
  color: "var(--t-5)",
  fontSize: "0.6875rem",
  marginBottom: "0.3rem",
  display: "block",
  fontFamily: "Raleway, sans-serif",
  letterSpacing: "0.05em",
} as React.CSSProperties;

const selectStyle = {
  ...inputStyle,
  appearance: "none" as const,
  WebkitAppearance: "none" as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.75rem center",
  paddingRight: "2rem",
};

export default function CreateQuotation() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);

  const { data: projects = [] } = useProjects();
  const { data: existingQuotations = [] } = useQuotations();
  const createQuotation = useCreateQuotation();

  const [docInfo, setDocInfo] = useState({
    type: "Quotation" as QuotationType,
    projectId: "",
    issueDate: new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "/"),
    validUntil: "",
    dueDate: "",
    taxRate: "0",
    notes: "Prices quoted are inclusive of all materials, labour, and project management fees unless otherwise stated.",
    terms: "50% deposit upon acceptance. 30% upon commencement of works. 20% upon completion and handover.",
  });

  // Default the project picker to the first project once projects load
  useMemo(() => {
    if (!docInfo.projectId && projects.length > 0) {
      setDocInfo((d) => ({ ...d, projectId: projects[0].id }));
    }
  }, [projects, docInfo.projectId]);

  const [items, setItems] = useState<LineItem[]>([
    { id: nanoid(6), area: "Living Room", description: "", category: "Furniture", qty: 1, unit: "set", unitPrice: 0, discount: 0 },
  ]);

  const selectedProject = projects.find((p) => p.id === docInfo.projectId) || projects[0];
  const { subtotal, taxAmount, total } = computeTotals(items, Number(docInfo.taxRate));

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: nanoid(6), area: "", description: "", category: "Material", qty: 1, unit: "unit", unitPrice: 0, discount: 0 },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) { toast.error("At least one line item is required"); return; }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  };

  // Client numbering scheme (Sep 2026): <PREFIX><YY>-<NNN>, sequence starting 801.
  // Quotations use "ID" (e.g. ID26-801); invoices "INV", proforma "PI".
  const SERIES_START = 801;

  /** Pick the next available <PREFIX><YY>-NNN id (e.g. ID26-801), based on the DB. */
  function nextQuotationId(prefix: "ID" | "INV" | "PI", year: number): string {
    const padded = (n: number) => String(n).padStart(3, "0");
    const seriesPrefix = `${prefix}${String(year % 100).padStart(2, "0")}-`; // e.g. ID26-
    const existing = existingQuotations
      .map((q) => q.id)
      .filter((id) => id.startsWith(seriesPrefix))
      .map((id) => Number(id.slice(seriesPrefix.length)))
      .filter((n) => !Number.isNaN(n));
    const next = existing.length ? Math.max(...existing) + 1 : SERIES_START;
    return `${seriesPrefix}${padded(next)}`;
  }

  const handleSubmit = async () => {
    if (!selectedProject) {
      toast.error("Pick a linked project first");
      return;
    }
    if (items.some((i) => !i.description.trim())) {
      toast.error("Every line item needs a description");
      return;
    }
    const year = new Date().getFullYear();
    const prefix = docInfo.type === "Invoice" ? "INV" : docInfo.type === "Proforma Invoice" ? "PI" : "ID";
    const newId = nextQuotationId(prefix, year);

    try {
      await createQuotation.mutateAsync({
        id: newId,
        projectId: selectedProject.id,
        docType: docInfo.type,
        clientName: selectedProject.client,
        clientContact: selectedProject.clientContact,
        clientEmail: selectedProject.clientEmail,
        issueDate: docInfo.issueDate,
        validUntil: docInfo.validUntil || undefined,
        dueDate: docInfo.dueDate || undefined,
        taxRate: Number(docInfo.taxRate),
        notes: docInfo.notes,
        terms: docInfo.terms,
        items: items.map((i) => ({
          area: i.area,
          description: i.description,
          category: i.category,
          qty: i.qty,
          unit: i.unit,
          unitPrice: i.unitPrice,
          discount: i.discount,
        })),
      });
      toast.success(`${docInfo.type} ${newId} created`, {
        description: `${selectedProject.name} — ${formatRM(total)}`,
      });
      navigate(`/quotations/${newId}`);
    } catch (err) {
      toast.error(`Create failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

  const groupedByArea = items.reduce((acc, item) => {
    const area = item.area || "General";
    if (!acc[area]) acc[area] = [];
    acc[area].push(item);
    return acc;
  }, {} as Record<string, LineItem[]>);

  return (
    <div className="mobile-container">
      <AppHeader title="New Document" subtitle="CREATE QUOTATION" showBack compact />

      <div className="px-4 pb-32">
        {/* Step indicator */}
        <div className="py-4">
          <div className="flex items-center justify-between mb-3">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: step > s.id ? "var(--acc-bright)" : step === s.id ? "oklch(0.62 0.09 68 / 15%)" : "var(--s-2)",
                    border: step >= s.id ? "1px solid var(--acc-bright)" : "1px solid var(--b-1)",
                    color: step > s.id ? "oklch(1 0 0)" : step === s.id ? "var(--acc-ink)" : "var(--t-4)",
                  }}
                >
                  {step > s.id ? <Check size={12} /> : s.id}
                </div>
                {i < steps.length - 1 && (
                  <div className="w-12 h-0.5 mx-1" style={{ background: step > s.id ? "var(--acc-bright)" : "var(--b-1)" }} />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs font-label" style={{ color: "var(--acc)", letterSpacing: "0.08em" }}>STEP {step} OF {steps.length}</p>
          <h2 className="font-display text-xl font-semibold text-[color:var(--t-1)]">{steps[step - 1].title}</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>{steps[step - 1].subtitle}</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
            className="space-y-4"
          >
            {/* STEP 1 — Document Info */}
            {step === 1 && (
              <>
                <div>
                  <label style={labelStyle}>DOCUMENT TYPE *</label>
                  <div className="flex gap-2">
                    {(["Quotation", "Invoice", "Proforma Invoice"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setDocInfo((d) => ({ ...d, type: t }))}
                        className="flex-1 py-2.5 rounded-xl text-[11px] font-label"
                        style={{
                          background: docInfo.type === t ? "var(--acc-bright)" : "var(--s-2)",
                          color: docInfo.type === t ? "oklch(1 0 0)" : "var(--t-5)",
                          border: docInfo.type === t ? "none" : "1px solid var(--b-1)",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>LINKED PROJECT *</label>
                  <SearchableSelect
                    testId="cq-project"
                    value={docInfo.projectId}
                    onChange={(v) => setDocInfo((d) => ({ ...d, projectId: v }))}
                    placeholder="Select a project…"
                    searchPlaceholder="Search project or client…"
                    options={projects.map((p) => ({ value: p.id, label: `${p.name} — ${p.client}`, sublabel: p.location }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>ISSUE DATE *</label>
                    <input style={inputStyle} placeholder="DD/MM/YYYY" value={docInfo.issueDate} onChange={(e) => setDocInfo((d) => ({ ...d, issueDate: e.target.value }))} />
                  </div>
                  <div>
                    <label style={labelStyle}>{docInfo.type === "Invoice" ? "DUE DATE" : "VALID UNTIL"}</label>
                    <input
                      style={inputStyle}
                      placeholder="DD/MM/YYYY"
                      value={docInfo.type === "Invoice" ? docInfo.dueDate : docInfo.validUntil}
                      onChange={(e) => setDocInfo((d) => docInfo.type === "Invoice" ? { ...d, dueDate: e.target.value } : { ...d, validUntil: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>TAX / SST RATE (%)</label>
                  <div className="flex gap-2">
                    {["0", "6", "8", "10"].map((r) => (
                      <button
                        key={r}
                        onClick={() => setDocInfo((d) => ({ ...d, taxRate: r }))}
                        className="flex-1 py-2 rounded-xl text-xs font-label"
                        style={{
                          background: docInfo.taxRate === r ? "oklch(0.62 0.09 68 / 15%)" : "var(--s-2)",
                          color: docInfo.taxRate === r ? "var(--acc-ink)" : "var(--t-4)",
                          border: docInfo.taxRate === r ? "1px solid oklch(0.72 0.09 68 / 40%)" : "1px solid var(--b-1)",
                        }}
                      >
                        {r}%
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>NOTES TO CLIENT</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: "80px", resize: "none" }}
                    value={docInfo.notes}
                    onChange={(e) => setDocInfo((d) => ({ ...d, notes: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={labelStyle}>PAYMENT TERMS</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: "70px", resize: "none" }}
                    value={docInfo.terms}
                    onChange={(e) => setDocInfo((d) => ({ ...d, terms: e.target.value }))}
                  />
                </div>
              </>
            )}

            {/* STEP 2 — Line Items */}
            {step === 2 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>{items.length} LINE ITEMS</p>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: "var(--t-5)" }}>Running total</p>
                    <p className="text-sm font-semibold" style={{ color: "var(--acc)" }}>{formatRM(subtotal)}</p>
                  </div>
                </div>

                {items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-2xl p-3 space-y-2.5"
                    style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
                  >
                    {/* Item header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                          style={{ background: "oklch(0.62 0.09 68 / 15%)", color: "var(--acc)" }}
                        >
                          {i + 1}
                        </span>
                        <span
                          className="text-[10px] font-label px-2 py-0.5 rounded-full"
                          style={{
                            background: `${categoryColors[item.category] || "var(--acc-bright)"} / 15%`,
                            color: categoryColors[item.category] || "var(--acc-bright)",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {item.category}
                        </span>
                      </div>
                      <button onClick={() => removeItem(item.id)}>
                        <Trash2 size={14} style={{ color: "oklch(0.68 0.12 25 / 70%)" }} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label style={labelStyle}>AREA</label>
                        <input style={inputStyle} placeholder="e.g. Living Room" value={item.area} onChange={(e) => updateItem(item.id, "area", e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>CATEGORY</label>
                        <select style={selectStyle} value={item.category} onChange={(e) => updateItem(item.id, "category", e.target.value)}>
                          {CATEGORIES.map((c) => <option key={c} value={c} style={{ background: "var(--s-2)" }}>{c}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>DESCRIPTION *</label>
                      <input data-testid="cq-item-desc" style={inputStyle} placeholder="Item description..." value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} />
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label style={labelStyle}>QTY</label>
                        <input style={inputStyle} type="number" min="0" value={item.qty} onChange={(e) => updateItem(item.id, "qty", Number(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label style={labelStyle}>UNIT</label>
                        <select style={selectStyle} value={item.unit} onChange={(e) => updateItem(item.id, "unit", e.target.value)}>
                          {UNITS.map((u) => <option key={u} value={u} style={{ background: "var(--s-2)" }}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>UNIT PRICE</label>
                        <input data-testid="cq-item-price" style={inputStyle} type="number" min="0" value={item.unitPrice} onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label style={labelStyle}>DISC %</label>
                        <input style={inputStyle} type="number" min="0" max="100" value={item.discount} onChange={(e) => updateItem(item.id, "discount", Number(e.target.value) || 0)} />
                      </div>
                    </div>

                    {/* Line total */}
                    <div className="flex justify-end">
                      <span className="text-xs font-semibold" style={{ color: "var(--acc)" }}>
                        = {formatRM(item.qty * item.unitPrice * (1 - item.discount / 100))}
                      </span>
                    </div>
                  </motion.div>
                ))}

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={addItem}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed"
                  style={{ borderColor: "oklch(0.62 0.09 68 / 25%)", color: "var(--acc)" }}
                >
                  <Plus size={15} />
                  <span className="text-sm font-label" style={{ letterSpacing: "0.04em" }}>Add Line Item</span>
                </motion.button>
              </div>
            )}

            {/* STEP 3 — Review */}
            {step === 3 && (
              <div className="space-y-4">
                {/* Document header preview */}
                <div className="rounded-2xl p-4" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs font-label" style={{ color: "var(--acc)", letterSpacing: "0.08em" }}>SPAZEHAUS DESIGN SDN BHD</p>
                      <h3 className="font-display text-xl font-semibold text-[color:var(--t-1)] mt-0.5">{docInfo.type}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-label" style={{ color: "var(--t-5)" }}>Date: {docInfo.issueDate}</p>
                      {docInfo.type === "Invoice" && docInfo.dueDate && (
                        <p className="text-xs" style={{ color: "oklch(0.68 0.12 25)" }}>Due: {docInfo.dueDate}</p>
                      )}
                    </div>
                  </div>
                  {[
                    { label: "Project", value: selectedProject.name },
                    { label: "Client", value: selectedProject.client },
                    { label: "Tax Rate", value: `${docInfo.taxRate}%` },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--b-2)" }}>
                      <span className="text-xs" style={{ color: "var(--t-5)" }}>{item.label}</span>
                      <span className="text-xs font-medium text-[color:var(--t-1)]">{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* Items by area */}
                <div className="rounded-2xl overflow-hidden" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--b-1)" }}>
                    <p className="text-xs font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>LINE ITEMS ({items.length})</p>
                  </div>
                  {Object.entries(groupedByArea).map(([area, areaItems]) => (
                    <div key={area}>
                      <div className="px-4 py-2" style={{ background: "var(--s-3)" }}>
                        <p className="text-[10px] font-label" style={{ color: "var(--acc)", letterSpacing: "0.06em" }}>{area.toUpperCase()}</p>
                      </div>
                      {areaItems.map((item) => (
                        <div key={item.id} className="px-4 py-2.5 flex items-start justify-between" style={{ borderBottom: "1px solid oklch(1 0 0 / 5%)" }}>
                          <div className="flex-1 min-w-0 pr-3">
                            <p className="text-xs text-[color:var(--t-1)] leading-snug">{item.description || "(No description)"}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: "var(--t-5)" }}>
                              {item.qty} {item.unit} × RM {item.unitPrice.toLocaleString()}{item.discount > 0 ? ` (${item.discount}% off)` : ""}
                            </p>
                          </div>
                          <p className="text-xs font-semibold shrink-0" style={{ color: "var(--acc)" }}>
                            {formatRM(item.qty * item.unitPrice * (1 - item.discount / 100))}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: "var(--t-5)" }}>Subtotal</span>
                    <span className="text-sm text-[color:var(--t-1)]">{formatRM(subtotal)}</span>
                  </div>
                  {Number(docInfo.taxRate) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm" style={{ color: "var(--t-5)" }}>Tax ({docInfo.taxRate}%)</span>
                      <span className="text-sm text-[color:var(--t-1)]">{formatRM(taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2" style={{ borderTop: "1px solid var(--b-1)" }}>
                    <span className="text-base font-semibold text-[color:var(--t-1)]">Total</span>
                    <span className="text-base font-display font-bold" style={{ color: "var(--acc)" }}>{formatRM(total)}</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 py-4 flex gap-3 lg:static lg:translate-x-0 lg:max-w-none"
        style={{ background: "var(--s-card)", borderTop: "1px solid var(--b-1)", backdropFilter: "blur(16px)" }}
      >
        {step > 1 && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 py-3.5 rounded-xl text-sm font-label"
            style={{ background: "var(--s-2)", color: "var(--t-3)", border: "1px solid var(--b-1)", letterSpacing: "0.04em" }}
          >
            Back
          </motion.button>
        )}
        <motion.button
          whileTap={createQuotation.isPending ? undefined : { scale: 0.95 }}
          onClick={step < 3 ? () => setStep((s) => s + 1) : handleSubmit}
          disabled={step === 3 && createQuotation.isPending}
          data-testid="cq-next"
          className="flex-1 py-3.5 rounded-xl text-sm font-label font-semibold"
          style={{ background: "linear-gradient(135deg, var(--acc-bright), var(--acc-2))", color: "oklch(1 0 0)", letterSpacing: "0.04em", opacity: step === 3 && createQuotation.isPending ? 0.7 : 1 }}
        >
          {step < 3 ? "Continue" : createQuotation.isPending ? "Creating…" : "Create Document"}
        </motion.button>
      </div>
    </div>
  );
}
