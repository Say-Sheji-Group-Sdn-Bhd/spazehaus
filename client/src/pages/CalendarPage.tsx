/*
 * SPAZEHAUS CALENDAR PAGE
 * Design: Dark premium calendar with event overlay
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppHeader from "@/components/AppHeader";
import { useCalendarEvents, useCalendarEventStaff, useCreateCalendarEvent, useAllStaff, useProjects, CALENDAR_EVENT_COLORS } from "@/lib/queries";
import { useAuth } from "@/contexts/AuthContext";
import type { CalendarEventType } from "@/lib/dbTypes";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, X, Check, RefreshCw } from "lucide-react";
import { googleConfigured } from "@/lib/google/gis";
import { exportEvents } from "@/lib/google/sync";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const eventTypeLabels: Record<string, string> = {
  project: "Site Visit / Project",
  meeting: "Client Meeting",
  leave: "Staff Leave",
  event: "Company Event",
};

export default function CalendarPage() {
  const today = new Date();
  // Default to the demo window — the seeded events cluster around May 2026.
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(4); // May = 4
  const [selectedDate, setSelectedDate] = useState<string | null>("2026-05-12");

  const { data: calendarEvents = [], isSuccess: eventsLoaded } = useCalendarEvents();
  const { data: eventStaff = [] } = useCalendarEventStaff();
  const { data: allStaff = [] } = useAllStaff();
  const { staff: me, user } = useAuth();
  const [composeOpen, setComposeOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const autoSyncedRef = useRef(false);

  // localStorage flag: set once a user has connected Google (first manual sync),
  // so later app-opens can silently auto-sync without a popup. Wrapped — storage
  // can throw in private mode.
  const GCAL_CONNECTED_KEY = "spz_gcal_connected";
  const markConnected = () => { try { localStorage.setItem(GCAL_CONNECTED_KEY, "1"); } catch { /* ignore */ } };

  // One-way push of the calendar into the signed-in user's OWN Google Calendar.
  // Per-user consent (GIS) + login_hint → their account. `silent` = background
  // auto-sync (no popup, no toasts); loud = the manual button.
  const runGoogleSync = async (silent: boolean) => {
    if (!user) { if (!silent) toast.error("Please sign in first"); return; }
    if (!silent) setSyncing(true);
    try {
      const r = await exportEvents(
        user.id, calendarEvents, user.email ?? me?.email ?? undefined, { silent },
      );
      markConnected();
      if (!silent) {
        toast.success("Synced to Google Calendar", {
          description: `${r.created} added · ${r.updated} updated · ${r.removed} removed`,
        });
      }
    } catch (err) {
      // Silent attempts fail quietly (no consent yet / expired session) — the
      // manual "Sync Google" button is the fallback.
      if (!silent) toast.error(`Google sync failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      if (!silent) setSyncing(false);
    }
  };
  const handleGoogleSync = () => runGoogleSync(false);

  // Background auto-sync on app open — once per mount, only for users who've
  // connected Google before and only after events have loaded (so we never
  // reconcile against an empty set mid-load).
  useEffect(() => {
    if (autoSyncedRef.current || !googleConfigured || !user || !eventsLoaded) return;
    let connected = false;
    try { connected = localStorage.getItem(GCAL_CONNECTED_KEY) === "1"; } catch { /* ignore */ }
    if (!connected) return;
    autoSyncedRef.current = true;
    void runGoogleSync(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, eventsLoaded]);

  // eventId → assigned staff rows (from the multi-staff junction table).
  const staffById = new Map(allStaff.map((s) => [s.id, s]));
  const staffByEvent = new Map<string, typeof allStaff>();
  for (const link of eventStaff) {
    const s = staffById.get(link.staff_id);
    if (!s) continue;
    const arr = staffByEvent.get(link.event_id) ?? [];
    arr.push(s);
    staffByEvent.set(link.event_id, arr);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const getEventsForDate = (dateStr: string) => calendarEvents.filter((e) => e.event_date === dateStr);

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // "Upcoming this week" — events on or after today, soonest first
  const todayIso = today.toISOString().slice(0, 10);
  const upcoming = [...calendarEvents]
    .filter((e) => e.event_date >= todayIso)
    .slice(0, 4);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="mobile-container">
      <AppHeader
        title="Calendar"
        subtitle="SCHEDULE"
        compact
        rightAction={
          <div className="flex items-center gap-2">
            {googleConfigured && (
              <button
                data-testid="google-sync-btn"
                onClick={handleGoogleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-label font-semibold"
                style={{ background: "var(--s-2)", color: "var(--t-2)", border: "1px solid var(--b-1)", letterSpacing: "0.04em", opacity: syncing ? 0.6 : 1 }}
              >
                <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing…" : "Sync Google"}
              </button>
            )}
            <button
              data-testid="new-event-btn"
              onClick={() => setComposeOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-label font-semibold"
              style={{ background: "var(--acc-strong)", color: "oklch(1 0 0)", letterSpacing: "0.04em" }}
            >
              <Plus size={14} /> Event
            </button>
          </div>
        }
      />

      <div className="px-4 py-4 pb-24 space-y-4 lg:px-8 lg:py-7 lg:space-y-6">
        {/* Two-column layout on lg+: calendar left, agenda right */}
        <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[1fr_340px] lg:gap-6 lg:items-start">

          {/* LEFT: Month nav + calendar grid */}
          <div className="space-y-4 lg:space-y-5">
            {/* Month nav */}
            <div className="flex items-center justify-between">
              <motion.button whileTap={{ scale: 0.9 }} onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                <ChevronLeft size={16} style={{ color: "var(--acc)" }} />
              </motion.button>
              <h3 className="font-display text-lg font-semibold text-[color:var(--t-1)]">{MONTHS[month]} {year}</h3>
              <motion.button whileTap={{ scale: 0.9 }} onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                <ChevronRight size={16} style={{ color: "var(--acc)" }} />
              </motion.button>
            </div>

            {/* Calendar grid */}
            <div className="rounded-2xl p-4 lg:p-6" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {DAYS_OF_WEEK.map((d) => (
                  <div key={d} className="text-center py-1">
                    <span className="text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>{d}</span>
                  </div>
                ))}
              </div>

              {/* Date cells */}
              <div className="grid grid-cols-7 gap-y-1 lg:gap-y-2">
                {cells.map((day, i) => {
                  if (!day) return <div key={`empty-${i}`} />;
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const events = getEventsForDate(dateStr);
                  const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                  const isSelected = dateStr === selectedDate;

                  return (
                    <motion.button
                      key={day}
                      whileTap={{ scale: 0.88 }}
                      onClick={() => setSelectedDate(dateStr)}
                      className="flex flex-col items-center py-1.5 lg:py-3 rounded-xl relative"
                      style={{
                        background: isSelected ? "var(--acc-bright)" : isToday ? "oklch(0.62 0.09 68 / 12%)" : "transparent",
                      }}
                    >
                      <span
                        className="text-sm font-medium"
                        style={{
                          color: isSelected ? "oklch(1 0 0)" : isToday ? "var(--acc-bright)" : "var(--t-2)",
                        }}
                      >
                        {day}
                      </span>
                      {events.length > 0 && (
                        <div className="flex gap-0.5 mt-0.5">
                          {events.slice(0, 3).map((e, ei) => (
                            <div
                              key={ei}
                              className="w-1 h-1 rounded-full"
                              style={{ background: isSelected ? "oklch(0.62 0.09 68 / 70%)" : e.color }}
                            />
                          ))}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Selected date events + Upcoming */}
          <div className="space-y-4 lg:space-y-5">
            {/* Selected date events */}
            {selectedDate && (
              <div>
                <p className="text-xs font-label mb-3" style={{ color: "var(--t-5)", letterSpacing: "0.08em" }}>
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long" }).toUpperCase()}
                </p>

                {selectedEvents.length === 0 ? (
                  <div className="rounded-2xl p-6 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                    <p className="text-sm" style={{ color: "var(--t-5)" }}>No events on this day</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedEvents.map((event, i) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className="rounded-xl p-3 flex items-center gap-3"
                        style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
                      >
                        <div
                          className="w-1.5 h-10 rounded-full shrink-0"
                          style={{ background: event.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[color:var(--t-1)]">{event.title}</p>
                          <p className="text-[10px] mt-0.5 font-label" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>
                            {eventTypeLabels[event.event_type] || event.event_type}
                            {event.end_date && event.end_date !== event.event_date && (
                              <> · until {new Date(event.end_date + "T00:00:00").toLocaleDateString("en-MY", { day: "numeric", month: "short" })}</>
                            )}
                            {(event.start_time) && <> · {event.start_time?.slice(0, 5)}{event.end_time ? `–${event.end_time.slice(0, 5)}` : ""}</>}
                          </p>
                        </div>
                        {(staffByEvent.get(event.id)?.length ?? 0) > 0 && (
                          <div className="flex -space-x-1 shrink-0">
                            {staffByEvent.get(event.id)!.slice(0, 3).map((s) => (
                              <div
                                key={s.id}
                                title={s.name}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2"
                                style={{ background: "oklch(0.62 0.09 68 / 15%)", color: "var(--acc-ink)", borderColor: "oklch(1 0 0)" }}
                              >
                                {s.avatar_code}
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upcoming events */}
            <div>
              <p className="text-xs font-label mb-3" style={{ color: "var(--t-5)", letterSpacing: "0.08em" }}>UPCOMING</p>
              <div className="space-y-2">
                {upcoming.length === 0 && (
                  <div className="rounded-xl p-4 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                    <p className="text-sm" style={{ color: "var(--t-5)" }}>Nothing on the horizon</p>
                  </div>
                )}
                {upcoming.map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${event.color}22` }}>
                      <span className="text-xs font-bold" style={{ color: event.color }}>
                        {new Date(event.event_date + "T00:00:00").getDate()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[color:var(--t-1)]">{event.title}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--t-5)" }}>
                        {new Date(event.event_date + "T00:00:00").toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: event.color }} />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      <CreateEventDialog
        open={composeOpen}
        defaultDate={selectedDate ?? todayIso}
        authorId={me?.id ?? ""}
        staffOptions={allStaff.filter((s) => s.status !== "inactive")}
        onClose={() => setComposeOpen(false)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE EVENT — schedule an event with a date range + multiple staff
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_TYPES: { value: CalendarEventType; label: string }[] = [
  { value: "project", label: "Site Visit / Project" },
  { value: "meeting", label: "Client Meeting" },
  { value: "event", label: "Company Event" },
  { value: "leave", label: "Staff Leave" },
];

function CreateEventDialog({
  open, defaultDate, authorId, staffOptions, onClose,
}: {
  open: boolean;
  defaultDate: string;
  authorId: string;
  staffOptions: { id: string; name: string; avatar_code: string }[];
  onClose: () => void;
}) {
  const createEvent = useCreateCalendarEvent();
  const { data: projects = [] } = useProjects();
  const pending = createEvent.isPending;

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<CalendarEventType>("meeting");
  const [eventDate, setEventDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [projectId, setProjectId] = useState("");
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(""); setEventType("meeting"); setEventDate(defaultDate); setEndDate("");
    setStartTime(""); setEndTime(""); setProjectId(""); setStaffIds([]); setNotes("");
  }, [open, defaultDate]);

  const toggleStaff = (id: string) =>
    setStaffIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const inputStyle: React.CSSProperties = {
    background: "var(--s-3)", border: "1px solid var(--b-1)",
    color: "var(--t-2)", borderRadius: "12px", padding: "0.7rem 0.9rem",
    fontSize: "0.875rem", width: "100%", outline: "none",
  };
  const labelStyle: React.CSSProperties = { color: "var(--t-5)", letterSpacing: "0.06em", fontWeight: 700 };

  const handleSubmit = async () => {
    if (!title.trim()) return toast.error("Title is required");
    if (!eventDate) return toast.error("Date is required");
    if (!authorId) return toast.error("Could not resolve your staff record");
    if (endDate && endDate < eventDate) return toast.error("End date can't be before the start date");
    try {
      await createEvent.mutateAsync({
        title: title.trim(),
        eventDate,
        endDate: endDate || null,
        startTime: startTime || null,
        endTime: endTime || null,
        eventType,
        projectId: projectId || null,
        staffIds,
        notes: notes.trim() || null,
        createdBy: authorId,
      });
      toast.success("Event scheduled");
      onClose();
    } catch (err) {
      toast.error(`Could not schedule: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={() => !pending && onClose()}
            className="fixed inset-0 z-40"
            style={{ background: "oklch(0.11 0.004 285 / 0.45)", backdropFilter: "blur(4px)" }}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[460px] z-50 flex flex-col lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2"
            style={{ maxHeight: "92vh", background: "var(--s-card)", borderRadius: "24px 24px 0 0", boxShadow: "0 -12px 48px oklch(0 0 0 / 0.18)" }}
          >
            <div className="flex justify-center pt-2.5 pb-1.5 shrink-0 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: "var(--b-strong)" }} />
            </div>
            <div className="px-4 pt-3 lg:pt-5 pb-3 flex items-start justify-between shrink-0" style={{ borderBottom: "1px solid var(--b-2)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))" }}>
                  <Plus size={16} className="text-white" />
                </div>
                <div>
                  <p className="font-display text-base font-semibold leading-tight" style={{ color: "var(--t-1)" }}>New Event</p>
                  <p className="text-[11px]" style={{ color: "var(--t-5)" }}>Schedule with a date range + team</p>
                </div>
              </div>
              <button onClick={onClose} disabled={pending} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--s-2)", opacity: pending ? 0.5 : 1 }}>
                <X size={14} style={{ color: "var(--acc-ink)" }} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div>
                <label className="block text-[10px] font-label mb-1.5" style={labelStyle}>TITLE *</label>
                <input data-testid="event-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Site handover — Residence" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[10px] font-label mb-1.5" style={labelStyle}>TYPE</label>
                <select value={eventType} onChange={(e) => setEventType(e.target.value as CalendarEventType)} style={inputStyle}>
                  {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-label mb-1.5" style={labelStyle}>START DATE *</label>
                  <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[10px] font-label mb-1.5" style={labelStyle}>END DATE</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-label mb-1.5" style={labelStyle}>START TIME</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[10px] font-label mb-1.5" style={labelStyle}>END TIME</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-label mb-1.5" style={labelStyle}>LINKED PROJECT</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={inputStyle}>
                  <option value="">None</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.client}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-label mb-1.5" style={labelStyle}>ASSIGN STAFF ({staffIds.length})</label>
                <div className="flex flex-wrap gap-1.5">
                  {staffOptions.map((s) => {
                    const active = staffIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleStaff(s.id)}
                        className="px-2.5 py-1.5 rounded-full text-xs font-label"
                        style={{ background: active ? "oklch(0.62 0.09 68 / 15%)" : "var(--s-3)", color: active ? "var(--acc-ink)" : "var(--t-5)", border: active ? "1px solid oklch(0.62 0.09 68 / 40%)" : "1px solid var(--b-1)" }}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-label mb-1.5" style={labelStyle}>NOTES</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agenda, location, details…" style={{ ...inputStyle, minHeight: "70px", resize: "none" }} />
              </div>
            </div>

            <div className="px-4 py-3 flex gap-2 shrink-0" style={{ borderTop: "1px solid var(--b-2)" }}>
              <button onClick={onClose} disabled={pending} className="flex-1 py-3 rounded-xl text-sm font-label" style={{ background: "var(--s-2)", color: "var(--acc-ink)", border: "1px solid var(--b-1)", letterSpacing: "0.04em", opacity: pending ? 0.5 : 1 }}>
                Cancel
              </button>
              <motion.button whileTap={pending ? undefined : { scale: 0.96 }} onClick={handleSubmit} disabled={pending} data-testid="event-submit" className="flex-1 py-3 rounded-xl text-sm font-label font-semibold flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))", color: "oklch(1 0 0)", letterSpacing: "0.04em", opacity: pending ? 0.7 : 1 }}>
                {pending ? <span>Scheduling…</span> : (<><Check size={15} />Schedule</>)}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
