import { describe, it, expect } from "vitest";
import { sortByNeedsFollowUp, earliestPendingDateByAccount } from "./followUp";

describe("sortByNeedsFollowUp", () => {
  it("orders items with a nextActionDate soonest-first", () => {
    const items = [
      { id: "a", nextActionDate: new Date("2026-09-01") },
      { id: "b", nextActionDate: new Date("2026-08-20") },
      { id: "c", nextActionDate: new Date("2026-08-25") },
    ];
    expect(sortByNeedsFollowUp(items).map((i) => i.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("puts items with no nextActionDate after all dated items", () => {
    const items = [
      { id: "a", nextActionDate: null },
      { id: "b", nextActionDate: new Date("2026-08-20") },
    ];
    expect(sortByNeedsFollowUp(items).map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("does not mutate the input array", () => {
    const items = [
      { id: "a", nextActionDate: new Date("2026-09-01") },
      { id: "b", nextActionDate: new Date("2026-08-20") },
    ];
    const original = [...items];
    sortByNeedsFollowUp(items);
    expect(items).toEqual(original);
  });
});

describe("earliestPendingDateByAccount", () => {
  it("picks the soonest pending nextActionDate per account", () => {
    const interactions = [
      { accountId: "acc-1", nextActionDate: new Date("2026-09-01") },
      { accountId: "acc-1", nextActionDate: new Date("2026-08-20") },
      { accountId: "acc-2", nextActionDate: new Date("2026-08-25") },
    ];
    const result = earliestPendingDateByAccount(interactions);
    expect(result.get("acc-1")).toEqual(new Date("2026-08-20"));
    expect(result.get("acc-2")).toEqual(new Date("2026-08-25"));
  });

  it("keeps an older pending date visible even when a newer interaction has no next action", () => {
    // Regression test for the bug where only the latest interaction's
    // nextActionDate was used: an older still-pending follow-up must not
    // disappear just because a newer interaction set no next action date.
    const interactions = [
      { accountId: "acc-1", nextActionDate: new Date("2026-08-20") },
      // A second, more recent interaction with no next action date is
      // simply absent from this list (its nextActionDate is null and so
      // never reaches this function) — the older pending date must remain.
    ];
    const result = earliestPendingDateByAccount(interactions);
    expect(result.get("acc-1")).toEqual(new Date("2026-08-20"));
  });

  it("returns an empty map when there are no pending interactions", () => {
    expect(earliestPendingDateByAccount([]).size).toBe(0);
  });
});
