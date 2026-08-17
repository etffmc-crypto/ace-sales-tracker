"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  isDueForVisit,
  isOverdue,
  buildMapsRouteUrl,
  MAX_MAPS_STOPS,
} from "@/lib/routePlanning";
import type { AccountListItem } from "@/types/account";

function formatAddress(account: AccountListItem): string {
  return [
    account.addressLine,
    `${account.city}, ${account.state} ${account.zip ?? ""}`.trim(),
  ]
    .filter(Boolean)
    .join(", ");
}

export default function ThisWeekPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok || res.redirected) {
          router.push("/login");
          return;
        }
        const data: AccountListItem[] = await res.json();
        const due = data.filter((a) =>
          isDueForVisit(a.nextActionDate, new Date(), 7),
        );
        setAccounts(due);
        const initialChecked: Record<string, boolean> = {};
        for (const a of due) {
          initialChecked[a.id] = Boolean(a.addressLine);
        }
        setChecked(initialChecked);
      } catch {
        setError("Failed to load accounts. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openRoute() {
    const selected = accounts.filter((a) => checked[a.id]);
    const addresses = selected.map(formatAddress);
    window.open(buildMapsRouteUrl(addresses), "_blank");
  }

  const checkedCount = Object.values(checked).filter(Boolean).length;
  const anyChecked = checkedCount > 0;
  const tooManyStops = checkedCount > MAX_MAPS_STOPS;

  if (loading) return <p>Loading...</p>;

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">This week</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {error ? null : accounts.length === 0 ? (
        <p className="text-gray-600">
          Nothing due this week — nice work staying on top of it.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {accounts.map((a) => {
              const overdue = isOverdue(a.nextActionDate, new Date());
              const usable = Boolean(a.addressLine);
              return (
                <li
                  key={a.id}
                  className="flex items-start gap-2 rounded border p-2"
                >
                  <input
                    type="checkbox"
                    checked={checked[a.id] ?? false}
                    onChange={() => toggle(a.id)}
                    disabled={!usable}
                    className="mt-1"
                  />
                  <div>
                    <Link href={`/accounts/${a.id}`} className="text-blue-600">
                      {a.name}
                    </Link>
                    <p className="text-sm text-gray-600">
                      {usable ? formatAddress(a) : "No address on file"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {overdue ? "Overdue — " : "Due "}
                      {a.nextActionDate
                        ? new Date(a.nextActionDate).toLocaleDateString(
                            undefined,
                            { timeZone: "UTC" },
                          )
                        : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {tooManyStops && (
            <p className="text-sm text-red-600">
              Maps supports up to {MAX_MAPS_STOPS} stops at once — uncheck{" "}
              {checkedCount - MAX_MAPS_STOPS} to continue.
            </p>
          )}
          <button
            onClick={openRoute}
            disabled={!anyChecked || tooManyStops}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Open route in Maps
          </button>
        </>
      )}
    </div>
  );
}
