import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sortByNeedsFollowUp, earliestPendingDateByAccount } from "@/lib/followUp";
import { requireSession } from "@/lib/requireSession";
import type { AccountInput, AccountListItem } from "@/types/account";
import type { AccountType, PipelineStage } from "@prisma/client";

export async function GET(request: NextRequest) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const params = request.nextUrl.searchParams;
  const stage = params.get("stage") as PipelineStage | null;
  const type = params.get("type") as AccountType | null;
  const q = params.get("q");

  const accounts = await prisma.account.findMany({
    where: {
      ...(stage ? { pipelineStage: stage } : {}),
      ...(type ? { accountType: type } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    include: {
      interactions: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  // The list's "next action" column must reflect the earliest still-pending
  // follow-up across ALL of an account's interactions, not just the latest
  // one — an older commitment must not disappear just because a newer
  // interaction with no next-action date was logged. Fetch every pending
  // (non-null nextActionDate) interaction for these accounts separately from
  // the "most recent interaction" lookup above, which stays lastInteractionDate-only.
  const pendingInteractions = await prisma.interaction.findMany({
    where: {
      accountId: { in: accounts.map((a) => a.id) },
      nextActionDate: { not: null },
    },
    select: { accountId: true, nextActionDate: true },
  });
  const pendingByAccount = earliestPendingDateByAccount(
    pendingInteractions.map((i) => ({
      accountId: i.accountId,
      nextActionDate: i.nextActionDate as Date,
    })),
  );

  const items: AccountListItem[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    accountType: a.accountType,
    pipelineStage: a.pipelineStage,
    addressLine: a.addressLine,
    city: a.city,
    state: a.state,
    zip: a.zip,
    lastInteractionDate: a.interactions[0]?.date.toISOString() ?? null,
    nextActionDate: pendingByAccount.get(a.id)?.toISOString() ?? null,
  }));

  const sorted = sortByNeedsFollowUp(
    items.map((i) => ({
      ...i,
      nextActionDate: i.nextActionDate ? new Date(i.nextActionDate) : null,
    })),
  ).map((i) => ({
    ...i,
    nextActionDate: i.nextActionDate ? i.nextActionDate.toISOString() : null,
  }));

  return NextResponse.json(sorted);
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const body = (await request.json()) as AccountInput;

  if (!body.name || body.name.trim() === "") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const account = await prisma.account.create({
    data: {
      name: body.name,
      addressLine: body.addressLine ?? null,
      city: body.city ?? "Harrisburg",
      state: body.state ?? "PA",
      zip: body.zip ?? null,
      phone: body.phone ?? null,
      accountType: body.accountType ?? "OTHER",
      pipelineStage: body.pipelineStage ?? "PROSPECT",
      source: body.source ?? "PROSPECTED",
    },
  });

  return NextResponse.json(account, { status: 201 });
}
