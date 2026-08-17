# Account/Lead Tracker — Design Spec

**Phase 1 of the "AI sales team" plan for outside sales at Ace Hardware (Harrisburg, PA).**

## Context

The user is starting fresh in an outside/commercial sales role at Ace Hardware in
Harrisburg, PA, selling to businesses (contractors, restaurants, property managers,
municipal accounts, etc.) on account. They inherited a small number of existing
customers from the previous rep and have internal sales history they can pull in
later, but nothing is tracked digitally today.

The long-term goal is an "AI team" covering:

1. Account/lead tracker (this spec)
2. Follow-up & CRM hygiene (visit logging, AI-drafted follow-ups)
3. Route/visit planning
4. Prospecting & proposals/quotes

Each phase is being designed and built separately. This spec covers **Phase 1 only**.

## Goals

- Give the user one place to track every business they sell to or are pursuing.
- Be usable from a laptop browser today; accessible from anywhere (hosted, not local-only).
- Be a real foundation (proper backend + data model) that later phases can build on,
  rather than a throwaway prototype.

## Non-goals (later phases)

- Follow-up email drafting / reminders
- Route planning
- Prospecting suggestions (finding new leads)
- Proposal/quote generation

## Architecture

- **Framework:** Next.js (App Router), TypeScript, single deployable app (frontend + API routes together).
- **Database:** Hosted Postgres, free tier (Supabase or Neon).
- **ORM:** Prisma, for schema + migrations.
- **Auth:** Single-user login (email + password) via NextAuth Credentials provider.
  No signup flow, no user management UI — one account, created via a seed script.
- **Hosting:** Vercel, free tier.
- **Styling:** Tailwind CSS (fast to build a clean, functional UI solo).

Account creation on Vercel/Supabase (or Neon) must be done by the user — Claude
cannot create accounts or enter credentials on their behalf. Claude will scaffold
the app, prepare it for deployment, and walk the user through the account-creation
and deploy steps.

## Data model

```
Account
  id            uuid, pk
  name          string, required
  addressLine   string, nullable
  city          string, default "Harrisburg"
  state         string, default "PA"
  zip           string, nullable
  phone         string, nullable
  accountType   enum: CONTRACTOR | RESTAURANT | PROPERTY_MGMT | MUNICIPAL | OTHER
  pipelineStage enum: PROSPECT | CONTACTED | QUOTED | ACTIVE_CUSTOMER | INACTIVE
  source        enum: INHERITED | PROSPECTED
  createdAt     datetime
  updatedAt     datetime

Contact
  id            uuid, pk
  accountId     fk -> Account
  name          string, required
  title         string, nullable
  phone         string, nullable
  email         string, nullable
  notes         text, nullable

Interaction
  id              uuid, pk
  accountId       fk -> Account
  date            datetime, required
  type            enum: VISIT | CALL | EMAIL
  notes           text, nullable
  nextAction      string, nullable
  nextActionDate  date, nullable
  createdAt       datetime
```

Indexes: `Account.pipelineStage`, `Account.accountType`, `Interaction.accountId`,
`Interaction.date`.

## Screens

1. **Login** — email + password, single user.
2. **Account list** (default view after login)
   - Table/list of accounts: name, type, pipeline stage, last interaction date, next action date.
   - Filter by pipeline stage and account type.
   - Search by name.
   - Sort by "needs follow-up" (soonest `nextActionDate` first) as default sort.
   - "New account" button.
3. **Account detail**
   - Business info (editable).
   - Contacts list (add/edit/remove inline).
   - Interaction timeline, newest first.
   - "Log a visit/call/email" form (type, date, notes, optional next action + date).
4. **New account form**
   - Same fields as Account detail's business info section.
   - Used both for adding the handful of inherited customers now and new prospects later.

## Error handling / non-functional

- All routes except login require an authenticated session; unauthenticated
  requests redirect to login.
- Form validation on required fields (account name; interaction date/type).
- Friendly empty states (e.g. "No accounts yet — add your first one") and error
  states (e.g. failed save shows an inline message, doesn't lose form input).
- No offline support in v1 — laptop/browser use is the primary target per the user.
- No mobile-specific layout work in v1, though Tailwind's responsive defaults mean
  it won't be unusable on a phone browser.

## Testing approach

Given this is a solo-use internal tool, testing is kept pragmatic rather than
full TDD ceremony on every screen:

- TypeScript strict mode across the app (compiler as first line of defense).
- Unit tests for data-logic that has real branching/risk of bugs:
  - Pipeline stage handling
  - "Needs follow-up" sort/ordering logic
  - Interaction timeline ordering
- No E2E test suite in v1.

## Open items deferred to implementation plan

- Exact seed data (the inherited customers) — user will provide when ready; app
  ships with an empty account list otherwise.
- Exact Supabase vs. Neon choice — functionally equivalent for this use case;
  implementation plan will pick one and note why.
