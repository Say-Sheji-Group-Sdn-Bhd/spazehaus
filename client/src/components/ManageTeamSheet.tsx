/*
 * SPAZEHAUS MANAGE-TEAM SHEET
 * Set a project's Lead Designer, PM, and team members. Ops-tier only
 * (server-enforced by the `projects_write_admin_or_ops` RLS policy).
 *
 * The roster drives the task-assignee pool, the Team tab, the team cards and
 * the client portal — so this is the single place to staff a project.
 *
 * `team` stores staff avatar_codes (what `resolveTeamMembers` + the
 * `projects_update_assigned` RLS policy expect). designer_id / pm_id are ids.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Check } from "lucide-react";
import { toast } from "sonner";
import { useUpdateProject, type Project } from "@/lib/queries";
import { useIsDesktop } from "@/hooks/useMobile";
import type { StaffRow } from "@/lib/dbTypes";

export default function ManageTeamSheet({
  project,
  staff,
  open,
  onClose,
}: {
  project: Project | null;
  staff: StaffRow[];
  open: boolean;
  onClose: () => void;
}) {
  const updateProject = useUpdateProject();
  const isDesktop = useIsDesktop();

  const [designerId, setDesignerId] = useState("");
  const [pmId, setPmId] = useState("");
  const [teamCodes, setTeamCodes] = useState<string[]>([]);

  useEffect(() => {
    if (open && project) {
      setDesignerId(project.designerId ?? "");
      setPmId(project.pmId ?? "");
      setTeamCodes(project.team ?? []);
    }
  }, [open, project]);

  if (!project) return null;

  const active = staff.filter((s) => s.status !== "inactive");
  const toggleMember = (code: string) =>
    setTeamCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  async function handleSubmit() {
    if (!project) return;
    try {
      await updateProject.mutateAsync({
        id: project.id,
        designerId: designerId || null,
        pmId: pmId || null,
        team: teamCodes,
      });
      toast.success("Team updated");
      onClose();
    } catch (err) {
      toast.error(`Update failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={() => !updateProject.isPending && onClose()}
            className="fixed inset-0 z-40"
            style={{ background: "oklch(0.11 0.004 285 / 0.55)", backdropFilter: "blur(4px)" }}
          />
          <motion.div
            initial={isDesktop ? { opacity: 0, scale: 0.96 } : { y: "100%" }}
            animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.96 } : { y: "100%" }}
            transition={isDesktop ? { duration: 0.18 } : { type: "spring", damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 flex flex-col lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:max-w-[480px]"
            style={{ maxHeight: "92dvh", background: "var(--s-card)", borderRadius: isDesktop ? 28 : "28px 28px 0 0", boxShadow: "0 -12px 48px oklch(0 0 0 / 0.18)" }}
          >
            <div className="flex justify-center pt-2.5 pb-1.5 shrink-0 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: "var(--b-strong)" }} />
            </div>

            {/* Header */}
            <div className="px-4 pt-3 lg:pt-5 pb-3 flex items-start justify-between shrink-0" style={{ borderBottom: "1px solid var(--b-2)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))" }}>
                  <Users size={16} className="text-white" />
                </div>
                <div>
                  <p className="font-display text-base font-semibold leading-tight" style={{ color: "var(--t-1)" }}>Manage Team</p>
                  <p className="text-[11px]" style={{ color: "var(--t-5)" }}>Staff this project — drives task assignees</p>
                </div>
              </div>
              <button onClick={onClose} disabled={updateProject.isPending} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--s-2)", opacity: updateProject.isPending ? 0.5 : 1 }}>
                <X size={14} style={{ color: "var(--acc-ink)" }} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {active.length === 0 && (
                <p className="text-xs" style={{ color: "var(--t-5)" }}>No active staff found. Add staff first (Company → Add Staff).</p>
              )}

              <div>
                <label style={labelStyle}>LEAD DESIGNER</label>
                <select value={designerId} onChange={(e) => setDesignerId(e.target.value)} style={inputStyle}>
                  <option value="">— None —</option>
                  {active.map((s) => <option key={s.id} value={s.id}>{s.name}{s.job_title ? ` · ${s.job_title}` : ""}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>PROJECT MANAGER</label>
                <select value={pmId} onChange={(e) => setPmId(e.target.value)} style={inputStyle}>
                  <option value="">— None —</option>
                  {active.map((s) => <option key={s.id} value={s.id}>{s.name}{s.job_title ? ` · ${s.job_title}` : ""}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>TEAM MEMBERS ({teamCodes.length})</label>
                <div className="flex flex-wrap gap-1.5">
                  {active.map((s) => {
                    const on = teamCodes.includes(s.avatar_code);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleMember(s.avatar_code)}
                        className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs font-label transition-colors"
                        style={{
                          background: on ? "oklch(0.62 0.09 68 / 14%)" : "var(--s-3)",
                          color: on ? "var(--acc-ink)" : "var(--t-4)",
                          border: on ? "1px solid oklch(0.62 0.09 68 / 45%)" : "1px solid var(--b-1)",
                        }}
                      >
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                          style={{ background: on ? "var(--acc-bright)" : "var(--s-2)", color: on ? "oklch(1 0 0)" : "var(--t-5)" }}
                        >
                          {s.avatar_code}
                        </span>
                        {s.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: "var(--t-5)" }}>Lead Designer and PM are on the roster automatically.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 flex gap-2 shrink-0" style={{ borderTop: "1px solid var(--b-2)", paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
              <button onClick={onClose} disabled={updateProject.isPending} className="flex-1 py-3 rounded-xl text-sm font-label" style={{ background: "var(--s-2)", color: "var(--t-3)", border: "1px solid var(--b-1)", letterSpacing: "0.04em", opacity: updateProject.isPending ? 0.5 : 1 }}>
                Cancel
              </button>
              <motion.button
                whileTap={updateProject.isPending ? undefined : { scale: 0.96 }}
                onClick={handleSubmit}
                disabled={updateProject.isPending}
                data-testid="team-save"
                className="flex-1 py-3 rounded-xl text-sm font-label font-semibold flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))", color: "oklch(1 0 0)", letterSpacing: "0.04em", opacity: updateProject.isPending ? 0.7 : 1 }}
              >
                {updateProject.isPending ? <span>Saving…</span> : (<><Check size={15} />Save Team</>)}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em",
  color: "var(--t-5)", marginBottom: "0.375rem",
};
const inputStyle: React.CSSProperties = {
  background: "var(--s-3)", border: "1px solid var(--b-1)", color: "var(--t-2)",
  borderRadius: "0.75rem", padding: "0.7rem 0.9rem", fontSize: "0.875rem", width: "100%", outline: "none",
};
