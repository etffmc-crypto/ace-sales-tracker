import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";
import {
  buildProspectSearchPrompt,
  parseProspectSearchResponse,
} from "@/lib/prospecting";
import type { AccountType } from "@prisma/client";

export const maxDuration = 60;

const VALID_TYPES: AccountType[] = [
  "CONTRACTOR",
  "RESTAURANT",
  "PROPERTY_MGMT",
  "MUNICIPAL",
  "OTHER",
];

export async function POST(request: NextRequest) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as { accountType?: string };
  if (
    !body.accountType ||
    !VALID_TYPES.includes(body.accountType as AccountType)
  ) {
    return NextResponse.json(
      { error: "A valid accountType is required" },
      { status: 400 },
    );
  }
  const accountType = body.accountType as AccountType;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI drafting is not configured" },
      { status: 500 },
    );
  }

  const existingAccounts = await prisma.account.findMany({
    select: { name: true },
  });
  const excludeNames = existingAccounts.map((a) => a.name);

  const prompt = buildProspectSearchPrompt(accountType, excludeNames);

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
          user_location: {
            type: "approximate",
            city: "Harrisburg",
            region: "Pennsylvania",
            country: "US",
            timezone: "America/New_York",
          },
        },
      ],
    });

    let text = "";
    for (const block of message.content) {
      if (block.type === "text") {
        text += block.text + "\n";
      }
    }

    const candidates = parseProspectSearchResponse(text);
    return NextResponse.json(candidates);
  } catch (err) {
    console.error("prospect search failed", err);
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 },
    );
  }
}
