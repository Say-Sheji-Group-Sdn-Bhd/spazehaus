/*
 * SPAZEHAUS CLIENT PORTAL — read-only project view
 *
 * Route: /portal/:token   (PUBLIC — registered above AuthGate so no Supabase
 *                          Auth session is required)
 *
 * Renders a clean, client-facing summary of one project's progress, payment
 * schedule, document signatures, and recent site photos. Mirrors the staff
 * app's mobile-container + warm-gold palette so it feels like the same brand
 * — but with no admin actions, no bottom nav, no role chips.
 *
 * The entire data fetch happens in one RPC (`get_client_portal_data`) keyed
 * by the URL token. Photos are loaded lazily via the `client-portal-photo`
 * Edge Function which mints short-lived signed URLs for the private bucket.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { useRoute } from "wouter";
import {
  AlertCircle, CheckCircle2, Clock, FileSignature, Receipt, Camera,
  MapPin, Calendar, Loader2, Lock, Mail, Phone, User, Building2, Star, Heart,
} from "lucide-react";
import {
  useClientPortalData,
  useClientPortalPhotoUrl,
  type ClientPortalData,
  type ClientPortalPayment,
  type ClientPortalPhoto,
  type ClientPortalSignature,
  type ClientPortalStage,
} from "@/lib/clientPortal";
import { useSubmitClientReview } from "@/lib/queries";

const HERO_BG =
  "/hero/portfolio.jpg";

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ClientPortal() {
  const [, params] = useRoute("/portal/:token");
  const token = params?.token;
  const { data, isLoading, isError } = useClientPortalData(token);

  // 1. Loading
  if (isLoading) {
    return (
      <Frame>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2
            size={20}
            className="animate-spin"
            style={{ color: "oklch(0.62 0.09 68)" }}
          />
        </div>
      </Frame>
    );
  }

  // 2. Invalid token (RPC returned null) OR network error
  if (isError || !data) {
    return (
      <Frame>
        <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center gap-3">
          <Lock size={28} style={{ color: "oklch(0.50 0.12 25)" }} />
          <p
            className="font-display text-xl font-semibold"
            style={{ color: "oklch(0.14 0.008 65)" }}
          >
            This link isn't valid
          </p>
          <p className="text-sm leading-relaxed max-w-sm" style={{ color: "oklch(0.45 0.008 65)" }}>
            The portal link you opened may have been revoked or mistyped.
            Please ask your SPAZEHAUS designer for an updated link.
          </p>
        </div>
        <Footer />
      </Frame>
    );
  }

  // 3. Real content
  return (
    <Frame>
      <HeroBanner project={data.project} />
      <div className="px-4 py-5 space-y-6 pb-24 lg:px-8 lg:py-7 lg:space-y-8">
        <ProjectMetaCard project={data.project} />
        <ProgressSection project={data.project} lifecycle={data.lifecycle} />
        <PaymentsSection payments={data.payments} budget={data.project.budget} />
        <SignaturesSection signatures={data.signatures} />
        <PhotosSection photos={data.recent_photos} token={token!} />
        <ReviewSection token={token!} clientName={data.project.client_name} />
        <SupportCard project={data.project} />
        <Footer />
      </div>
    </Frame>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-start justify-center lg:py-8"
      style={{ background: "oklch(0.93 0.008 75)" }}
    >
      <div
        className="w-full max-w-[430px] min-h-screen relative lg:max-w-[900px] xl:max-w-[1100px] lg:min-h-0 lg:rounded-2xl lg:overflow-hidden lg:shadow-xl"
        style={{ background: "oklch(0.985 0.004 80)" }}
      >
        {children}
      </div>
    </div>
  );
}

function HeroBanner({ project }: { project: ClientPortalData["project"] }) {
  return (
    <div
      className="relative h-44 flex flex-col justify-end px-5 py-4 lg:h-64 lg:px-8 lg:py-7"
      style={{
        backgroundImage: `linear-gradient(180deg, oklch(0.14 0.008 65 / 30%), oklch(0.14 0.008 65 / 85%)), url(${HERO_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <p
        className="text-[10px] font-label tracking-widest mb-1"
        style={{ color: "oklch(0.72 0.09 68)", fontWeight: 700, letterSpacing: "0.18em" }}
      >
        SPAZEHAUS · CLIENT PORTAL
      </p>
      <h1
        className="font-display text-2xl font-semibold leading-tight lg:text-4xl"
        style={{ color: "oklch(1 0 0)" }}
      >
        {project.name}
      </h1>
      <p className="text-xs mt-1" style={{ color: "oklch(0.93 0 0 / 80%)" }}>
        {[project.client_name, project.property_type, project.location?.split(",")[0]].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

function ProjectMetaCard({ project }: { project: ClientPortalData["project"] }) {
  return (
    <Section title="PROJECT" icon={Building2}>
      <div
        className="rounded-2xl p-4 space-y-3 lg:p-5"
        style={{
          background: "oklch(1 0 0)",
          border: "1px solid oklch(0.90 0.010 75)",
          boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)",
        }}
      >
        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-4">
          <MetaRow
            icon={MapPin}
            label="Location"
            value={project.location}
          />
          <MetaRow
            icon={Calendar}
            label="Schedule"
            value={`${formatDate(project.start_date)} → ${
              project.target_date ? formatDate(project.target_date) : "TBD"
            }`}
          />
          <MetaRow
            icon={User}
            label="Designer"
            value={project.designer_name}
          />
          <MetaRow
            icon={User}
            label="Project Manager"
            value={project.pm_name}
          />
          {project.size_sqft ? (
            <MetaRow
              icon={Building2}
              label="Floor area"
              value={`${project.size_sqft.toLocaleString()} sqft`}
            />
          ) : null}
          {project.budget ? (
            <MetaRow
              icon={Receipt}
              label="Contract value"
              value={`RM ${project.budget.toLocaleString("en-MY")}`}
            />
          ) : null}
        </div>
        {project.description ? (
          <div className="pt-2 mt-1" style={{ borderTop: "1px solid oklch(0.93 0.008 75)" }}>
            <p className="text-[10px] font-label mb-1" style={{ color: "oklch(0.52 0.010 68)", letterSpacing: "0.08em", fontWeight: 700 }}>
              ABOUT
            </p>
            <p className="text-[12px] leading-relaxed" style={{ color: "oklch(0.30 0.008 65)" }}>
              {project.description}
            </p>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function ProgressSection({
  project,
  lifecycle,
}: {
  project: ClientPortalData["project"];
  lifecycle: ClientPortalData["lifecycle"];
}) {
  const currentOrder = lifecycle.current?.order_index ?? 0;
  const totalStages = lifecycle.all_stages.length;
  // Group by phase for the timeline
  const phases = groupByPhase(lifecycle.all_stages);

  return (
    <Section title="PROGRESS" icon={CheckCircle2}>
      <div className="lg:flex lg:gap-4 lg:items-start">
      {/* Progress meter */}
      <div
        className="rounded-2xl p-4 mb-3 lg:mb-0 lg:w-56 lg:shrink-0"
        style={{
          background: "oklch(1 0 0)",
          border: "1px solid oklch(0.90 0.010 75)",
          boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)",
        }}
      >
        <div className="flex items-baseline justify-between mb-2">
          <p
            className="font-display text-xl font-semibold leading-none"
            style={{ color: "oklch(0.14 0.008 65)" }}
          >
            {project.progress}%
          </p>
          <p
            className="text-[10px] font-label"
            style={{ color: "oklch(0.52 0.010 68)", letterSpacing: "0.08em", fontWeight: 700 }}
          >
            COMPLETE
          </p>
        </div>
        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: "oklch(0.92 0.008 75)" }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, project.progress)}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: "oklch(0.62 0.09 68)" }}
          />
        </div>
        {lifecycle.current ? (
          <p className="text-[11px] mt-2.5" style={{ color: "oklch(0.45 0.008 65)" }}>
            Currently at <span style={{ color: "oklch(0.42 0.09 68)", fontWeight: 600 }}>{lifecycle.current.label}</span>
            {" "}({lifecycle.current.phase} phase · stage {currentOrder} of {totalStages})
          </p>
        ) : null}
      </div>

      {/* Phase timeline */}
      <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-2 lg:items-start">
        {phases.map((p) => {
          const phaseDone = p.stages.every((s) => s.order_index < currentOrder);
          const phaseActive = p.stages.some((s) => s.order_index === currentOrder);
          const phaseUpcoming = p.stages.every((s) => s.order_index > currentOrder);
          return (
            <div
              key={p.phase}
              className="rounded-xl p-3"
              style={{
                background: phaseActive
                  ? "linear-gradient(135deg, oklch(0.62 0.09 68 / 10%), oklch(1 0 0))"
                  : "oklch(1 0 0)",
                border: phaseActive
                  ? "1px solid oklch(0.62 0.09 68 / 35%)"
                  : "1px solid oklch(0.90 0.010 75)",
                opacity: phaseUpcoming ? 0.65 : 1,
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <p
                  className="font-label text-[10px]"
                  style={{
                    color: phaseActive ? "oklch(0.42 0.09 68)" : phaseDone ? "oklch(0.38 0.09 145)" : "oklch(0.52 0.010 68)",
                    letterSpacing: "0.12em",
                    fontWeight: 700,
                  }}
                >
                  {p.phase.toUpperCase()}
                </p>
                {phaseDone ? (
                  <CheckCircle2 size={12} style={{ color: "oklch(0.38 0.09 145)" }} />
                ) : phaseActive ? (
                  <span
                    className="text-[9px] font-label px-1.5 py-0.5 rounded"
                    style={{
                      background: "oklch(0.62 0.09 68)",
                      color: "oklch(1 0 0)",
                      letterSpacing: "0.06em",
                      fontWeight: 700,
                    }}
                  >
                    NOW
                  </span>
                ) : (
                  <Clock size={12} style={{ color: "oklch(0.65 0.008 68)" }} />
                )}
              </div>
              <p className="text-[11px]" style={{ color: "oklch(0.30 0.008 65)" }}>
                {p.stages.length} step{p.stages.length === 1 ? "" : "s"} ·{" "}
                {phaseActive
                  ? p.stages.find((s) => s.order_index === currentOrder)?.label
                  : phaseDone
                  ? "Completed"
                  : "Upcoming"}
              </p>
            </div>
          );
        })}
      </div>
      </div>
    </Section>
  );
}

function PaymentsSection({
  payments,
  budget,
}: {
  payments: ClientPortalPayment[];
  budget: number | null;
}) {
  if (payments.length === 0) return null;
  const collected = payments
    .filter((p) => p.status === "completed")
    .reduce((s, p) => s + Number(p.amount), 0);
  const total = payments.reduce((s, p) => s + Number(p.amount), 0);
  const pct = total === 0 ? 0 : Math.round((collected / total) * 100);

  return (
    <Section title="PAYMENTS" icon={Receipt}>
      <div
        className="rounded-2xl p-4 mb-3"
        style={{
          background: "oklch(1 0 0)",
          border: "1px solid oklch(0.90 0.010 75)",
          boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)",
        }}
      >
        <div className="flex items-baseline justify-between mb-1">
          <p className="font-display text-lg font-semibold" style={{ color: "oklch(0.14 0.008 65)" }}>
            RM {collected.toLocaleString("en-MY")}
          </p>
          <p className="text-[10px]" style={{ color: "oklch(0.52 0.010 68)" }}>
            of RM {total.toLocaleString("en-MY")} ({pct}%)
          </p>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden mt-2"
          style={{ background: "oklch(0.92 0.008 75)" }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: "oklch(0.55 0.09 145)" }}
          />
        </div>
      </div>
      <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:items-start">
        {payments.map((p) => (
          <PaymentRow key={p.id} payment={p} />
        ))}
      </div>
    </Section>
  );
}

function PaymentRow({ payment }: { payment: ClientPortalPayment }) {
  const gateGlyph = ["①", "②", "③", "④", "⑤"][payment.gate - 1] ?? "•";
  const isCompleted = payment.status === "completed";
  const isOverdue = payment.status === "overdue";
  const tone = isCompleted
    ? { color: "oklch(0.38 0.09 145)", bg: "oklch(0.55 0.09 145 / 10%)", border: "oklch(0.55 0.09 145 / 25%)" }
    : isOverdue
    ? { color: "oklch(0.50 0.12 25)", bg: "oklch(0.60 0.12 25 / 10%)", border: "oklch(0.60 0.12 25 / 25%)" }
    : { color: "oklch(0.42 0.09 68)", bg: "oklch(0.62 0.09 68 / 10%)", border: "oklch(0.62 0.09 68 / 25%)" };

  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "oklch(1 0 0)",
        border: "1px solid oklch(0.90 0.010 75)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="font-display text-lg leading-none w-7 text-center"
          style={{ color: "oklch(0.72 0.09 68)" }}
        >
          {gateGlyph}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: "oklch(0.14 0.008 65)" }}>
            {payment.label}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "oklch(0.45 0.008 65)" }}>
            RM {Number(payment.amount).toLocaleString("en-MY")}
            {payment.instalment && payment.of_instalments
              ? ` · Instalment ${payment.instalment} of ${payment.of_instalments}`
              : ""}
          </p>
          {isCompleted && payment.collected_date ? (
            <p className="text-[10px] mt-1" style={{ color: "oklch(0.38 0.09 145)" }}>
              Received {formatDate(payment.collected_date)}
              {payment.reference ? ` · Ref ${payment.reference}` : ""}
            </p>
          ) : payment.due_date ? (
            <p className="text-[10px] mt-1" style={{ color: "oklch(0.45 0.008 65)" }}>
              Due {formatDate(payment.due_date)}
            </p>
          ) : null}
        </div>
        <span
          className="text-[9px] font-label px-2 py-0.5 rounded-md shrink-0"
          style={{
            background: tone.bg,
            color: tone.color,
            border: `1px solid ${tone.border}`,
            letterSpacing: "0.04em",
            fontWeight: 700,
          }}
        >
          {payment.status.replace("-", " ").toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function SignaturesSection({
  signatures,
}: {
  signatures: ClientPortalSignature[];
}) {
  if (signatures.length === 0) return null;
  const signed = signatures.filter((s) => s.status === "completed").length;
  return (
    <Section title="DOCUMENTS" icon={FileSignature}>
      <div
        className="rounded-2xl p-3 mb-3"
        style={{
          background: "oklch(1 0 0)",
          border: "1px solid oklch(0.90 0.010 75)",
          boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)",
        }}
      >
        <p className="text-sm font-semibold" style={{ color: "oklch(0.14 0.008 65)" }}>
          {signed} of {signatures.length} signed
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "oklch(0.45 0.008 65)" }}>
          Your designer will reach out when each document is ready to sign.
        </p>
      </div>
      <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:items-start">
        {signatures.map((s) => (
          <SignatureRow key={s.id} signature={s} />
        ))}
      </div>
    </Section>
  );
}

function SignatureRow({ signature }: { signature: ClientPortalSignature }) {
  const isCompleted = signature.status === "completed";
  const tone = isCompleted
    ? { color: "oklch(0.38 0.09 145)", bg: "oklch(0.55 0.09 145 / 10%)", border: "oklch(0.55 0.09 145 / 25%)", label: "SIGNED" }
    : { color: "oklch(0.42 0.09 68)", bg: "oklch(0.62 0.09 68 / 10%)", border: "oklch(0.62 0.09 68 / 25%)", label: "PENDING" };
  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3"
      style={{
        background: "oklch(1 0 0)",
        border: "1px solid oklch(0.90 0.010 75)",
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: signature.group_name === "contract" ? "oklch(0.62 0.09 68 / 12%)" : "oklch(0.55 0.09 240 / 12%)",
        }}
      >
        <FileSignature
          size={13}
          style={{
            color: signature.group_name === "contract" ? "oklch(0.42 0.09 68)" : "oklch(0.38 0.09 240)",
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "oklch(0.14 0.008 65)" }}>
          {signature.label}
        </p>
        {isCompleted && signature.signed_date ? (
          <p className="text-[10px] mt-0.5" style={{ color: "oklch(0.38 0.09 145)" }}>
            Signed {formatDate(signature.signed_date)}
            {signature.signed_by ? ` by ${signature.signed_by}` : ""}
          </p>
        ) : (
          <p className="text-[10px] mt-0.5" style={{ color: "oklch(0.45 0.008 65)" }}>
            {signature.group_name === "contract" ? "Contract" : "Drawing sign-off"}
          </p>
        )}
      </div>
      <span
        className="text-[9px] font-label px-2 py-0.5 rounded-md shrink-0"
        style={{
          background: tone.bg,
          color: tone.color,
          border: `1px solid ${tone.border}`,
          letterSpacing: "0.04em",
          fontWeight: 700,
        }}
      >
        {tone.label}
      </span>
    </div>
  );
}

function PhotosSection({
  photos,
  token,
}: {
  photos: ClientPortalPhoto[];
  token: string;
}) {
  if (photos.length === 0) {
    return (
      <Section title="SITE PHOTOS" icon={Camera}>
        <div
          className="rounded-2xl p-6 text-center"
          style={{
            background: "oklch(1 0 0)",
            border: "1px solid oklch(0.90 0.010 75)",
          }}
        >
          <Camera size={20} className="mx-auto mb-2" style={{ color: "oklch(0.75 0.008 68)" }} />
          <p className="text-xs" style={{ color: "oklch(0.45 0.008 65)" }}>
            No site photos uploaded in the last 14 days.
          </p>
        </div>
      </Section>
    );
  }
  return (
    <Section title="RECENT SITE PHOTOS" icon={Camera}>
      <p className="text-[11px] mb-2" style={{ color: "oklch(0.45 0.008 65)" }}>
        Daily close-door photos from your project site, last 14 days.
      </p>
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-4 xl:grid-cols-5">
        {photos.map((p) => (
          <PortalPhotoTile key={p.id} photo={p} token={token} />
        ))}
      </div>
    </Section>
  );
}

function PortalPhotoTile({
  photo,
  token,
}: {
  photo: ClientPortalPhoto;
  token: string;
}) {
  const { data: url, isLoading } = useClientPortalPhotoUrl(token, photo.storage_path);
  const [errored, setErrored] = useState(false);
  return (
    <div
      className="aspect-square rounded-lg overflow-hidden relative"
      style={{ background: "oklch(0.92 0.008 75)" }}
    >
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2
            size={14}
            className="animate-spin"
            style={{ color: "oklch(0.62 0.09 68)" }}
          />
        </div>
      ) : url && !errored ? (
        <img
          src={url}
          alt={`Site photo on ${photo.photo_date}`}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setErrored(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Camera size={16} style={{ color: "oklch(0.65 0.008 68)" }} />
        </div>
      )}
      <span
        className="absolute bottom-1 left-1 text-[9px] font-label px-1.5 py-0.5 rounded"
        style={{
          background: "oklch(0.14 0.008 65 / 75%)",
          color: "oklch(1 0 0)",
          letterSpacing: "0.04em",
          fontWeight: 600,
        }}
      >
        {formatDate(photo.photo_date)}
      </span>
    </div>
  );
}

function ReviewSection({ token, clientName }: { token: string; clientName: string }) {
  const submit = useSubmitClientReview();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (rating < 1) return;
    try {
      await submit.mutateAsync({ token, rating, comment, reviewerName: name || clientName });
      setDone(true);
    } catch {
      /* mutation error surfaced below */
    }
  }

  if (done) {
    return (
      <Section title="YOUR REVIEW" icon={Star}>
        <div
          className="rounded-2xl p-5 flex flex-col items-center text-center gap-2"
          style={{ background: "linear-gradient(135deg, oklch(0.62 0.09 68 / 8%), oklch(1 0 0))", border: "1px solid oklch(0.62 0.09 68 / 25%)" }}
        >
          <Heart size={22} style={{ color: "oklch(0.55 0.14 25)" }} />
          <p className="font-display text-base font-semibold" style={{ color: "oklch(0.18 0.008 65)" }}>Thank you!</p>
          <p className="text-xs leading-relaxed max-w-xs" style={{ color: "oklch(0.42 0.008 65)" }}>
            Your feedback means a lot to the SPAZEHAUS team.
          </p>
        </div>
      </Section>
    );
  }

  return (
    <Section title="RATE YOUR EXPERIENCE" icon={Star}>
      <div
        className="rounded-2xl p-4 space-y-3 lg:p-5"
        style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.90 0.010 75)", boxShadow: "0 1px 8px oklch(0 0 0 / 0.04)" }}
      >
        <p className="text-xs leading-relaxed" style={{ color: "oklch(0.42 0.008 65)" }}>
          How has your experience been so far? Tap a star to rate us.
        </p>
        <div className="flex gap-1.5 justify-center py-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const on = n <= (hover || rating);
            return (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                className="p-1 transition-transform active:scale-90"
              >
                <Star
                  size={30}
                  style={{ color: on ? "oklch(0.72 0.14 68)" : "oklch(0.85 0.010 75)" }}
                  fill={on ? "oklch(0.72 0.14 68)" : "none"}
                />
              </button>
            );
          })}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us what you loved (optional)"
          rows={3}
          className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
          style={{ background: "oklch(0.98 0.004 80)", border: "1px solid oklch(0.90 0.010 75)", color: "oklch(0.20 0.008 65)", outline: "none" }}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Your name (${clientName})`}
          className="w-full rounded-xl px-3 py-2.5 text-sm"
          style={{ background: "oklch(0.98 0.004 80)", border: "1px solid oklch(0.90 0.010 75)", color: "oklch(0.20 0.008 65)", outline: "none" }}
        />
        {submit.isError && (
          <p className="text-xs" style={{ color: "oklch(0.55 0.14 25)" }}>
            Couldn't submit — please try again.
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={rating < 1 || submit.isPending}
          className="w-full rounded-xl py-3 text-sm font-label font-semibold flex items-center justify-center gap-2"
          style={{
            background: rating < 1 ? "oklch(0.85 0.010 75)" : "linear-gradient(135deg, oklch(0.62 0.09 68), oklch(0.55 0.10 55))",
            color: "oklch(1 0 0)", letterSpacing: "0.04em", opacity: submit.isPending ? 0.7 : 1,
            cursor: rating < 1 ? "not-allowed" : "pointer",
          }}
        >
          {submit.isPending ? "Sending…" : "Submit Review"}
        </button>
      </div>
    </Section>
  );
}

function SupportCard({
  project,
}: {
  project: ClientPortalData["project"];
}) {
  if (!project.client_contact && !project.client_email) return null;
  return (
    <Section title="QUESTIONS?" icon={AlertCircle}>
      <div
        className="rounded-2xl p-4 space-y-2.5 lg:p-5"
        style={{
          background: "linear-gradient(135deg, oklch(0.62 0.09 68 / 6%), oklch(1 0 0))",
          border: "1px solid oklch(0.62 0.09 68 / 25%)",
        }}
      >
        <p className="text-xs leading-relaxed" style={{ color: "oklch(0.30 0.008 65)" }}>
          Reach out to your project team anytime. They'll get back to you within a working day.
        </p>
        <div className="text-[11px] space-y-1.5 pt-1 lg:flex lg:gap-6 lg:space-y-0">
          <p style={{ color: "oklch(0.42 0.09 68)" }}>
            <strong className="font-semibold">{project.designer_name}</strong>
            {" · "}
            <span style={{ color: "oklch(0.45 0.008 65)" }}>Lead Designer</span>
          </p>
          <p style={{ color: "oklch(0.42 0.09 68)" }}>
            <strong className="font-semibold">{project.pm_name}</strong>
            {" · "}
            <span style={{ color: "oklch(0.45 0.008 65)" }}>Project Manager</span>
          </p>
        </div>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <div className="text-center pt-4">
      <p
        className="font-display text-base"
        style={{ color: "oklch(0.72 0.09 68)", letterSpacing: "0.18em" }}
      >
        SPAZEHAUS
      </p>
      <p className="text-[10px] mt-1" style={{ color: "oklch(0.55 0.008 65)" }}>
        Interior Design · Johor Bahru
      </p>
      <p className="text-[9px] mt-3 px-6" style={{ color: "oklch(0.65 0.008 68)" }}>
        This portal is a private link for {""}
        <span style={{ color: "oklch(0.42 0.09 68)" }}>your</span> project only.
        Please don't share it publicly — contact your designer if you need a new link.
      </p>
    </div>
  );
}

// ─── Small building blocks ───────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={13} style={{ color: "oklch(0.42 0.09 68)" }} />
        <p
          className="font-label text-[11px]"
          style={{ color: "oklch(0.20 0.008 65)", letterSpacing: "0.12em", fontWeight: 700 }}
        >
          {title}
        </p>
      </div>
      {children}
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={12} className="mt-0.5 shrink-0" style={{ color: "oklch(0.62 0.09 68)" }} />
      <div className="flex-1 min-w-0">
        <p
          className="text-[9px] font-label"
          style={{ color: "oklch(0.52 0.010 68)", letterSpacing: "0.10em", fontWeight: 700 }}
        >
          {label.toUpperCase()}
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: "oklch(0.20 0.008 65)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "—";
  // Handle both ISO date (YYYY-MM-DD) and ISO datetime
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function groupByPhase(stages: ClientPortalStage[]): { phase: string; stages: ClientPortalStage[] }[] {
  const order: Record<string, number> = {
    Inquiry: 0,
    Design: 1,
    "Pre-Build": 2,
    Build: 3,
    Closeout: 4,
  };
  const byPhase = new Map<string, ClientPortalStage[]>();
  for (const s of stages) {
    const phase = s.phase ?? "Other";
    if (!byPhase.has(phase)) byPhase.set(phase, []);
    byPhase.get(phase)!.push(s);
  }
  return Array.from(byPhase.entries())
    .map(([phase, stages]) => ({ phase, stages }))
    .sort((a, b) => (order[a.phase] ?? 99) - (order[b.phase] ?? 99));
}

// Silence unused-import warnings for icons used only conditionally above.
void Phone;
void Mail;
