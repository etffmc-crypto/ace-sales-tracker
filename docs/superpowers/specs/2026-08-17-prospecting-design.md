# Prospecting — Design Spec

**Phase 4a of the "AI sales team" plan for outside sales at Ace Hardware (Harrisburg, PA).**

(The other half of the originally-scoped "Phase 4" — AI-assisted proposals/quotes —
is deferred to a separate phase, brainstormed and built later.)

## Context

Phases 1-3 (account/lead tracker, AI-drafted follow-up emails, route/visit
planning) are built, reviewed, and deployed. The rep now wants help finding
*new* businesses to target, not just managing existing accounts.

## Goals

- Given an account type (contractor, restaurant, property management,
  municipal, other), find real businesses of that type in the Harrisburg, PA
  area that aren't already in the tracker.
- Let the user add any candidate as a new prospect account with one click.
- Once added, draft a cold-outreach email introducing Ace Hardware, its
  value to that business, and that Ace Hardware is a PA COSTARS vendor —
  informational, not a question to the prospect.
- Hand the drafted email to the user as text to copy (primary) or a
  `mailto:` link (when a usable email address was found) — never sent
  automatically, matching Phase 2's review-before-send principle.

## Non-goals

- No proposal/quote generation (deferred to a later phase).
- No new external API key/billing beyond the `ANTHROPIC_API_KEY` already
  configured (Phase 2) — search uses Claude's built-in web search tool
  rather than a dedicated business-data API (e.g. Google Places), which
  would need its own Google Cloud project and billing setup.
- No automatic/scheduled searching or batch prospecting — one search, one
  account type, on demand.
- No persistence of search results that aren't added as accounts — an
  unadded candidate is simply gone if the user navigates away; re-searching
  the same category may surface it again.
- No deduplication guarantee beyond "ask the model to exclude names that
  match existing accounts" — this is a best-effort instruction to the
  model, not a hard database constraint (`Account.name` has no unique
  constraint, consistent with existing schema).

## Architecture

- **New pure functions in `src/lib/prospecting.ts`:**
  - `buildProspectSearchPrompt(accountType: AccountType, excludeNames: string[]): string`
    — builds the prompt instructing Claude to use web search to find real
    businesses of the given type in the Harrisburg, PA area, excluding any
    name matching (case-insensitively) the given list, and to reply with a
    JSON array of candidates.
  - `parseProspectSearchResponse(text: string): ProspectCandidate[]` — parses
    Claude's JSON-array reply into
    `{ name: string; addressLine: string | null; city: string | null; state: string | null; zip: string | null; phone: string | null; website: string | null; notes: string | null }[]`,
    falling back to an empty array on malformed output (never throws —
    a parsing failure should surface as "no results," not a crash).
  - `buildProspectingEmailPrompt(businessName: string, accountType: AccountType): string`
    — builds the cold-outreach email prompt (introduce Ace Hardware, explain
    value/offerings relevant to that business type, state that Ace Hardware
    is a PA COSTARS-registered vendor). Reuses Phase 2's existing
    `parseEmailDraftResponse` (same `Subject: ... \n --- \n body` contract)
    rather than a new parser.
- **New API route:** `POST /api/prospects/search` — body `{ accountType: AccountType }`.
  Server-side: fetches existing account names via Prisma (to build the
  exclude list), calls the Anthropic Messages API with the web search tool
  enabled, calls `parseProspectSearchResponse` on the result, returns the
  candidate array.
- **New API route:** `POST /api/accounts/[id]/prospecting-email` — no
  `contactId` needed (unlike Phase 2's follow-up emails, which target a
  known contact). Calls `buildProspectingEmailPrompt` with the account's
  name/type, calls Anthropic, parses with Phase 2's `parseEmailDraftResponse`,
  returns `{ subject, body }`.
- **Reuses existing infrastructure:** account creation goes through the
  existing `POST /api/accounts` route (Phase 1) with `source: "PROSPECTED"`
  — no new account-creation logic.

## UI / data flow

1. A new "Prospecting" nav link leads to a new page.
2. A dropdown/select for account type (same five values used elsewhere:
   CONTRACTOR, RESTAURANT, PROPERTY_MGMT, MUNICIPAL, OTHER) plus a "Search"
   button.
3. On search: results render as cards — business name, whatever
   address/phone/website was found (each optional, shown only if present),
   and an "Add as prospect" button.
4. Clicking "Add as prospect" calls the existing accounts API to create the
   account (`source: PROSPECTED`, `pipelineStage: PROSPECT`, the selected
   `accountType`, and whatever address fields were found). The card updates
   to show "Added" and reveals a "Draft intro email" button.
5. Clicking "Draft intro email" calls the new prospecting-email route and
   shows the result: subject + body text, a "Copy" button (primary action —
   copies the full email to the clipboard for pasting into a contact form,
   a personal email client, wherever), and — only if a usable email/website
   contact was found among the search result's fields — a `mailto:` link as
   a secondary option.

## Error handling

- Zero results for a category → friendly message ("No new \<type\> prospects
  found — try again later or try a different category.").
- Search or draft-email failures → inline error message with a retry
  option, consistent with Phase 2's pattern.
- Missing `ANTHROPIC_API_KEY` → the existing clear "AI drafting is not
  configured" — style 500 response, reused verbatim from Phase 2's routes.
- A candidate the model returns with a name matching an existing account
  (the exclude-list instruction failing) is not specially handled beyond
  what the account-creation route already does (it just creates another
  account with that name — no uniqueness constraint exists, consistent with
  current schema) — acceptable given this is a best-effort exclusion, not a
  hard guarantee.

## Testing

Following the established pragmatic approach:

- `buildProspectSearchPrompt`, `parseProspectSearchResponse`, and
  `buildProspectingEmailPrompt` are pure functions with real branching
  (empty exclude list vs. populated; well-formed JSON vs. malformed) and
  get unit tests.
- The two new API routes and the new page are verified manually via the dev
  server, consistent with every other phase.

## Open items deferred to implementation

- Exact wording of the "Add as prospect"/"Draft intro email" UI and the
  cold-email's tone — implementer discretion within established
  conventions, following the same Tailwind/component patterns as Phases
  1-3.
- Exact Claude web-search tool configuration (e.g. any max-uses limit) —
  implementation plan will pick reasonable defaults and note them.
