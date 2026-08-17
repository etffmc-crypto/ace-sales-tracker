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
