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
