/*
 * SPAZEHAUS LEAVE MANAGEMENT
 * Design: Dark premium leave list with approval actions
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppHeader from "@/components/AppHeader";
import { useLeaveRequests, useUpdateLeaveStatus, useApplyLeave } from "@/lib/queries";
import { useAuth } from "@/contexts/AuthContext";
import { statusConfig, DEFAULT_STATUS_CONFIG } from "@/lib/mockData";
import { toast } from "sonner";
import { Check, X, Plus } from "lucide-react";
import { nanoid } from "nanoid";

const tabs = ["Pending", "All Requests", "Apply Leave"];

const leaveTypeColors: Record<string, string> = {
  "Annual Leave": "oklch(0.70 0.09 240)",
  "Medical Leave": "oklch(0.68 0.12 25)",
  "Replacement Leave": "var(--acc-bright)",
  "Unpaid Leave": "oklch(0.58 0.12 25)",
};

/** Count inclusive days between DD/MM/YYYY start and end. Returns 0 if either parse fails. */
function inclusiveDays(startDDMM: string, endDDMM: string): number {
  const parse = (s: string) => {
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  };
  const a = parse(startDDMM);
  const b = parse(endDDMM);
  if (!a || !b) return 0;
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24))) + 1;
}

export default function LeaveManagement() {
  const [activeTab, setActiveTab] = useState("Pending");
  const [applyForm, setApplyForm] = useState({ type: "Annual Leave", startDate: "", endDate: "", reason: "" });

  const { data: requests = [] } = useLeaveRequests();
  const updateStatus = useUpdateLeaveStatus();
  const applyLeave = useApplyLeave();
  const { staff: me } = useAuth();

  const pending = requests.filter((r) => r.status === "pending");

  const handleApprove = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: "approved", approverId: me?.id });
      toast.success("Leave approved successfully");
    } catch (err) {
      toast.error(`Approval failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: "rejected", approverId: me?.id });
      toast.error("Leave rejected");
    } catch (err) {
      toast.error(`Rejection failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

  const handleApply = async () => {
    if (!applyForm.startDate || !applyForm.endDate) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!me) {
      toast.error("You need to be signed in to apply for leave");
      return;
    }
    const days = inclusiveDays(applyForm.startDate, applyForm.endDate);
    if (days === 0) {
      toast.error("Dates must be in DD/MM/YYYY format with end on or after start");
      return;
    }
    try {
      await applyLeave.mutateAsync({
        id: `LV-${nanoid(6).toUpperCase()}`,
        staffId: me.id,
        leaveType: applyForm.type,
        startDate: applyForm.startDate,
        endDate: applyForm.endDate,
        days,
        reason: applyForm.reason || undefined,
      });
      toast.success("Leave application submitted!", { description: "Your request is pending approval." });
      setApplyForm({ type: "Annual Leave", startDate: "", endDate: "", reason: "" });
      setActiveTab("All Requests");
    } catch (err) {
      toast.error(`Submission failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

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

  const labelStyle = {
    color: "var(--t-5)",
    fontSize: "0.75rem",
    marginBottom: "0.375rem",
    display: "block",
    fontFamily: "Raleway, sans-serif",
    letterSpacing: "0.04em",
  } as React.CSSProperties;

  return (
    <div className="mobile-container">
      <AppHeader title="Leave Management" subtitle="APPROVALS & REQUESTS" showBack compact />

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: "1px solid var(--b-1)" }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            data-testid={`leave-tab-${tab.toLowerCase().replace(/\s+/g, "-")}`}
            className="flex-1 py-3 text-[11px] font-label relative"
            style={{
              color: activeTab === tab ? "var(--acc-ink)" : "var(--t-4)",
              letterSpacing: "0.04em",
              fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {tab}
            {tab === "Pending" && pending.length > 0 && (
              <span
                className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
                style={{ background: "var(--acc-bright)", color: "oklch(1 0 0)" }}
              >
                {pending.length}
              </span>
            )}
            {activeTab === tab && (
              <motion.div
                layoutId="leaveTabIndicator"
                className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full"
                style={{ background: "var(--acc-bright)" }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="px-4 py-4 pb-24 lg:px-8 lg:py-7">
        <AnimatePresence mode="wait">
          {activeTab === "Pending" && (
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
              {pending.length === 0 ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                  <p className="text-sm" style={{ color: "var(--t-5)" }}>No pending approvals</p>
                </div>
              ) : pending.map((req, i) => (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="rounded-2xl p-4"
                  style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: "oklch(0.62 0.09 68 / 12%)", color: "var(--acc)", border: "1px solid oklch(0.62 0.09 68 / 20%)" }}
                    >
                      {req.staffAvatar}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[color:var(--t-1)]">{req.staffName}</p>
                      <p className="text-xs mt-0.5" style={{ color: leaveTypeColors[req.leave_type] || "var(--acc-bright)" }}>{req.leave_type}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--t-5)" }}>
                        {req.startDateLabel} — {req.endDateLabel} · {req.days} day{req.days > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  {req.reason && (
                    <p className="text-xs mb-3 px-1" style={{ color: "var(--t-5)" }}>"{req.reason}"</p>
                  )}
                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleReject(req.id)}
                      data-testid="leave-reject"
                      data-leave-id={req.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-label"
                      style={{ background: "oklch(0.68 0.12 25 / 15%)", color: "oklch(0.68 0.12 25)", border: "1px solid oklch(0.68 0.12 25 / 25%)", letterSpacing: "0.04em" }}
                    >
                      <X size={13} /> Reject
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleApprove(req.id)}
                      data-testid="leave-approve"
                      data-leave-id={req.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-label"
                      style={{ background: "oklch(0.60 0.07 145 / 15%)", color: "oklch(0.70 0.09 145)", border: "1px solid oklch(0.60 0.07 145 / 25%)", letterSpacing: "0.04em" }}
                    >
                      <Check size={13} /> Approve
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {activeTab === "All Requests" && (
            <motion.div key="all" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
              {requests.map((req, i) => {
                const sc = statusConfig[req.status as keyof typeof statusConfig] ?? DEFAULT_STATUS_CONFIG;
                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
                  >
                    <div
                      className="w-1.5 h-full min-h-[40px] rounded-full shrink-0"
                      style={{ background: leaveTypeColors[req.leave_type] || "var(--acc-bright)" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[color:var(--t-1)]">{req.staffName}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>{req.leave_type} · {req.days}d</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--t-5)" }}>{req.startDateLabel} — {req.endDateLabel}</p>
                    </div>
                    <span className="status-pill shrink-0" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {activeTab === "Apply Leave" && (
            <motion.div key="apply" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div>
                <label style={labelStyle}>LEAVE TYPE *</label>
                <div className="flex flex-wrap gap-2">
                  {["Annual Leave", "Medical Leave", "Replacement Leave", "Unpaid Leave"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setApplyForm((f) => ({ ...f, type: t }))}
                      className="px-3 py-1.5 rounded-full text-xs font-label"
                      style={{
                        background: applyForm.type === t ? "oklch(0.62 0.09 68 / 15%)" : "var(--s-2)",
                        color: applyForm.type === t ? "var(--acc-ink)" : "var(--t-4)",
                        border: applyForm.type === t ? "1px solid oklch(0.72 0.09 68 / 40%)" : "1px solid var(--b-1)",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>START DATE *</label>
                  <input data-testid="leave-start" type="date" style={inputStyle} value={(applyForm.startDate || "").split("/").reverse().join("-")} onChange={(e) => setApplyForm((f) => ({ ...f, startDate: e.target.value ? e.target.value.split("-").reverse().join("/") : "" }))} />
                </div>
                <div>
                  <label style={labelStyle}>END DATE *</label>
                  <input data-testid="leave-end" type="date" style={inputStyle} value={(applyForm.endDate || "").split("/").reverse().join("-")} onChange={(e) => setApplyForm((f) => ({ ...f, endDate: e.target.value ? e.target.value.split("-").reverse().join("/") : "" }))} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>REASON</label>
                <textarea
                  style={{ ...inputStyle, minHeight: "80px", resize: "none" }}
                  placeholder="Brief reason for leave..."
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleApply}
                data-testid="leave-submit"
                className="w-full py-3.5 rounded-xl text-sm font-label font-semibold flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, var(--acc-bright), var(--acc-2))", color: "oklch(1 0 0)", letterSpacing: "0.04em" }}
              >
                <Plus size={16} /> Submit Application
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
