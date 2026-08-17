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
