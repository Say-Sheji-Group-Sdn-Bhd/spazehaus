/*
 * SPAZEHAUS CREATE CUSTOMER
 * Adds a new customer/inquiry to the CRM pipeline. A "customer" is an inquiry —
 * the pre-sales record that can later be converted into a real project (via the
 * "Convert to Project" CTA on the customer page, or by picking it in the New
 * Project wizard). Insert is open to any authenticated user
 * (`inquiries_insert_any_authenticated` RLS policy).
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import AppHeader from "@/components/AppHeader";
import { useCreateCustomer, useAllStaff, type CreateInquiryArgs } from "@/lib/queries";
import type { CustomerCategory, CustomerTier, InquiryStage } from "@/lib/dbTypes";

const CATEGORIES: CustomerCategory[] = ["Residential", "Commercial", "F&B", "Office", "Investor"];
const TIERS: CustomerTier[] = ["Standard", "Repeat", "Referral", "VIP"];
const STAGES: { value: InquiryStage; label: string }[] = [
  { value: "new-inquiry", label: "New Inquiry" },
  { value: "showroom-meet", label: "Showroom Meet" },
];
const SOURCES = ["Direct", "Website", "Referral", "Social Media", "Walk-in", "Exhibition"];

export default function CreateCustomer() {
  const [, navigate] = useLocation();
  const createCustomer = useCreateCustomer();
  const { data: allStaff = [] } = useAllStaff();

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<CustomerCategory>("Residential");
  const [tier, setTier] = useState<CustomerTier>("Standard");
  const [propertyType, setPropertyType] = useState("");
  const [location, setLocation] = useState("");
  const [source, setSource] = useState(SOURCES[0]);
  const [size, setSize] = useState("");
  const [budget, setBudget] = useState("");
  const [stage, setStage] = useState<InquiryStage>("new-inquiry");
  const [assignedToId, setAssignedToId] = useState("");
  const [notes, setNotes] = useState("");

  const assignable = useMemo(() => allStaff.filter((s) => s.status !== "inactive"), [allStaff]);

  const initials = name.trim()
    ? name.trim().split(/[\s.&-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"
    : "?";

  async function handleSubmit() {
    if (!name.trim()) return toast.error("Customer name is required");
    if (!location.trim()) return toast.error("Location is required");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return toast.error("Enter a valid email");
    }

    const args: CreateInquiryArgs = {
      clientName: name.trim(),
      contact: contact.trim() || null,
      email: email.trim().toLowerCase() || null,
      category,
      tier,
      source,
      propertyType: propertyType.trim() || "—",
      location: location.trim(),
      estimatedSize: size ? Number(size) : null,
      estimatedBudget: budget ? Number(budget) : null,
      stage,
      assignedToId: assignedToId || null,
      notes: notes.trim() || null,
    };

    try {
      const created = await createCustomer.mutateAsync(args);
      toast.success("Customer added", { description: `${args.clientName} · ${created.customerId}` });
      navigate(`/customers/${created.customerId}`);
    } catch (err) {
      toast.error(`Could not add customer: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader title="Add Customer" subtitle="NEW INQUIRY" showBack compact />

      <div className="px-4 py-4 space-y-4 pb-10 lg:px-8 lg:py-7">
        {/* Identity preview */}
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5" style={cardStyle}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))" }}>
            <span className="text-white font-display font-semibold text-base">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold leading-tight truncate" style={{ color: "var(--t-1)" }}>
              {name.trim() || "New customer"}
            </p>
            <p className="text-[11px]" style={{ color: "var(--t-5)" }}>{category} · {tier}</p>
          </div>
        </div>

        <FieldGroup label="CUSTOMER NAME *">
          <input data-testid="cc-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mr. & Mrs. Lim / Meridian Group" style={inputStyle} />
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="CONTACT NUMBER">
            <input type="tel" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+60 12-345 6789" style={inputStyle} />
          </FieldGroup>
          <FieldGroup label="EMAIL">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@email.com" style={inputStyle} />
          </FieldGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="CATEGORY">
            <select value={category} onChange={(e) => setCategory(e.target.value as CustomerCategory)} style={inputStyle}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="TIER">
            <select value={tier} onChange={(e) => setTier(e.target.value as CustomerTier)} style={inputStyle}>
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FieldGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="PROPERTY TYPE" hint="e.g. Condominium, Retail, Office.">
            <input type="text" value={propertyType} onChange={(e) => setPropertyType(e.target.value)} placeholder="e.g. Condominium" style={inputStyle} />
          </FieldGroup>
          <FieldGroup label="LEAD SOURCE">
            <select value={source} onChange={(e) => setSource(e.target.value)} style={inputStyle}>
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FieldGroup>
        </div>

        <FieldGroup label="LOCATION *">
          <input data-testid="cc-location" type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bukit Indah, Johor Bahru" style={inputStyle} />
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="EST. SIZE (SQFT)">
            <input type="number" value={size} onChange={(e) => setSize(e.target.value)} placeholder="1850" style={inputStyle} />
          </FieldGroup>
          <FieldGroup label="EST. BUDGET (RM)">
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="280000" style={inputStyle} />
          </FieldGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="PIPELINE STAGE">
            <select value={stage} onChange={(e) => setStage(e.target.value as InquiryStage)} style={inputStyle}>
              {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="ASSIGNED TO">
            <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} style={inputStyle}>
              <option value="">Unassigned</option>
              {assignable.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </FieldGroup>
        </div>

        <FieldGroup label="NOTES">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Requirements, budget flexibility, timeline, how they found us…" style={{ ...inputStyle, minHeight: "90px", resize: "none" }} />
        </FieldGroup>

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => navigate("/customers")}
            disabled={createCustomer.isPending}
            className="flex-1 py-3 rounded-xl text-sm font-label"
            style={{ background: "var(--s-2)", color: "var(--t-3)", border: "1px solid var(--b-1)", letterSpacing: "0.04em", opacity: createCustomer.isPending ? 0.5 : 1 }}
          >
            Cancel
          </button>
          <motion.button
            whileTap={createCustomer.isPending ? undefined : { scale: 0.96 }}
            onClick={handleSubmit}
            disabled={createCustomer.isPending}
            data-testid="cc-submit"
            className="flex-1 py-3 rounded-xl text-sm font-label font-semibold flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))", color: "oklch(1 0 0)", letterSpacing: "0.04em", opacity: createCustomer.isPending ? 0.7 : 1 }}
          >
            {createCustomer.isPending ? <span>Adding…</span> : (<><UserPlus size={15} />Add Customer</>)}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Form primitives ────────────────────────────────────────────────────────

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-label mb-1.5" style={{ color: "var(--t-5)", letterSpacing: "0.06em", fontWeight: 700 }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] mt-1" style={{ color: "var(--t-5)" }}>{hint}</p>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--s-3)",
  border: "1px solid var(--b-1)",
  color: "var(--t-2)",
  borderRadius: "12px",
  padding: "0.7rem 0.9rem",
  fontSize: "0.875rem",
  width: "100%",
  outline: "none",
};

const cardStyle: React.CSSProperties = {
  background: "var(--s-card)",
  border: "1px solid var(--b-2)",
  boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)",
};
