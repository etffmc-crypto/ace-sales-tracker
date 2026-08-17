import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";
import type { InteractionInput } from "@/types/account";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = (await request.json()) as InteractionInput;

  if (!body.date || !body.type) {
    return NextResponse.json(
      { error: "date and type are required" },
      { status: 400 },
    );
  }

  const interaction = await prisma.interaction.create({
    data: {
      accountId: id,
      date: new Date(body.date),
      type: body.type,
      notes: body.notes ?? null,
      nextAction: body.nextAction ?? null,
      nextActionDate: body.nextActionDate ? new Date(body.nextActionDate) : null,
    },
  });

  return NextResponse.json(interaction, { status: 201 });
}
