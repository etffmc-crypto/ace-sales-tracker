# Proposals/Quotes — Design Spec

**Phase 4b of the "AI sales team" plan for outside sales at Ace Hardware (Harrisburg, PA).**

(The other half of the originally-scoped "Phase 4" — prospecting — was built and
deployed separately as Phase 4a.)

## Context

Phases 1-4a (account/lead tracker, AI-drafted follow-up emails, route/visit
planning, prospecting) are built, reviewed, and deployed. The rep now wants
AI-assisted help drafting quotes for accounts already in the pipeline.

This app has never modeled products, SKUs, or pricing — there is no catalog.
Building one is explicitly out of scope for this phase (see Non-goals);
line items are entered by hand for each quote.

## Goals

- From an account's detail page, enter a quote's line items (description,
  quantity, unit price) and get an AI-drafted email presenting them to a
  chosen contact — professional framing and value language around the
  numbers, never inventing or altering the numbers themselves.
- Hand the drafted email to the user as text to copy or a `mailto:` link,
  matching the review-before-send principle already established in Phases
  2 and 4a — never sent automatically.
- Let the user save a sent quote into that account's interaction history, so
  there's a record of what was quoted and when, visible in the same timeline
  as visits/calls/other emails.

## Non-goals

- No product catalog, no SKUs, no saved pricing — every quote's line items
  are typed in from scratch each time.
- No PDF or other document generation — the quote is presented as an email
  body (an itemized list plus total), same distribution model as every other
  AI-drafted email in this app.
- No new Prisma model and no `InteractionType` enum change — a logged quote
  is stored as an ordinary `Interaction` row with `type: "EMAIL"`, its notes
  field holding the formatted line items and total. This reuses Phase 1's
  existing interaction-logging API entirely.
- No automatic pipeline-stage changes — logging a quote does not move an
  account to the `QUOTED` stage automatically; the user does that themselves
  via the existing "Move to QUOTED" button, same manual-control convention
  used everywhere else in this app.
- No tax, shipping, or discount calculation logic — the total is a simple
  sum of `quantity × unitPrice` across line items; anything beyond that
  (tax, delivery fees, negotiated discounts) is the user's responsibility to
  fold into a line item themselves if needed.
- No automatic/batch quoting, no quote editing/versioning after it's logged
  (the logged interaction is a historical record, not a live document).

## Architecture

- **New pure function:** `buildQuoteEmailPrompt(accountName: string, contactName: string, lineItems: { description: string; quantity: number; unitPrice: number }[], total: number): string`
  in `src/lib/quote.ts` — builds the prompt instructing Claude to write a
  professional quote email presenting the exact given line items and total
  verbatim (explicitly forbidding the model from inventing, rounding, or
  adjusting any number), addressed to the named contact, in the same
  `Subject: ... \n --- \n body` format Phase 2 established. Reuses Phase 2's
  existing `parseEmailDraftResponse` — no new parser.
- **New API route:** `POST /api/accounts/[id]/quote-email` — body
  `{ contactId: string, lineItems: { description, quantity, unitPrice }[] }`.
  Validates the contact belongs to the account and has an email, computes
  the total server-side (never trusts a client-supplied total), calls
  `buildQuoteEmailPrompt`, calls Anthropic (plain text generation, no tools
  — same shape as Phase 2's `draft-email` route), returns `{ subject, body }`.
- **Reuses existing infrastructure for logging:** saving a quote to history
  goes through the existing `POST /api/accounts/[id]/interactions` route
  (Phase 1) with `type: "EMAIL"` and a `notes` string built client-side from
  the line items and total (e.g. a simple itemized text block) — no new
  route, no schema change.

## UI / data flow

1. A new "Quote" section on the account detail page (alongside the existing
   Contacts, Follow-up, and History sections).
2. A simple line-item form: one row per item (description, quantity, unit
   price), an "Add line" button, a remove button per row, and a running
   total computed and displayed client-side as the user types.
3. A contact picker, same pattern as the existing follow-up-email feature
   (auto-selects if only one contact has an email; otherwise shows a
   dropdown) — the button that triggers drafting is disabled until at least
   one line item has a non-empty description and a contact is selected.
4. "Draft quote email" calls the new route and shows a preview: subject,
   body, a "Copy" button (primary), and a `mailto:` link to the selected
   contact's email (always available here, unlike prospecting, since the
   contact is a known existing `Contact` record with a real email).
5. A separate "Log this quote" button (shown once a draft exists) saves it
   to the account's interaction history via the existing interactions API,
   with a success confirmation. Logging and sending are independent actions
   — the user can log without sending, or copy/send without logging, in
   either order.

## Error handling

- No contacts with an email on file → same "add an email to a contact"
  message pattern as Phase 2's follow-up-email feature.
- No line items, or all line items have an empty description → the draft
  button stays disabled with no explicit error (matches the pattern of
  disabling rather than erroring used elsewhere, e.g. Phase 3's Maps button).
- Draft-email API failure → inline error, retry, consistent with every
  other AI-backed action in this app.
- Logging failure (the interactions API call) → inline error, retry;
  distinct from a draft failure since they're independent actions.
- Missing `ANTHROPIC_API_KEY` → the existing "AI drafting is not
  configured" 500 pattern, reused verbatim.

## Testing

Following the established pragmatic approach:

- `buildQuoteEmailPrompt` is a pure function with real branching (one line
  item vs. several; a line item with decimal pricing; the "never invent
  numbers" instruction actually present in the output) and gets a unit
  test. The total-computation logic (sum of `quantity × unitPrice`) is
  simple enough to verify inline within that same test file rather than
  needing its own module — no dedicated arithmetic function is being
  extracted for this.
- The route, the UI, and the logging flow are verified manually via the dev
  server, consistent with every other phase.

## Open items deferred to implementation

- Exact wording/formatting of the itemized `notes` text saved when logging
  a quote — implementer discretion, following the plain-text conventions
  already used in interaction notes elsewhere.
- Exact line-item form UI details (input widths, number formatting) —
  implementer discretion within established Tailwind/component conventions.
