import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";
import {
  buildFollowUpEmailPrompt,
  parseEmailDraftResponse,
} from "@/lib/followUpEmail";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = (await request.json()) as { contactId?: string };

  if (!body.contactId) {
    return NextResponse.json(
      { error: "contactId is required" },
      { status: 400 },
    );
  }

  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      contacts: true,
      interactions: { orderBy: { date: "desc" }, take: 1 },
    },
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

  const lastInteraction = account.interactions[0]
    ? {
        type: account.interactions[0].type,
        date: account.interactions[0].date.toISOString(),
        notes: account.interactions[0].notes,
        nextAction: account.interactions[0].nextAction,
      }
    : null;

  const prompt = buildFollowUpEmailPrompt({
    accountName: account.name,
    accountType: account.accountType,
    contactName: contact.name,
    lastInteraction,
  });

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
    return NextResponse.json(draft);
  } catch {
    return NextResponse.json(
      { error: "AI drafting failed. Please try again." },
      { status: 500 },
    );
  }
}
