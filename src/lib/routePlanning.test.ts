import { describe, it, expect } from "vitest";
import {
  isDueForVisit,
  isOverdue,
  buildMapsRouteUrl,
  MAX_MAPS_STOPS,
} from "./routePlanning";

describe("isDueForVisit", () => {
  const today = new Date("2026-08-17T12:00:00Z");

  it("returns true for a date already overdue", () => {
    expect(isDueForVisit("2026-08-10T00:00:00.000Z", today, 7)).toBe(true);
  });

  it("returns true for a date within the window", () => {
    expect(isDueForVisit("2026-08-20T00:00:00.000Z", today, 7)).toBe(true);
  });

  it("returns false for a date beyond the window", () => {
    expect(isDueForVisit("2026-09-01T00:00:00.000Z", today, 7)).toBe(false);
  });

  it("returns false when there is no next action date", () => {
    expect(isDueForVisit(null, today, 7)).toBe(false);
  });

  it("treats the exact boundary date as due", () => {
    const cutoff = new Date("2026-08-24T12:00:00Z"); // exactly 7 days after `today`
    expect(isDueForVisit(cutoff.toISOString(), today, 7)).toBe(true);
  });
});

describe("isOverdue", () => {
  const today = new Date("2026-08-17T18:30:00-04:00"); // 2026-08-17T22:30:00.000Z

  it("does not consider a date due today as overdue", () => {
    expect(isOverdue("2026-08-17T00:00:00.000Z", today)).toBe(false);
  });

  it("considers a date due yesterday as overdue", () => {
    expect(isOverdue("2026-08-16T00:00:00.000Z", today)).toBe(true);
  });

  it("does not consider a date due tomorrow as overdue", () => {
    expect(isOverdue("2026-08-18T00:00:00.000Z", today)).toBe(false);
  });

  it("returns false when there is no next action date", () => {
    expect(isOverdue(null, today)).toBe(false);
  });
});

describe("MAX_MAPS_STOPS", () => {
  it("is 10 (1 destination + 9 waypoints, the Google Maps URL API limit)", () => {
    expect(MAX_MAPS_STOPS).toBe(10);
  });
});

describe("buildMapsRouteUrl", () => {
  it("builds a URL with a single destination and no waypoints", () => {
    const url = buildMapsRouteUrl(["123 Main St, Harrisburg, PA 17101"]);
    expect(url).toContain("https://www.google.com/maps/dir/?");
    expect(url).toContain("destination=123+Main+St%2C+Harrisburg%2C+PA+17101");
    expect(url).not.toContain("waypoints=");
  });

  it("builds a URL with waypoints when there are multiple addresses", () => {
    const url = buildMapsRouteUrl([
      "1 First St, Harrisburg, PA",
      "2 Second St, Harrisburg, PA",
      "3 Third St, Harrisburg, PA",
    ]);
    expect(url).toContain("destination=3+Third+St%2C+Harrisburg%2C+PA");
    expect(url).toContain(
      "waypoints=1+First+St%2C+Harrisburg%2C+PA%7C2+Second+St%2C+Harrisburg%2C+PA",
    );
  });

  it("always includes api=1 and travelmode=driving", () => {
    const url = buildMapsRouteUrl(["1 First St, Harrisburg, PA"]);
    expect(url).toContain("api=1");
    expect(url).toContain("travelmode=driving");
  });
});
