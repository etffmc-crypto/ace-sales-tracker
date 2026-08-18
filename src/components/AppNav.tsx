"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Icons } from "@/components/ui";

const LINKS = [
  { href: "/", label: "Accounts", match: (p: string) => p === "/" || p.startsWith("/accounts") },
  { href: "/this-week", label: "This week", match: (p: string) => p.startsWith("/this-week") },
  { href: "/prospecting", label: "Prospecting", match: (p: string) => p.startsWith("/prospecting") },
];

export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-11 w-11 text-lg" : size === "sm" ? "h-7 w-7 text-xs" : "h-8 w-8 text-sm";
  return (
    <span
      className={`${dims} inline-flex items-center justify-center rounded-lg bg-brand font-bold text-white shadow-sm ring-1 ring-black/5`}
      aria-hidden="true"
    >
      A
    </span>
  );
}

export function AppNav() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-sm font-semibold tracking-tight text-gray-900">
            Ace Sales Tracker
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 sm:flex" aria-label="Main">
          {LINKS.map((l) => {
            const active = l.match(pathname);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/accounts/new" className="btn-primary btn-sm">
            {Icons.plus}
            <span>New account</span>
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="btn-ghost btn-sm"
            title="Sign out"
          >
            {Icons.logout}
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <nav
        className="flex gap-1 overflow-x-auto border-t border-gray-100 px-3 py-1.5 sm:hidden"
        aria-label="Main mobile"
      >
        {LINKS.map((l) => {
          const active = l.match(pathname);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                active ? "bg-gray-100 text-gray-900" : "text-gray-500"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
