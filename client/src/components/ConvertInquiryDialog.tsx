/*
 * SPAZEHAUS CONVERT-INQUIRY PAGE
 * Converts a "new-inquiry" / "showroom-meet" customer opportunity into a real
 * project. Rendered as a full page INSIDE the app shell (sidebar + AppHeader),
 * matching the New Project wizard's look — not a floating overlay.
 *
 * On submit:
 *   • A new Project is created (assigned status, 0% progress)
 *   • The lifecycle starts at New Inquiry (or Showroom Meet-up done), manual-status
 *   • Gate ① Proposal Deposit is marked collected today
 *   • The inquiry flips to "awarded" with awardedProjectId
 *   • User is navigated to the new project
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Calendar, Coins, AlertCircle, Check, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import AppHeader from "@/components/AppHeader";
import {
  useAllStaff,
  useConvertInquiry,
  useUpdateProject,
  useSetStageStatus,
  type Inquiry,
} from "@/lib/queries";
import { useAuth } from "@/contexts/AuthContext";
import { formatRM } from "@/lib/quotationData";

type Priority = "high" | "medium" | "low";

type FormState = {
  projectName: string;
  designerStaffId: string;
  pmStaffId: string;
  startDate: string; // YYYY-MM-DD (input format)
  targetDate: string;
  budget: string; // string for input control
  proposalDeposit: string;
  priority: Priority;
  serviceType: "Design" | "Renovation"; // drives the SD/SR project code
  areas: string; // comma-separated
  showroomDone: boolean; // start-choice: is the showroom meet-up already done?
};

// —— date helpers ——
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Convert YYYY-MM-DD → DD/MM/YYYY (the SPAZEHAUS canonical format). */
function isoToDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function ConvertInquiryDialog({
  inquiry,
  onClose,
}: {
  inquiry: Inquiry;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();
  const { data: allStaff = [] } = useAllStaff();
  const { staff: me } = useAuth();
  const convertMutation = useConvertInquiry();

  // Sensible defaults pulled from the inquiry
  const designStaff = useMemo(
    () => allStaff.filter(s => s.dept === "Design"),
    [allStaff]
  );
  const opsStaff = useMemo(
    () => allStaff.filter(s => s.dept === "Operations"),
    [allStaff]
  );

  // Lead Designer picker lists EVERY registered staff member (supervisor review —
  // "list all registered designers to choose from"), with Design-dept staff first
  // and the converter surfaced as "(you)". The converting staff still leads by
  // default (meeting note #6).
  const designerOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    const push = (s: { id: string; name: string }, label?: string) => {
      if (seen.has(s.id)) return;
      seen.add(s.id);
      opts.push({ value: s.id, label: label ?? s.name });
    };
    if (me) push(me, `${me.name} (you)`);
    for (const s of designStaff) push(s);
    for (const s of allStaff) push(s);
    return opts;
  }, [designStaff, allStaff, me]);

  const defaultDesigner = me ?? designStaff[1] ?? designStaff[0]; // converter leads by default
  const defaultPM = opsStaff[0];
  const defaultBudget = inquiry.estimatedBudget ?? 100_000;
  const defaultDeposit = Math.max(2_000, Math.round(defaultBudget * 0.02));

  const [form, setForm] = useState<FormState>(() => ({
    projectName:
      `${inquiry.client.split(/[\s.&-]+/)[0] || "New"} ${inquiry.propertyType}`.trim(),
    designerStaffId: defaultDesigner?.id ?? "",
    pmStaffId: defaultPM?.id ?? "",
    startDate: isoToday(),
    targetDate: isoPlusDays(120),
    budget: String(defaultBudget),
    proposalDeposit: String(defaultDeposit),
    priority: "medium",
    serviceType: "Design",
    areas: "",
    showroomDone: false,
  }));
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const updateProject = useUpdateProject();
  const setStageStatus = useSetStageStatus();

  const [submitting, setSubmitting] = useState(false);

  // Robustness for meeting-note #6: once `me` (useAuth) loads, default the
  // designer to the converter — unless the user has already picked someone.
  const designerTouched = useRef(false);
  useEffect(() => {
    if (designerTouched.current || !me?.id) return;
    setForm(f =>
      f.designerStaffId === me.id ? f : { ...f, designerStaffId: me.id }
    );
  }, [me?.id]);

  // Derived validation
  const budgetNum = parseFloat(form.budget) || 0;
  const depositNum = parseFloat(form.proposalDeposit) || 0;
  const errors: string[] = [];
  if (!form.projectName.trim()) errors.push("Project name is required.");
  if (!form.designerStaffId) errors.push("Assign a designer.");
  if (!form.pmStaffId) errors.push("Assign a project manager.");
  // Budget may be ZERO (design-only clients who find their own contractor); the
  // proposal deposit still applies, so the deposit is NOT capped by the budget.
  if (budgetNum < 0) errors.push("Budget can't be negative.");
  if (depositNum < 0) errors.push("Deposit must be ≥ 0.");
  if (form.startDate >= form.targetDate)
    errors.push("Target date must be after start date.");
  const isValid = errors.length === 0;

  async function handleSubmit() {
    if (!isValid || submitting) return;
    setSubmitting(true);

    const designer = allStaff.find(s => s.id === form.designerStaffId);
    const pm = allStaff.find(s => s.id === form.pmStaffId);

    try {
      const newId = await convertMutation.mutateAsync({
        inquiryId: inquiry.id,
        projectName: form.projectName.trim(),
        designerName: designer?.name ?? "",
        pmName: pm?.name ?? "",
        designerAvatar: designer?.avatar_code ?? "",
        pmAvatar: pm?.avatar_code ?? "",
        startDate: isoToDDMMYYYY(form.startDate),
        targetDate: isoToDDMMYYYY(form.targetDate),
        budget: budgetNum,
        priority: form.priority,
        areas: form.areas
          .split(",")
          .map(s => s.trim())
          .filter(Boolean),
        proposalDeposit: depositNum,
        serviceType: form.serviceType,
        assignedToAvatar: inquiry.assignedTo,
      });

      // Optional cover image for the new project (reuses the project cover upload).
      if (coverFile) {
        try {
          await updateProject.mutateAsync({ id: newId, imageFile: coverFile });
        } catch {
          toast.error("Project created, but the cover image didn't upload");
        }
      }
      // Start-choice: if the showroom meet-up already happened, mark that stage done
      // (manual-status model — staff drive everything else from here).
      if (form.showroomDone) {
        try {
          await setStageStatus.mutateAsync({
            projectId: newId,
            stageId: "showroom-meet",
            status: "completed",
            by: me?.avatar_code ?? null,
          });
        } catch {
          /* non-fatal */
        }
      }

      toast.success(`Converted to ${newId}`, {
        description: `${form.projectName} is live in /projects · ${formatRM(budgetNum)} secured`,
      });

      onClose();
      // Small timeout so the toast renders before route change
      setTimeout(() => navigate(`/projects/${newId}?tab=Lifecycle`), 250);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not convert inquiry");
      setSubmitting(false);
    }
  }

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader
        title="Convert to Project"
        subtitle={`${inquiry.id} · ${inquiry.client}`}
        showBack
        onBack={onClose}
        compact
      />

      {/* Body */}
      <div className="px-4 pt-4 pb-36 lg:px-8 lg:pt-6 lg:pb-8 space-y-4">
        <FieldGroup label="PROJECT NAME">
          <TextInput
            value={form.projectName}
            onChange={v => setForm({ ...form, projectName: v })}
            placeholder="The Paragon Residence"
          />
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="DESIGNER">
            <Select
              testid="convert-designer"
              value={form.designerStaffId}
              onChange={v => {
                designerTouched.current = true;
                setForm({ ...form, designerStaffId: v });
              }}
              options={designerOptions}
            />
          </FieldGroup>
          <FieldGroup label="PROJECT MANAGER">
            <Select
              testid="convert-pm"
              value={form.pmStaffId}
              onChange={v => setForm({ ...form, pmStaffId: v })}
              options={opsStaff.map(s => ({
                value: s.id,
                label: s.name,
              }))}
            />
          </FieldGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="START DATE" icon={Calendar}>
            <DateInput
              value={form.startDate}
              onChange={v => setForm({ ...form, startDate: v })}
            />
          </FieldGroup>
          <FieldGroup label="TARGET COMPLETION" icon={Calendar}>
            <DateInput
              value={form.targetDate}
              onChange={v => setForm({ ...form, targetDate: v })}
            />
          </FieldGroup>
        </div>

        <FieldGroup label="CONFIRMED BUDGET (RM)" icon={Coins}>
          <NumberInput
            value={form.budget}
            onChange={v => setForm({ ...form, budget: v })}
            prefix="RM"
            hint={
              inquiry.estimatedBudget
                ? `Estimated at inquiry: ${formatRM(inquiry.estimatedBudget)}`
                : undefined
            }
          />
        </FieldGroup>

        <FieldGroup label="① PROPOSAL DEPOSIT (collected today)" icon={Coins}>
          <NumberInput
            value={form.proposalDeposit}
            onChange={v => setForm({ ...form, proposalDeposit: v })}
            prefix="RM"
            hint="Booking fee for the design phase. Sets gate ① as collected."
          />
        </FieldGroup>

        <FieldGroup label="SERVICE TYPE">
          <div className="grid grid-cols-2 gap-2">
            {(["Design", "Renovation"] as const).map(st => {
              const active = form.serviceType === st;
              return (
                <button
                  key={st}
                  onClick={() => setForm({ ...form, serviceType: st })}
                  className="py-2.5 rounded-xl text-xs font-label"
                  style={{
                    background: active ? "var(--acc-bright)" : "var(--s-2)",
                    color: active ? "oklch(1 0 0)" : "var(--t-5)",
                    border: active ? "none" : "1px solid var(--b-1)",
                    letterSpacing: "0.04em",
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </FieldGroup>

        <FieldGroup label="PRIORITY">
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                p: "high" as Priority,
                tint: "oklch(0.50 0.12 25)",
                bg: "oklch(0.60 0.12 25 / 12%)",
              },
              {
                p: "medium" as Priority,
                tint: "var(--acc-ink)",
                bg: "oklch(0.62 0.09 68 / 12%)",
              },
              {
                p: "low" as Priority,
                tint: "oklch(0.38 0.09 145)",
                bg: "oklch(0.55 0.09 145 / 12%)",
              },
            ].map(({ p, tint, bg }) => {
              const active = form.priority === p;
              return (
                <button
                  key={p}
                  onClick={() => setForm({ ...form, priority: p })}
                  className="py-2.5 rounded-xl text-xs font-label"
                  style={{
                    background: active ? bg : "var(--s-2)",
                    color: active ? tint : "var(--t-5)",
                    border: active ? `1.5px solid ${tint}` : "1px solid var(--b-1)",
                    letterSpacing: "0.06em",
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  {p.toUpperCase()}
                </button>
              );
            })}
          </div>
        </FieldGroup>

        <FieldGroup label="PROJECT AREAS (optional, comma-separated)">
          <TextInput
            value={form.areas}
            onChange={v => setForm({ ...form, areas: v })}
            placeholder="Living Room, Master Bedroom, Kitchen"
          />
        </FieldGroup>

        {/* Cover image (optional) */}
        <FieldGroup label="COVER IMAGE (optional)">
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => setCoverFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-label"
            style={{
              background: "var(--s-2)",
              color: "var(--acc-ink)",
              border: "1px dashed var(--b-strong)",
              cursor: "pointer",
            }}
          >
            <ImagePlus size={14} />{" "}
            {coverFile ? coverFile.name : "Add a cover image"}
          </button>
        </FieldGroup>

        {/* Start-choice — has the showroom meet-up already happened? */}
        <FieldGroup label="STARTING POINT">
          <div className="grid grid-cols-2 gap-2">
            {[
              { done: false, label: "Start at New Inquiry" },
              { done: true, label: "Showroom meet-up done" },
            ].map(opt => {
              const active = form.showroomDone === opt.done;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setForm({ ...form, showroomDone: opt.done })}
                  className="rounded-xl px-3 py-3 text-xs font-label"
                  style={{
                    background: active ? "var(--acc-bright)" : "var(--s-2)",
                    color: active ? "oklch(1 0 0)" : "var(--t-3)",
                    border: active ? "none" : "1px solid var(--b-1)",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </FieldGroup>

        {/* Preview card */}
        <div
          className="rounded-2xl p-4"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.62 0.09 68 / 5%), var(--s-card))",
            border: "1px solid oklch(0.62 0.09 68 / 25%)",
          }}
        >
          <p
            className="text-[10px] font-label mb-2"
            style={{
              color: "var(--acc-ink)",
              letterSpacing: "0.10em",
              fontWeight: 700,
            }}
          >
            WHAT HAPPENS ON CONVERT
          </p>
          <Bullet text="A new project is created at status “Assigned”." />
          <Bullet
            text={
              form.showroomDone
                ? "Lifecycle starts with Showroom Meet-up marked done; staff set the rest."
                : "Lifecycle starts at New Inquiry; staff set each stage's status."
            }
          />
          <Bullet
            text={`Gate ① Proposal Deposit (${formatRM(depositNum)}) marked collected today.`}
          />
          <Bullet
            text={`Inquiry ${inquiry.id} flips to “Awarded” and links to the new project.`}
          />
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div
            className="rounded-xl p-3 flex items-start gap-2"
            style={{
              background: "oklch(0.60 0.12 25 / 8%)",
              border: "1px solid oklch(0.60 0.12 25 / 25%)",
            }}
          >
            <AlertCircle
              size={14}
              style={{ color: "oklch(0.50 0.12 25)" }}
              className="mt-0.5 shrink-0"
            />
            <div>
              {errors.map(e => (
                <p
                  key={e}
                  className="text-[11px]"
                  style={{ color: "oklch(0.50 0.12 25)" }}
                >
                  {e}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer — matches the New Project wizard's nav bar */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 py-4 flex gap-3 lg:static lg:translate-x-0 lg:max-w-none"
        style={{
          background: "var(--s-card)",
          borderTop: "1px solid var(--b-1)",
          backdropFilter: "blur(16px)",
        }}
      >
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="flex-1 py-3.5 rounded-xl text-sm font-label"
          style={{
            background: "var(--s-2)",
            color: "var(--t-3)",
            border: "1px solid var(--b-1)",
            letterSpacing: "0.04em",
          }}
        >
          Cancel
        </motion.button>
        <motion.button
          whileTap={isValid ? { scale: 0.95 } : undefined}
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          data-testid="convert-submit"
          className="flex-1 py-3.5 rounded-xl text-sm font-label font-semibold flex items-center justify-center gap-1.5"
          style={{
            background: isValid
              ? "linear-gradient(135deg, var(--acc-bright), var(--acc-2))"
              : "var(--b-strong)",
            color: "oklch(1 0 0)",
            letterSpacing: "0.04em",
            opacity: isValid ? 1 : 0.6,
          }}
        >
          {submitting ? (
            <>Converting…</>
          ) : (
            <>
              <Check size={14} strokeWidth={3} />
              Convert to Project
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}

// ─── form atoms ──────────────────────────────────────────────────────────────

const inputStyle = {
  background: "var(--s-2)",
  border: "1px solid var(--b-1)",
  color: "var(--t-2)",
  borderRadius: "0.75rem",
  padding: "0.75rem 1rem",
  fontSize: "0.875rem",
  width: "100%",
  outline: "none",
} as React.CSSProperties;

function FieldGroup({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof Calendar;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={12} style={{ color: "var(--t-5)" }} />}
        <p
          className="text-xs font-label"
          style={{
            color: "var(--t-5)",
            letterSpacing: "0.04em",
            fontWeight: 600,
          }}
        >
          {label}
        </p>
      </div>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  );
}

function NumberInput({
  value,
  onChange,
  prefix,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  hint?: string;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-2"
        style={{ ...inputStyle, padding: "0.625rem 1rem" }}
      >
        {prefix && (
          <span
            className="text-xs font-label"
            style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}
          >
            {prefix}
          </span>
        )}
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm font-display font-semibold"
          style={{ color: "var(--t-2)" }}
        />
      </div>
      {hint && (
        <p className="text-[11px] mt-1" style={{ color: "var(--t-5)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={inputStyle}
    />
  );
}

function Select({
  value,
  onChange,
  options,
  testid,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  testid?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      data-testid={testid}
      style={inputStyle}
    >
      <option value="">— select —</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-1.5 mb-1">
      <Check
        size={11}
        style={{ color: "oklch(0.38 0.09 145)" }}
        className="mt-0.5 shrink-0"
        strokeWidth={3}
      />
      <p className="text-[11px] leading-snug" style={{ color: "var(--t-3)" }}>
        {text}
      </p>
    </div>
  );
}
