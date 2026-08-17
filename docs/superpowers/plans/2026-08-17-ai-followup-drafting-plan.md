# AI-Drafted Follow-Up Emails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From an account's detail page, generate an AI-drafted follow-up email grounded in that account's most recent interaction, and hand it to the user as a pre-filled `mailto:` link they review and send themselves.

**Architecture:** A pure function builds the Claude prompt from account/interaction data and a matching pure function parses Claude's reply into `{ subject, body }`; a new API route wires those together with a server-side call to the Anthropic Messages API; a new client component adds the button/picker/preview UI to the existing account detail page. No new database model — every draft is generated fresh on click and never persisted.

**Tech Stack:** Next.js 16.3.1 (App Router), TypeScript, `@anthropic-ai/sdk`, Vitest — same stack as Phase 1.

**Spec:** [docs/superpowers/specs/2026-08-17-ai-followup-drafting-design.md](../specs/2026-08-17-ai-followup-drafting-design.md)

## Global Constraints

- No new Prisma model — drafting is stateless; nothing about a draft is written to the database.
- No automatic or scheduled sending. Every email is one manual click, initiated by the user, per account.
- No batch drafting across multiple accounts in this phase.
- No real Gmail API integration (no OAuth, no Google Cloud project, no stored Google tokens) — email handoff is via a `mailto:` link only.
- TypeScript strict mode across the app (inherited repo-wide setting).
- `ANTHROPIC_API_KEY` must never be committed; only ever read from environment variables.

---

### Task 1: Follow-up email prompt/response helpers (TDD)

**Files:**
- Create: `src/lib/followUpEmail.ts`
- Test: `src/lib/followUpEmail.test.ts`

**Interfaces:**
- Produces: `FollowUpEmailInput` type, `buildFollowUpEmailPrompt(input: FollowUpEmailInput): string`, `parseEmailDraftResponse(text: string): { subject: string; body: string }`. Task 2's API route imports and uses both.
- Consumes: `AccountType`, `InteractionType` from `@prisma/client` (already a project dependency).

- [ ] **Step 1: Write the failing tests**

`src/lib/followUpEmail.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildFollowUpEmailPrompt, parseEmailDraftResponse } from "./followUpEmail";

describe("buildFollowUpEmailPrompt", () => {
  it("includes notes and next action when a last interaction exists", () => {
    const prompt = buildFollowUpEmailPrompt({
      accountName: "Acme Construction",
      accountType: "CONTRACTOR",
      contactName: "Jamie Rivera",
      lastInteraction: {
        type: "VISIT",
        date: "2026-08-10",
        notes: "Discussed bulk fastener pricing.",
        nextAction: "Send a quote for 500 units.",
      },
    });
    expect(prompt).toContain("Acme Construction");
    expect(prompt).toContain("Jamie Rivera");
    expect(prompt).toContain("Discussed bulk fastener pricing.");
    expect(prompt).toContain("Send a quote for 500 units.");
    expect(prompt).toContain("visit");
  });

  it("omits placeholder text for missing notes/next action without crashing", () => {
    const prompt = buildFollowUpEmailPrompt({
      accountName: "Acme Construction",
      accountType: "CONTRACTOR",
      contactName: "Jamie Rivera",
      lastInteraction: {
        type: "CALL",
        date: "2026-08-10",
        notes: null,
        nextAction: null,
      },
    });
    expect(prompt).not.toContain("null");
    expect(prompt).toContain("No notes were recorded");
    expect(prompt).toContain("No specific next action was recorded");
  });

  it("requests a generic introductory email when there is no last interaction", () => {
    const prompt = buildFollowUpEmailPrompt({
      accountName: "New Prospect Co",
      accountType: "OTHER",
      contactName: "Sam Lee",
      lastInteraction: null,
    });
    expect(prompt).toContain("no recorded interactions");
    expect(prompt).toContain("introductory");
  });
});

describe("parseEmailDraftResponse", () => {
  it("parses a well-formed subject/body response", () => {
    const result = parseEmailDraftResponse(
      "Subject: Following up on our visit\n---\nHi Jamie,\n\nGreat catching up last week...",
    );
    expect(result.subject).toBe("Following up on our visit");
    expect(result.body).toBe("Hi Jamie,\n\nGreat catching up last week...");
  });

  it("falls back gracefully when the format is not as expected", () => {
    const result = parseEmailDraftResponse(
      "Just some unstructured text with no subject line.",
    );
    expect(result.subject).toBe("Follow up");
    expect(result.body).toBe(
      "Just some unstructured text with no subject line.",
    );
  });

  it("handles extra surrounding whitespace", () => {
    const result = parseEmailDraftResponse(
      "\n\n  Subject: Quick check-in  \n---\n  Hello there.  \n\n",
    );
    expect(result.subject).toBe("Quick check-in");
    expect(result.body).toBe("Hello there.");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/followUpEmail.test.ts`
Expected: FAIL — `./followUpEmail` has no exported member `buildFollowUpEmailPrompt`/`parseEmailDraftResponse` (module doesn't exist yet).

- [ ] **Step 3: Implement**

`src/lib/followUpEmail.ts`:

```ts
import type { AccountType, InteractionType } from "@prisma/client";

export interface FollowUpEmailInput {
  accountName: string;
  accountType: AccountType;
  contactName: string;
  lastInteraction: {
    type: InteractionType;
    date: string;
    notes: string | null;
    nextAction: string | null;
  } | null;
}

export function buildFollowUpEmailPrompt(input: FollowUpEmailInput): string {
  const { accountName, accountType, contactName, lastInteraction } = input;

  const intro = `You are drafting a short, professional follow-up email from an outside sales rep at Ace Hardware to a business contact. Write in a friendly, concise, non-pushy tone. Do not use placeholder brackets like [Name] — use the actual names given.

Business: ${accountName} (${accountType})
Contact: ${contactName}`;

  const situation = lastInteraction
    ? `The rep's most recent interaction with this account was a ${lastInteraction.type.toLowerCase()} on ${lastInteraction.date}.
${lastInteraction.notes ? `Notes from that interaction: ${lastInteraction.notes}` : "No notes were recorded for that interaction."}
${lastInteraction.nextAction ? `The planned next action was: ${lastInteraction.nextAction}` : "No specific next action was recorded."}

Write a follow-up email that references this history naturally and moves the relationship forward.`
    : `The rep has no recorded interactions with this account yet. Write a brief, friendly introductory follow-up email.`;

  const format = `Reply in exactly this format, with nothing before or after:
Subject: <subject line>
---
<email body>`;

  return `${intro}\n\n${situation}\n\n${format}`;
}

export function parseEmailDraftResponse(
  text: string,
): { subject: string; body: string } {
  const trimmed = text.trim();
  const subjectMatch = trimmed.match(/^Subject:\s*(.+)$/m);
  const delimiterIndex = trimmed.indexOf("\n---");

  if (subjectMatch && delimiterIndex !== -1) {
    const subject = subjectMatch[1].trim();
    const body = trimmed.slice(delimiterIndex + 4).trim();
    if (subject && body) {
      return { subject, body };
    }
  }

  return { subject: "Follow up", body: trimmed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/followUpEmail.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/followUpEmail.ts src/lib/followUpEmail.test.ts
git commit -m "Add follow-up email prompt/response helpers"
```

---

### Task 2: Draft-email API route

**Files:**
- Create: `src/app/api/accounts/[id]/draft-email/route.ts`
- Modify: `package.json` (add `@anthropic-ai/sdk` dependency)
- Modify: `.env.example` (add `ANTHROPIC_API_KEY`)

**Interfaces:**
- Consumes: `prisma` (`@/lib/prisma`), `requireSession` (`@/lib/requireSession`), `buildFollowUpEmailPrompt`/`parseEmailDraftResponse` (Task 1, `@/lib/followUpEmail`).
- Produces: `POST /api/accounts/[id]/draft-email` — body `{ contactId: string }` → `{ subject: string, body: string }` on success, or `{ error: string }` with an appropriate status code. Task 3's UI calls this route.

- [ ] **Step 1: Install the Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Add `ANTHROPIC_API_KEY` to `.env.example`**

Add this line to `.env.example` (alongside the existing four variables):

```
ANTHROPIC_API_KEY="sk-ant-your-key-here"
```

- [ ] **Step 3: Write the route**

`src/app/api/accounts/[id]/draft-email/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";
import {
  buildFollowUpEmailPrompt,
  parseEmailDraftResponse,
} from "@/lib/followUpEmail";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = (await request.json()) as { contactId?: string };

  if (!body.contactId) {
    return NextResponse.json(
      { error: "contactId is required" },
      { status: 400 },
    );
  }

  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      contacts: true,
      interactions: { orderBy: { date: "desc" }, take: 1 },
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contact = account.contacts.find((c) => c.id === body.contactId);
  if (!contact || !contact.email) {
    return NextResponse.json(
      { error: "Contact not found or has no email on file" },
      { status: 400 },
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI drafting is not configured" },
      { status: 500 },
    );
  }

  const lastInteraction = account.interactions[0]
    ? {
        type: account.interactions[0].type,
        date: account.interactions[0].date.toISOString(),
        notes: account.interactions[0].notes,
        nextAction: account.interactions[0].nextAction,
      }
    : null;

  const prompt = buildFollowUpEmailPrompt({
    accountName: account.name,
    accountType: account.accountType,
    contactName: contact.name,
    lastInteraction,
  });

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
  } catch {
    return NextResponse.json(
      { error: "AI drafting failed. Please try again." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Verify by hand**

Run: `npm run dev`. With a logged-in browser session (or a REST client sending the session cookie) and a real `ANTHROPIC_API_KEY` set in `.env`:
- `POST /api/accounts/<id>/draft-email` with `{"contactId":"<a real contact id with an email>"}` for an account that has at least one interaction — confirm it returns `{ subject, body }` and the body references the interaction's notes/next action.
- Same account/contact but temporarily with no interactions — confirm it returns a generic introductory draft instead of erroring.
- `{"contactId":"nonexistent-id"}` — confirm 400 `"Contact not found or has no email on file"`.
- Temporarily unset `ANTHROPIC_API_KEY` and retry — confirm 500 `"AI drafting is not configured"`, then restore the key.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/accounts/[id]/draft-email package.json package-lock.json .env.example
git commit -m "Add draft-email API route"
```

---

### Task 3: Follow-up email UI

**Files:**
- Create: `src/components/FollowUpEmailDraft.tsx`
- Modify: `src/app/(dashboard)/accounts/[id]/page.tsx`

**Interfaces:**
- Consumes: `POST /api/accounts/[id]/draft-email` (Task 2), `AccountDetail["contacts"]` type (already defined in `@/types/account`).
- Produces: `FollowUpEmailDraft` component, rendered on the account detail page.

- [ ] **Step 1: Write the component**

`src/components/FollowUpEmailDraft.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { AccountDetail } from "@/types/account";

export function FollowUpEmailDraft({
  accountId,
  contacts,
}: {
  accountId: string;
  contacts: AccountDetail["contacts"];
}) {
  const contactsWithEmail = contacts.filter(
    (c): c is typeof c & { email: string } => !!c.email,
  );

  const [showPicker, setShowPicker] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(
    null,
  );

  if (contactsWithEmail.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        Add an email to a contact to draft follow-up emails.
      </p>
    );
  }

  async function requestDraft(contactId: string) {
    setLoading(true);
    setError(null);
    setDraft(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}/draft-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          (data && typeof data.error === "string" && data.error) ||
            "Failed to draft email. Please try again.",
        );
        return;
      }
      setDraft(data);
      setShowPicker(false);
    } finally {
      setLoading(false);
    }
  }

  function handleDraftClick() {
    if (contactsWithEmail.length === 1) {
      const only = contactsWithEmail[0];
      setSelectedContactId(only.id);
      requestDraft(only.id);
    } else {
      setShowPicker(true);
    }
  }

  const draftContact = contactsWithEmail.find(
    (c) => c.id === selectedContactId,
  );

  return (
    <div className="space-y-2">
      {!draft && !showPicker && (
        <button
          onClick={handleDraftClick}
          disabled={loading}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          {loading ? "Drafting..." : "Draft follow-up email"}
        </button>
      )}

      {showPicker && !draft && (
        <div className="flex items-center gap-2">
          <select
            className="rounded border px-2 py-1 text-sm"
            value={selectedContactId}
            onChange={(e) => setSelectedContactId(e.target.value)}
          >
            <option value="">Choose a contact...</option>
            {contactsWithEmail.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
          <button
            onClick={() => selectedContactId && requestDraft(selectedContactId)}
            disabled={!selectedContactId || loading}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            {loading ? "Drafting..." : "Draft"}
          </button>
          <button
            onClick={() => setShowPicker(false)}
            className="text-sm text-gray-600"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {draft && draftContact && (
        <div className="space-y-2 rounded border p-3">
          <p className="text-sm font-semibold">Subject: {draft.subject}</p>
          <p className="whitespace-pre-wrap text-sm">{draft.body}</p>
          <div className="flex gap-2">
            <a
              href={`mailto:${draftContact.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            >
              Send via email
            </a>
            <button
              onClick={() => {
                setDraft(null);
                setSelectedContactId("");
              }}
              className="text-sm text-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the account detail page**

In `src/app/(dashboard)/accounts/[id]/page.tsx`, add the import:

```tsx
import { FollowUpEmailDraft } from "@/components/FollowUpEmailDraft";
```

And add a new section after the "History" section (after the closing `</div>` that follows `<InteractionTimeline interactions={account.interactions} />`, still inside the outer `max-w-2xl space-y-6` wrapper):

```tsx
      <div>
        <h2 className="mb-2 font-semibold">Follow-up</h2>
        <FollowUpEmailDraft accountId={id} contacts={account.contacts} />
      </div>
```

- [ ] **Step 3: Verify by hand**

Run: `npm run dev`, log in, visit an account that has a contact with an email and at least one interaction with notes/next-action. Confirm:
- The "Draft follow-up email" button appears.
- Clicking it (single contact with email) immediately shows a loading state, then a preview panel with subject/body referencing that interaction's notes.
- "Send via email" opens your default mail client with the subject/body pre-filled and the correct recipient.
- "Close" clears the preview and shows the button again.
- On an account with two contacts that both have emails, clicking "Draft follow-up email" shows the picker first; selecting one and clicking "Draft" produces the preview addressed to that contact.
- On an account with no contact emails on file, only the hint text appears, no button.

- [ ] **Step 4: Commit**

```bash
git add src/components/FollowUpEmailDraft.tsx "src/app/(dashboard)/accounts/[id]/page.tsx"
git commit -m "Add follow-up email drafting UI to account detail page"
```

---

### Task 4: Configure and deploy

**Files:**
- Modify: `README.md` (document the new env var)

**Interfaces:**
- Produces: a working `ANTHROPIC_API_KEY` in both local `.env` and the Vercel production environment, so the deployed app can draft emails.

- [ ] **Step 1: Update `README.md`**

In the "Local development" step 1 (which lists the env vars to fill in), add `ANTHROPIC_API_KEY` to the list. In the "Deploying" step 4 (Vercel environment variables), add `ANTHROPIC_API_KEY` to the list of variables to set.

- [ ] **Step 2: Commit the README change**

```bash
git add README.md
git commit -m "Document ANTHROPIC_API_KEY in deployment docs"
```

- [ ] **Step 3: Get an Anthropic API key and configure both environments**

This step is done together with the user, not solo — they must create the Anthropic account/key themselves (Claude cannot create accounts or enter credentials on their behalf):

1. If the user doesn't already have one: go to console.anthropic.com, sign up, create an API key.
2. Add `ANTHROPIC_API_KEY="<the key>"` to the local `.env` file.
3. Add the same variable in Vercel's Project Settings → Environment Variables.
4. Redeploy (push to `main`, or trigger a redeploy from the Vercel dashboard) so the production environment picks up the new variable.
5. Verify end-to-end at the live URL: open a real account with a contact email, click "Draft follow-up email", confirm a draft is generated and "Send via email" opens a correctly pre-filled compose window.

---

## Post-plan check

After Task 4, the user should be able to: open any account with a contact email on file, click "Draft follow-up email," get an AI-written draft grounded in that account's real history, and hand it off to their email client with one click — both locally and in production. Phase 3 (route/visit planning) is a separate spec/plan to be brainstormed when the user is ready to start it.
