import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import {
  buildProspectSearchPrompt,
  parseProspectSearchResponse,
  buildProspectingEmailPrompt,
  categoryForDate,
} from "@/lib/prospecting";
import { parseEmailDraftResponse } from "@/lib/followUpEmail";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("cron/prospect: ANTHROPIC_API_KEY not configured");
    return NextResponse.json(
      { error: "AI drafting is not configured" },
      { status: 500 },
    );
  }

  const accountType = categoryForDate(new Date());
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const existingAccounts = await prisma.account.findMany({
    select: { name: true },
  });
  const excludeNames = existingAccounts.map((a) => a.name);

  let candidates: ReturnType<typeof parseProspectSearchResponse> = [];
  try {
    const searchPrompt = buildProspectSearchPrompt(accountType, excludeNames);
    const searchMessage = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: searchPrompt }],
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

    if (
      searchMessage.stop_reason === "pause_turn" ||
      searchMessage.stop_reason === "max_tokens"
    ) {
      console.error(
        "cron/prospect: search incomplete",
        searchMessage.stop_reason,
      );
      return NextResponse.json({ accountType, foundCount: 0, addedCount: 0, draftedCount: 0 });
    }

    let text = "";
    for (const block of searchMessage.content) {
      if (block.type === "text") text += block.text + "\n";
    }
    candidates = parseProspectSearchResponse(text);
  } catch (err) {
    console.error("cron/prospect: search failed", err);
    return NextResponse.json({ accountType, foundCount: 0, addedCount: 0, draftedCount: 0 });
  }

  let addedCount = 0;
  let draftedCount = 0;

  for (const candidate of candidates) {
    let accountId: string;
    try {
      const account = await prisma.account.create({
        data: {
          name: candidate.name,
          addressLine: candidate.addressLine,
          city: candidate.city ?? "Harrisburg",
          state: candidate.state ?? "PA",
          zip: candidate.zip,
          phone: candidate.phone,
          accountType,
          source: "PROSPECTED",
        },
      });
      accountId = account.id;
      addedCount++;

      if (candidate.email) {
        await prisma.contact.create({
          data: {
            accountId,
            name: candidate.name,
            email: candidate.email,
            phone: candidate.phone,
          },
        });
      }
    } catch (err) {
      console.error(
        "cron/prospect: failed to add candidate",
        candidate.name,
        err,
      );
      continue;
    }

    try {
      const emailPrompt = buildProspectingEmailPrompt(
        candidate.name,
        accountType,
      );
      const emailMessage = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: emailPrompt }],
      });
      const textBlock = emailMessage.content.find(
        (block) => block.type === "text",
      );
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("no text block in draft response");
      }
      const draft = parseEmailDraftResponse(textBlock.text);
      await prisma.prospectDraft.create({
        data: {
          accountId,
          subject: draft.subject,
          body: draft.body,
          recipientEmail: candidate.email,
        },
      });
      draftedCount++;
    } catch (err) {
      console.error(
        "cron/prospect: failed to draft email for",
        candidate.name,
        err,
      );
    }
  }

  return NextResponse.json({
    accountType,
    foundCount: candidates.length,
    addedCount,
    draftedCount,
  });
}
