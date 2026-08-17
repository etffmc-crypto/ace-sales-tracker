import { describe, it, expect } from "vitest";
import { sortInteractionsNewestFirst } from "./interactions";

describe("sortInteractionsNewestFirst", () => {
  it("orders items newest date first", () => {
    const items = [
      { id: "a", date: new Date("2026-08-01") },
      { id: "b", date: new Date("2026-08-15") },
      { id: "c", date: new Date("2026-08-10") },
    ];
    expect(sortInteractionsNewestFirst(items).map((i) => i.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("does not mutate the input array", () => {
    const items = [
      { id: "a", date: new Date("2026-08-01") },
      { id: "b", date: new Date("2026-08-15") },
    ];
    const original = [...items];
    sortInteractionsNewestFirst(items);
    expect(items).toEqual(original);
  });
});
