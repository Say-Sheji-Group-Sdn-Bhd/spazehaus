/*
 * SPAZEHAUS CUSTOMER DETAIL (Phase 5 — multiple projects per customer)
 * One customer record holding MANY opportunities/projects. The header is the
 * customer; below it, each opportunity (inquiry) is a card with its own
 * New Inquiry → Showroom Meet → Awarded pipeline, an editable lead source, a
 * manual Showroom-Meet control, and a Convert / awarded-project link. An
 * "Add New Project" button creates a new opportunity under this customer.
 *
 * `:id` is a CUSTOMER id. Old `/customers/{inquiryId}` links are redirected to
 * the owning customer.
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, useLocation } from "wouter";
import {
  Phone, Mail, Building2, Coins, FolderOpen, Check, Clock, X, Sparkles, Plus, MapPin, Store, Pencil,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import ConvertInquiryDialog from "@/components/ConvertInquiryDialog";
import { toast } from "sonner";
import { stageConfig, categoryConfig, tierConfig } from "@/lib/customerData";
import type { InquiryStage } from "@/lib/dbTypes";
import {
  useCustomer, useAllStaff, canEditProject,
  useAddProjectToCustomer, useSetInquiryStage, useSetInquirySource, useUpdateCustomer, findCustomerIdForInquiry,
  type Inquiry,
} from "@/lib/queries";
import { useAuth } from "@/contexts/AuthContext";
import { formatRM } from "@/lib/quotationData";

const HERO_BG = "/hero/cool.jpg";
const PIPELINE: { key: InquiryStage; label: string }[] = [
  { key: "new-inquiry",   label: "New Inquiry" },
  { key: "showroom-meet", label: "Showroom Meet" },
  { key: "awarded",       label: "Awarded" },
];
const SOURCES = ["Direct", "Repeat", "Referral"];

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { staff: me } = useAuth();
  const canManage = canEditProject(me?.role); // ops-tier (mirrors the convert RPC gate)
  const { data, isLoading } = useCustomer(id);
  const { data: allStaff = [] } = useAllStaff();
  const addProject = useAddProjectToCustomer();
  const updateCustomer = useUpdateCustomer();
  const [convertTarget, setConvertTarget] = useState<Inquiry | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", email: "" });

  // Old-link redirect: if `:id` isn't a customer but IS an inquiry, go to its customer.
  useEffect(() => {
    if (!isLoading && !data && id) {
      findCustomerIdForInquiry(id).then((cid) => {
        if (cid) navigate(`/customers/${cid}`, { replace: true });
      });
    }
  }, [isLoading, data, id, navigate]);

  if (isLoading) {
    return (
      <div className="mobile-container" style={{ background: "var(--s-page)" }}>
        <AppHeader title="Loading…" subtitle="—" showBack compact />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mobile-container" style={{ background: "var(--s-page)" }}>
        <AppHeader title="Customer not found" subtitle="—" showBack compact />
        <div className="px-4 py-8 text-center">
          <p className="text-sm" style={{ color: "var(--t-5)" }}>This customer could not be located.</p>
        </div>
      </div>
    );
  }

  const { customer, opportunities } = data;
  const cc = categoryConfig[customer.category];
  const tc = tierConfig[customer.tier];
  const initials = customer.name.split(/[\s.&-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("");

  const handleAddProject = () => {
    addProject.mutate(
      { customerId: customer.id, by: me?.avatar_code ?? null },
      {
        onSuccess: () => toast.success("New project opportunity added"),
        onError: (e) => toast.error(`Couldn't add: ${e instanceof Error ? e.message : "error"}`),
      },
    );
  };
  const startEdit = () => {
    setForm({ name: customer.name, contact: customer.contact ?? "", email: customer.email ?? "" });
    setEditing(true);
  };
  const saveEdit = () => {
    const name = form.name.trim();
    if (!name) { toast.error("Name can't be empty"); return; }
    updateCustomer.mutate(
      { id: customer.id, name, contact: form.contact.trim() || null, email: form.email.trim() || null },
      {
        onSuccess: () => { toast.success("Customer updated"); setEditing(false); },
        onError: (e) => toast.error(`Couldn't save: ${e instanceof Error ? e.message : "error"}`),
      },
    );
  };
  const telHref = customer.contact ? `tel:${customer.contact.replace(/\s+/g, "")}` : undefined;
  const mailHref = customer.email ? `mailto:${customer.email}` : undefined;

  // Convert flow is a full page inside the app shell (sidebar stays), matching
  // the New Project wizard — not a floating overlay.
  if (convertTarget) {
    return <ConvertInquiryDialog inquiry={convertTarget} onClose={() => setConvertTarget(null)} />;
  }

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader title={customer.name} subtitle={customer.id} bgImage={HERO_BG} showBack compact />

      <div className="pb-24 px-4 pt-4 lg:px-8 lg:pt-7 space-y-4">
        {/* Customer header */}
        <div className="rounded-2xl p-4" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 12px oklch(0 0 0 / 0.04)" }}>
          {editing ? (
            <div className="space-y-2">
              <p className="font-label text-[10px]" style={{ color: "var(--t-5)", letterSpacing: "0.08em" }}>EDIT CUSTOMER</p>
              <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name"
                className="w-full text-sm rounded-md px-2 py-1.5" style={{ background: "var(--s-2)", border: "1px solid var(--b-strong)", color: "var(--t-1)" }} />
              <input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} placeholder="Phone" inputMode="tel"
                className="w-full text-sm rounded-md px-2 py-1.5" style={{ background: "var(--s-2)", border: "1px solid var(--b-strong)", color: "var(--t-1)" }} />
              <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" inputMode="email"
                className="w-full text-sm rounded-md px-2 py-1.5" style={{ background: "var(--s-2)", border: "1px solid var(--b-strong)", color: "var(--t-1)" }} />
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={saveEdit} disabled={updateCustomer.isPending}
                  className="text-xs font-label px-3 py-1.5 rounded-lg" style={{ background: "var(--acc)", color: "oklch(1 0 0)", cursor: "pointer" }}>
                  {updateCustomer.isPending ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setEditing(false)}
                  className="text-xs font-label px-3 py-1.5 rounded-lg" style={{ background: "var(--s-2)", color: "var(--t-3)", border: "1px solid var(--b-strong)", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold shrink-0" style={{ background: cc.bg, color: cc.color, border: `2px solid ${cc.color}30` }}>
                {initials || "—"}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-2xl font-semibold leading-tight" style={{ color: "var(--t-1)" }}>{customer.name}</h1>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[10px] font-label px-1.5 py-0.5 rounded-md" style={{ background: cc.bg, color: cc.color, letterSpacing: "0.04em", fontWeight: 700 }}>
                    {customer.category.toUpperCase()}
                  </span>
                  {customer.tier !== "Standard" && (
                    <span className="text-[10px] font-label px-1.5 py-0.5 rounded-md" style={{ background: tc.bg, color: tc.color, letterSpacing: "0.04em", fontWeight: 700 }}>
                      {customer.tier.toUpperCase()}
                    </span>
                  )}
                  <span className="text-[10px]" style={{ color: "var(--t-5)" }}>· {opportunities.length} project{opportunities.length === 1 ? "" : "s"}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {telHref ? (
                    <a href={telHref} className="text-[11px] inline-flex items-center gap-1" style={{ color: "var(--acc-ink)" }}><Phone size={11} /> {customer.contact}</a>
                  ) : null}
                  {mailHref ? (
                    <a href={mailHref} className="text-[11px] inline-flex items-center gap-1 truncate" style={{ color: "var(--acc-ink)" }}><Mail size={11} /> {customer.email}</a>
                  ) : null}
                </div>
              </div>
              {canManage && (
                <button type="button" onClick={startEdit} aria-label="Edit customer" className="p-2 rounded-lg shrink-0 self-start"
                  style={{ color: "var(--t-5)", border: "1px solid var(--b-strong)", cursor: "pointer" }}>
                  <Pencil size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Projects / opportunities */}
        <div className="flex items-center justify-between">
          <p className="font-label text-xs" style={{ color: "var(--t-2)", letterSpacing: "0.10em", fontWeight: 700 }}>
            PROJECTS ({opportunities.length})
          </p>
          {canManage && (
            <button
              type="button"
              onClick={handleAddProject}
              disabled={addProject.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-label"
              style={{ background: "var(--acc)", color: "oklch(1 0 0)", letterSpacing: "0.03em", cursor: "pointer" }}
            >
              <Plus size={14} /> Add New Project
            </button>
          )}
        </div>

        {opportunities.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: "var(--s-card)", border: "1px dashed var(--b-strong)" }}>
            <Store size={24} className="mx-auto mb-2" style={{ color: "var(--t-7)" }} />
            <p className="text-xs" style={{ color: "var(--t-5)" }}>No projects yet.{canManage ? ' Use "Add New Project" to start one.' : ""}</p>
          </div>
        ) : (
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 lg:items-start">
            {opportunities.map((opp) => (
              <OpportunityCard
                key={opp.id}
                opp={opp}
                customerId={customer.id}
                canManage={canManage}
                assignedName={opp.assignedTo ? allStaff.find((s) => s.avatar_code === opp.assignedTo)?.name : undefined}
                onConvert={() => setConvertTarget(opp)}
                onOpenProject={(pid) => navigate(`/projects/${pid}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OpportunityCard({
  opp, customerId, canManage, assignedName, onConvert, onOpenProject,
}: {
  opp: Inquiry;
  customerId: string;
  canManage: boolean;
  assignedName?: string;
  onConvert: () => void;
  onOpenProject: (projectId: string) => void;
}) {
  const setStage = useSetInquiryStage();
  const setSource = useSetInquirySource();
  const sc = stageConfig[opp.stage];
  const isRejected = opp.stage === "rejected";
  const inPipeline = opp.stage === "new-inquiry" || opp.stage === "showroom-meet";

  const changeStage = (stage: InquiryStage) =>
    setStage.mutate({ inquiryId: opp.id, customerId, stage }, { onError: (e) => toast.error(`Couldn't update: ${e instanceof Error ? e.message : "error"}`) });
  const changeSource = (source: string) =>
    setSource.mutate({ inquiryId: opp.id, customerId, source }, { onError: (e) => toast.error(`Couldn't update source: ${e instanceof Error ? e.message : "error"}`) });

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}>
      {/* Header: id + stage + source */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-display font-semibold" style={{ color: "var(--t-2)" }}>{opp.id}</span>
          <span className="status-pill" style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{sc.label}</span>
        </div>
        <label className="flex items-center gap-1 shrink-0" title="Lead source">
          <MapPin size={11} style={{ color: "var(--t-5)" }} />
          {canManage ? (
            <select
              value={SOURCES.includes(opp.source) ? opp.source : ""}
              onChange={(e) => changeSource(e.target.value)}
              className="text-[11px] rounded-md px-1 py-0.5"
              style={{ background: "var(--s-2)", border: "1px solid var(--b-strong)", color: "var(--t-2)", cursor: "pointer" }}
            >
              {!SOURCES.includes(opp.source) && <option value="">{opp.source || "Source"}</option>}
              {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <span className="text-[11px]" style={{ color: "var(--t-4)" }}>{opp.source}</span>
          )}
        </label>
      </div>

      {/* Mini pipeline */}
      {isRejected ? (
        <div className="flex items-center gap-2 text-xs" style={{ color: "oklch(0.50 0.12 25)" }}>
          <X size={14} strokeWidth={3} /> Rejected{opp.rejectionReason ? ` — ${opp.rejectionReason}` : ""}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-1">
          {PIPELINE.map((step, i) => {
            const stepOrder = stageConfig[step.key].order;
            const curOrder = stageConfig[opp.stage].order;
            const isWon = opp.stage === "awarded" && step.key === "awarded";
            const isDone = stepOrder < curOrder || isWon;
            const isCurrent = stepOrder === curOrder && !isDone;
            const stepSc = stageConfig[step.key];
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: isDone ? "oklch(0.55 0.09 145)" : isCurrent ? stepSc.color : "var(--s-2)", border: isDone || isCurrent ? "none" : "1.5px solid var(--b-strong)" }}>
                    {isDone ? <Check size={12} className="text-white" strokeWidth={3} /> : isCurrent ? <Clock size={12} className="text-white" /> : <span className="text-[9px] font-bold" style={{ color: "var(--t-6)" }}>{i + 1}</span>}
                  </div>
                  <p className="text-[8px] font-label text-center leading-tight" style={{ color: isCurrent || isDone ? stepSc.color : "var(--t-5)", letterSpacing: "0.03em", fontWeight: isCurrent ? 700 : 500 }}>
                    {step.label.toUpperCase()}
                  </p>
                </div>
                {i < PIPELINE.length - 1 && <div className="h-0.5 flex-1" style={{ background: isDone ? "oklch(0.55 0.09 145 / 50%)" : "var(--b-2)", marginBottom: 14 }} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Details */}
      <div className="text-[11px] space-y-0.5" style={{ color: "var(--t-5)" }}>
        {(opp.propertyType || opp.location) && (
          <p className="inline-flex items-center gap-1"><Building2 size={11} /> {[opp.propertyType, opp.location].filter(Boolean).join(" · ")}</p>
        )}
        {opp.estimatedBudget ? <p className="inline-flex items-center gap-1"><Coins size={11} /> {formatRM(opp.estimatedBudget)} est.</p> : null}
        {assignedName && <p>Owner: {assignedName}</p>}
      </div>

      {/* Manual Showroom-Meet control (not for awarded/rejected) */}
      {canManage && inPipeline && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>STAGE</span>
          {(["new-inquiry", "showroom-meet"] as InquiryStage[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeStage(s)}
              disabled={setStage.isPending || opp.stage === s}
              className="text-[10px] font-label px-2 py-1 rounded-md"
              style={{
                background: opp.stage === s ? stageConfig[s].color : "var(--s-2)",
                color: opp.stage === s ? "oklch(1 0 0)" : "var(--t-3)",
                border: opp.stage === s ? "none" : "1px solid var(--b-strong)",
                cursor: opp.stage === s ? "default" : "pointer",
              }}
            >
              {s === "new-inquiry" ? "New Inquiry" : "Showroom Meet"}
            </button>
          ))}
        </div>
      )}

      {/* Action: awarded project link OR convert */}
      {opp.awardedProjectId ? (
        <button
          type="button"
          onClick={() => onOpenProject(opp.awardedProjectId!)}
          className="w-full rounded-xl px-3 py-2.5 flex items-center gap-2 text-left"
          style={{ background: "oklch(0.55 0.09 145 / 8%)", border: "1px solid oklch(0.55 0.09 145 / 28%)", cursor: "pointer" }}
        >
          <FolderOpen size={16} style={{ color: "oklch(0.38 0.09 145)" }} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-label" style={{ color: "oklch(0.38 0.09 145)", letterSpacing: "0.06em", fontWeight: 700 }}>AWARDED PROJECT</p>
            <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>{opp.awardedProjectId}</p>
          </div>
        </button>
      ) : inPipeline && canManage ? (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onConvert}
          data-testid="open-convert-dialog"
          className="w-full rounded-xl py-2.5 flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))", color: "white", boxShadow: "0 3px 12px oklch(0.62 0.09 68 / 0.25)" }}
        >
          <Sparkles size={14} />
          <span className="text-xs font-label" style={{ letterSpacing: "0.06em", fontWeight: 700 }}>CONVERT TO PROJECT</span>
        </motion.button>
      ) : inPipeline ? (
        <p className="text-[11px] text-center" style={{ color: "var(--t-5)" }}>Only admins / PMs can convert.</p>
      ) : null}

      {opp.notes && <p className="text-[11px] leading-snug" style={{ color: "var(--t-4)" }}>{opp.notes}</p>}
    </div>
  );
}
