import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sortByNeedsFollowUp } from "@/lib/followUp";
import type { AccountInput, AccountListItem } from "@/types/account";
import type { AccountType, PipelineStage } from "@prisma/client";

export async function GET(request: NextRequest) {
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

  const items: AccountListItem[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    accountType: a.accountType,
    pipelineStage: a.pipelineStage,
    lastInteractionDate: a.interactions[0]?.date.toISOString() ?? null,
    nextActionDate: a.interactions[0]?.nextActionDate?.toISOString() ?? null,
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
