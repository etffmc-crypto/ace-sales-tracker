# Route/Visit Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show which accounts are due for a visit this week (overdue or due within 7 days) and let the user hand a checked subset off to Google/Apple Maps as a multi-stop route.

**Architecture:** Two new pure functions (`isDueForVisit`, `buildMapsRouteUrl`) in `src/lib/routePlanning.ts`, TDD'd like every other domain-logic module in this app. A small, additive extension to the existing `GET /api/accounts` response (adding address fields it didn't previously return) so the new page can reuse that endpoint instead of adding a new one. A new page renders the filtered/checkable list and builds the Maps handoff link.

**Tech Stack:** Next.js 16.3.1 (App Router), TypeScript, Vitest — same stack as Phases 1 and 2.

**Spec:** [docs/superpowers/specs/2026-08-17-route-planning-design.md](../specs/2026-08-17-route-planning-design.md)

## Global Constraints

- No new Prisma model, no new fields on `Account`/`Interaction`.
- No route optimization computed by this app — accounts are listed soonest-due-first; any reordering happens inside the Maps app the link opens, if the user uses that feature there.
- No visual map/pins rendered in-app — no mapping library, no API key.
- No geocoding, distance calculation, or travel-time estimation performed by this app.
- TypeScript strict mode across the app (inherited repo-wide setting).

---

### Task 1: Extend the account list response with address fields

**Files:**
- Modify: `src/types/account.ts`
- Modify: `src/app/api/accounts/route.ts`

**Interfaces:**
- Produces: `AccountListItem` gains `addressLine: string | null`, `city: string`, `state: string`, `zip: string | null`. `GET /api/accounts` now returns these on every item. Task 3 consumes this.
- Note: this is a design correction found while planning — the spec assumed `GET /api/accounts` already carried address data for route-building; it doesn't yet (only `AccountDetail`, the single-account endpoint, has it). This task closes that gap with a minimal, additive, backward-compatible extension — existing consumers (`AccountList.tsx`, the account list screen) don't reference the new fields and are unaffected.

- [ ] **Step 1: Extend `AccountListItem` and de-duplicate `AccountDetail`**

In `src/types/account.ts`, change `AccountListItem` to:

```ts
export interface AccountListItem {
  id: string;
  name: string;
  accountType: AccountType;
  pipelineStage: PipelineStage;
  addressLine: string | null;
  city: string;
  state: string;
  zip: string | null;
  lastInteractionDate: string | null;
  nextActionDate: string | null;
}
```

And change `AccountDetail` to remove the now-redundant fields it previously redeclared (they're inherited from `AccountListItem` instead — same final shape, no behavior change for existing consumers):

```ts
export interface AccountDetail extends AccountListItem {
  phone: string | null;
  source: AccountSource;
  contacts: {
    id: string;
    name: string;
    title: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
  }[];
  interactions: {
    id: string;
    date: string;
    type: "VISIT" | "CALL" | "EMAIL";
    notes: string | null;
    nextAction: string | null;
    nextActionDate: string | null;
  }[];
}
```

- [ ] **Step 2: Include the new fields in `GET /api/accounts`'s response**

In `src/app/api/accounts/route.ts`, find the `items: AccountListItem[]` mapping in the `GET` handler and add the four new fields (the Prisma `account` row already has these scalar columns — no query change needed, just include them in the mapped object):

```ts
  const items: AccountListItem[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    accountType: a.accountType,
    pipelineStage: a.pipelineStage,
    addressLine: a.addressLine,
    city: a.city,
    state: a.state,
    zip: a.zip,
    lastInteractionDate: a.interactions[0]?.date.toISOString() ?? null,
    nextActionDate: pendingByAccount.get(a.id)?.toISOString() ?? null,
  }));
```

- [ ] **Step 3: Verify by hand**

Run: `npx tsc --noEmit` — confirm no type errors (existing `AccountList.tsx` and `AccountDetail`-consuming code should still compile unchanged). Run `npm run dev`, log in, visit `/` and confirm the account list still renders exactly as before (this change is additive/invisible on that screen). Optionally `curl`/fetch `GET /api/accounts` with a session cookie and confirm the JSON now includes `addressLine`/`city`/`state`/`zip` per account.

- [ ] **Step 4: Commit**

```bash
git add src/types/account.ts src/app/api/accounts/route.ts
git commit -m "Add address fields to the account list API response"
```

---

### Task 2: Route-planning pure functions (TDD)

**Files:**
- Create: `src/lib/routePlanning.ts`
- Test: `src/lib/routePlanning.test.ts`

**Interfaces:**
- Produces: `isDueForVisit(nextActionDate: string | null, referenceDate: Date, daysAhead: number): boolean`, `buildMapsRouteUrl(addresses: string[]): string`. Task 3 imports and uses both.

- [ ] **Step 1: Write the failing tests**

`src/lib/routePlanning.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isDueForVisit, buildMapsRouteUrl } from "./routePlanning";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/routePlanning.test.ts`
Expected: FAIL — `./routePlanning` has no exported member `isDueForVisit`/`buildMapsRouteUrl` (module doesn't exist yet).

- [ ] **Step 3: Implement**

`src/lib/routePlanning.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/routePlanning.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/routePlanning.ts src/lib/routePlanning.test.ts
git commit -m "Add route-planning due-date and Maps-URL helpers"
```

---

### Task 3: "This week" page and nav link

**Files:**
- Create: `src/app/(dashboard)/this-week/page.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `GET /api/accounts` (Task 1's extended response), `isDueForVisit`/`buildMapsRouteUrl` (Task 2), `AccountListItem` type (Task 1).

- [ ] **Step 1: Write the page**

`src/app/(dashboard)/this-week/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isDueForVisit, buildMapsRouteUrl } from "@/lib/routePlanning";
import type { AccountListItem } from "@/types/account";

function formatAddress(account: AccountListItem): string {
  return [
    account.addressLine,
    `${account.city}, ${account.state} ${account.zip ?? ""}`.trim(),
  ]
    .filter(Boolean)
    .join(", ");
}

export default function ThisWeekPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok || res.redirected) {
          router.push("/login");
          return;
        }
        const data: AccountListItem[] = await res.json();
        const due = data.filter((a) =>
          isDueForVisit(a.nextActionDate, new Date(), 7),
        );
        setAccounts(due);
        const initialChecked: Record<string, boolean> = {};
        for (const a of due) {
          initialChecked[a.id] = Boolean(a.addressLine);
        }
        setChecked(initialChecked);
      } catch {
        setError("Failed to load accounts. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openRoute() {
    const selected = accounts.filter((a) => checked[a.id]);
    const addresses = selected.map(formatAddress);
    window.open(buildMapsRouteUrl(addresses), "_blank");
  }

  const anyChecked = Object.values(checked).some(Boolean);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">This week</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {accounts.length === 0 ? (
        <p className="text-gray-600">
          Nothing due this week — nice work staying on top of it.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {accounts.map((a) => {
              const overdue = a.nextActionDate
                ? new Date(a.nextActionDate) < new Date()
                : false;
              const usable = Boolean(a.addressLine);
              return (
                <li
                  key={a.id}
                  className="flex items-start gap-2 rounded border p-2"
                >
                  <input
                    type="checkbox"
                    checked={checked[a.id] ?? false}
                    onChange={() => toggle(a.id)}
                    disabled={!usable}
                    className="mt-1"
                  />
                  <div>
                    <Link href={`/accounts/${a.id}`} className="text-blue-600">
                      {a.name}
                    </Link>
                    <p className="text-sm text-gray-600">
                      {usable ? formatAddress(a) : "No address on file"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {overdue ? "Overdue — " : "Due "}
                      {a.nextActionDate
                        ? new Date(a.nextActionDate).toLocaleDateString(
                            undefined,
                            { timeZone: "UTC" },
                          )
                        : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            onClick={openRoute}
            disabled={!anyChecked}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Open route in Maps
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the nav link**

In `src/app/(dashboard)/layout.tsx`, add a new `Link` after the existing "+ New account" link:

```tsx
        <Link href="/this-week" className="text-blue-600">
          This week
        </Link>
```

- [ ] **Step 3: Verify by hand**

Run: `npm run dev`, log in. Confirm:
- The "This week" nav link appears and navigates to the new page.
- Accounts with a `nextActionDate` that's overdue or within the next 7 days appear, sorted soonest/most-overdue first; accounts with no pending next-action, or one further than 7 days out, do not appear.
- An account with no `addressLine` shows "No address on file" with its checkbox unchecked and disabled.
- Unchecking an account and clicking "Open route in Maps" opens a new tab with a Google Maps directions URL that does NOT include that account's address.
- With zero accounts due, the empty-state message renders instead of the list.
- The "Open route in Maps" button is disabled when every checkbox is unchecked.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/this-week" "src/app/(dashboard)/layout.tsx"
git commit -m "Add This week route-planning page"
```

---

## Post-plan check

After Task 3, the user should be able to: open "This week" from the nav, see exactly the accounts overdue or due within 7 days, uncheck any they don't want on today's trip, and click through to a real Google/Apple Maps route with the rest — without any mapping API key or billing setup. Phase 4 (prospecting & proposals/quotes) is a separate spec/plan to be brainstormed when the user is ready to start it.
