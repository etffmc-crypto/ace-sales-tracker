# Automated Prospecting — Design Spec

**Phase 5 of the "AI sales team" plan for outside sales at Ace Hardware
(Harrisburg, PA).**

## Context

Phase 4a built manual prospecting: the rep picks a business category, triggers
a Claude web search, and individually clicks "Add as prospect" then "Draft
intro email" per candidate. The drafted email only ever lives in React
component state — it's gone the moment the rep navigates away.

The rep now wants this to run unattended: an agent that searches for new
prospects on its own during business hours, adds them, drafts the outreach
email, and leaves it somewhere the rep can find and review later — without
ever auto-sending anything, matching the review-before-send principle
established in every prior AI-drafted-email feature in this app.

## Goals

- Once each weekday morning, automatically search for new prospects, add
  each one found as an Account (+ Contact, if an email is available), and
  draft its cold-outreach email — with zero manual triggering.
- Persist every drafted email so it survives past the run that created it,
  in a "Needs review" queue the rep checks in the app.
- Reuse Phase 4a's search/draft logic and account/contact creation exactly —
  this phase changes who triggers it and where the result is stored, not
  what it does.

## Non-goals

- No real notification (push, SMS, or actual email-to-the-rep) when a draft
  is ready. The rep checks the in-app queue; no new external notification
  service is introduced.
- No sending of the drafted email by the system — identical to every other
  AI-drafted email in this app, the rep copies or uses the `mailto:` link
  themselves.
- No more-than-once-per-day scheduling. Vercel's free/Hobby plan limits
  scheduled jobs to one run per day; running more often is a possible
  future upgrade if the rep moves to a paid Vercel plan, not part of this
  phase.
- No persisted rotation state (e.g. "which category ran last"). The
  category is derived deterministically from the day of the week, so there
  is nothing to track between runs.
- No cap on candidates added per run beyond the search's own existing limit
  (up to 8) — every candidate found gets added and drafted.
- No changes to the manual prospecting flow (`ProspectCard`, the existing
  search UI) beyond adding the new queue section above it on the same page.
- No review-queue auto-expiry or automatic dismissal — a queued draft stays
  until the rep explicitly dismisses it.

## Architecture

- **New Prisma model — `ProspectDraft`:**
  ```
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
  `recipientEmail` is a snapshot of the candidate's email at draft time, not
  a live foreign key to `Contact` — the queue item keeps working even if
  the Contact is later edited or removed.

- **New pure function — `categoryForDate(date: Date): AccountType`** in
  `src/lib/prospecting.ts` — maps day-of-week to account type (Mon
  CONTRACTOR, Tue RESTAURANT, Wed PROPERTY_MGMT, Thu MUNICIPAL, Fri OTHER;
  weekends fall back to OTHER, though the cron schedule itself only fires
  on weekdays). Deterministic and stateless, so no persisted rotation
  cursor is needed.

- **New API route — `POST /api/cron/prospect`:** the Vercel Cron target.
  Auth is a `CRON_SECRET` bearer-token check (Vercel sends this
  automatically for cron-triggered requests when `CRON_SECRET` is set as
  an env var) instead of `requireSession` — this route has no browser
  caller. Logic:
  1. Compute today's category via `categoryForDate`.
  2. Run the existing search (`buildProspectSearchPrompt` +
     `parseProspectSearchResponse`), excluding all existing account names,
     exactly as `POST /api/prospects/search` does today.
  3. For each candidate returned: create the `Account` (`source:
     "PROSPECTED"`) and, if `candidate.email` is present, a `Contact` —
     identical to `ProspectCard.addProspect()`'s logic today.
  4. Draft the email via `buildProspectingEmailPrompt` +
     `parseEmailDraftResponse` (reused from Phase 2) and save a
     `ProspectDraft` row. If drafting fails for one candidate, the account
     it already created is kept (it just won't have a queued draft); the
     run continues with the remaining candidates.
  5. Return a small JSON summary (counts) for Vercel's cron log; all
     failures are caught and logged via `console.error`, never thrown
     past the route, since nothing is watching this run in real time.

- **`vercel.json`** — add a `crons` entry: `{"path": "/api/cron/prospect",
  "schedule": "0 13 * * 1-5"}` (approx. 9am US/Eastern; exact offset drifts
  by an hour across the DST boundary, which is an accepted approximation,
  not something worth compensating for).

- **New API route — `GET /api/prospect-drafts`** and **`POST
  /api/prospect-drafts/[id]/dismiss`:** list undismissed drafts (joined
  with their account's name/address for display) and mark one reviewed.
  Both behind `requireSession`, same as every other authenticated route.

## UI / data flow

1. The existing `/prospecting` page gains a "Needs review" section above
   today's manual search form, populated from `GET /api/prospect-drafts`.
2. Each queued item renders the same way a freshly-drafted `ProspectCard`
   result does today: account name/address, subject, body, a "Copy"
   button, and a `mailto:` link when `recipientEmail` is present.
3. A "Dismiss" button calls the dismiss route and removes the item from
   the list client-side — this only flips `reviewed`, it never deletes the
   `Account`, `Contact`, or the draft row itself.
4. If the queue is empty, the section shows a brief "Nothing to review
   right now" message rather than being hidden entirely (so the rep knows
   the feature is running, not broken).

## Error handling

- Cron route failures (search error, Anthropic API down, missing
  `ANTHROPIC_API_KEY`) are logged server-side only and end the run early;
  there is no user-facing error surface for an unattended job.
- `GET /api/prospect-drafts` / dismiss failures use the same inline-error
  pattern as every other route in this app.
- An invalid or missing `CRON_SECRET` on the cron route returns 401,
  identical in spirit to `requireSession`'s handling on every other route.

## Testing

Following the established pragmatic approach:

- `categoryForDate` is a pure function with real branching (all five
  weekdays plus the weekend fallback) and gets a unit test.
- The cron route's per-candidate loop, the review queue UI, and the
  end-to-end scheduled run are verified manually via the dev server
  (triggering the cron route directly with the right header, since Vercel
  Cron itself can't be simulated locally) — consistent with every other
  phase's route/UI testing approach.

## Open items deferred to implementation

- Exact wording of the "Nothing to review" empty state — implementer
  discretion, matching existing empty-state copy elsewhere in this app.
- Whether `GET /api/prospect-drafts` returns account fields inline or the
  UI fetches them separately — implementer discretion; inline is simpler
  and avoids N+1 fetches.
