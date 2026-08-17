import { describe, it, expect } from "vitest";
import { sortByNeedsFollowUp } from "./followUp";

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
