import Link from "next/link";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <nav className="flex items-center gap-4 border-b p-4">
        <Link href="/" className="font-semibold">
          Ace Sales Tracker
        </Link>
        <Link href="/accounts/new" className="text-blue-600">
          + New account
        </Link>
        <Link href="/this-week" className="text-blue-600">
          This week
        </Link>
      </nav>
      <div className="p-4">{children}</div>
    </div>
  );
}
