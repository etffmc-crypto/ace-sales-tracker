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
