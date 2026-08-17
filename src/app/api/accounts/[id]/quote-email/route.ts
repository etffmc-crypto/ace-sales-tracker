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
