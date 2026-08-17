export function isDueForVisit(
  nextActionDate: string | null,
  referenceDate: Date,
  daysAhead: number,
): boolean {
  if (!nextActionDate) return false;
  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() + daysAhead);
  return new Date(nextActionDate) <= cutoff;
}

/**
 * Compares UTC calendar days (not full timestamps) so that an account due
 * "today" is never considered overdue regardless of the local time of day.
 */
export function isOverdue(
  nextActionDate: string | null,
  referenceDate: Date,
): boolean {
  if (!nextActionDate) return false;
  const due = new Date(nextActionDate);
  const dueDay = Date.UTC(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate(),
  );
  const refDay = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );
  return dueDay < refDay;
}

/**
 * Google Maps' URL API supports at most 1 destination + 9 waypoints = 10
 * total stops in a single route.
 */
export const MAX_MAPS_STOPS = 10;

export function buildMapsRouteUrl(addresses: string[]): string {
  const destination = addresses[addresses.length - 1];
  const waypointAddresses = addresses.slice(0, -1);

  const params = new URLSearchParams({
    api: "1",
    destination,
    travelmode: "driving",
  });
  if (waypointAddresses.length > 0) {
    params.set("waypoints", waypointAddresses.join("|"));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
