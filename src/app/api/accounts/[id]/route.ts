import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextValidStages } from "@/lib/pipeline";
import type { AccountInput } from "@/types/account";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      contacts: true,
      interactions: { orderBy: { date: "desc" } },
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(account);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
