/*
 * SPAZEHAUS NOTIFICATION BELL
 * Header bell + dropdown showing the 3 most urgent reminders, with a "See all"
 * link to the full /reminders page. Shared by AppHeader and the Dashboard header.
 *
 * The dropdown is positioned `fixed` (anchored to the button's rect) so it is not
 * clipped by the header's `overflow-hidden`.
 */
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useReminders, type Reminder } from "@/lib/queries";

// Urgency order: overdue first, then today's pending, then upcoming, done last.
const ORDER: Record<string, number> = { overdue: 0, pending: 1, upcoming: 2, completed: 3 };
const DOT: Record<string, string> = {
  overdue: "oklch(0.58 0.14 25)",
  pending: "oklch(0.70 0.12 68)",
  upcoming: "oklch(0.62 0.09 240)",
  completed: "oklch(0.55 0.10 145)",
};

export default function NotificationBell({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [, navigate] = useLocation();
  const { all } = useReminders();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const sorted = [...all].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));
  const top3 = sorted.slice(0, 3);
  const unread = all.filter((r) => r.status === "overdue" || r.status === "pending").length;

  function toggle() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    setOpen((o) => !o);
  }

  // Close on outside click, Escape, or scroll/resize (avoids a drifting panel).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const goReminders = () => { setOpen(false); navigate("/reminders"); };

  const btnStyle =
    variant === "dark"
      ? { background: "oklch(1 0 0 / 12%)", border: "1px solid oklch(1 0 0 / 18%)" }
      : { background: "var(--s-2)", border: "1px solid var(--b-1)" };
  const iconColor = variant === "dark" ? "#fff" : "var(--t-3)";

  return (
    <>
      <motion.button
        ref={btnRef}
        whileTap={{ scale: 0.9 }}
        onClick={toggle}
        data-testid="notif-bell"
        aria-label="Notifications"
        className="w-9 h-9 flex items-center justify-center rounded-full relative"
        style={btnStyle}
      >
        <Bell size={16} style={{ color: iconColor }} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: "var(--acc-bright)" }} />
        )}
      </motion.button>

      <AnimatePresence>
        {open && pos && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[60] w-[320px] max-w-[calc(100vw-16px)] rounded-2xl overflow-hidden"
            style={{ top: pos.top, right: pos.right, background: "var(--s-card)", border: "1px solid var(--b-1)", boxShadow: "0 12px 40px oklch(0 0 0 / 0.22)" }}
          >
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--b-2)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>Notifications</p>
              {unread > 0 && (
                <span className="text-[10px] font-label px-2 py-0.5 rounded-full" style={{ background: "oklch(0.62 0.09 68 / 14%)", color: "var(--acc-ink)" }}>
                  {unread} due
                </span>
              )}
            </div>

            {top3.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm" style={{ color: "var(--t-1)" }}>You're all caught up 🎉</p>
                <p className="text-xs mt-1" style={{ color: "var(--t-5)" }}>No reminders need attention.</p>
              </div>
            ) : (
              <div>
                {top3.map((r: Reminder) => (
                  <button
                    key={r.id}
                    onClick={goReminders}
                    className="w-full flex items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[color:var(--s-2)]"
                    style={{ borderBottom: "1px solid var(--b-2)" }}
                  >
                    <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: DOT[r.status] ?? "var(--t-5)" }} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium truncate" style={{ color: "var(--t-1)" }}>{r.title}</span>
                      <span className="block text-[11px] mt-0.5 truncate" style={{ color: "var(--t-5)" }}>
                        {r.status === "overdue" ? "Overdue · " : r.status === "pending" ? "Due today · " : r.status === "upcoming" ? "Upcoming · " : "Done · "}
                        {r.note ?? r.dueDate}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={goReminders}
              className="w-full flex items-center justify-center gap-1 px-4 py-2.5 text-xs font-label font-semibold"
              style={{ color: "var(--acc-ink)", letterSpacing: "0.04em" }}
            >
              See all reminders <ChevronRight size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
