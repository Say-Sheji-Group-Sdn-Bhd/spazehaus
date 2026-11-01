/*
 * SPAZEHAUS BOTTOM NAVIGATION
 * Design: White corporate bar with warm gold active state
 * 5 tabs: Dashboard, Projects, Company, Calendar, Profile
 */
import { Home, FolderOpen, Building2, CalendarDays, User } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/projects", icon: FolderOpen, label: "Projects" },
  { path: "/company", icon: Building2, label: "Company" },
  { path: "/calendar", icon: CalendarDays, label: "Calendar" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const [location, navigate] = useLocation();

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50 md:hidden"
      style={{
        background: "oklch(1 0 0 / 0.97)",
        borderTop: "1px solid var(--b-1)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 -4px 24px oklch(0 0 0 / 0.06)",
      }}
    >
      <div className="flex items-center justify-around px-2 py-2 pb-safe">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.path}
              whileTap={{ scale: 0.88 }}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl min-w-[52px] relative"
            >
              {active && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: "oklch(0.62 0.09 68 / 10%)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                size={20}
                style={{
                  color: active ? "var(--acc)" : "var(--t-6)",
                  strokeWidth: active ? 2 : 1.5,
                }}
              />
              <span
                className="text-[10px] font-label"
                style={{
                  color: active ? "var(--acc)" : "var(--t-6)",
                  letterSpacing: "0.04em",
                  fontWeight: active ? 700 : 400,
                }}
              >
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
