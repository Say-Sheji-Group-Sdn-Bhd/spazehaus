import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// queries.ts imports the real Supabase client at module load (which throws on
// missing env). The pure helpers under test never call it, so stub the module.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import {
  canDeleteSpacologyResult,
  computeSpacologySummary,
  isSpacologyLead,
  whatsappHref,
  parseSpacologyAnswers,
  parseSpacologyScores,
} from "@/lib/queries";
import { spaceType, SPACE_TYPES } from "@/lib/spacologyData";
import type { SpacologyResultRow } from "@/lib/dbTypes";

type Role = Parameters<typeof canDeleteSpacologyResult>[0];

const NOW = new Date("2026-08-27T12:00:00Z").getTime();
const DAY = 86_400_000;

/** A submission `daysAgo` days old. Only the fields the helpers read matter. */
function row(over: Partial<SpacologyResultRow> & { daysAgo?: number } = {}): SpacologyResultRow {
  const { daysAgo = 0, ...rest } = over;
  return {
    id: "SPC-test",
    result_type: "leaf",
    result_name_en: null,
    result_name_cn: null,
    scores: {},
    is_tie: false,
    answers: [],
    answer_count: 0,
    quiz_version: "v1",
    duration_ms: null,
    name: null,
    email: null,
    phone: null,
    planning_renovation: null,
    locale: null,
    source: "website",
    referrer: null,
    landing_path: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    user_agent: null,
    inquiry_id: null,
    notes: null,
    submitted_at: new Date(NOW - daysAgo * DAY).toISOString(),
    created_at: new Date(NOW - daysAgo * DAY).toISOString(),
    ...rest,
  } as SpacologyResultRow;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("canDeleteSpacologyResult", () => {
  it("is admin tier only — mirrors the spacology_results_delete_admin policy", () => {
    (["principal", "admin", "admin_exec"] as Role[]).forEach((r) =>
      expect(canDeleteSpacologyResult(r), `${r}`).toBe(true),
    );
    (["pm", "site_supervisor", "designer", "sales"] as Role[]).forEach((r) =>
      expect(canDeleteSpacologyResult(r), `${r}`).toBe(false),
    );
    expect(canDeleteSpacologyResult(null)).toBe(false);
    expect(canDeleteSpacologyResult(undefined)).toBe(false);
  });
});

describe("computeSpacologySummary", () => {
  it("returns a zeroed summary for no rows", () => {
    const s = computeSpacologySummary([]);
    expect(s.total).toBe(0);
    expect(s.topType).toBeNull();
    expect(s.avgDurationMs).toBeNull();
    expect(s.topSource).toBeNull();
    SPACE_TYPES.forEach((t) => expect(s.byType[t]).toBe(0));
  });

  it("counts each personality", () => {
    const s = computeSpacologySummary([
      row({ result_type: "leaf" }),
      row({ result_type: "leaf" }),
      row({ result_type: "root" }),
      row({ result_type: "fruit" }),
    ]);
    expect(s.total).toBe(4);
    expect(s.byType.leaf).toBe(2);
    expect(s.byType.root).toBe(1);
    expect(s.byType.fruit).toBe(1);
    expect(s.byType.wood).toBe(0);
    expect(s.topType).toBe("leaf");
  });

  it("ignores a personality key this build doesn't know", () => {
    const s = computeSpacologySummary([row({ result_type: "stone" }), row({ result_type: "wood" })]);
    expect(s.total).toBe(2);
    expect(s.topType).toBe("wood");
    SPACE_TYPES.forEach((t) => expect(s.byType[t]).toBe(t === "wood" ? 1 : 0));
  });

  it("windows last7 / last30 on submitted_at", () => {
    const s = computeSpacologySummary([
      row({ daysAgo: 0 }),
      row({ daysAgo: 3 }),
      row({ daysAgo: 12 }),
      row({ daysAgo: 45 }),
    ]);
    expect(s.total).toBe(4);
    expect(s.last7).toBe(2);
    expect(s.last30).toBe(3);
  });

  it("counts renovating-soon leads, ignoring 'no' and 'not asked'", () => {
    const s = computeSpacologySummary([
      row({ name: "A", planning_renovation: true }),
      row({ name: "B", planning_renovation: true }),
      row({ name: "C", planning_renovation: false }),
      row({ planning_renovation: null }),
    ]);
    expect(s.renovatingSoon).toBe(2);
    expect(s.withContact).toBe(3);
  });

  it("counts a row as contactable if any one contact field is set", () => {
    const s = computeSpacologySummary([
      row({ name: "Amir" }),
      row({ email: "a@b.com" }),
      row({ phone: "+60123456789" }),
      row(),
    ]);
    expect(s.withContact).toBe(3);
  });

  it("averages only the rows that recorded a duration", () => {
    const s = computeSpacologySummary([
      row({ duration_ms: 60_000 }),
      row({ duration_ms: 120_000 }),
      row({ duration_ms: null }),
      row({ duration_ms: 0 }),
    ]);
    expect(s.avgDurationMs).toBe(90_000);
  });

  it("prefers utm_source over source, and picks the most frequent", () => {
    const s = computeSpacologySummary([
      row({ utm_source: "instagram" }),
      row({ utm_source: "instagram" }),
      row({ utm_source: "google" }),
      row(), // falls back to source = 'website'
    ]);
    expect(s.topSource).toBe("instagram");
  });
});

describe("jsonb parsers", () => {
  it("parseSpacologyScores keeps numeric entries and drops the rest", () => {
    expect(parseSpacologyScores({ leaf: 9, wood: 4, bogus: "3" })).toEqual({ leaf: 9, wood: 4 });
  });

  it("parseSpacologyScores tolerates non-object input", () => {
    expect(parseSpacologyScores(null)).toEqual({});
    expect(parseSpacologyScores([1, 2])).toEqual({});
    expect(parseSpacologyScores("nope")).toEqual({});
  });

  it("parseSpacologyAnswers tolerates non-array input", () => {
    expect(parseSpacologyAnswers(null)).toEqual([]);
    expect(parseSpacologyAnswers({ a: 1 })).toEqual([]);
  });

  it("parseSpacologyAnswers keeps object entries", () => {
    const a = [{ index: 0, option_index: 2 }, null, "junk"];
    expect(parseSpacologyAnswers(a)).toHaveLength(1);
  });
});

describe("spaceType lookup", () => {
  it("resolves the five known personalities", () => {
    SPACE_TYPES.forEach((t) => expect(spaceType(t).label).not.toBe("Unknown"));
  });

  it("falls back rather than returning undefined for an unknown key", () => {
    expect(spaceType("stone").label).toBe("Stone");
    expect(spaceType(null).label).toBe("Unknown");
    expect(spaceType(undefined).emoji).toBe("❓");
  });
});

describe("lead helpers", () => {
  it("isSpacologyLead needs at least one contact field", () => {
    expect(isSpacologyLead(row())).toBe(false);
    expect(isSpacologyLead(row({ name: "Amir" }))).toBe(true);
    expect(isSpacologyLead(row({ phone: "+60123456789" }))).toBe(true);
    expect(isSpacologyLead(row({ email: "a@b.com" }))).toBe(true);
  });

  it("whatsappHref strips everything wa.me won't accept", () => {
    expect(whatsappHref("+60 12-679 6530")).toBe("https://wa.me/60126796530");
    expect(whatsappHref("+60126796530")).toBe("https://wa.me/60126796530");
  });

  it("whatsappHref returns null rather than a broken link", () => {
    expect(whatsappHref(null)).toBeNull();
    expect(whatsappHref(undefined)).toBeNull();
    expect(whatsappHref("123")).toBeNull();
    expect(whatsappHref("")).toBeNull();
  });
});
