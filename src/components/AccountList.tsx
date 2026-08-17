"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AccountListItem } from "@/types/account";

const STAGES = ["PROSPECT", "CONTACTED", "QUOTED", "ACTIVE_CUSTOMER", "INACTIVE"];
const TYPES = ["CONTRACTOR", "RESTAURANT", "PROPERTY_MGMT", "MUNICIPAL", "OTHER"];

export function AccountList() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [stage, setStage] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (type) params.set("type", type);
    if (q) params.set("q", q);

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/accounts?${params.toString()}`);
        if (!res.ok || res.redirected) {
          // A non-ok response means the request failed outright. A
          // *redirected* response can still be `ok` (200) — that's what
          // happens when the session expired and the proxy redirected this
          // fetch to the login page: `fetch` follows it and returns the
          // login HTML with status 200, so `res.ok` alone won't catch it.
          // Either way, don't silently render an empty list.
          router.push("/login");
          return;
        }
        const data = await res.json();
        setAccounts(data);
      } catch {
        setError("Failed to load accounts. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [stage, type, q, router]);

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="mb-4 flex gap-2">
        <input
          placeholder="Search by name"
          className="rounded border px-3 py-2"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded border px-3 py-2"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="rounded border px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : accounts.length === 0 ? (
        <p className="text-gray-600">No accounts yet — add your first one.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="p-2">Name</th>
              <th className="p-2">Type</th>
              <th className="p-2">Stage</th>
              <th className="p-2">Last contact</th>
              <th className="p-2">Next action</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b hover:bg-gray-50">
                <td className="p-2">
                  <Link href={`/accounts/${a.id}`} className="text-blue-600">
                    {a.name}
                  </Link>
                </td>
                <td className="p-2">{a.accountType}</td>
                <td className="p-2">{a.pipelineStage}</td>
                <td className="p-2">
                  {a.lastInteractionDate
                    ? new Date(a.lastInteractionDate).toLocaleDateString(undefined, {
                        timeZone: "UTC",
                      })
                    : "—"}
                </td>
                <td className="p-2">
                  {a.nextActionDate
                    ? new Date(a.nextActionDate).toLocaleDateString(undefined, {
                        timeZone: "UTC",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
