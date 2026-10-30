/*
 * SPAZEHAUS EDIT-PROJECT SHEET
 * Bottom-sheet (mobile) / centred modal (desktop) form for editing project
 * metadata from the Project Detail page. Gated to the OPS tier
 * (`canEditProject`) — server-enforced by the `projects_write_ops` RLS policy.
 *
 * Edits metadata only. Derived/system fields (progress, task counts,
 * current_stage_id, client_access_token) and assignee reassignment
 * (designer/pm) are intentionally out of scope here.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FolderCog, Check, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUpdateProject, type UpdateProjectArgs, type Project } from "@/lib/queries";
import { useIsDesktop } from "@/hooks/useMobile";
import type { ProjectRow } from "@/lib/dbTypes";

const STATUSES: ProjectRow["status"][] = ["active", "assigned", "under-review", "completed", "on-hold"];
const PRIORITIES: ProjectRow["priority"][] = ["high", "medium", "low"];

/** DD/MM/YYYY → YYYY-MM-DD (for <input type=date>); "" if unparseable. */
function ddmmToIso(s: string): string {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
/** YYYY-MM-DD → DD/MM/YYYY (the shape useUpdateProject expects); "" if empty. */
function isoToDdmm(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

export default function EditProjectSheet({
  project,
  open,
  onClose,
}: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
}) {
  const updateProject = useUpdateProject();
  const isDesktop = useIsDesktop();

  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectRow["status"]>("active");
  const [priority, setPriority] = useState<ProjectRow["priority"]>("medium");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [size, setSize] = useState("");
  const [startIso, setStartIso] = useState("");
  const [targetIso, setTargetIso] = useState("");
  const [client, setClient] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && project) {
      setCoverFile(null);
      setCoverPreview(null);
      setRemoveCover(false);
      setName(project.name);
      setStatus(project.status as ProjectRow["status"]);
      setPriority(project.priority as ProjectRow["priority"]);
      setLocation(project.location);
      setBudget(String(project.budget ?? ""));
      setSize(String(project.size ?? ""));
      setStartIso(ddmmToIso(project.startDate));
      setTargetIso(ddmmToIso(project.targetDate));
      setClient(project.client);
      setClientContact(project.clientContact ?? "");
      setClientEmail(project.clientEmail ?? "");
      setDescription(project.description ?? "");
    }
  }, [open, project]);

  function pickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setRemoveCover(false);
  }
  function clearCover() {
    setCoverFile(null);
    setCoverPreview(null);
    setRemoveCover(true);
  }

  if (!project) return null;

  // Current cover shown in the sheet: a freshly-picked file, else the existing
  // cover, else (removed / none) the built-in default placeholder.
  const currentCoverUrl = removeCover ? undefined : (coverPreview ?? project.heroImage);
  const showRemove = Boolean(coverFile) || (Boolean(project.heroImage) && !removeCover);

  async function handleSubmit() {
    if (!project) return;
    if (!name.trim()) { toast.error("Project name is required"); return; }
    if (!client.trim()) { toast.error("Client name is required"); return; }

    const args: UpdateProjectArgs = {
      id: project.id,
      name: name.trim(),
      status,
      priority,
      location: location.trim(),
      budget: Number(budget) || 0,
      size: Number(size) || 0,
      startDate: isoToDdmm(startIso),
      targetDate: isoToDdmm(targetIso),
      client: client.trim(),
      clientContact: clientContact.trim() || null,
      clientEmail: clientEmail.trim() || null,
      description: description.trim() || null,
      imageFile: coverFile,
      removeImage: removeCover,
    };
    try {
      await updateProject.mutateAsync(args);
      toast.success("Project updated", { description: name.trim() });
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
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
            style={{
              maxHeight: "92vh",
              background: "var(--s-card)",
              borderRadius: isDesktop ? 28 : "28px 28px 0 0",
              boxShadow: "0 -12px 48px oklch(0 0 0 / 0.18)",
            }}
          >
            <div className="flex justify-center pt-2.5 pb-1.5 shrink-0 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ background: "var(--b-strong)" }} />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 flex items-start justify-between shrink-0" style={{ borderBottom: "1px solid var(--b-2)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))" }}>
                  <FolderCog size={16} className="text-white" />
                </div>
                <div>
                  <p className="font-display text-base font-semibold leading-tight" style={{ color: "var(--t-1)" }}>Edit Project</p>
                  <p className="text-[11px]" style={{ color: "var(--t-5)" }}>{project.id}</p>
                </div>
              </div>
              <button onClick={onClose} disabled={updateProject.isPending} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "var(--s-2)", opacity: updateProject.isPending ? 0.5 : 1 }}>
                <X size={14} style={{ color: "var(--acc-ink)" }} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <FieldGroup label="COVER IMAGE">
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--b-1)" }}>
                  <div
                    style={{
                      height: 120,
                      background: currentCoverUrl
                        ? `linear-gradient(oklch(0.11 0.004 285 / 0.1), oklch(0.11 0.004 285 / 0.25)), url(${currentCoverUrl}) center/cover no-repeat`
                        : "var(--s-3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {!currentCoverUrl && (
                      <span className="text-[11px]" style={{ color: "var(--t-5)" }}>Default cover (by project type)</span>
                    )}
                  </div>
                  <div className="flex gap-2 p-2" style={{ borderTop: "1px solid var(--b-2)" }}>
                    <button
                      type="button"
                      data-testid="edit-cover-replace"
                      onClick={() => fileRef.current?.click()}
                      className="flex-1 py-2 rounded-lg text-xs font-label flex items-center justify-center gap-1.5"
                      style={{ background: "var(--s-2)", color: "var(--acc-ink)", border: "1px solid var(--b-1)" }}
                    >
                      <ImagePlus size={13} />{currentCoverUrl ? "Replace" : "Add cover"}
                    </button>
                    {showRemove && (
                      <button
                        type="button"
                        data-testid="edit-cover-remove"
                        onClick={clearCover}
                        className="py-2 px-3 rounded-lg text-xs font-label flex items-center justify-center gap-1.5"
                        style={{ background: "oklch(0.55 0.16 25 / 10%)", color: "oklch(0.55 0.16 25)", border: "1px solid oklch(0.55 0.16 25 / 25%)" }}
                      >
                        <Trash2 size={13} />Remove
                      </button>
                    )}
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickCover} />
              </FieldGroup>

              <FieldGroup label="PROJECT NAME *">
                <input data-testid="edit-name" type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
              </FieldGroup>

              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="STATUS">
                  <select value={status} onChange={(e) => setStatus(e.target.value as ProjectRow["status"])} style={inputStyle}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </FieldGroup>
                <FieldGroup label="PRIORITY">
                  <select value={priority} onChange={(e) => setPriority(e.target.value as ProjectRow["priority"])} style={inputStyle}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </FieldGroup>
              </div>

              <FieldGroup label="LOCATION">
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle} />
              </FieldGroup>

              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="BUDGET (RM)">
                  <input type="number" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} style={inputStyle} />
                </FieldGroup>
                <FieldGroup label="SIZE (SQFT)">
                  <input type="number" inputMode="numeric" value={size} onChange={(e) => setSize(e.target.value)} style={inputStyle} />
                </FieldGroup>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="START DATE">
                  <input type="date" value={startIso} onChange={(e) => setStartIso(e.target.value)} style={inputStyle} />
                </FieldGroup>
                <FieldGroup label="TARGET DATE">
                  <input type="date" value={targetIso} onChange={(e) => setTargetIso(e.target.value)} style={inputStyle} />
                </FieldGroup>
              </div>

              <FieldGroup label="CLIENT NAME *">
                <input type="text" value={client} onChange={(e) => setClient(e.target.value)} style={inputStyle} />
              </FieldGroup>
              <FieldGroup label="CLIENT CONTACT">
                <input type="tel" value={clientContact} onChange={(e) => setClientContact(e.target.value)} placeholder="+60 12-345 6789" style={inputStyle} />
              </FieldGroup>
              <FieldGroup label="CLIENT EMAIL">
                <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@example.com" style={inputStyle} />
              </FieldGroup>

              <FieldGroup label="DESCRIPTION">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...inputStyle, minHeight: 80, resize: "none" }} />
              </FieldGroup>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 flex gap-2 shrink-0" style={{ borderTop: "1px solid var(--b-2)" }}>
              <button onClick={onClose} disabled={updateProject.isPending} className="flex-1 py-3 rounded-xl text-sm font-label" style={{ background: "var(--s-2)", color: "var(--t-3)", border: "1px solid var(--b-1)", letterSpacing: "0.04em", opacity: updateProject.isPending ? 0.5 : 1 }}>
                Cancel
              </button>
              <motion.button
                whileTap={updateProject.isPending ? undefined : { scale: 0.96 }}
                onClick={handleSubmit}
                disabled={updateProject.isPending}
                data-testid="edit-save"
                className="flex-1 py-3 rounded-xl text-sm font-label font-semibold flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, var(--acc-strong), var(--acc-2))", color: "oklch(1 0 0)", letterSpacing: "0.04em", boxShadow: updateProject.isPending ? "none" : "0 4px 16px oklch(0.62 0.09 68 / 0.35)", opacity: updateProject.isPending ? 0.7 : 1 }}
              >
                {updateProject.isPending ? <span>Saving…</span> : (<><Check size={15} />Save Changes</>)}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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
  borderRadius: "0.75rem",
  padding: "0.7rem 0.9rem",
  fontSize: "0.875rem",
  width: "100%",
  outline: "none",
};
