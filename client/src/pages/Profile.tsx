/*
 * SPAZEHAUS PROFILE PAGE
 * Design: Dark premium user profile with settings
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useStaffKpiRecords } from "@/lib/queries";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronRight, Bell, Shield, HelpCircle, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";

const menuItems: { icon: typeof Bell; label: string; subtitle: string; color: string; to?: string }[] = [
  { icon: Bell, label: "Notifications", subtitle: "In-app alerts", color: "var(--acc)", to: "/notifications" },
  { icon: Moon, label: "Appearance", subtitle: "Light mode", color: "oklch(0.70 0.09 240)" },
  { icon: Shield, label: "Privacy & Security", subtitle: "Two-factor, sessions", color: "oklch(0.60 0.07 145)", to: "/security" },
  { icon: HelpCircle, label: "Help & Support", subtitle: "FAQ, contact us", color: "oklch(0.68 0.12 25)", to: "/help" },
];

export default function Profile() {
  const [, navigate] = useLocation();
  const { theme, toggle: toggleTheme } = useTheme();
  const { staff, signOut } = useAuth();
  const { data: kpiRecords = [] } = useStaffKpiRecords(staff?.id);
  const [signingOut, setSigningOut] = useState(false);

  // Auth gate guarantees staff is non-null in this view, but TS doesn't know
  if (!staff) return null;

  // Most-recent KPI rating (defaults to staff.kpi_grade if no records yet)
  const currentRating: string = kpiRecords[0]?.rating ?? staff.kpi_grade ?? "—";
  const currentScore = kpiRecords[0]?.total_score;

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="mobile-container">
      {/* Hero header */}
      <div
        className="relative pt-12 pb-6 px-4 lg:pt-14 lg:pb-10"
        style={{ background: "linear-gradient(135deg, oklch(0.23 0.018 65) 0%, oklch(0.12 0.006 285) 100%)" }}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, transparent, var(--acc-bright), transparent)" }} />

        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold mb-3"
            style={{
              background: "linear-gradient(135deg, oklch(0.62 0.09 68 / 35%), oklch(0.55 0.08 65 / 28%))",
              color: "var(--acc-bright)",
              border: "2px solid oklch(0.72 0.09 68 / 35%)",
            }}
          >
            {staff.avatar_code}
          </motion.div>
          <h2 className="font-display text-2xl font-semibold text-white">{staff.name}</h2>
          <p className="text-sm mt-1" style={{ color: "var(--acc-bright)" }}>{staff.job_title}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--t-7)" }}>{staff.dept} Department · {staff.id}</p>

          {/* KPI badge */}
          {currentRating !== "—" && (
            <div
              className="mt-3 px-4 py-1.5 rounded-full flex items-center gap-2"
              style={{ background: "oklch(0.72 0.09 68 / 18%)", border: "1px solid oklch(0.72 0.09 68 / 30%)" }}
            >
              <span className="text-xs font-label" style={{ color: "var(--acc-bright)", letterSpacing: "0.04em" }}>KPI RATING</span>
              <span className="text-sm font-display font-bold" style={{ color: "var(--acc-bright)" }}>{currentRating}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 pb-24 space-y-5 lg:px-8 lg:py-7 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 lg:items-start">
        {/* Left column — identity & stats */}
        <div className="space-y-5">
        {/* Contact info */}
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
          {[
            { label: "Email", value: staff.email },
            { label: "Phone", value: staff.phone ?? "—" },
            { label: "Role", value: staff.role },
            { label: "Status", value: staff.status },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid var(--b-2)" }}>
              <span className="text-xs" style={{ color: "var(--t-5)" }}>{item.label}</span>
              <span className="text-xs" style={{ color: "var(--t-2)" }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Annual Leave", value: `${staff.leave_balance_annual}d`, color: "oklch(0.70 0.09 240)" },
            { label: "Medical Leave", value: `${staff.leave_balance_medical}d`, color: "var(--acc)" },
            { label: "Score", value: currentScore !== undefined ? String(currentScore) : "—", color: "oklch(0.60 0.07 145)" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
              <p className="text-xl font-display font-semibold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-label mt-0.5" style={{ color: "var(--t-5)", letterSpacing: "0.04em" }}>{s.label}</p>
            </div>
          ))}
        </div>
        </div>

        {/* Right column — settings & account */}
        <div className="space-y-5">
        {/* Settings menu */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--s-card)", border: "1px solid var(--b-1)" }}>
          {menuItems.map((item, i) => {
            const isAppearance = item.label === "Appearance";
            const Icon = isAppearance ? (theme === "dark" ? Sun : Moon) : item.icon;
            const subtitle = isAppearance ? (theme === "dark" ? "Dark mode" : "Light mode") : item.subtitle;
            return (
              <motion.button
                key={item.label}
                whileTap={{ scale: 0.98 }}
                data-testid={isAppearance ? "theme-toggle" : undefined}
                onClick={() => isAppearance ? toggleTheme() : item.to ? navigate(item.to) : toast.info(`${item.label} — coming soon`)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                style={{ borderBottom: i < menuItems.length - 1 ? "1px solid var(--b-2)" : "none" }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--s-2)" }}>
                  <Icon size={15} style={{ color: item.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-[color:var(--t-1)]">{item.label}</p>
                  <p className="text-xs" style={{ color: "var(--t-5)" }}>{subtitle}</p>
                </div>
                {isAppearance ? (
                  <span className="text-[11px] font-label px-2 py-1 rounded-full" style={{ background: "var(--s-2)", color: "var(--acc-ink)", letterSpacing: "0.04em" }}>
                    {theme === "dark" ? "DARK" : "LIGHT"}
                  </span>
                ) : (
                  <ChevronRight size={14} style={{ color: "var(--t-5)" }} />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Logout */}
        <motion.button
          whileTap={signingOut ? undefined : { scale: 0.97 }}
          onClick={handleSignOut}
          disabled={signingOut}
          data-testid="profile-signout"
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl"
          style={{
            background: "oklch(0.68 0.12 25 / 10%)",
            border: "1px solid oklch(0.68 0.12 25 / 20%)",
            opacity: signingOut ? 0.6 : 1,
          }}
        >
          <LogOut size={15} style={{ color: "oklch(0.68 0.12 25)" }} />
          <span className="text-sm font-label" style={{ color: "oklch(0.68 0.12 25)", letterSpacing: "0.04em" }}>
            {signingOut ? "Signing out…" : "Sign Out"}
          </span>
        </motion.button>

        <p className="text-center text-[10px] font-label" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>SPAZEHAUS MANAGEMENT APP v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
