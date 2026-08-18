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
import {
  Badge,
  EmptyState,
  ErrorNote,
  Icons,
  LoadingBlock,
  PageHeader,
  StageBadge,
  formatDate,
  initials,
} from "@/components/ui";

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
  const overdueCount = accounts.filter((a) => isOverdue(a.nextActionDate, new Date())).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="This week"
        subtitle="Accounts with a next action due in the next 7 days. Pick your stops and open them as a route."
      />

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      {loading ? (
        <div className="card px-5">
          <LoadingBlock label="Loading this week's visits…" />
        </div>
      ) : error ? null : accounts.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Icons.calendar}
            title="Nothing due this week"
            description="Nice work staying on top of it. New next actions you log will show up here."
            action={
              <Link href="/" className="btn-secondary">
                Back to accounts
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span className="font-medium text-gray-900">{accounts.length}</span>
            {accounts.length === 1 ? "account" : "accounts"} due
            {overdueCount > 0 && (
              <Badge tone="danger">
                {overdueCount} overdue
              </Badge>
            )}
          </div>

          <ul className="card divide-y divide-gray-100 overflow-hidden">
            {accounts.map((a) => {
              const overdue = isOverdue(a.nextActionDate, new Date());
              const usable = Boolean(a.addressLine);
              const isChecked = checked[a.id] ?? false;
              return (
                <li
                  key={a.id}
                  className={`flex items-start gap-3 px-4 py-3.5 transition sm:px-5 ${
                    isChecked ? "bg-gray-50/60" : ""
                  }`}
                >
                  <label className="mt-1 flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(a.id)}
                      disabled={!usable}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 accent-gray-900 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Include ${a.name} in route`}
                    />
                  </label>
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">
                    {initials(a.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link href={`/accounts/${a.id}`} className="link">
                        {a.name}
                      </Link>
                      <StageBadge stage={a.pipelineStage} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-gray-500">
                      {usable ? formatAddress(a) : "No address on file"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm tabular-nums ${overdue ? "font-medium text-red-600" : "text-gray-700"}`}>
                      {formatDate(a.nextActionDate)}
                    </p>
                    <p className="text-xs text-gray-400">{overdue ? "Overdue" : "Due"}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="card sticky bottom-4 flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">{checkedCount}</span> of{" "}
              {accounts.length} selected
              {tooManyStops && (
                <span className="ml-2 text-red-600">
                  Maps supports up to {MAX_MAPS_STOPS} stops — uncheck{" "}
                  {checkedCount - MAX_MAPS_STOPS} to continue.
                </span>
              )}
            </div>
            <button
              onClick={openRoute}
              disabled={!anyChecked || tooManyStops}
              className="btn-primary"
            >
              {Icons.map}
              Open route in Maps
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
