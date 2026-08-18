"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProspectCard } from "@/components/ProspectCard";
import { ProspectDraftQueue } from "@/components/ProspectDraftQueue";
import type { ProspectCandidate } from "@/lib/prospecting";
import type { AccountType } from "@prisma/client";
import {
  Card,
  EmptyState,
  ErrorNote,
  Icons,
  PageHeader,
  Spinner,
  typeLabel,
} from "@/components/ui";

const TYPES: AccountType[] = [
  "CONTRACTOR",
  "RESTAURANT",
  "PROPERTY_MGMT",
  "MUNICIPAL",
  "OTHER",
];

export default function ProspectingPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("CONTRACTOR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ProspectCandidate[] | null>(null);

  async function search() {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/prospects/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType }),
      });
      if (res.redirected) {
        router.push("/login");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          (data && typeof data.error === "string" && data.error) ||
            "Search failed. Please try again.",
        );
        return;
      }
      setResults(data);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Prospecting"
        subtitle="Find new local businesses to reach out to, and review drafts the automated prospector has queued up."
      />

      <ProspectDraftQueue />

      <Card
        title="Find new prospects"
        description="Searches for local businesses in the selected category that aren't already in your accounts."
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            className="select sm:w-60"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as AccountType)}
            aria-label="Business category"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
          <button onClick={search} disabled={loading} className="btn-primary">
            {loading ? <Spinner /> : Icons.sparkles}
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

        {results && results.length === 0 && (
          <div className="mt-2">
            <EmptyState
              icon={Icons.search}
              title="No new prospects found"
              description="Try again later or try a different category."
            />
          </div>
        )}
      </Card>

      {results && results.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
            {results.length} {results.length === 1 ? "result" : "results"}
          </p>
          <ul className="space-y-3">
            {results.map((candidate, i) => (
              <ProspectCard
                key={i}
                candidate={candidate}
                accountType={accountType}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
