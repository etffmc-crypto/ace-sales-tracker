import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-gray-400 sm:px-6">
        Ace Sales Tracker · Harrisburg, PA
      </footer>
    </div>
  );
}
