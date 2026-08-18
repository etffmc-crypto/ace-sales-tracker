import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/requireSession";
import type { ProspectDraftListItem } from "@/types/account";

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const drafts = await prisma.prospectDraft.findMany({
    where: { reviewed: false },
    orderBy: { createdAt: "desc" },
    include: {
      account: {
        select: {
          id: true,
          name: true,
          addressLine: true,
          city: true,
          state: true,
          zip: true,
        },
      },
    },
  });

  const items: ProspectDraftListItem[] = drafts.map((d) => ({
    id: d.id,
    subject: d.subject,
    body: d.body,
    recipientEmail: d.recipientEmail,
    account: d.account,
  }));

  return NextResponse.json(items);
}
