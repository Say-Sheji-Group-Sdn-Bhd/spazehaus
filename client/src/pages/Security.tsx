/*
 * SPAZEHAUS — PRIVACY & SECURITY
 * Sign-in is passwordless (magic link). This screen manages session control:
 *   • Sign out of all devices (global sign-out).
 * Reached from Profile → Privacy & Security.
 */
import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

export default function Security() {
  const { staff } = useAuth();
  const [busy, setBusy] = useState(false);

  async function signOutEverywhere() {
    setBusy(true);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      setBusy(false);
      toast.error(`Couldn't sign out other devices: ${error.message}`);
      return;
    }
    toast.success("Signed out of all devices");
  }

  return (
    <div className="mobile-container" style={{ background: "var(--s-page)" }}>
      <AppHeader title="Privacy & Security" subtitle="SESSIONS" showBack compact />

      <div className="px-4 py-4 pb-24 space-y-5 lg:px-8 lg:py-7 lg:max-w-[720px]">
        {/* ── Session control ── */}
        <div className="rounded-2xl p-4 space-y-3" style={cardStyle}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.68 0.12 25 / 12%)" }}>
              <LogOut size={16} style={{ color: "oklch(0.58 0.12 25)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--t-1)" }}>Sign out of all devices</p>
              <p className="text-xs" style={{ color: "var(--t-5)" }}>Ends every active session, including this one</p>
            </div>
          </div>
          <button onClick={signOutEverywhere} disabled={busy} data-testid="signout-all" className="w-full py-2.5 rounded-xl text-sm font-label" style={{ background: "oklch(0.68 0.12 25 / 10%)", color: "oklch(0.55 0.12 25)", border: "1px solid oklch(0.68 0.12 25 / 25%)", letterSpacing: "0.04em", opacity: busy ? 0.6 : 1 }}>
            Sign out everywhere
          </button>
        </div>

        <p className="text-[10px] text-center font-label pt-1" style={{ color: "var(--t-5)", letterSpacing: "0.06em" }}>
          {staff ? `${staff.name.toUpperCase()} · ${staff.id}` : ""}
        </p>
      </div>
    </div>
  );
}

const cardStyle = { background: "var(--s-card)", border: "1px solid var(--b-1)" } as const;
