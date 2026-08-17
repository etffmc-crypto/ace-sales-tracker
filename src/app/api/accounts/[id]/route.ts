import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextValidStages } from "@/lib/pipeline";
import { earliestPendingDateByAccount } from "@/lib/followUp";
import { requireSession } from "@/lib/requireSession";
import type { AccountDetail, AccountInput } from "@/types/account";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      contacts: true,
      interactions: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Project onto AccountDetail rather than returning the raw Prisma object,
  // which has neither lastInteractionDate nor nextActionDate — those are
  // derived here from the included interactions (same "earliest pending
  // date" logic used by the account list route), so the type is honest.
  const nextActionMap = earliestPendingDateByAccount(
    account.interactions
      .filter((i) => i.nextActionDate !== null)
      .map((i) => ({
        accountId: account.id,
        nextActionDate: i.nextActionDate as Date,
      })),
  );

  const detail: AccountDetail = {
    id: account.id,
    name: account.name,
    accountType: account.accountType,
    pipelineStage: account.pipelineStage,
    lastInteractionDate: account.interactions[0]?.date.toISOString() ?? null,
    nextActionDate: nextActionMap.get(account.id)?.toISOString() ?? null,
    addressLine: account.addressLine,
    city: account.city,
    state: account.state,
    zip: account.zip,
    phone: account.phone,
    source: account.source,
    contacts: account.contacts,
    interactions: account.interactions.map((i) => ({
      id: i.id,
      date: i.date.toISOString(),
      type: i.type,
      notes: i.notes,
      nextAction: i.nextAction,
      nextActionDate: i.nextActionDate ? i.nextActionDate.toISOString() : null,
    })),
  };

  return NextResponse.json(detail);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = (await request.json()) as Partial<AccountInput>;

  if (body.pipelineStage) {
    const current = await prisma.account.findUnique({
      where: { id },
      select: { pipelineStage: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const allowed = nextValidStages(current.pipelineStage);
    if (
      body.pipelineStage !== current.pipelineStage &&
      !allowed.includes(body.pipelineStage)
    ) {
      return NextResponse.json(
        { error: `Cannot move from ${current.pipelineStage} to ${body.pipelineStage}` },
        { status: 400 },
      );
    }
  }

  const account = await prisma.account.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(account);
}
