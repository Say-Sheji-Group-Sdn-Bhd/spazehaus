/*
 * SPAZEHAUS APP HEADER
 * Design: White/light corporate header with warm gold accents
 * Used across all screens — supports back navigation, title, subtitle, action buttons
 */
import { ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import NotificationBell from "./NotificationBell";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  showNotification?: boolean;
  bgImage?: string;
  compact?: boolean;
}

export default function AppHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  showNotification = false,
  bgImage,
  compact = false,
}: AppHeaderProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  // When a background image is provided, use a rich overlay (e.g. Projects hero)
  if (bgImage) {
    return (
      <div
        className={`relative overflow-hidden ${compact ? "pt-10 pb-5" : "pt-12 pb-7"}`}
        style={{
          // Three layers, top→bottom: dark overlay (tints the image) · the hero
          // image · a brand gradient fallback. The fallback matches the Profile
          // header, so while the image is still downloading (or fails) the header
          // shows the warm dark gradient instead of a flash of gray.
          background: `linear-gradient(to bottom, oklch(0.11 0.004 285 / 0.55) 0%, oklch(0.11 0.004 285 / 0.80) 100%), url(${bgImage}) center/cover no-repeat, linear-gradient(135deg, oklch(0.23 0.018 65) 0%, oklch(0.12 0.006 285) 100%)`,
        }}
      >
        {/* Gold accent line at top */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: "linear-gradient(90deg, transparent, var(--acc-bright), transparent)" }}
        />
        <div className="px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleBack}
                className="w-9 h-9 flex items-center justify-center rounded-full"
                style={{ background: "oklch(1 0 0 / 15%)", border: "1px solid oklch(1 0 0 / 20%)" }}
              >
                <ChevronLeft size={18} style={{ color: "var(--acc-bright)" }} />
              </motion.button>
            )}
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`font-display font-semibold text-white leading-tight ${compact ? "text-xl" : "text-2xl"}`}
              >
                {title}
              </motion.h1>
              {subtitle && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-xs mt-0.5 font-label"
                  style={{ color: "var(--acc-bright)", letterSpacing: "0.08em" }}
                >
                  {subtitle}
                </motion.p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rightAction}
            {showNotification && <NotificationBell variant="dark" />}
          </div>
        </div>
      </div>
    );
  }

  // Default: clean white header
  return (
    <div
      className={`relative ${compact ? "pt-10 pb-4" : "pt-12 pb-5"}`}
      style={{
        background: "var(--s-card)",
        borderBottom: "1px solid var(--b-1)",
      }}
    >
      {/* Gold accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: "linear-gradient(90deg, var(--acc-strong), oklch(0.72 0.09 68 / 60%), transparent)" }}
      />

      {/* Header content */}
      <div className="px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleBack}
              className="w-9 h-9 flex items-center justify-center rounded-full"
              style={{ background: "var(--s-2)", border: "1px solid var(--b-1)" }}
            >
              <ChevronLeft size={18} style={{ color: "var(--acc-strong)" }} />
            </motion.button>
          )}
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`font-display font-semibold leading-tight ${compact ? "text-xl" : "text-2xl"}`}
              style={{ color: "var(--t-1)" }}
            >
              {title}
            </motion.h1>
            {subtitle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-xs mt-0.5 font-label"
                style={{ color: "var(--acc-strong)", letterSpacing: "0.08em" }}
              >
                {subtitle}
              </motion.p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rightAction}
          {showNotification && <NotificationBell variant="light" />}
        </div>
      </div>
    </div>
  );
}
