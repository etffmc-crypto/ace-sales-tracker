import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Defense-in-depth auth check for API route handlers. `src/proxy.ts` already
 * gates every non-login route at the edge, but route handlers should not
 * rely solely on that — this gives each handler its own guard.
 *
 * Usage:
 *   const unauthorized = await requireSession();
 *   if (unauthorized) return unauthorized;
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
