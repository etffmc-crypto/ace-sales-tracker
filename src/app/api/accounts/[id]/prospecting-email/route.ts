import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";
import { buildProspectingEmailPrompt } from "@/lib/prospecting";
import { parseEmailDraftResponse } from "@/lib/followUpEmail";

export const maxDuration = 30;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const account = await prisma.account.findUnique({
    where: { id },
    select: { name: true, accountType: true },
  });

  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI drafting is not configured" },
      { status: 500 },
    );
  }

  const prompt = buildProspectingEmailPrompt(account.name, account.accountType);

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
  } catch (err) {
    console.error("prospecting-email failed", err);
    return NextResponse.json(
      { error: "AI drafting failed. Please try again." },
      { status: 500 },
    );
  }
}
