"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AccountListItem } from "@/types/account";

const STAGES = ["PROSPECT", "CONTACTED", "QUOTED", "ACTIVE_CUSTOMER", "INACTIVE"];
const TYPES = ["CONTRACTOR", "RESTAURANT", "PROPERTY_MGMT", "MUNICIPAL", "OTHER"];

export function AccountList() {
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [stage, setStage] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (type) params.set("type", type);
    if (q) params.set("q", q);

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/accounts?${params.toString()}`);
        const data = await res.json();
        setAccounts(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [stage, type, q]);

  return (
    <div>
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
                    ? new Date(a.lastInteractionDate).toLocaleDateString()
                    : "—"}
                </td>
                <td className="p-2">
                  {a.nextActionDate
                    ? new Date(a.nextActionDate).toLocaleDateString()
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
