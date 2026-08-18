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
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("cron/prospect: CRON_SECRET not configured");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
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

  type CreatedCandidate = {
    candidate: (typeof candidates)[number];
    accountId: string;
  };
  const created: CreatedCandidate[] = [];

  // Phase 1: create Account + Contact sequentially, per-candidate isolated.
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
    } catch (err) {
      console.error(
        "cron/prospect: failed to add candidate",
        candidate.name,
        err,
      );
      continue;
    }

    if (candidate.email) {
      try {
        await prisma.contact.create({
          data: {
            accountId,
            name: candidate.name,
            email: candidate.email,
            phone: candidate.phone,
          },
        });
      } catch (err) {
        console.error(
          "cron/prospect: failed to create contact for",
          candidate.name,
          err,
        );
      }
    }

    created.push({ candidate, accountId });
  }

  // Phase 2: draft intro emails concurrently so ~8 sequential AI calls
  // collapse into roughly one call's wall-clock time, keeping us well
  // within maxDuration. Each draft is isolated in its own try/catch so
  // one candidate's failure can't affect any other candidate's draft.
  const draftResults = await Promise.allSettled(
    created.map(async ({ candidate, accountId }) => {
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
    }),
  );

  draftResults.forEach((result, i) => {
    if (result.status === "fulfilled") {
      draftedCount++;
    } else {
      console.error(
        "cron/prospect: failed to draft email for",
        created[i].candidate.name,
        result.reason,
      );
    }
  });

  return NextResponse.json({
    accountType,
    foundCount: candidates.length,
    addedCount,
    draftedCount,
  });
}
