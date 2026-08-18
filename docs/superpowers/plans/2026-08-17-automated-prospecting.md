# Automated Prospecting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run prospecting unattended once each weekday morning — search for new prospects, add them, draft their outreach emails, and persist the drafts in an in-app "Needs review" queue.

**Architecture:** A Vercel Cron job hits a new `CRON_SECRET`-protected route that reuses Phase 4a's existing search/draft prompt-building functions (no new AI logic, just a new caller). The day-of-week deterministically picks the category to search, so no rotation state is stored. Drafts move from ephemeral React state (today) to a new `ProspectDraft` table, surfaced by a queue UI folded into the existing `/prospecting` page.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + `@prisma/adapter-pg`, `@anthropic-ai/sdk` (`claude-sonnet-5`), Vitest, Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-08-17-automated-prospecting-design.md`

## Global Constraints

- Model for all Anthropic calls: `claude-sonnet-5`.
- Never auto-send an email — the system only ever drafts; a human copies or uses a `mailto:` link.
- No new notification service (no real email-to-the-rep, no push/SMS) — review happens via the in-app queue only.
- Scheduling stays at once-per-day (Vercel Hobby-plan compatible) — do not add more cron entries or more-frequent schedules.
- No persisted rotation cursor — the day's category is derived from the date, every time, via `categoryForDate`.
- Reuse existing prompt-building and parsing functions verbatim (`buildProspectSearchPrompt`, `parseProspectSearchResponse`, `buildProspectingEmailPrompt`, `parseEmailDraftResponse`) — no new parsing logic.
- Routes and UI are verified manually via the dev server, not unit tested — only pure functions get TDD, matching this project's established convention.
- Do NOT touch `src/app/layout.tsx` under any circumstances — a false `tsc --noEmit` error about `LayoutProps` there is expected and not a real bug (see `AGENTS.md` / `node_modules/next/dist/docs/`).
- Do not use `startTransition` to route around the `react-hooks/set-state-in-effect` ESLint rule — use a plain async IIFE inside `useEffect` instead if the rule fires.

---

### Task 1: `ProspectDraft` Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma model `ProspectDraft { id, accountId, account, subject, body, recipientEmail, reviewed, createdAt }`, and `prisma.prospectDraft` client accessor used by Tasks 3 and 4.

- [ ] **Step 1: Add the model to the schema**

Add this model at the end of `prisma/schema.prisma`, and add a back-relation field to `Account`:

```prisma
model ProspectDraft {
  id             String   @id @default(uuid())
  accountId      String
  account        Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  subject        String
  body           String
  recipientEmail String?
  reviewed       Boolean  @default(false)
  createdAt      DateTime @default(now())

  @@index([reviewed])
}
```

In the existing `model Account { ... }` block, add this line alongside the other relation fields (`contacts`, `interactions`):

```prisma
  prospectDrafts ProspectDraft[]
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_prospect_draft`
Expected: a new folder appears under `prisma/migrations/` (timestamp-prefixed, ending in `_add_prospect_draft`) containing a `migration.sql` that creates the `ProspectDraft` table; command exits with no errors and regenerates the Prisma client.

- [ ] **Step 3: Verify the schema is valid**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "Add ProspectDraft model for automated prospecting queue"
```

---

### Task 2: `categoryForDate` pure function (TDD)

**Files:**
- Modify: `src/lib/prospecting.ts`
- Modify: `src/lib/prospecting.test.ts`

**Interfaces:**
- Consumes: `AccountType` from `@prisma/client` (already imported in `prospecting.ts`).
- Produces: `categoryForDate(date: Date): AccountType`, used by Task 3's cron route.

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `src/lib/prospecting.test.ts`:

```ts
describe("categoryForDate", () => {
  it("returns CONTRACTOR for Monday", () => {
    expect(categoryForDate(new Date(Date.UTC(2026, 7, 17)))).toBe(
      "CONTRACTOR",
    );
  });

  it("returns RESTAURANT for Tuesday", () => {
    expect(categoryForDate(new Date(Date.UTC(2026, 7, 18)))).toBe(
      "RESTAURANT",
    );
  });

  it("returns PROPERTY_MGMT for Wednesday", () => {
    expect(categoryForDate(new Date(Date.UTC(2026, 7, 19)))).toBe(
      "PROPERTY_MGMT",
    );
  });

  it("returns MUNICIPAL for Thursday", () => {
    expect(categoryForDate(new Date(Date.UTC(2026, 7, 20)))).toBe(
      "MUNICIPAL",
    );
  });

  it("returns OTHER for Friday", () => {
    expect(categoryForDate(new Date(Date.UTC(2026, 7, 21)))).toBe("OTHER");
  });

  it("returns OTHER for Saturday", () => {
    expect(categoryForDate(new Date(Date.UTC(2026, 7, 22)))).toBe("OTHER");
  });

  it("returns OTHER for Sunday", () => {
    expect(categoryForDate(new Date(Date.UTC(2026, 7, 23)))).toBe("OTHER");
  });
});
```

Add `categoryForDate` to the existing import line at the top of the test file:

```ts
import {
  buildProspectSearchPrompt,
  parseProspectSearchResponse,
  buildProspectingEmailPrompt,
  categoryForDate,
} from "./prospecting";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/prospecting.test.ts`
Expected: FAIL — `categoryForDate is not exported` / `is not a function`.

- [ ] **Step 3: Implement `categoryForDate`**

Add to `src/lib/prospecting.ts` (uses `getUTCDay()`, not `getDay()`, so the result is deterministic regardless of the server's local timezone — Vercel's cron fires on a UTC schedule, so the category must be computed on UTC day-of-week to match):

```ts
export function categoryForDate(date: Date): AccountType {
  const ROTATION: AccountType[] = [
    "OTHER", // Sunday
    "CONTRACTOR", // Monday
    "RESTAURANT", // Tuesday
    "PROPERTY_MGMT", // Wednesday
    "MUNICIPAL", // Thursday
    "OTHER", // Friday
    "OTHER", // Saturday
  ];
  return ROTATION[date.getUTCDay()];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/prospecting.test.ts`
Expected: PASS, all tests including the 7 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prospecting.ts src/lib/prospecting.test.ts
git commit -m "Add categoryForDate for deterministic prospecting category rotation"
```

---

### Task 3: Cron route — `POST /api/cron/prospect`

**Files:**
- Create: `src/app/api/cron/prospect/route.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `categoryForDate`, `buildProspectSearchPrompt`, `parseProspectSearchResponse`, `buildProspectingEmailPrompt` from `@/lib/prospecting` (Task 2 + existing); `parseEmailDraftResponse` from `@/lib/followUpEmail` (existing); `prisma.prospectDraft.create` (Task 1).
- Produces: the route Task 5's queue UI reads from indirectly (via Task 4's `GET /api/prospect-drafts`) — this task only writes `Account`, `Contact`, and `ProspectDraft` rows.

- [ ] **Step 1: Write the cron route**

Create `src/app/api/cron/prospect/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import {
  buildProspectSearchPrompt,
  parseProspectSearchResponse,
  buildProspectingEmailPrompt,
  categoryForDate,
} from "@/lib/prospecting";
import { parseEmailDraftResponse } from "@/lib/followUpEmail";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("cron/prospect: ANTHROPIC_API_KEY not configured");
    return NextResponse.json(
      { error: "AI drafting is not configured" },
      { status: 500 },
    );
  }

  const accountType = categoryForDate(new Date());
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const existingAccounts = await prisma.account.findMany({
    select: { name: true },
  });
  const excludeNames = existingAccounts.map((a) => a.name);

  let candidates: ReturnType<typeof parseProspectSearchResponse> = [];
  try {
    const searchPrompt = buildProspectSearchPrompt(accountType, excludeNames);
    const searchMessage = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: searchPrompt }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
          user_location: {
            type: "approximate",
            city: "Harrisburg",
            region: "Pennsylvania",
            country: "US",
            timezone: "America/New_York",
          },
        },
      ],
    });

    if (
      searchMessage.stop_reason === "pause_turn" ||
      searchMessage.stop_reason === "max_tokens"
    ) {
      console.error(
        "cron/prospect: search incomplete",
        searchMessage.stop_reason,
      );
      return NextResponse.json({ accountType, foundCount: 0, addedCount: 0, draftedCount: 0 });
    }

    let text = "";
    for (const block of searchMessage.content) {
      if (block.type === "text") text += block.text + "\n";
    }
    candidates = parseProspectSearchResponse(text);
  } catch (err) {
    console.error("cron/prospect: search failed", err);
    return NextResponse.json({ accountType, foundCount: 0, addedCount: 0, draftedCount: 0 });
  }

  let addedCount = 0;
  let draftedCount = 0;

  for (const candidate of candidates) {
    let accountId: string;
    try {
      const account = await prisma.account.create({
        data: {
          name: candidate.name,
          addressLine: candidate.addressLine,
          city: candidate.city ?? "Harrisburg",
          state: candidate.state ?? "PA",
          zip: candidate.zip,
          phone: candidate.phone,
          accountType,
          source: "PROSPECTED",
        },
      });
      accountId = account.id;
      addedCount++;

      if (candidate.email) {
        await prisma.contact.create({
          data: {
            accountId,
            name: candidate.name,
            email: candidate.email,
            phone: candidate.phone,
          },
        });
      }
    } catch (err) {
      console.error(
        "cron/prospect: failed to add candidate",
        candidate.name,
        err,
      );
      continue;
    }

    try {
      const emailPrompt = buildProspectingEmailPrompt(
        candidate.name,
        accountType,
      );
      const emailMessage = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: emailPrompt }],
      });
      const textBlock = emailMessage.content.find(
        (block) => block.type === "text",
      );
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("no text block in draft response");
      }
      const draft = parseEmailDraftResponse(textBlock.text);
      await prisma.prospectDraft.create({
        data: {
          accountId,
          subject: draft.subject,
          body: draft.body,
          recipientEmail: candidate.email,
        },
      });
      draftedCount++;
    } catch (err) {
      console.error(
        "cron/prospect: failed to draft email for",
        candidate.name,
        err,
      );
    }
  }

  return NextResponse.json({
    accountType,
    foundCount: candidates.length,
    addedCount,
    draftedCount,
  });
}
```

- [ ] **Step 2: Add the Vercel Cron schedule**

Create `vercel.json` at the project root (this project has no `vercel.json` yet — Next.js is otherwise zero-config on Vercel, and adding just a `crons` key does not change that):

```json
{
  "crons": [
    {
      "path": "/api/cron/prospect",
      "schedule": "0 13 * * 1-5"
    }
  ]
}
```

This fires at 13:00 UTC on Mon–Fri, which is 9am US/Eastern during EDT (drifting to 8am during EST) — an accepted approximation, not worth compensating for per the spec's non-goals.

- [ ] **Step 3: Generate a `CRON_SECRET` and add it locally**

Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Add the printed value to `.env` (which is gitignored) as a new line:

```
CRON_SECRET=<the generated value>
```

- [ ] **Step 4: Verify manually against the dev server**

Run: `npm run dev`, then in another terminal:

```bash
curl -i -X POST http://localhost:3000/api/cron/prospect \
  -H "Authorization: Bearer <the CRON_SECRET value from Step 3>"
```

Expected: HTTP 200 with a JSON body like `{"accountType":"CONTRACTOR","foundCount":...,"addedCount":...,"draftedCount":...}` (the exact category depends on today's real weekday). Confirm in the account list UI (`/`) that new accounts with `source: PROSPECTED` appeared, and query the database (e.g. `npx prisma studio`) to confirm matching `ProspectDraft` rows exist with non-empty `subject`/`body`.

Also verify the auth guard: re-run the same `curl` command with a wrong bearer token (e.g. `-H "Authorization: Bearer wrong"`) and confirm it returns `401 {"error":"Unauthorized"}` without creating any accounts.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/prospect/route.ts vercel.json
git commit -m "Add cron route for automated daily prospecting"
```

---

### Task 4: Review queue API routes

**Files:**
- Create: `src/app/api/prospect-drafts/route.ts`
- Create: `src/app/api/prospect-drafts/[id]/dismiss/route.ts`
- Modify: `src/types/account.ts`

**Interfaces:**
- Consumes: `prisma.prospectDraft` (Task 1), `requireSession` (existing).
- Produces: `GET /api/prospect-drafts` → `ProspectDraftListItem[]`; `POST /api/prospect-drafts/[id]/dismiss` → `{ ok: true }`. `ProspectDraftListItem` is consumed by Task 5's UI.

- [ ] **Step 1: Add the response type**

Add to `src/types/account.ts`:

```ts
export interface ProspectDraftListItem {
  id: string;
  subject: string;
  body: string;
  recipientEmail: string | null;
  account: {
    id: string;
    name: string;
    addressLine: string | null;
    city: string;
    state: string;
    zip: string | null;
  };
}
```

- [ ] **Step 2: Write the list route**

Create `src/app/api/prospect-drafts/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";
import type { ProspectDraftListItem } from "@/types/account";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const drafts = await prisma.prospectDraft.findMany({
    where: { reviewed: false },
    orderBy: { createdAt: "desc" },
    include: {
      account: {
        select: {
          id: true,
          name: true,
          addressLine: true,
          city: true,
          state: true,
          zip: true,
        },
      },
    },
  });

  const items: ProspectDraftListItem[] = drafts.map((d) => ({
    id: d.id,
    subject: d.subject,
    body: d.body,
    recipientEmail: d.recipientEmail,
    account: d.account,
  }));

  return NextResponse.json(items);
}
```

- [ ] **Step 3: Write the dismiss route**

Create `src/app/api/prospect-drafts/[id]/dismiss/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  try {
    await prisma.prospectDraft.update({
      where: { id },
      data: { reviewed: true },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Verify manually**

With `npm run dev` running and at least one undismissed `ProspectDraft` row from Task 3's verification:

```bash
curl -i http://localhost:3000/api/prospect-drafts -H "Cookie: <your session cookie from logging in via the browser>"
```

Expected: 200 with a JSON array containing the draft(s) created in Task 3, each with a nested `account` object.

Then dismiss one and re-fetch:

```bash
curl -i -X POST http://localhost:3000/api/prospect-drafts/<id>/dismiss -H "Cookie: <same cookie>"
curl -i http://localhost:3000/api/prospect-drafts -H "Cookie: <same cookie>"
```

Expected: the dismissed draft no longer appears in the second `GET`, but confirm via `npx prisma studio` that its `Account`/`Contact` rows and the `ProspectDraft` row itself still exist (`reviewed` is now `true`, nothing was deleted).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/prospect-drafts src/types/account.ts
git commit -m "Add review queue API routes for automated prospecting drafts"
```

---

### Task 5: "Needs review" queue UI

**Files:**
- Create: `src/components/ProspectDraftQueue.tsx`
- Modify: `src/app/(dashboard)/prospecting/page.tsx`

**Interfaces:**
- Consumes: `GET /api/prospect-drafts`, `POST /api/prospect-drafts/[id]/dismiss` (Task 4), `ProspectDraftListItem` (Task 4).

- [ ] **Step 1: Write the queue component**

Create `src/components/ProspectDraftQueue.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProspectDraftListItem } from "@/types/account";

export function ProspectDraftQueue() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<ProspectDraftListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/prospect-drafts");
      if (res.redirected) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setError("Failed to load the review queue.");
        return;
      }
      const data = await res.json();
      setDrafts(data);
    } catch {
      setError("Failed to load the review queue.");
    }
  }

  function copyDraft(draft: ProspectDraftListItem) {
    navigator.clipboard.writeText(
      `Subject: ${draft.subject}\n\n${draft.body}`,
    );
    setCopiedId(draft.id);
  }

  async function dismiss(id: string) {
    try {
      const res = await fetch(`/api/prospect-drafts/${id}/dismiss`, {
        method: "POST",
      });
      if (res.redirected) {
        router.push("/login");
        return;
      }
      if (!res.ok) return;
      setDrafts((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
    } catch {
      // leave the item in the queue; the user can retry the dismiss
    }
  }

  return (
    <div className="space-y-2 rounded border p-3">
      <h2 className="font-semibold">Needs review</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {drafts && drafts.length === 0 && (
        <p className="text-sm text-gray-600">Nothing to review right now.</p>
      )}
      {drafts && drafts.length > 0 && (
        <ul className="space-y-2">
          {drafts.map((draft) => (
            <li key={draft.id} className="space-y-1 rounded border p-2">
              <p className="font-semibold">{draft.account.name}</p>
              {draft.account.addressLine && (
                <p className="text-sm text-gray-600">
                  {draft.account.addressLine}
                  {draft.account.city ? `, ${draft.account.city}` : ""}
                  {draft.account.state ? `, ${draft.account.state}` : ""}
                  {draft.account.zip ? ` ${draft.account.zip}` : ""}
                </p>
              )}
              <p className="text-sm font-semibold">
                Subject: {draft.subject}
              </p>
              <p className="whitespace-pre-wrap text-sm">{draft.body}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => copyDraft(draft)}
                  className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
                >
                  {copiedId === draft.id ? "Copied!" : "Copy"}
                </button>
                {draft.recipientEmail && (
                  <a
                    href={`mailto:${draft.recipientEmail}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                    className="rounded border px-3 py-1 text-sm"
                  >
                    Open in email
                  </a>
                )}
                <button
                  onClick={() => dismiss(draft.id)}
                  className="rounded border px-3 py-1 text-sm"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the Prospecting page**

In `src/app/(dashboard)/prospecting/page.tsx`, add the import alongside the existing ones:

```ts
import { ProspectDraftQueue } from "@/components/ProspectDraftQueue";
```

Then render it as the first child inside the page's outer `<div className="max-w-2xl space-y-4">`, immediately after the `<h1>`:

```tsx
      <h1 className="text-xl font-semibold">Prospecting</h1>
      <ProspectDraftQueue />
```

(This is the only change to this file — the existing manual search form below it is untouched.)

- [ ] **Step 3: Verify manually in the browser**

Run: `npm run dev`, log in, navigate to `/prospecting`.
Expected: a "Needs review" section appears at the top, listing the draft(s) persisted during Task 3/4's verification, each showing the account's name/address, subject, body, a "Copy" button, an "Open in email" link (if the candidate had an email), and a "Dismiss" button. Click "Copy" and confirm the clipboard contains `Subject: ...\n\n...`. Click "Dismiss" and confirm the item disappears from the list without a page reload. Reload the page and confirm the dismissed item stays gone (persisted server-side) while the rest of the page — the existing manual search form — still works exactly as before.

If the queue is empty at this point (e.g. Task 3/4's verification drafts were already dismissed), first re-run Task 3's `curl` command to produce a fresh draft, then repeat this verification.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProspectDraftQueue.tsx "src/app/(dashboard)/prospecting/page.tsx"
git commit -m "Add Needs review queue UI to the Prospecting page"
```
