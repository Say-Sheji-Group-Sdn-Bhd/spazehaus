/*
 * SPAZEHAUS CREATE PROJECT WIZARD
 * Multi-step form: Client Details → Project Details → Cover & Notes → Review
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { Check, ImagePlus } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { useCreateProject, useInquiries } from "@/lib/queries";
import SearchableSelect from "@/components/SearchableSelect";
import { toast } from "sonner";

// Map a CRM customer category onto the wizard's project-type buttons.
const categoryToType = (cat: string): string =>
  cat === "Commercial" || cat === "F&B" || cat === "Office" ? "Commercial" : "Residential";

const steps = [
  { id: 1, title: "Client Details", subtitle: "Who is this project for?" },
  { id: 2, title: "Project Details", subtitle: "What are we designing?" },
  { id: 3, title: "Cover & Notes", subtitle: "Add a cover image and any notes" },
  { id: 4, title: "Review & Submit", subtitle: "Confirm everything" },
];

const projectTypes = ["Residential", "Commercial", "Community"];
const propertyTypes = {
  Residential: ["Condominium", "Apartment", "Cluster House", "Terrace House", "Semi-D", "Bungalow", "Others"],
  Commercial: ["Office", "Retail", "F&B", "Hotel", "Clinic", "Others"],
  Community: ["Showroom", "Gallery", "Mixed-use", "Community Centre"],
};

export default function CreateProject() {
  const [, navigate] = useLocation();
  const createProject = useCreateProject();
  const { data: inquiries = [] } = useInquiries();
  const [step, setStep] = useState(1);
  const [linkInquiryId, setLinkInquiryId] = useState("");
  // Optional cover image (kept out of `form` since it's a File, not text).
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const onPickImage = (file: File | null) => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    if (!file) { setImageFile(null); setImagePreview(null); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };
  const [form, setForm] = useState({
    clientName: "", clientContact: "", clientEmail: "",
    projectName: "", projectType: "Residential", propertyType: "Condominium",
    location: "", size: "", budget: "", startDate: "", targetDate: "",
    notes: "",
  });

  const update = (key: string, value: string | string[]) => setForm((f) => ({ ...f, [key]: value }));

  // Switching project type must also reset property type to a valid option for
  // that type — otherwise a leftover value (e.g. "Condominium" on a Commercial
  // project) stays selected and gets submitted.
  const selectProjectType = (type: string) => {
    const firstProp = propertyTypes[type as keyof typeof propertyTypes]?.[0] ?? "";
    setForm((f) => ({ ...f, projectType: type, propertyType: firstProp }));
  };

  // Customers still in the pipeline (not already awarded) can seed a new project.
  const eligibleCustomers = inquiries.filter(
    (i) => !i.awardedProjectId && (i.stage === "new-inquiry" || i.stage === "showroom-meet"),
  );

  const onPickCustomer = (inqId: string) => {
    setLinkInquiryId(inqId);
    if (!inqId) return;
    const inq = inquiries.find((i) => i.id === inqId);
    if (!inq) return;
    const type = categoryToType(inq.category);
    const propList = propertyTypes[type as keyof typeof propertyTypes] ?? [];
    const propType = propList.includes(inq.property_type) ? inq.property_type : (propList[0] ?? "");
    setForm((f) => ({
      ...f,
      clientName: inq.client_name ?? f.clientName,
      clientContact: inq.contact ?? f.clientContact,
      clientEmail: inq.email ?? f.clientEmail,
      projectType: type,
      propertyType: propType,
      location: inq.location ?? f.location,
      size: inq.estimated_size != null ? String(inq.estimated_size) : f.size,
      budget: inq.estimated_budget != null ? String(inq.estimated_budget) : f.budget,
      projectName: f.projectName || (inq.property_type ? `${inq.client_name} — ${inq.property_type}` : f.projectName),
    }));
  };

  const handleSubmit = async () => {
    // Required-field guard (mirrors the * markers in the wizard).
    const missing =
      !form.clientName.trim() ? "Client name" :
      !form.clientContact.trim() ? "Contact number" :
      !form.projectName.trim() ? "Project name" :
      !form.propertyType ? "Property type" :
      !form.location.trim() ? "Location" :
      null;
    if (missing) {
      toast.error(`${missing} is required`);
      return;
    }
    try {
      const project = await createProject.mutateAsync({
        name: form.projectName.trim(),
        client: form.clientName.trim(),
        clientContact: form.clientContact.trim() || null,
        clientEmail: form.clientEmail.trim() || null,
        type: form.projectType,
        propertyType: form.propertyType,
        location: form.location.trim(),
        size: form.size ? Number(form.size) : 0,
        budget: form.budget ? Number(form.budget) : 0,
        startDate: form.startDate.trim() || null,
        targetDate: form.targetDate.trim() || null,
        areas: [],
        description: form.notes.trim() || null,
        linkInquiryId: linkInquiryId || null,
        imageFile,
      });
      toast.success("Project created successfully!", { description: `${project.name} (${project.id}) has been added.` });
      navigate(`/projects/${project.id}`);
    } catch (err) {
      toast.error(`Could not create project: ${err instanceof Error ? err.message : "unknown error"}`);
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

  const labelStyle = { color: "var(--t-5)", fontSize: "0.75rem", marginBottom: "0.375rem", display: "block", fontFamily: "Raleway, sans-serif", letterSpacing: "0.04em" } as React.CSSProperties;

  return (
    <div className="mobile-container">
      <AppHeader title="New Project" subtitle="CREATE PROJECT" showBack compact />

      <div className="px-4 pb-32 lg:pb-6">
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
                  <div className="w-8 h-0.5 mx-1" style={{ background: step > s.id ? "var(--acc-bright)" : "var(--b-1)" }} />
                )}
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-label" style={{ color: "var(--acc)", letterSpacing: "0.08em" }}>STEP {step} OF {steps.length}</p>
            <h2 className="font-display text-xl font-semibold text-[color:var(--t-1)]">{steps[step - 1].title}</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--t-5)" }}>{steps[step - 1].subtitle}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {step === 1 && (
              <>
                {/* Optional CRM link — pick an existing customer to prefill + link back. */}
                <div className="rounded-xl p-3.5" style={{ background: "oklch(0.62 0.09 68 / 7%)", border: "1px solid oklch(0.62 0.09 68 / 22%)" }}>
                  <label style={labelStyle}>LINK TO CUSTOMER</label>
                  <SearchableSelect
                    testId="cp-link-customer"
                    value={linkInquiryId}
                    onChange={onPickCustomer}
                    placeholder="None — new walk-in client"
                    searchPlaceholder="Search customer name or location…"
                    clearLabel="None — new walk-in client"
                    emptyText="No matching open customers"
                    options={eligibleCustomers.map((c) => ({
                      value: c.id,
                      label: c.client_name,
                      sublabel: `${c.category} · ${c.location}`,
                    }))}
                  />
                  <p className="text-[11px] mt-1.5" style={{ color: "var(--t-5)" }}>
                    {linkInquiryId
                      ? "Client details prefilled below — this project will be linked to the customer and marked as Awarded."
                      : "Optional — pick a pipeline customer to prefill their details, or leave as a walk-in."}
                  </p>
                  {eligibleCustomers.length === 0 && (
                    <p className="text-[11px] mt-1" style={{ color: "var(--t-5)" }}>
                      No open customers yet. Add one from the Customers page first.
                    </p>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>CLIENT NAME *</label>
                  <input data-testid="cp-client-name" style={inputStyle} placeholder="e.g. Mr. & Mrs. Lim" value={form.clientName} onChange={(e) => update("clientName", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>CONTACT NUMBER *</label>
                  <input data-testid="cp-client-contact" style={inputStyle} placeholder="+60 12-345 6789" value={form.clientContact} onChange={(e) => update("clientContact", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>EMAIL ADDRESS</label>
                  <input style={inputStyle} placeholder="client@email.com" value={form.clientEmail} onChange={(e) => update("clientEmail", e.target.value)} />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label style={labelStyle}>PROJECT NAME *</label>
                  <input data-testid="cp-project-name" style={inputStyle} placeholder="e.g. The Paragon Residence" value={form.projectName} onChange={(e) => update("projectName", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>PROJECT TYPE *</label>
                  <div className="flex gap-2">
                    {projectTypes.map((t) => (
                      <button
                        key={t}
                        onClick={() => selectProjectType(t)}
                        className="flex-1 py-2.5 rounded-xl text-xs font-label"
                        style={{
                          background: form.projectType === t ? "var(--acc-bright)" : "var(--s-2)",
                          color: form.projectType === t ? "oklch(1 0 0)" : "var(--t-5)",
                          border: form.projectType === t ? "none" : "1px solid var(--b-1)",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>PROPERTY TYPE *</label>
                  <div className="flex flex-wrap gap-2">
                    {(propertyTypes[form.projectType as keyof typeof propertyTypes] || []).map((t) => (
                      <button
                        key={t}
                        onClick={() => update("propertyType", t)}
                        className="px-3 py-1.5 rounded-full text-xs font-label"
                        style={{
                          background: form.propertyType === t ? "oklch(0.62 0.09 68 / 15%)" : "var(--s-2)",
                          color: form.propertyType === t ? "var(--acc-ink)" : "var(--t-4)",
                          border: form.propertyType === t ? "1px solid oklch(0.72 0.09 68 / 40%)" : "1px solid var(--b-1)",
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>LOCATION / ADDRESS *</label>
                  <input data-testid="cp-location" style={inputStyle} placeholder="e.g. Bukit Indah, Johor Bahru" value={form.location} onChange={(e) => update("location", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>SIZE (SQFT)</label>
                    <input style={inputStyle} placeholder="1850" type="number" value={form.size} onChange={(e) => update("size", e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>BUDGET (RM)</label>
                    <input style={inputStyle} placeholder="280000" type="number" value={form.budget} onChange={(e) => update("budget", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>START DATE</label>
                    <input style={inputStyle} placeholder="DD/MM/YYYY" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>TARGET DATE</label>
                    <input style={inputStyle} placeholder="DD/MM/YYYY" value={form.targetDate} onChange={(e) => update("targetDate", e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div>
                  <label style={labelStyle}>COVER IMAGE</label>
                  <p className="text-xs mb-2" style={{ color: "var(--t-5)" }}>
                    Optional — leave empty to use the default cover for this project type.
                  </p>
                  {imagePreview ? (
                    <div className="relative rounded-xl overflow-hidden" style={{ border: "1px solid var(--b-1)" }}>
                      <img src={imagePreview} alt="Cover preview" className="w-full h-40 object-cover" />
                      <button
                        type="button"
                        onClick={() => onPickImage(null)}
                        className="absolute top-2 right-2 px-2.5 py-1 rounded-lg text-xs font-label"
                        style={{ background: "oklch(0 0 0 / 55%)", color: "oklch(1 0 0)" }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label
                      className="flex flex-col items-center justify-center gap-1.5 h-40 cursor-pointer rounded-xl"
                      style={{ background: "var(--s-2)", border: "1px dashed var(--b-strong)" }}
                    >
                      <ImagePlus size={22} style={{ color: "var(--t-5)" }} />
                      <span className="text-xs font-label" style={{ color: "var(--t-4)" }}>Tap to upload an image</span>
                      <span className="text-[10px]" style={{ color: "var(--t-5)" }}>JPG, PNG or WebP · up to 10 MB</span>
                      <input
                        data-testid="cp-cover-image"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>ADDITIONAL NOTES</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: "100px", resize: "none" }}
                    placeholder="Special requirements, client preferences, style direction..."
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                  />
                </div>
              </>
            )}

            {step === 4 && (
              <div className="space-y-3">
                {[
                  { title: "Client Details", fields: [{ label: "Client Name", value: form.clientName || "—" }, { label: "Contact", value: form.clientContact || "—" }, { label: "Email", value: form.clientEmail || "—" }] },
                  { title: "Project Details", fields: [{ label: "Project Name", value: form.projectName || "—" }, { label: "Type", value: `${form.projectType} · ${form.propertyType}` }, { label: "Location", value: form.location || "—" }, { label: "Size", value: form.size ? `${form.size} sqft` : "—" }, { label: "Budget", value: form.budget ? `RM ${Number(form.budget).toLocaleString()}` : "—" }] },
                ].map((section, si) => (
                  <div key={si} className="rounded-2xl p-4" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-display text-base font-semibold text-[color:var(--t-1)]">{section.title}</h4>
                      <button onClick={() => setStep(si + 1)} className="text-xs font-label" style={{ color: "var(--acc)" }}>Edit</button>
                    </div>
                    {section.fields.map((f) => (
                      <div key={f.label} className="flex items-start justify-between py-1.5" style={{ borderBottom: "1px solid var(--b-2)" }}>
                        <span className="text-xs" style={{ color: "var(--t-5)" }}>{f.label}</span>
                        <span className="text-xs font-medium text-right max-w-[55%]" style={{ color: "var(--t-2)" }}>{f.value}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation buttons */}
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
          whileTap={{ scale: 0.95 }}
          onClick={step < 4 ? () => setStep((s) => s + 1) : handleSubmit}
          disabled={createProject.isPending}
          data-testid="cp-next"
          className="flex-1 py-3.5 rounded-xl text-sm font-label font-semibold"
          style={{ background: "linear-gradient(135deg, var(--acc-bright), var(--acc-2))", color: "oklch(1 0 0)", letterSpacing: "0.04em", opacity: createProject.isPending ? 0.6 : 1 }}
        >
          {step < 4 ? "Continue" : createProject.isPending ? "Creating…" : "Create Project"}
        </motion.button>
      </div>
    </div>
  );
}
