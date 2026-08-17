# Prospecting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user search for real businesses of a given type in the Harrisburg area not already in the tracker, add any as a new prospect account with one click, and draft a cold-outreach intro email for it.

**Architecture:** Three pure functions in `src/lib/prospecting.ts` (search-prompt builder, search-response parser, email-prompt builder — the last reusing Phase 2's existing `parseEmailDraftResponse`), two new thin API routes wrapping Anthropic calls (one with the web search tool enabled, one without), and a new page + card component built from existing account-creation infrastructure.

**Tech Stack:** Next.js 16.3.1 (App Router), TypeScript, `@anthropic-ai/sdk` (already installed, `^0.117.1`), Vitest — same stack as Phases 1-3.

**Spec:** [docs/superpowers/specs/2026-08-17-prospecting-design.md](../specs/2026-08-17-prospecting-design.md)

## Global Constraints

- No new Prisma model, no schema change — prospects become ordinary `Account` rows via the existing account-creation route.
- No new external API key/billing beyond `ANTHROPIC_API_KEY` (already configured) — search uses Claude's built-in web search tool, not a separate business-data API.
- No automatic/scheduled searching, no batch prospecting — one search, one account type, on demand.
- No automatic email sending — drafted emails are copied or opened via `mailto:` for the user to send themselves.
- TypeScript strict mode across the app (inherited repo-wide setting).
- Do not touch `src/app/layout.tsx` (the root layout) in any task in this plan — a prior phase's implementer incorrectly "fixed" a `tsc --noEmit` artifact there by editing this unrelated file; if a bare `tsc --noEmit` shows a `LayoutProps` error, run `npx next build` first to generate `.next/types`, don't edit source.

---

### Task 1: Prospecting pure functions (TDD)

**Files:**
- Create: `src/lib/prospecting.ts`
- Test: `src/lib/prospecting.test.ts`

**Interfaces:**
- Produces: `ProspectCandidate` interface, `buildProspectSearchPrompt(accountType: AccountType, excludeNames: string[]): string`, `parseProspectSearchResponse(text: string): ProspectCandidate[]`, `buildProspectingEmailPrompt(businessName: string, accountType: AccountType): string`. Task 2 uses the first two; Task 3 uses the third (and Phase 2's existing `parseEmailDraftResponse` from `src/lib/followUpEmail.ts`, not redefined here).
- Consumes: `AccountType` from `@prisma/client` (already a project dependency).

- [ ] **Step 1: Write the failing tests**

`src/lib/prospecting.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildProspectSearchPrompt,
  parseProspectSearchResponse,
  buildProspectingEmailPrompt,
} from "./prospecting";

describe("buildProspectSearchPrompt", () => {
  it("includes the account type and Harrisburg location", () => {
    const prompt = buildProspectSearchPrompt("RESTAURANT", []);
    expect(prompt).toContain("restaurant");
    expect(prompt).toContain("Harrisburg");
  });

  it("lists names to exclude when provided", () => {
    const prompt = buildProspectSearchPrompt("CONTRACTOR", [
      "Acme Construction",
      "Bob's Builders",
    ]);
    expect(prompt).toContain("Acme Construction");
    expect(prompt).toContain("Bob's Builders");
  });

  it("omits the exclude section when the list is empty", () => {
    const prompt = buildProspectSearchPrompt("OTHER", []);
    expect(prompt).not.toContain("already tracked");
  });
});

describe("parseProspectSearchResponse", () => {
  it("parses a well-formed JSON array", () => {
    const text = `[{"name":"Joe's Diner","addressLine":"1 Main St","city":"Harrisburg","state":"PA","zip":"17101","phone":"717-555-0100","email":null,"website":"https://joes.example","notes":"busy kitchen"}]`;
    const result = parseProspectSearchResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Joe's Diner");
    expect(result[0].phone).toBe("717-555-0100");
    expect(result[0].email).toBeNull();
  });

  it("parses a JSON array wrapped in a markdown code fence", () => {
    const text =
      'Here you go:\n```json\n[{"name":"Test Co","addressLine":null,"city":null,"state":null,"zip":null,"phone":null,"email":null,"website":null,"notes":null}]\n```';
    const result = parseProspectSearchResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test Co");
    expect(result[0].addressLine).toBeNull();
  });

  it("returns an empty array for malformed output", () => {
    expect(
      parseProspectSearchResponse("Sorry, I couldn't find anything."),
    ).toEqual([]);
  });

  it("returns an empty array for a genuinely empty result", () => {
    expect(parseProspectSearchResponse("[]")).toEqual([]);
  });

  it("drops entries missing a name", () => {
    const text = `[{"addressLine":"1 Main St"},{"name":"Valid Co"}]`;
    const result = parseProspectSearchResponse(text);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Valid Co");
  });
});

describe("buildProspectingEmailPrompt", () => {
  it("mentions Ace Hardware, the business name, and COSTARS", () => {
    const prompt = buildProspectingEmailPrompt("Joe's Diner", "RESTAURANT");
    expect(prompt).toContain("Ace Hardware");
    expect(prompt).toContain("Joe's Diner");
    expect(prompt).toContain("COSTARS");
  });

  it("instructs a generic greeting when there is no contact name", () => {
    const prompt = buildProspectingEmailPrompt("Test Co", "OTHER");
    expect(prompt).toContain("generically");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/prospecting.test.ts`
Expected: FAIL — `./prospecting` has no exported member `buildProspectSearchPrompt`/`parseProspectSearchResponse`/`buildProspectingEmailPrompt` (module doesn't exist yet).

- [ ] **Step 3: Implement**

`src/lib/prospecting.ts`:

```ts
import type { AccountType } from "@prisma/client";

export interface ProspectCandidate {
  name: string;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CONTRACTOR: "contractor",
  RESTAURANT: "restaurant",
  PROPERTY_MGMT: "property management company",
  MUNICIPAL: "municipal or government office",
  OTHER: "business",
};

export function buildProspectSearchPrompt(
  accountType: AccountType,
  excludeNames: string[],
): string {
  const typeLabel = ACCOUNT_TYPE_LABELS[accountType];
  const excludeSection =
    excludeNames.length > 0
      ? `Do not include any business whose name matches (even approximately) one of these, since they are already tracked:\n${excludeNames.map((n) => `- ${n}`).join("\n")}\n\n`
      : "";

  return `You are helping an outside sales rep for Ace Hardware find new business prospects. Use web search to find up to 8 real, currently-operating ${typeLabel} businesses in or near Harrisburg, Pennsylvania that could plausibly need hardware, tools, or maintenance supplies.

${excludeSection}For each business found, gather whatever of the following you can verify: street address, city, state, zip code, phone number, a general contact email if publicly listed, and website. Do not invent or guess any of these — leave a field out (use null) if you can't verify it.

Reply with ONLY a JSON array, nothing before or after it, in exactly this shape:
[
  {
    "name": "Business Name",
    "addressLine": "123 Main St" or null,
    "city": "Harrisburg" or null,
    "state": "PA" or null,
    "zip": "17101" or null,
    "phone": "717-555-0100" or null,
    "email": "info@example.com" or null,
    "website": "https://example.com" or null,
    "notes": "one short sentence on why this business might be a good prospect" or null
  }
]

If you find no qualifying businesses, reply with an empty array: []`;
}

export function parseProspectSearchResponse(
  text: string,
): ProspectCandidate[] {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fencedMatch ? fencedMatch[1] : text;

  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    return [];
  }

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null,
      )
      .filter(
        (item) => typeof item.name === "string" && item.name.trim().length > 0,
      )
      .map((item) => ({
        name: String(item.name),
        addressLine:
          typeof item.addressLine === "string" ? item.addressLine : null,
        city: typeof item.city === "string" ? item.city : null,
        state: typeof item.state === "string" ? item.state : null,
        zip: typeof item.zip === "string" ? item.zip : null,
        phone: typeof item.phone === "string" ? item.phone : null,
        email: typeof item.email === "string" ? item.email : null,
        website: typeof item.website === "string" ? item.website : null,
        notes: typeof item.notes === "string" ? item.notes : null,
      }));
  } catch {
    return [];
  }
}

export function buildProspectingEmailPrompt(
  businessName: string,
  accountType: AccountType,
): string {
  const typeLabel = ACCOUNT_TYPE_LABELS[accountType];

  const intro = `You are drafting a short, professional cold-outreach email from an outside sales rep at Ace Hardware, introducing Ace Hardware to a business that isn't a customer yet. Write in a friendly, concise, non-pushy tone. Do not use placeholder brackets like [Name] — if you don't have a contact's name, address the email generically (e.g. "Hello,").

Business: ${businessName} (a ${typeLabel})`;

  const content = `Introduce Ace Hardware and briefly explain how it can help a ${typeLabel} — tools, hardware, and maintenance supplies, with a local rep who can visit in person and account-based ordering. Mention that Ace Hardware is a registered PA COSTARS vendor, as a note of credibility (state it as a fact about Ace Hardware — do not phrase it as a question or ask the recipient about their own COSTARS status). End with a low-pressure invitation to connect.`;

  const format = `Reply in exactly this format, with nothing before or after:
Subject: <subject line>
---
<email body>`;

  return `${intro}\n\n${content}\n\n${format}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/prospecting.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prospecting.ts src/lib/prospecting.test.ts
git commit -m "Add prospecting prompt/response helpers"
```

---

### Task 2: Prospect search API route

**Files:**
- Create: `src/app/api/prospects/search/route.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/prisma`), `requireSession` (`@/lib/requireSession`), `buildProspectSearchPrompt`/`parseProspectSearchResponse`/`ProspectCandidate` (Task 1, `@/lib/prospecting`).
- Produces: `POST /api/prospects/search` — body `{ accountType: AccountType }` → `ProspectCandidate[]` on success, `{ error: string }` on failure. Task 4's UI calls this.

- [ ] **Step 1: Write the route**

`src/app/api/prospects/search/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";
import {
  buildProspectSearchPrompt,
  parseProspectSearchResponse,
} from "@/lib/prospecting";
import type { AccountType } from "@prisma/client";

export const maxDuration = 60;

const VALID_TYPES: AccountType[] = [
  "CONTRACTOR",
  "RESTAURANT",
  "PROPERTY_MGMT",
  "MUNICIPAL",
  "OTHER",
];

export async function POST(request: NextRequest) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as { accountType?: string };
  if (
    !body.accountType ||
    !VALID_TYPES.includes(body.accountType as AccountType)
  ) {
    return NextResponse.json(
      { error: "A valid accountType is required" },
      { status: 400 },
    );
  }
  const accountType = body.accountType as AccountType;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI drafting is not configured" },
      { status: 500 },
    );
  }

  const existingAccounts = await prisma.account.findMany({
    select: { name: true },
  });
  const excludeNames = existingAccounts.map((a) => a.name);

  const prompt = buildProspectSearchPrompt(accountType, excludeNames);

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
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

    let text = "";
    for (const block of message.content) {
      if (block.type === "text") {
        text += block.text + "\n";
      }
    }

    const candidates = parseProspectSearchResponse(text);
    return NextResponse.json(candidates);
  } catch (err) {
    console.error("prospect search failed", err);
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify by hand**

Run: `npm run dev`. With a logged-in session and a real `ANTHROPIC_API_KEY` set in `.env`:
- `POST /api/prospects/search` with `{"accountType":"RESTAURANT"}` — confirm it returns a JSON array (may take 10-30 seconds due to web search); check a few entries look like real, plausible Harrisburg-area restaurants.
- `{"accountType":"NOT_A_REAL_TYPE"}` — confirm 400 `"A valid accountType is required"`.
- Temporarily unset `ANTHROPIC_API_KEY` and retry — confirm 500 `"AI drafting is not configured"`, then restore the key.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/prospects/search
git commit -m "Add prospect search API route"
```

---

### Task 3: Prospecting email API route

**Files:**
- Create: `src/app/api/accounts/[id]/prospecting-email/route.ts`

**Interfaces:**
- Consumes: `prisma`, `requireSession`, `buildProspectingEmailPrompt` (Task 1), `parseEmailDraftResponse` (already exists — Phase 2, `@/lib/followUpEmail`, NOT redefined here).
- Produces: `POST /api/accounts/[id]/prospecting-email` (no body needed) → `{ subject: string, body: string }` on success, `{ error: string }` on failure. Task 4's UI calls this.

- [ ] **Step 1: Write the route**

`src/app/api/accounts/[id]/prospecting-email/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";
import { buildProspectingEmailPrompt } from "@/lib/prospecting";
import { parseEmailDraftResponse } from "@/lib/followUpEmail";

export const maxDuration = 30;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const account = await prisma.account.findUnique({
    where: { id },
    select: { name: true, accountType: true },
  });

  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI drafting is not configured" },
      { status: 500 },
    );
  }

  const prompt = buildProspectingEmailPrompt(account.name, account.accountType);

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "AI drafting failed. Please try again." },
        { status: 500 },
      );
    }

    const draft = parseEmailDraftResponse(textBlock.text);
    return NextResponse.json(draft);
  } catch (err) {
    console.error("prospecting-email failed", err);
    return NextResponse.json(
      { error: "AI drafting failed. Please try again." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify by hand**

Run: `npm run dev`. With a logged-in session, create a test account (any existing account works), then `POST /api/accounts/<id>/prospecting-email` with no body — confirm it returns `{ subject, body }`, and the body mentions Ace Hardware and PA COSTARS as a statement, not a question. `POST` against a nonexistent account id — confirm 404.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/accounts/[id]/prospecting-email
git commit -m "Add prospecting email API route"
```

---

### Task 4: Prospecting UI

**Files:**
- Create: `src/app/(dashboard)/prospecting/page.tsx`
- Create: `src/components/ProspectCard.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `POST /api/prospects/search` (Task 2), `POST /api/accounts/[id]/prospecting-email` (Task 3), `POST /api/accounts` (existing, Phase 1), `ProspectCandidate` type (Task 1).

- [ ] **Step 1: Write the `ProspectCard` component**

`src/components/ProspectCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountType } from "@prisma/client";
import type { ProspectCandidate } from "@/lib/prospecting";

export function ProspectCard({
  candidate,
  accountType,
}: {
  candidate: ProspectCandidate;
  accountType: AccountType;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(
    null,
  );
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function addProspect() {
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: candidate.name,
          addressLine: candidate.addressLine,
          city: candidate.city,
          state: candidate.state,
          zip: candidate.zip,
          phone: candidate.phone,
          accountType,
          source: "PROSPECTED",
        }),
      });
      if (res.redirected) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setAddError("Failed to add prospect. Please try again.");
        return;
      }
      const account = await res.json();
      setAccountId(account.id);
    } catch {
      setAddError("Failed to add prospect. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function draftEmail() {
    if (!accountId) return;
    setDrafting(true);
    setDraftError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/accounts/${accountId}/prospecting-email`, {
        method: "POST",
      });
      if (res.redirected) {
        router.push("/login");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setDraftError(
          (data && typeof data.error === "string" && data.error) ||
            "Failed to draft email. Please try again.",
        );
        return;
      }
      setDraft(data);
    } catch {
      setDraftError("Failed to draft email. Please try again.");
    } finally {
      setDrafting(false);
    }
  }

  function copyEmail() {
    if (!draft) return;
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopied(true);
  }

  return (
    <li className="space-y-2 rounded border p-3">
      <p className="font-semibold">{candidate.name}</p>
      {candidate.addressLine && (
        <p className="text-sm text-gray-600">
          {candidate.addressLine}
          {candidate.city ? `, ${candidate.city}` : ""}
          {candidate.state ? `, ${candidate.state}` : ""}
          {candidate.zip ? ` ${candidate.zip}` : ""}
        </p>
      )}
      {candidate.phone && (
        <p className="text-sm text-gray-600">{candidate.phone}</p>
      )}
      {candidate.website && (
        <p className="text-sm text-gray-600">
          <a
            href={candidate.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600"
          >
            {candidate.website}
          </a>
        </p>
      )}
      {candidate.notes && (
        <p className="text-sm text-gray-600">{candidate.notes}</p>
      )}

      {addError && <p className="text-sm text-red-600">{addError}</p>}

      {!accountId ? (
        <button
          onClick={addProspect}
          disabled={adding}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add as prospect"}
        </button>
      ) : !draft ? (
        <button
          onClick={draftEmail}
          disabled={drafting}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          {drafting ? "Drafting..." : "Draft intro email"}
        </button>
      ) : (
        <div className="space-y-2 rounded border p-2">
          <p className="text-sm font-semibold">Subject: {draft.subject}</p>
          <p className="whitespace-pre-wrap text-sm">{draft.body}</p>
          <div className="flex gap-2">
            <button
              onClick={copyEmail}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            {candidate.email && (
              <a
                href={`mailto:${candidate.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                className="rounded border px-3 py-1 text-sm"
              >
                Open in email
              </a>
            )}
          </div>
        </div>
      )}
      {draftError && <p className="text-sm text-red-600">{draftError}</p>}
    </li>
  );
}
```

- [ ] **Step 2: Write the page**

`src/app/(dashboard)/prospecting/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProspectCard } from "@/components/ProspectCard";
import type { ProspectCandidate } from "@/lib/prospecting";
import type { AccountType } from "@prisma/client";

const TYPES: AccountType[] = [
  "CONTRACTOR",
  "RESTAURANT",
  "PROPERTY_MGMT",
  "MUNICIPAL",
  "OTHER",
];

export default function ProspectingPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("CONTRACTOR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ProspectCandidate[] | null>(null);

  async function search() {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/prospects/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType }),
      });
      if (res.redirected) {
        router.push("/login");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          (data && typeof data.error === "string" && data.error) ||
            "Search failed. Please try again.",
        );
        return;
      }
      setResults(data);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Prospecting</h1>
      <div className="flex items-center gap-2">
        <select
          className="rounded border px-3 py-2"
          value={accountType}
          onChange={(e) => setAccountType(e.target.value as AccountType)}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={search}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results && results.length === 0 && (
        <p className="text-gray-600">
          No new prospects found — try again later or try a different
          category.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="space-y-2">
          {results.map((candidate, i) => (
            <ProspectCard
              key={i}
              candidate={candidate}
              accountType={accountType}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the nav link**

In `src/app/(dashboard)/layout.tsx`, the current `<nav>` contains, in order: "Ace Sales Tracker", "+ New account", "This week". Add a new `Link` immediately after the "This week" link (still inside the same `<nav>`):

```tsx
        <Link href="/prospecting" className="text-blue-600">
          Prospecting
        </Link>
```

- [ ] **Step 4: Verify by hand**

Run: `npm run dev`, log in. Confirm:
- The "Prospecting" nav link appears and navigates to the new page.
- Selecting a type and clicking "Search" shows a loading state, then a list of result cards (this can take 10-30 seconds due to live web search — don't be alarmed by the wait).
- "Add as prospect" on a card creates the account (verify it shows up in the main account list afterward) and the card switches to showing "Draft intro email".
- "Draft intro email" shows the subject/body, mentions Ace Hardware and PA COSTARS as a statement (not a question).
- "Copy" copies the email text (paste it somewhere to confirm).
- If a candidate has an email, "Open in email" appears and opens a correctly addressed compose window; if not, it doesn't appear.
- Searching a category with genuinely no results (or simulate by checking the empty-results message renders correctly).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/prospecting" src/components/ProspectCard.tsx "src/app/(dashboard)/layout.tsx"
git commit -m "Add prospecting UI"
```

---

## Post-plan check

After Task 4, the user should be able to: pick a business category, search for real prospects in the Harrisburg area not already tracked, add any as a new account with one click, and get an AI-drafted intro email ready to copy or send — all reusing the existing Anthropic API key, no new billing setup. Proposals/quotes (the other half of the original "Phase 4" scope) is a separate spec/plan for later.
