/*
 * SPAZEHAUS — Spacology display config
 *
 * The five space personalities the public quiz sorts visitors into. Rows in
 * `spacology_results` store the personality as a bare key (`fruit`, `flower`,
 * …) plus a text snapshot of the name as it read at submission time; this file
 * is what turns that key into something presentable in the app.
 *
 * The brand colours mirror `Web/lib/spacologyQuiz.ts` (the marketing site's
 * result cards) so a personality looks the same in both products, expressed in
 * the oklch tokens the rest of this app uses.
 */

import type { SpaceType } from "@/lib/dbTypes";

export const SPACE_TYPES: SpaceType[] = ["fruit", "flower", "leaf", "wood", "root"];

export const spaceTypeConfig: Record<
  SpaceType,
  { emoji: string; label: string; labelCn: string; tagline: string; color: string; bg: string; border: string }
> = {
  fruit: {
    emoji: "🍊",
    label: "Vibrant",
    labelCn: "活力型（果）",
    tagline: "Variety, energy, new experiences",
    color: "oklch(0.52 0.13 55)",
    bg: "oklch(0.66 0.13 55 / 12%)",
    border: "oklch(0.66 0.13 55 / 28%)",
  },
  flower: {
    emoji: "🌸",
    label: "Graceful",
    labelCn: "优雅型（花）",
    tagline: "Beauty, detail, meaningful moments",
    color: "oklch(0.52 0.10 5)",
    bg: "oklch(0.66 0.10 5 / 12%)",
    border: "oklch(0.66 0.10 5 / 28%)",
  },
  leaf: {
    emoji: "🌿",
    label: "Easygoing",
    labelCn: "随性型（叶）",
    tagline: "Simplicity, freedom, fresh air",
    color: "oklch(0.45 0.09 150)",
    bg: "oklch(0.58 0.09 150 / 12%)",
    border: "oklch(0.58 0.09 150 / 28%)",
  },
  wood: {
    emoji: "🌳",
    label: "Grounded",
    labelCn: "沉稳型（木）",
    tagline: "Stability, structure, purpose",
    color: "oklch(0.48 0.09 85)",
    bg: "oklch(0.62 0.09 85 / 12%)",
    border: "oklch(0.62 0.09 85 / 28%)",
  },
  root: {
    emoji: "🌱",
    label: "Serene",
    labelCn: "宁静型（根）",
    tagline: "Peace, quiet, personal space",
    color: "oklch(0.44 0.06 130)",
    bg: "oklch(0.58 0.06 130 / 12%)",
    border: "oklch(0.58 0.06 130 / 28%)",
  },
};

/** Safe lookup — a row written by a future quiz version could carry a key this
 *  build doesn't know about, and a missing entry must not blank the page. */
export function spaceType(key: string | null | undefined) {
  return (
    spaceTypeConfig[key as SpaceType] ?? {
      emoji: "❓",
      label: key ? key[0].toUpperCase() + key.slice(1) : "Unknown",
      labelCn: "",
      tagline: "Unrecognised personality — check the quiz version",
      color: "oklch(0.55 0.006 80)",
      bg: "oklch(0.55 0.006 80 / 12%)",
      border: "oklch(0.55 0.006 80 / 28%)",
    }
  );
}
