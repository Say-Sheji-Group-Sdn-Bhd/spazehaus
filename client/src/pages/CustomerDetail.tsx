/*
 * SPAZEHAUS CUSTOMER DETAIL
 * Single inquiry view — shows pipeline stage timeline, contact log,
 * estimated commercials, and links to the awarded project (if any).
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { useParams, useLocation } from "wouter";
import {
  Phone, Mail, MapPin, Building2, Ruler, Coins, FolderOpen,
  Check, Clock, X, MessageSquare, Calendar, Briefcase, Map, Sparkles
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import ConvertInquiryDialog from "@/components/ConvertInquiryDialog";
import { toast } from "sonner";
import {
  stageConfig,
  categoryConfig,
  tierConfig,
  type ContactLogEntry,
} from "@/lib/customerData";
import type { InquiryStage } from "@/lib/dbTypes";
import { useInquiry, useAllStaff, canEditProject } from "@/lib/queries";
import { useAuth } from "@/contexts/AuthContext";
import { formatRM } from "@/lib/quotationData";

const HERO_BG = "/hero/cool.jpg";

const PIPELINE: { key: InquiryStage; label: string }[] = [
  { key: "new-inquiry",   label: "New Inquiry" },
  { key: "showroom-meet", label: "Showroom Meet" },
  { key: "awarded",       label: "Awarded" },
];

const contactIconConfig: Record<ContactLogEntry["type"], { icon: typeof Phone; color: string; bg: string }> = {
  call:        { icon: Phone,         color: "var(--acc-ink)",  bg: "oklch(0.62 0.09 68 / 12%)" },
  email:       { icon: Mail,          color: "oklch(0.38 0.09 240)", bg: "oklch(0.55 0.09 240 / 12%)" },
  whatsapp:    { icon: MessageSquare, color: "oklch(0.38 0.09 145)", bg: "oklch(0.55 0.09 145 / 12%)" },
  meet:        { icon: Briefcase,     color: "oklch(0.45 0.10 55)",  bg: "oklch(0.65 0.10 55 / 12%)" },
  "site-visit":{ icon: Map,           color: "oklch(0.50 0.10 25)",  bg: "oklch(0.60 0.10 25 / 12%)" },
};

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [convertOpen, setConvertOpen] = useState(false);
  const { staff: me } = useAuth();
  const canConvert = canEditProject(me?.role); // ops-tier only (mirrors the RPC's is_ops_tier gate)
  const { data: inq, isLoading } = useInquiry(id);
  const { data: allStaff = [] } = useAllStaff();

  if (isLoading) {
    return (
      <div className="mobile-container" style={{ background: "var(--s-page)" }}>
        <AppHeader title="Loading…" subtitle="—" showBack compact />
      </div>
    );
  }
  if (!inq) {
    return (
      <div className="mobile-container" style={{ background: "var(--s-page)" }}>
        <AppHeader title="Customer not found" subtitle="—" showBack compact />
        <div className="px-4 py-8 text-center">
          <p className="text-sm" style={{ color: "var(--t-5)" }}>
            This inquiry could not be located.
          </p>
        </div>
      </div>
    );
  }

  const sc = stageConfig[inq.stage];
  const cc = categoryConfig[inq.category];
  const tc = tierConfig[inq.tier];
  const assignedStaff = inq.assignedTo ? allStaff.find((s) => s.avatar_code === inq.assignedTo) : undefined;
  const initials = inq.client
    .split(/[\s.&-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("");

  const isRejected = inq.stage === "rejected";

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader title={inq.client} subtitle={inq.id} bgImage={HERO_BG} showBack compact />

      <div className="pb-24">
        {/* Hero card */}
        <div className="px-4 pt-4 lg:px-8 lg:pt-7">
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 12px oklch(0 0 0 / 0.04)" }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-base font-bold shrink-0"
              style={{
                background: cc.bg,
                color: cc.color,
                border: `2px solid ${cc.color}30`,
              }}
            >
              {initials || "—"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-base font-semibold" style={{ color: "var(--t-1)" }}>
                {inq.client}
              </p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span
                  className="text-[10px] font-label px-1.5 py-0.5 rounded-md"
                  style={{ background: cc.bg, color: cc.color, letterSpacing: "0.04em", fontWeight: 700 }}
                >
                  {inq.category.toUpperCase()}
                </span>
                {inq.tier !== "Standard" && (
                  <span
                    className="text-[10px] font-label px-1.5 py-0.5 rounded-md"
                    style={{ background: tc.bg, color: tc.color, letterSpacing: "0.04em", fontWeight: 700 }}
                  >
                    {inq.tier.toUpperCase()}
                  </span>
                )}
                <span className="text-[10px]" style={{ color: "var(--t-5)" }}>
                  · via {inq.source}
                </span>
              </div>
              <span
                className="status-pill mt-2 inline-block"
                style={{
                  background: sc.bg,
                  color: sc.color,
                  border: `1px solid ${sc.border}`,
                }}
              >
                {sc.label}
              </span>
            </div>
          </div>
        </div>

        {/* Two-column layout on lg+: primary (left) + side rail (right) */}
        <div className="px-4 py-4 space-y-4 lg:px-8 lg:py-6 xl:space-y-0 xl:grid xl:grid-cols-[1fr_360px] xl:gap-6 xl:items-start">

          {/* PRIMARY COLUMN */}
          <div className="space-y-4 lg:space-y-6">
          {/* Pipeline timeline */}
          <SectionCard title="PIPELINE STAGE">
            {isRejected ? (
              <div className="flex items-center gap-3 py-2">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: "oklch(0.60 0.12 25 / 12%)" }}
                >
                  <X size={16} style={{ color: "oklch(0.50 0.12 25)" }} strokeWidth={3} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "oklch(0.50 0.12 25)" }}>
                    Inquiry Rejected
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>
                    {inq.rejectionReason || "—"}
                  </p>
                  {inq.rejectedDate && (
                    <p className="text-[10px] mt-1" style={{ color: "var(--t-5)" }}>
                      Closed on {inq.rejectedDate}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 py-2">
                {PIPELINE.map((step, i) => {
                  const stepOrder = stageConfig[step.key].order;
                  const curOrder = stageConfig[inq.stage].order;
                  const isDone = stepOrder < curOrder;
                  const isCurrent = stepOrder === curOrder;
                  const stepSc = stageConfig[step.key];
                  return (
                    <div key={step.key} className="flex items-center flex-1">
                      <div className="flex flex-col items-center gap-1.5 flex-1">
                        {isCurrent ? (
                          <motion.div
                            animate={{ scale: [1, 1.12, 1] }}
                            transition={{ repeat: Infinity, duration: 1.6 }}
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: stepSc.color }}
                          >
                            <Clock size={14} className="text-white" />
                          </motion.div>
                        ) : isDone ? (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: "oklch(0.55 0.09 145)" }}
                          >
                            <Check size={14} className="text-white" strokeWidth={3} />
                          </div>
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                            style={{
                              background: "var(--s-2)",
                              border: "1.5px solid var(--b-strong)",
                            }}
                          >
                            <span className="text-[10px] font-display font-bold" style={{ color: "var(--t-6)" }}>
                              {i + 1}
                            </span>
                          </div>
                        )}
                        <p
                          className="text-[9px] font-label text-center leading-tight"
                          style={{
                            color: isCurrent || isDone ? stepSc.color : "var(--t-5)",
                            letterSpacing: "0.04em",
                            fontWeight: isCurrent ? 700 : 500,
                          }}
                        >
                          {step.label.toUpperCase()}
                        </p>
                      </div>
                      {i < PIPELINE.length - 1 && (
                        <div
                          className="h-0.5 flex-1"
                          style={{
                            background: isDone ? "oklch(0.55 0.09 145 / 50%)" : "var(--b-2)",
                            marginBottom: 18,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {inq.awardedDate && (
              <div
                className="mt-3 pt-3 flex items-center justify-between"
                style={{ borderTop: "1px solid var(--b-2)" }}
              >
                <span className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>
                  AWARDED ON
                </span>
                <span className="text-xs font-semibold" style={{ color: "oklch(0.38 0.09 145)" }}>
                  {inq.awardedDate}
                </span>
              </div>
            )}
          </SectionCard>

          {/* Linked project */}
          {inq.awardedProjectId && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/projects/${inq.awardedProjectId}`)}
              className="w-full rounded-2xl p-4 flex items-center gap-3 text-left"
              style={{
                background: "linear-gradient(135deg, oklch(0.55 0.09 145 / 8%), oklch(1 0 0))",
                border: "1px solid oklch(0.55 0.09 145 / 30%)",
                boxShadow: "0 1px 12px oklch(0.55 0.09 145 / 8%)",
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "oklch(0.55 0.09 145 / 12%)" }}>
                <FolderOpen size={18} style={{ color: "oklch(0.38 0.09 145)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-label" style={{ color: "oklch(0.38 0.09 145)", letterSpacing: "0.06em", fontWeight: 700 }}>
                  AWARDED PROJECT
                </p>
                <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>
                  {inq.awardedProjectId}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--t-5)" }}>
                  Tap to open project lifecycle
                </p>
              </div>
            </motion.button>
          )}

          {/* Contact log timeline */}
          {inq.contactLog && inq.contactLog.length > 0 && (
            <SectionCard title={`CONTACT LOG (${inq.contactLog.length})`}>
              <div className="space-y-3">
                {inq.contactLog.slice().reverse().map((entry, i) => {
                  const cfg = contactIconConfig[entry.type];
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center shrink-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: cfg.bg }}
                        >
                          <Icon size={12} style={{ color: cfg.color }} />
                        </div>
                        {i < inq.contactLog!.length - 1 && (
                          <div
                            className="w-0.5 flex-1 mt-1"
                            style={{ background: "var(--b-2)", minHeight: 16 }}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span
                            className="text-[10px] font-label"
                            style={{ color: cfg.color, letterSpacing: "0.06em", fontWeight: 700 }}
                          >
                            {entry.type.toUpperCase().replace("-", " ")}
                          </span>
                          <span className="text-[10px]" style={{ color: "var(--t-5)" }}>
                            {entry.date} · {entry.by}
                          </span>
                        </div>
                        <p className="text-[12px] leading-snug" style={{ color: "var(--t-3)" }}>
                          {entry.note}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* Notes */}
          {inq.notes && (
            <SectionCard title="NOTES">
              <p className="text-sm leading-relaxed" style={{ color: "var(--t-3)" }}>
                {inq.notes}
              </p>
            </SectionCard>
          )}
          </div>
          {/* END PRIMARY COLUMN */}

          {/* SECONDARY RAIL — contact, opportunity, actions (stacked on mobile, right rail on lg+) */}
          <div className="space-y-4 lg:space-y-6">

          {/* Contact info */}
          <SectionCard title="CONTACT">
            <ContactRow icon={Phone} label="Phone" value={inq.contact ?? "—"} onClick={() => toast.info(`Calling ${inq.client}…`)} />
            {inq.email && <ContactRow icon={Mail} label="Email" value={inq.email} onClick={() => toast.info(`Opening email to ${inq.email}…`)} />}
            {assignedStaff && (
              <div
                className="flex items-center gap-3 py-2.5"
                style={{ borderTop: "1px solid var(--s-2)" }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: "linear-gradient(135deg, oklch(0.62 0.09 68 / 20%), oklch(0.52 0.08 65 / 20%))",
                    color: "var(--acc-ink)",
                    border: "1.5px solid oklch(0.62 0.09 68 / 25%)",
                  }}
                >
                  {assignedStaff.avatar_code}
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>
                    SALES OWNER
                  </p>
                  <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>
                    {assignedStaff.name}
                  </p>
                </div>
                <span className="text-[10px]" style={{ color: "var(--t-5)" }}>
                  {assignedStaff.job_title}
                </span>
              </div>
            )}
          </SectionCard>

          {/* Property + commercials */}
          <SectionCard title="OPPORTUNITY">
            <DetailRow icon={Building2} label="Property" value={`${inq.propertyType} · ${inq.location}`} />
            {inq.estimatedSize && (
              <DetailRow icon={Ruler} label="Size" value={`${inq.estimatedSize.toLocaleString()} sqft`} />
            )}
            {inq.estimatedBudget && (
              <DetailRow
                icon={Coins}
                label="Estimated Budget"
                value={formatRM(inq.estimatedBudget)}
                valueColor={sc.color}
              />
            )}
            <DetailRow icon={Calendar} label="Inquiry Date" value={inq.date} />
            <DetailRow icon={MapPin} label="Source" value={inq.source} />
          </SectionCard>

          {/* Convert to Project — primary CTA when inquiry is in pipeline.
              Ops-tier only (the convert RPC enforces is_ops_tier); hide for
              everyone else rather than let them hit a raw 42501. */}
          {canConvert && (inq.stage === "new-inquiry" || inq.stage === "showroom-meet") && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setConvertOpen(true)}
              data-testid="open-convert-dialog"
              className="w-full rounded-2xl py-3.5 flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))",
                color: "white",
                boxShadow: "0 4px 16px oklch(0.62 0.09 68 / 0.30)",
              }}
            >
              <Sparkles size={15} />
              <span className="text-sm font-label" style={{ letterSpacing: "0.06em", fontWeight: 700 }}>
                CONVERT TO PROJECT
              </span>
            </motion.button>
          )}
          {!canConvert && (inq.stage === "new-inquiry" || inq.stage === "showroom-meet") && (
            <p className="text-xs text-center px-2" style={{ color: "var(--t-5)" }}>
              Only admins / project managers can convert an inquiry into a project.
            </p>
          )}

          {/* Secondary action buttons */}
          {inq.stage !== "rejected" && (
            <div className="grid grid-cols-2 gap-2">
              <ActionButton icon={Phone} label="Call" onClick={() => toast.info(`Calling ${inq.client}…`)} />
              <ActionButton icon={Mail} label="Email" onClick={() => toast.info(`Email to ${inq.client}…`)} />
            </div>
          )}
          </div>
          {/* END SECONDARY RAIL */}

        </div>
        {/* END TWO-COLUMN GRID */}
      </div>

      {/* Conversion modal */}
      <ConvertInquiryDialog inquiry={inq} open={convertOpen} onClose={() => setConvertOpen(false)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
    >
      <p
        className="font-label text-xs mb-3"
        style={{ color: "var(--t-2)", letterSpacing: "0.10em", fontWeight: 700 }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  valueColor,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      className="flex items-center gap-3 py-2"
      style={{ borderBottom: "1px solid var(--s-2)" }}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--s-page)" }}>
        <Icon size={12} style={{ color: "var(--t-5)" }} />
      </div>
      <span className="text-xs flex-1" style={{ color: "var(--t-5)" }}>{label}</span>
      <span className="text-xs font-medium text-right" style={{ color: valueColor || "var(--t-2)" }}>
        {value}
      </span>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2 text-left"
      style={{ borderBottom: "1px solid var(--s-2)" }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "oklch(0.62 0.09 68 / 10%)" }}
      >
        <Icon size={14} style={{ color: "var(--acc-ink)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>
          {label.toUpperCase()}
        </p>
        <p className="text-sm font-medium truncate" style={{ color: "var(--t-2)" }}>
          {value}
        </p>
      </div>
    </button>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Phone;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="rounded-2xl py-3 flex items-center justify-center gap-2"
      style={{ background: "var(--s-card)", border: "1px solid oklch(0.62 0.09 68 / 25%)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
    >
      <Icon size={14} style={{ color: "var(--acc-ink)" }} />
      <span className="text-sm font-label" style={{ color: "var(--acc-ink)", letterSpacing: "0.04em", fontWeight: 600 }}>
        {label}
      </span>
    </motion.button>
  );
}
