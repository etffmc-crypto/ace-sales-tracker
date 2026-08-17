"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProspectCard } from "@/components/ProspectCard";
import type { ProspectCandidate } from "@/lib/prospecting";
import type { AccountType } from "@prisma/client";

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
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Prospecting</h1>
      <div className="flex items-center gap-2">
        <select
          className="rounded border px-3 py-2"
          value={accountType}
          onChange={(e) => setAccountType(e.target.value as AccountType)}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={search}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {results && results.length === 0 && (
        <p className="text-gray-600">
          No new prospects found — try again later or try a different
          category.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="space-y-2">
          {results.map((candidate, i) => (
            <ProspectCard
              key={i}
              candidate={candidate}
              accountType={accountType}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
