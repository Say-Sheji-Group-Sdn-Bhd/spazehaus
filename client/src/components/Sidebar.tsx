/*
 * SPAZEHAUS DESKTOP / TABLET SIDEBAR
 * Design: Dark premium rail with warm gold active state — mirrors the
 * mobile BottomNav tabs. Shown only at `lg` and up (≥1024px); the mobile
 * BottomNav takes over below that. See `.agent/documentation/desktop-tablet-layout.md`.
 *
 * Collapsible: a toggle shrinks the rail to an icon-only strip (w-20) to give
 * the content area more width. The state is persisted to localStorage so it
 * survives navigation and reloads. Content is `flex-1`, so it auto-reflows
 * wider when the rail collapses — no coordination needed in App.tsx.
 *
 * Persistent across every authenticated page (unlike BottomNav, which only
 * appears on the 5 main tab routes), giving desktop the standard app-shell feel.
 */
import { useEffect, useState } from "react";
import { Home, FolderOpen, Building2, CalendarDays, User, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";

const tabs = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/projects", icon: FolderOpen, label: "Projects" },
  { path: "/company", icon: Building2, label: "Company" },
  { path: "/calendar", icon: CalendarDays, label: "Calendar" },
  { path: "/profile", icon: User, label: "Profile" },
];

const STORAGE_KEY = "sz-sidebar-collapsed";

export default function Sidebar() {
  const [location, navigate] = useLocation();
  const { staff } = useAuth();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen z-40 transition-[width] duration-200 ${
        collapsed ? "w-20" : "w-64"
      }`}
      style={{
        background: "oklch(0.13 0.006 285)",
        borderRight: "1px solid oklch(1 0 0 / 8%)",
      }}
    >
      {/* Brand + collapse toggle */}
      <div className={`flex items-center pt-7 pb-6 ${collapsed ? "flex-col gap-3 px-2" : "justify-between px-6"}`}>
        {!collapsed && (
          <div className="min-w-0">
            <p
              className="text-[11px] font-label"
              style={{ color: "var(--acc-bright)", letterSpacing: "0.18em" }}
            >
              SPAZEHAUS
            </p>
            <h1 className="font-display text-xl font-semibold text-white leading-tight mt-0.5">
              Management
            </h1>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="w-9 h-9 flex items-center justify-center rounded-lg shrink-0"
          style={{ background: "oklch(1 0 0 / 6%)", border: "1px solid oklch(1 0 0 / 8%)" }}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} style={{ color: "oklch(0.72 0.012 285)" }} />
          ) : (
            <PanelLeftClose size={18} style={{ color: "oklch(0.72 0.012 285)" }} />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              title={collapsed ? tab.label : undefined}
              className={`relative w-full flex items-center gap-3 py-2.5 rounded-xl text-left ${
                collapsed ? "justify-center px-0" : "px-3"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="sidebarActiveTab"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: "oklch(0.62 0.09 68 / 14%)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                size={19}
                className="relative z-10 shrink-0"
                style={{
                  color: active ? "var(--acc-bright)" : "oklch(0.62 0.012 285)",
                  strokeWidth: active ? 2 : 1.5,
                }}
              />
              {!collapsed && (
                <span
                  className="relative z-10 text-sm font-label"
                  style={{
                    color: active ? "oklch(0.92 0.02 68)" : "oklch(0.68 0.012 285)",
                    letterSpacing: "0.02em",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      {staff && (
        <button
          onClick={() => navigate("/profile")}
          title={collapsed ? staff.name : undefined}
          className={`m-3 flex items-center gap-3 py-3 rounded-xl text-left ${
            collapsed ? "justify-center px-0" : "px-3"
          }`}
          style={{ background: "oklch(1 0 0 / 5%)", border: "1px solid oklch(1 0 0 / 8%)" }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
            style={{
              background: "linear-gradient(135deg, var(--acc-bright), var(--acc-2))",
              color: "oklch(1 0 0)",
            }}
          >
            {staff.avatar_code}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{staff.name}</p>
              <p
                className="text-[11px] truncate"
                style={{ color: "oklch(0.62 0.012 285)" }}
              >
                {staff.role}
              </p>
            </div>
          )}
        </button>
      )}
    </aside>
  );
}
