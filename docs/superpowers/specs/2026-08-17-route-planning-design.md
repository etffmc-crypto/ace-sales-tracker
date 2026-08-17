# Route/Visit Planning — Design Spec

**Phase 3 of the "AI sales team" plan for outside sales at Ace Hardware (Harrisburg, PA).**

## Context

Phases 1 (account/lead tracker) and 2 (AI-drafted follow-up emails) are built,
reviewed, and deployed. Every account already has an address and a computed
`nextActionDate` (the soonest pending follow-up across its interactions, per
Phase 1's `earliestPendingDateByAccount` logic).

This phase adds a "this week" view: which accounts are due for a visit, and a
one-click way to load them into the phone's own Maps app as a route.

## Goals

- Show which accounts are due for a visit: overdue, or due within the next 7
  days.
- Let the user check/uncheck individual accounts before building a route (not
  every due account necessarily gets visited in one trip).
- Hand the selected accounts off to Google/Apple Maps as a multi-stop
  directions link, so the phone's own Maps app does the actual routing.

## Non-goals

- No real route optimization (shortest path / minimal drive time) computed by
  this app — that requires a paid mapping API (e.g. Google Directions API with
  billing). This app only decides *which* accounts are due and *what order* to
  list them in (soonest-due first); any re-optimization of stop order happens
  inside the Maps app itself, if the user chooses to use that feature there.
- No visual map/pins rendered inside this app — no mapping library, no API
  key. Just a list with addresses and a link out to Maps.
- No geocoding, no distance calculations, no travel-time estimates performed
  by this app.
- No new database model, no new fields on `Account`/`Interaction` — this
  phase is entirely a read + client-side filter + link-building layer on top
  of existing data.

## Architecture

- **New pure function:** `isDueForVisit(nextActionDate: string | null, referenceDate: Date, daysAhead: number): boolean` in `src/lib/routePlanning.ts`.
  Returns `true` if `nextActionDate` is non-null and `<= referenceDate + daysAhead days`
  (this naturally includes anything already overdue, since overdue dates are
  earlier than "today + 7", with no lower bound — an account overdue by a
  year is still `true`). Returns `false` for `null` (nothing pending) or a
  date further out than the window.
- **No new API route.** The new page calls the existing `GET /api/accounts`
  (Phase 1, Task 8), which already returns every account with its computed
  `nextActionDate`, sorted soonest-first. The page filters that list
  client-side with `isDueForVisit`. This is a deliberate reuse — the account
  list for a single rep is small enough that client-side filtering needs no
  new backend query, and it avoids touching an already-shipped, already-tested
  route.
- **New pure function:** `buildMapsRouteUrl(addresses: string[]): string` in
  the same `src/lib/routePlanning.ts` file, building a
  `https://www.google.com/maps/dir/?api=1&destination=...&waypoints=...&travelmode=driving`
  URL from a list of full addresses (each account's `addressLine, city, state
  zip`, URL-encoded). Origin is intentionally omitted — Google Maps uses the
  device's current location as the starting point when opened without one,
  which matches "wherever I'm starting from today."

## UI / data flow

1. A new nav link ("This week") is added to the dashboard layout, alongside
   the existing "+ New account" link.
2. The new page fetches `GET /api/accounts`, filters to accounts where
   `isDueForVisit(account.nextActionDate, new Date(), 7)` is true, and
   displays them sorted by `nextActionDate` ascending (soonest/most-overdue
   first) — the same order the underlying list already comes in, since Phase
   1's `sortByNeedsFollowUp` already does this.
3. Each row shows: a checkbox (checked by default), the account name (linking
   to its detail page, same as the main account list), its address, and its
   next-action date (with an "Overdue" indicator if the date has passed).
4. An "Open route in Maps" button is disabled when zero accounts are checked;
   otherwise it builds the Maps URL from the checked accounts' addresses (in
   the order shown) and opens it in a new tab via `window.open`.
5. If there are zero accounts due this week, the page shows a friendly empty
   state ("Nothing due this week — nice work staying on top of it.") instead
   of an empty list.

## Error handling

- An account with no address on file (all of `addressLine`/`city`/`zip` are
  empty — city defaults to "Harrisburg" so this is rare but possible for a
  manually-cleared record) is still listed with its checkbox, but the checkbox
  is unchecked and disabled by default with a small "no address on file" note,
  since it can't usefully be added to a Maps route.
- The existing `GET /api/accounts` fetch failure handling (session
  expiry via `res.redirected`, generic fetch failure) follows the same
  pattern already established in `AccountList.tsx` — reused, not
  reinvented.

## Testing

Following Phase 1/2's pragmatic approach:

- `isDueForVisit` and `buildMapsRouteUrl` are pure functions with real
  branching (overdue / within-window / out-of-window / no date; one address /
  multiple addresses / addresses needing URL-encoding) and get unit tests.
- The page itself (list rendering, checkbox interaction, the "Open route in
  Maps" button actually opening the right URL) is verified manually via the
  dev server, consistent with how every other screen in this app has been
  tested.

## Open items deferred to implementation

- Exact wording/placement of the nav link and empty-state copy — implementer
  discretion within the established UI conventions (Tailwind utility classes
  already used throughout the app).
