import { describe, it, expect } from "vitest";
import { nextValidStages, PIPELINE_ORDER } from "./pipeline";

describe("nextValidStages", () => {
  it("allows moving forward from PROSPECT to any later stage, or to INACTIVE", () => {
    expect(nextValidStages("PROSPECT")).toEqual([
      "CONTACTED",
      "QUOTED",
      "ACTIVE_CUSTOMER",
      "INACTIVE",
    ]);
  });

  it("only allows INACTIVE from the final active stage", () => {
    expect(nextValidStages("ACTIVE_CUSTOMER")).toEqual(["INACTIVE"]);
  });

  it("allows reactivating an INACTIVE account into any active stage", () => {
    expect(nextValidStages("INACTIVE")).toEqual(PIPELINE_ORDER);
  });

  it("never includes the current stage itself", () => {
    for (const stage of PIPELINE_ORDER) {
      expect(nextValidStages(stage)).not.toContain(stage);
    }
  });
});
