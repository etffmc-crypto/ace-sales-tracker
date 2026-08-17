# AI-Drafted Follow-Up Emails — Design Spec

**Phase 2 of the "AI sales team" plan for outside sales at Ace Hardware (Harrisburg, PA).**

## Context

Phase 1 (account/lead tracker) is built, reviewed, and deployed. Accounts, contacts,
and interactions (visits/calls/emails, each with optional next-action + next-action
date) are already tracked, and the account list already sorts by soonest pending
follow-up.

This phase adds the "AI" part of the AI sales team: a way to turn a pending
follow-up into a ready-to-send email without the user having to write it from
scratch.

## Goals

- From an account's detail page, generate a follow-up email draft grounded in that
  account's most recent interaction (its notes and next-action text).
- Hand the draft to the user in a state they can review, edit, and send themselves —
  never send anything automatically.
- Support accounts with multiple contacts by letting the user pick the recipient.

## Non-goals

- No automatic/scheduled sending — every email is a manual, one-click-at-a-time
  action initiated by the user.
- No batch drafting across multiple accounts (deferred; the account list's existing
  "needs follow-up" sort is how the user finds who to follow up with).
- No persistence of drafts — each click generates fresh text; nothing is saved to
  the database.
- No real Gmail API integration (no OAuth, no Google Cloud project, no stored
  Google tokens) — see Architecture.

## Architecture

- **No new database model.** Drafting is stateless: generate on click, don't store.
- **New API route:** `POST /api/accounts/[id]/draft-email`
  - Body: `{ contactId: string }`
  - Requires an authenticated session (same `requireSession()` guard as every other
    route).
  - Builds a prompt from the account's name/type and the most recent interaction's
    notes + next-action text (if any interactions exist; if none, drafts a generic
    introductory follow-up instead).
  - Calls the Anthropic Messages API (model: a current Claude model, e.g. Claude
    Sonnet) server-side using an `ANTHROPIC_API_KEY` environment variable.
  - Returns `{ subject: string, body: string }`.
- **Email handoff: `mailto:` link, not the Gmail API.** The generated subject/body
  populate a `mailto:<contact-email>?subject=...&body=...` link. Clicking it opens
  the user's default mail handler (Gmail web, if set as default, or their desktop
  client) with a pre-filled compose window for final review/editing/sending. This
  was chosen over a real Gmail API integration specifically to avoid OAuth setup,
  Google Cloud project configuration, and token storage — the practical workflow
  (one click → review → send) is the same either way.

## UI / data flow

1. On the account detail page (`src/app/(dashboard)/accounts/[id]/page.tsx`), a
   "Draft follow-up email" button appears only if the account has at least one
   contact with a non-empty email address.
2. On click:
   - If exactly one contact has an email, it's used automatically.
   - If more than one contact has an email, a small inline picker appears first.
3. The app calls the draft-email route with the chosen `contactId`, shows a loading
   state, then displays the returned subject/body in a preview panel.
4. The preview panel has a "Send via email" button/link that builds and opens the
   `mailto:` link.
5. The user can dismiss the preview and re-draft (e.g. try again after editing an
   interaction's notes) without any state carrying over.

## Error handling

- No contact has an email on file → the button doesn't render; a small hint text
  suggests adding an email to a contact.
- Draft-email API call fails (network error, Anthropic API error, missing/invalid
  `ANTHROPIC_API_KEY`) → the preview panel shows an inline error message with a
  "Try again" action. No silent failure.
- Anthropic API key missing entirely → the route returns a clear 500 error
  (`"AI drafting is not configured"` or similar) rather than crashing; this keeps
  the rest of the app usable even before the key is set up.

## Testing

Following Phase 1's pragmatic approach:

- The prompt-building logic (turning account + interaction data into the text sent
  to the Anthropic API) is extracted as a pure function in `src/lib/` and unit
  tested — this is the one piece with real branching (has interactions vs. doesn't,
  has next-action vs. doesn't).
- The actual Anthropic API call, the API route, and the UI (button, picker, preview
  panel, mailto handoff) are verified manually via the dev server, not automated —
  consistent with how Phase 1 treated API routes and screens.

## Open items deferred to implementation

- Exact Anthropic model name/version to call — implementation plan will pick a
  current model and note it.
- Whether the user already has an `ANTHROPIC_API_KEY` — to be resolved during
  implementation, same as the Neon database connection string was in Phase 1.
