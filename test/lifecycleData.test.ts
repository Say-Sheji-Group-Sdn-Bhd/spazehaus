import { describe, it, expect } from "vitest";
import {
  stageOrder,
  daysFromToday,
  bucketDate,
  effectivePaymentStatus,
  stageStatus,
  paymentSummary,
  signatureSummary,
  stageById,
  type PaymentRecord,
  type ProjectLifecycle,
} from "@/lib/lifecycleData";

// Fixed anchor: 8 June 2026 (local midnight). All date helpers take an explicit
// `today` so these tests never depend on the wall clock.
const TODAY = new Date(2026, 5, 8);

describe("stageOrder", () => {
  it("returns the canonical order for a known stage", () => {
    expect(stageOrder("new-inquiry")).toBe(1);
    expect(stageOrder("design-contract")).toBe(9);
    expect(stageOrder("defect-period")).toBe(29);
  });
  it("returns 0 for an unknown stage", () => {
    expect(stageOrder("nope")).toBe(0);
    expect(stageById("nope")).toBeUndefined();
  });
});

describe("daysFromToday", () => {
  it("is 0 for today, positive for future, negative for past", () => {
    expect(daysFromToday("08/06/2026", TODAY)).toBe(0);
    expect(daysFromToday("10/06/2026", TODAY)).toBe(2);
    expect(daysFromToday("01/06/2026", TODAY)).toBe(-7);
  });
  it("is null for undated / TBD / malformed", () => {
    expect(daysFromToday(undefined, TODAY)).toBeNull();
    expect(daysFromToday("TBD", TODAY)).toBeNull();
    expect(daysFromToday("2026-06-08", TODAY)).toBeNull(); // wrong format
  });
});

describe("bucketDate", () => {
  it("buckets relative to today", () => {
    expect(bucketDate(undefined, TODAY)).toBe("no-date");
    expect(bucketDate("01/06/2026", TODAY)).toBe("overdue");   // -7d
    expect(bucketDate("08/06/2026", TODAY)).toBe("this-week"); // 0d
    expect(bucketDate("15/06/2026", TODAY)).toBe("this-week"); // +7d (boundary)
    expect(bucketDate("16/06/2026", TODAY)).toBe("this-month");// +8d
    expect(bucketDate("08/07/2026", TODAY)).toBe("this-month");// +30d (boundary)
    expect(bucketDate("09/07/2026", TODAY)).toBe("later");     // +31d
  });
});

describe("effectivePaymentStatus", () => {
  const pay = (status: PaymentRecord["status"], dueDate?: string): PaymentRecord => ({
    gate: 2, label: "Fee", amount: 100, status, dueDate,
  });
  it("promotes a past-due pending payment to overdue", () => {
    expect(effectivePaymentStatus(pay("pending", "01/06/2026"), TODAY)).toBe("overdue");
  });
  it("leaves a not-yet-due pending payment as pending", () => {
    expect(effectivePaymentStatus(pay("pending", "10/06/2026"), TODAY)).toBe("pending");
  });
  it("never changes completed / skipped", () => {
    expect(effectivePaymentStatus(pay("completed", "01/06/2026"), TODAY)).toBe("completed");
    expect(effectivePaymentStatus(pay("skipped", "01/06/2026"), TODAY)).toBe("skipped");
  });
  it("treats an undated pending payment as pending (never overdue)", () => {
    expect(effectivePaymentStatus(pay("pending", undefined), TODAY)).toBe("pending");
  });
});

describe("stageStatus (manual per-stage status — 7 Nov 2026)", () => {
  it("New Inquiry is always Completed and ignores the map", () => {
    expect(stageStatus(stageById("new-inquiry")!, {})).toBe("completed");
    expect(stageStatus(stageById("new-inquiry")!, { "new-inquiry": "pending" })).toBe("completed");
  });
  it("defaults a stage with no stored status to pending", () => {
    expect(stageStatus(stageById("design-contract")!, {})).toBe("pending");
    expect(stageStatus(stageById("kick-off")!, {})).toBe("pending");
  });
  it("reflects the staff-set manual status (out of order)", () => {
    const map = {
      "proposal-deposit": "completed",
      "design-contract": "refer",
      "kick-off": "completed", // completed out of order while earlier stages aren't
      "site-inspection": "not-yet",
    } as const;
    expect(stageStatus(stageById("proposal-deposit")!, map)).toBe("completed");
    expect(stageStatus(stageById("design-contract")!, map)).toBe("refer");
    expect(stageStatus(stageById("kick-off")!, map)).toBe("completed");
    expect(stageStatus(stageById("site-inspection")!, map)).toBe("not-yet");
    // a stage absent from the map still defaults to pending
    expect(stageStatus(stageById("handover")!, map)).toBe("pending");
  });
});

describe("paymentSummary / signatureSummary", () => {
  const lc: ProjectLifecycle = {
    projectId: "PRJ001",
    currentStageId: "design-contract",
    startedAt: "01/05/2026",
    payments: [
      { gate: 1, label: "Deposit", amount: 10000, status: "completed" },
      { gate: 2, label: "Fee", amount: 10500, status: "pending" },
      { gate: 3, label: "Reno", amount: 5000, status: "skipped" },
    ],
    signatures: [
      { key: "design-contract", label: "DC", group: "contract", status: "completed" },
      { key: "revised-3d", label: "3D", group: "drawing", status: "pending" },
    ],
  };
  it("sums collected vs outstanding (skipped excluded) with pct", () => {
    const s = paymentSummary(lc);
    expect(s.collected).toBe(10000);
    expect(s.outstanding).toBe(10500); // skipped 5000 excluded
    expect(s.total).toBe(20500);
    expect(s.pct).toBe(Math.round((10000 / 20500) * 100)); // 49
  });
  it("counts signed vs pending with pct", () => {
    expect(signatureSummary(lc)).toEqual({ signed: 1, pending: 1, total: 2, pct: 50 });
  });
});
