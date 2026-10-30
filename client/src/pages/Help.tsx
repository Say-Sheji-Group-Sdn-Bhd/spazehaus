/*
 * SPAZEHAUS — HELP & SUPPORT
 * Static FAQ + working contact channels (email / call / optional WhatsApp).
 * Reached from Profile → Help & Support.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppHeader from "@/components/AppHeader";
import { COMPANY } from "@/lib/company";
import { toast } from "sonner";
import { Mail, Phone, MessageCircle, ChevronDown, LifeBuoy } from "lucide-react";

const telHref = (phone: string) => (phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null);
const mailtoHref = (email: string, subject: string) =>
  email ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : null;

const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I upload a daily site photo?",
    a: "Open a project → Photos tab → Upload, or use the “Upload Photos” action on the project. Photos are stored per project and shown in the grid.",
  },
  {
    q: "How do I turn an inquiry into a project?",
    a: "Open the customer in the Customer Database, then tap “Convert to Project” — or pick the customer in New Project. It moves into your active projects and is marked Awarded.",
  },
  {
    q: "How do I assign tasks or change a project's team?",
    a: "Open the project. Admin/ops staff first staff the project on the Team tab → “Manage Team” (set the Lead Designer, PM, and members). Then use the Tasks tab to add tasks and assign them to anyone on that team.",
  },
  {
    q: "How do I share the client portal with a customer?",
    a: "On a project's Overview tab, tap “Share Client Portal”. That copies a private link you can WhatsApp or email to the client — they can view progress and leave a review without logging in.",
  },
  {
    q: "How do I make a quotation or invoice?",
    a: "Go to Quotations → New. Once saved, open the quotation to export a branded PDF you can send to the client.",
  },
  {
    q: "I signed in but see “No staff profile”.",
    a: "Sign-in is a magic link sent to your work email — no password needed. If no staff profile is linked to your email, ask an admin to add you in Company → Staff.",
  },
  {
    q: "How do weekly reminders work?",
    a: "Every active site needs a daily close-door photo. On Fridays there's a weekly payment review and a weekly site report per active project. Reminders shows what's due, missed, and upcoming.",
  },
];

export default function Help() {
  const [open, setOpen] = useState<number | null>(0);

  const emailHref = mailtoHref(COMPANY.support.email, "Spazehaus App — Support request");
  const callHref = telHref(COMPANY.support.phone);
  const waNumber = COMPANY.support.whatsapp?.replace(/[^\d]/g, "");
  const waHref = waNumber ? `https://wa.me/${waNumber}` : null;

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader title="Help & Support" subtitle="FAQ · CONTACT US" showBack compact />

      <div className="px-4 py-4 pb-24 space-y-5 lg:px-8 lg:py-7 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 lg:items-start">
        {/* Contact support */}
        <div className="space-y-3">
          <SectionLabel icon={LifeBuoy} title="CONTACT SUPPORT" />
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
            <ContactRow
              icon={Mail}
              label="Email support"
              value={COMPANY.support.email}
              href={emailHref}
              onMissing={() => toast.error("No support email configured")}
            />
            <ContactRow
              icon={Phone}
              label="Call the office"
              value={COMPANY.support.phone}
              href={callHref}
              onMissing={() => toast.error("No support phone configured")}
            />
            {waHref && (
              <ContactRow
                icon={MessageCircle}
                label="Chat on WhatsApp"
                value="Message our team"
                href={waHref}
                external
                isLast
              />
            )}
          </div>
          <p className="text-xs leading-relaxed px-1" style={{ color: "var(--t-5)" }}>
            Our team is available Monday–Friday, 9am–6pm (MYT). We usually reply within one working day.
          </p>
        </div>

        {/* FAQ */}
        <div className="space-y-3">
          <SectionLabel icon={LifeBuoy} title="FREQUENTLY ASKED" />
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
            {FAQ.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={item.q} style={{ borderBottom: i < FAQ.length - 1 ? "1px solid var(--b-2)" : "none" }}>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                  >
                    <span className="flex-1 text-sm font-medium" style={{ color: "var(--t-2)" }}>{item.q}</span>
                    <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
                      <ChevronDown size={16} style={{ color: "var(--t-5)" }} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-4 text-sm leading-relaxed" style={{ color: "var(--t-4)" }}>{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <p className="text-center text-[10px] font-label pt-2" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>
            {COMPANY.name.toUpperCase()} · SPAZEHAUS MANAGEMENT APP v1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ icon: Icon, title }: { icon: typeof Mail; title: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.62 0.09 68 / 10%)" }}>
        <Icon size={14} style={{ color: "var(--acc-ink)" }} />
      </div>
      <p className="font-label text-xs" style={{ color: "var(--t-2)", letterSpacing: "0.10em", fontWeight: 700 }}>{title}</p>
    </div>
  );
}

function ContactRow({
  icon: Icon, label, value, href, external, isLast, onMissing,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href: string | null;
  external?: boolean;
  isLast?: boolean;
  onMissing?: () => void;
}) {
  const style = { borderBottom: isLast ? "none" : "1px solid var(--b-2)" } as const;
  const inner = (
    <>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--s-3)" }}>
        <Icon size={15} style={{ color: "var(--acc-ink)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: "var(--t-1)" }}>{label}</p>
        <p className="text-xs truncate" style={{ color: "var(--t-5)" }}>{value}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        style={style}
      >
        {inner}
      </a>
    );
  }
  return (
    <button onClick={onMissing} className="w-full flex items-center gap-3 px-4 py-3.5 text-left" style={style}>
      {inner}
    </button>
  );
}
