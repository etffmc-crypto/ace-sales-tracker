# Proposals/Quotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user enter a quote's line items on an account's detail page, get an AI-drafted email presenting them to a chosen contact (numbers never invented or altered), hand it off to copy/send, and optionally log it into that account's interaction history.

**Architecture:** A pure prompt-builder function in `src/lib/quote.ts` (reusing Phase 2's existing `parseEmailDraftResponse`), a thin API route that computes the total server-side and wraps an Anthropic call, and a new `QuoteDraft` component wired into the existing account detail page — reusing the existing interactions API for logging, no schema change.

**Tech Stack:** Next.js 16.3.1 (App Router), TypeScript, `@anthropic-ai/sdk` (already installed), Vitest — same stack as every prior phase.

**Spec:** [docs/superpowers/specs/2026-08-17-quotes-design.md](../specs/2026-08-17-quotes-design.md)

## Global Constraints

- No new Prisma model, no schema change, no `InteractionType` enum change — a logged quote is an ordinary `Interaction` row with `type: "EMAIL"`.
- No product catalog, no saved pricing — every quote's line items are entered fresh each time.
- No PDF generation — the quote is an email body only.
- No automatic pipeline-stage changes — logging/sending a quote never changes `pipelineStage` automatically.
- The server must compute the total itself from the line items — never trust a client-supplied total.
- No automatic email sending — Copy/mailto handoff only, matching Phases 2 and 4a.
- TypeScript strict mode across the app (inherited repo-wide setting).
- Do not touch `src/app/layout.tsx` (the root layout) in any task in this plan — a prior phase's implementer incorrectly "fixed" a `tsc --noEmit` artifact there by editing this unrelated file; if a bare `tsc --noEmit` shows a `LayoutProps` error, run `npx next build` first to generate `.next/types`, don't edit source.

---

### Task 1: Quote email prompt pure function (TDD)

**Files:**
- Create: `src/lib/quote.ts`
- Test: `src/lib/quote.test.ts`

**Interfaces:**
- Produces: `LineItem` interface `{ description: string; quantity: number; unitPrice: number }`, `buildQuoteEmailPrompt(accountName: string, contactName: string, lineItems: LineItem[], total: number): string`. Task 2's API route imports and uses both.

- [ ] **Step 1: Write the failing tests**

`src/lib/quote.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildQuoteEmailPrompt } from "./quote";

describe("buildQuoteEmailPrompt", () => {
  it("includes the business name, contact name, and every line item", () => {
    const prompt = buildQuoteEmailPrompt(
      "Acme Construction",
      "Jamie Rivera",
      [
        { description: "2x4 Lumber", quantity: 50, unitPrice: 4.5 },
        { description: "Deck screws (box)", quantity: 3, unitPrice: 12.99 },
      ],
      263.97,
    );
    expect(prompt).toContain("Acme Construction");
    expect(prompt).toContain("Jamie Rivera");
    expect(prompt).toContain("2x4 Lumber");
    expect(prompt).toContain("Deck screws (box)");
    expect(prompt).toContain("263.97");
  });

  it("instructs the model never to invent or adjust the numbers", () => {
    const prompt = buildQuoteEmailPrompt(
      "Test Co",
      "Sam Lee",
      [{ description: "Widget", quantity: 1, unitPrice: 10 }],
      10,
    );
    expect(prompt).toContain("do not invent");
    expect(prompt).toContain("EXACT line items");
  });

  it("formats a single line item with quantity, unit price, and line total", () => {
    const prompt = buildQuoteEmailPrompt(
      "Solo Co",
      "Alex Kim",
      [{ description: "Widget", quantity: 1, unitPrice: 9.99 }],
      9.99,
    );
    expect(prompt).toContain("Widget: 1 x $9.99 = $9.99");
  });

  it("formats decimal prices and totals to two places", () => {
    const prompt = buildQuoteEmailPrompt(
      "Test Co",
      "Sam Lee",
      [{ description: "Bolt", quantity: 100, unitPrice: 0.5 }],
      50,
    );
    expect(prompt).toContain("$0.50");
    expect(prompt).toContain("Total: $50.00");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/quote.test.ts`
Expected: FAIL — `./quote` has no exported member `buildQuoteEmailPrompt` (module doesn't exist yet).

- [ ] **Step 3: Implement**

`src/lib/quote.ts`:

```ts
export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export function buildQuoteEmailPrompt(
  accountName: string,
  contactName: string,
  lineItems: LineItem[],
  total: number,
): string {
  const itemLines = lineItems
    .map(
      (item) =>
        `- ${item.description}: ${item.quantity} x $${item.unitPrice.toFixed(2)} = $${(item.quantity * item.unitPrice).toFixed(2)}`,
    )
    .join("\n");

  const intro = `You are drafting a short, professional quote email from an outside sales rep at Ace Hardware to an existing business contact. Write in a friendly, clear, professional tone. Do not use placeholder brackets like [Name] — use the actual names given.

Business: ${accountName}
Contact: ${contactName}`;

  const content = `Present this quote clearly, using these EXACT line items and total — do not invent, omit, round, or adjust any of these numbers, and do not add taxes, shipping, or fees that aren't listed here:

${itemLines}

Total: $${total.toFixed(2)}

Write an email that presents this quote professionally, briefly explains next steps (e.g. confirming the order, asking any questions), and ends with a low-pressure invitation to follow up.`;

  const format = `Reply in exactly this format, with nothing before or after:
Subject: <subject line>
---
<email body>`;

  return `${intro}\n\n${content}\n\n${format}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/quote.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/quote.ts src/lib/quote.test.ts
git commit -m "Add quote email prompt helper"
```

---

### Task 2: Quote email API route

**Files:**
- Create: `src/app/api/accounts/[id]/quote-email/route.ts`

**Interfaces:**
- Consumes: `prisma`, `requireSession`, `buildQuoteEmailPrompt`/`LineItem` (Task 1), `parseEmailDraftResponse` (existing — Phase 2, `@/lib/followUpEmail`, NOT redefined here).
- Produces: `POST /api/accounts/[id]/quote-email` — body `{ contactId: string, lineItems: LineItem[] }` → `{ subject: string, body: string, total: number }` on success, `{ error: string }` on failure. Task 3's UI calls this and uses the returned `total` when logging the quote (never recomputes it separately, so the logged record always matches exactly what was quoted).

- [ ] **Step 1: Write the route**

`src/app/api/accounts/[id]/quote-email/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";
import { buildQuoteEmailPrompt, type LineItem } from "@/lib/quote";
import { parseEmailDraftResponse } from "@/lib/followUpEmail";

export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = (await request.json()) as {
    contactId?: string;
    lineItems?: LineItem[];
  };

  if (!body.contactId) {
    return NextResponse.json(
      { error: "contactId is required" },
      { status: 400 },
    );
  }

  if (!body.lineItems || !Array.isArray(body.lineItems)) {
    return NextResponse.json(
      { error: "At least one line item is required" },
      { status: 400 },
    );
  }

  const lineItems = body.lineItems.filter(
    (item) =>
      typeof item.description === "string" &&
      item.description.trim() !== "" &&
      typeof item.quantity === "number" &&
      typeof item.unitPrice === "number",
  );

  if (lineItems.length === 0) {
    return NextResponse.json(
      { error: "At least one valid line item is required" },
      { status: 400 },
    );
  }

  const account = await prisma.account.findUnique({
    where: { id },
    include: { contacts: true },
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

  const total = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  const prompt = buildQuoteEmailPrompt(account.name, contact.name, lineItems, total);

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
    return NextResponse.json({ ...draft, total });
  } catch (err) {
    console.error("quote-email failed", err);
    return NextResponse.json(
      { error: "AI drafting failed. Please try again." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify by hand**

Run: `npm run dev`. With a logged-in session, a real account with a contact that has an email, and a real `ANTHROPIC_API_KEY` set in `.env`:
- `POST /api/accounts/<id>/quote-email` with `{"contactId":"<real contact id>","lineItems":[{"description":"2x4 Lumber","quantity":50,"unitPrice":4.5}]}` — confirm it returns `{subject, body, total}` with `total` equal to `225`, and the body presents that exact line item without inventing extra costs.
- Omit `lineItems` — confirm 400 `"At least one line item is required"`.
- `{"contactId":"nonexistent"}` with a valid lineItems array — confirm 400 `"Contact not found or has no email on file"`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/accounts/[id]/quote-email
git commit -m "Add quote email API route"
```

---

### Task 3: Quote UI

**Files:**
- Modify: `src/components/InteractionForm.tsx` (export the existing `todayLocalDate` helper so it can be reused)
- Create: `src/components/QuoteDraft.tsx`
- Modify: `src/app/(dashboard)/accounts/[id]/page.tsx`

**Interfaces:**
- Consumes: `POST /api/accounts/[id]/quote-email` (Task 2), the existing `POST /api/accounts/[id]/interactions` (Phase 1, for logging), `todayLocalDate` (this task's own export from `InteractionForm.tsx`), `AccountDetail["contacts"]` type.

- [ ] **Step 1: Export `todayLocalDate` from `InteractionForm.tsx`**

In `src/components/InteractionForm.tsx`, change:

```ts
function todayLocalDate(): string {
```

to:

```ts
export function todayLocalDate(): string {
```

No other change to that file — the function body and every existing usage stay exactly as they are.

- [ ] **Step 2: Write the `QuoteDraft` component**

`src/components/QuoteDraft.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountDetail } from "@/types/account";
import { todayLocalDate } from "@/components/InteractionForm";

interface LineItemRow {
  description: string;
  quantity: string;
  unitPrice: string;
}

function emptyRow(): LineItemRow {
  return { description: "", quantity: "1", unitPrice: "" };
}

export function QuoteDraft({
  accountId,
  contacts,
  onChange,
}: {
  accountId: string;
  contacts: AccountDetail["contacts"];
  onChange: () => void;
}) {
  const router = useRouter();
  const contactsWithEmail = contacts.filter(
    (c): c is typeof c & { email: string } => !!c.email,
  );

  const [rows, setRows] = useState<LineItemRow[]>([emptyRow()]);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<
    { subject: string; body: string; total: number } | null
  >(null);
  const [copied, setCopied] = useState(false);
  const [logStatus, setLogStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  if (contactsWithEmail.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        Add an email to a contact to draft quotes.
      </p>
    );
  }

  function updateRow(index: number, field: keyof LineItemRow, value: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const parsedItems = rows
    .map((row) => ({
      description: row.description.trim(),
      quantity: Number(row.quantity) || 0,
      unitPrice: Number(row.unitPrice) || 0,
    }))
    .filter((item) => item.description !== "");

  const runningTotal = parsedItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  async function requestDraft(contactId: string) {
    setLoading(true);
    setError(null);
    setDraft(null);
    setLogStatus("idle");
    try {
      const res = await fetch(`/api/accounts/${accountId}/quote-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, lineItems: parsedItems }),
      });
      if (res.redirected) {
        router.push("/login");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          (data && typeof data.error === "string" && data.error) ||
            "Failed to draft quote. Please try again.",
        );
        return;
      }
      setDraft(data);
      setShowPicker(false);
    } catch {
      setError("Failed to draft quote. Please try again.");
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

  function copyEmail() {
    if (!draft) return;
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopied(true);
  }

  async function logQuote() {
    if (!draft) return;
    setLogStatus("saving");
    const notesLines = parsedItems.map(
      (item) =>
        `${item.description}: ${item.quantity} x $${item.unitPrice.toFixed(2)} = $${(item.quantity * item.unitPrice).toFixed(2)}`,
    );
    const notes = `Quote:\n${notesLines.join("\n")}\nTotal: $${draft.total.toFixed(2)}`;
    try {
      const res = await fetch(`/api/accounts/${accountId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayLocalDate(),
          type: "EMAIL",
          notes,
          nextAction: null,
          nextActionDate: null,
        }),
      });
      if (!res.ok) {
        setLogStatus("error");
        return;
      }
      setLogStatus("success");
      onChange();
    } catch {
      setLogStatus("error");
    }
  }

  const hasValidItems = parsedItems.length > 0;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <input
              placeholder="Description"
              className="flex-1 rounded border px-2 py-1 text-sm"
              value={row.description}
              onChange={(e) => updateRow(i, "description", e.target.value)}
            />
            <input
              placeholder="Qty"
              type="number"
              className="w-20 rounded border px-2 py-1 text-sm"
              value={row.quantity}
              onChange={(e) => updateRow(i, "quantity", e.target.value)}
            />
            <input
              placeholder="Unit price"
              type="number"
              step="0.01"
              className="w-28 rounded border px-2 py-1 text-sm"
              value={row.unitPrice}
              onChange={(e) => updateRow(i, "unitPrice", e.target.value)}
            />
            <button onClick={() => removeRow(i)} className="text-sm text-red-600">
              Remove
            </button>
          </div>
        ))}
        <button onClick={addRow} className="text-sm text-blue-600">
          + Add line
        </button>
        <p className="text-sm font-semibold">
          Total: ${runningTotal.toFixed(2)}
        </p>
      </div>

      {!draft && !showPicker && (
        <button
          onClick={handleDraftClick}
          disabled={loading || !hasValidItems}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          {loading ? "Drafting..." : "Draft quote email"}
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
          <button onClick={() => setShowPicker(false)} className="text-sm text-gray-600">
            Cancel
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {draft && draftContact && (
        <div className="space-y-2 rounded border p-3">
          <p className="text-sm font-semibold">Subject: {draft.subject}</p>
          <p className="whitespace-pre-wrap text-sm">{draft.body}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyEmail}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <a
              href={`mailto:${draftContact.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
              className="rounded border px-3 py-1 text-sm"
            >
              Send via email
            </a>
            <button
              onClick={logQuote}
              disabled={logStatus === "saving"}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              {logStatus === "saving"
                ? "Logging..."
                : logStatus === "success"
                  ? "Logged ✓"
                  : "Log this quote"}
            </button>
            <button
              onClick={() => {
                setDraft(null);
                setSelectedContactId("");
                setLogStatus("idle");
              }}
              className="text-sm text-gray-600"
            >
              Close
            </button>
          </div>
          {logStatus === "error" && (
            <p className="text-sm text-red-600">
              Failed to log this quote. Please try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire it into the account detail page**

In `src/app/(dashboard)/accounts/[id]/page.tsx`, the current file (after Phase 4a's merge) ends with a "Follow-up" section as the last `<div>` inside the outer `max-w-2xl space-y-6` wrapper, using `FollowUpEmailDraft`. Add the import:

```tsx
import { QuoteDraft } from "@/components/QuoteDraft";
```

And add a new section immediately after the "Follow-up" section's closing `</div>`, still inside the outer wrapper:

```tsx
      <div>
        <h2 className="mb-2 font-semibold">Quote</h2>
        <QuoteDraft accountId={id} contacts={account.contacts} onChange={load} />
      </div>
```

- [ ] **Step 4: Verify by hand**

Run: `npm run dev`, log in, visit an account that has a contact with an email. Confirm:
- A "Quote" section appears with one empty line-item row, an "+ Add line" button, and a running total that updates as you type.
- "Draft quote email" is disabled until at least one row has a description; clicking it (single contact with email) shows a loading state, then a preview whose body presents your exact line items and total.
- "Copy" copies the email text; "Send via email" opens a correctly addressed compose window.
- "Log this quote" saves an interaction, the button changes to "Logged ✓", and the account's History section (below) shows the new entry with the itemized notes — confirm this without a manual page reload (the `onChange={load}` wiring should refresh it automatically).
- On an account with two contacts that both have emails, the picker appears before drafting.
- On an account with no contact emails, only the "Add an email to a contact..." message appears — no line-item form, matching Phase 2's precedent for accounts without a usable contact.

- [ ] **Step 5: Commit**

```bash
git add src/components/InteractionForm.tsx src/components/QuoteDraft.tsx "src/app/(dashboard)/accounts/[id]/page.tsx"
git commit -m "Add quote drafting UI to account detail page"
```

---

## Post-plan check

After Task 3, the user should be able to: open any account with a contact email on file, type in a quote's line items, get an AI-drafted email presenting them accurately (no invented numbers), copy or send it, and optionally log it into that account's history — all reusing existing infrastructure, with zero schema changes. This completes the full originally-scoped roadmap (Phases 1-4b). Adding the user's real inherited customers remains the only open item from the very first conversation.
