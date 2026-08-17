import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ContactInput } from "@/types/account";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as ContactInput;

  if (!body.name || body.name.trim() === "") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const contact = await prisma.contact.create({
    data: {
      accountId: id,
      name: body.name,
      title: body.title ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json(contact, { status: 201 });
}
