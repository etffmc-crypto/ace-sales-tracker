"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AccountListItem } from "@/types/account";
import { isDueForVisit, isOverdue } from "@/lib/routePlanning";
import {
  Badge,
  EmptyState,
  ErrorNote,
  Icons,
  PageHeader,
  StageBadge,
  formatDate,
  initials,
  stageLabel,
  typeLabel,
} from "@/components/ui";

const STAGES = ["PROSPECT", "CONTACTED", "QUOTED", "ACTIVE_CUSTOMER", "INACTIVE"];
const TYPES = ["CONTRACTOR", "RESTAURANT", "PROPERTY_MGMT", "MUNICIPAL", "OTHER"];

function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const accent = {
    neutral: "text-gray-900",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-red-600",
  }[tone];
  return (
    <div className="card px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${accent}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="skeleton h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-2.5 w-1/5" />
          </div>
          <div className="skeleton h-5 w-20 rounded-full" />
          <div className="skeleton hidden h-3 w-20 sm:block" />
          <div className="skeleton hidden h-3 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

export function AccountList() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [allAccounts, setAllAccounts] = useState<AccountListItem[] | null>(null);
  const [stage, setStage] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Unfiltered snapshot for the summary tiles.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/accounts");
        if (!res.ok || res.redirected) return;
        const data: AccountListItem[] = await res.json();
        setAllAccounts(data);
      } catch {
        // Tiles are decorative; ignore failures here (the list handles errors).
      }
    })();
  }, []);

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

  const now = new Date();
  const stats = allAccounts
    ? {
        total: allAccounts.length,
        active: allAccounts.filter((a) => a.pipelineStage === "ACTIVE_CUSTOMER").length,
        dueThisWeek: allAccounts.filter(
          (a) => isDueForVisit(a.nextActionDate, now, 7) && !isOverdue(a.nextActionDate, now),
        ).length,
        overdue: allAccounts.filter((a) => isOverdue(a.nextActionDate, now)).length,
      }
    : null;

  const filtersActive = Boolean(stage || type || q);

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Every account and lead you're working, in one place."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total accounts" value={stats ? stats.total : "—"} />
        <StatTile
          label="Active customers"
          value={stats ? stats.active : "—"}
          tone="success"
        />
        <StatTile
          label="Due this week"
          value={stats ? stats.dueThisWeek : "—"}
          hint="Next actions in the next 7 days"
          tone="warning"
        />
        <StatTile
          label="Overdue"
          value={stats ? stats.overdue : "—"}
          hint="Past their next-action date"
          tone={stats && stats.overdue > 0 ? "danger" : "neutral"}
        />
      </div>

      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-gray-100 p-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              {Icons.search}
            </span>
            <input
              placeholder="Search accounts…"
              className="input pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search by name"
            />
          </label>
          <div className="flex gap-2">
            <select
              className="select sm:w-44"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              aria-label="Filter by stage"
            >
              <option value="">All stages</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {stageLabel(s)}
                </option>
              ))}
            </select>
            <select
              className="select sm:w-48"
              value={type}
              onChange={(e) => setType(e.target.value)}
              aria-label="Filter by type"
            >
              <option value="">All types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
            {filtersActive && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setQ("");
                  setStage("");
                  setType("");
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <SkeletonRows />
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={Icons.building}
            title={filtersActive ? "No accounts match these filters" : "No accounts yet"}
            description={
              filtersActive
                ? "Try a different search or clear the filters."
                : "Add your first account to start tracking visits, calls and quotes."
            }
            action={
              filtersActive ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setQ("");
                    setStage("");
                    setType("");
                  }}
                >
                  Clear filters
                </button>
              ) : (
                <Link href="/accounts/new" className="btn-primary">
                  {Icons.plus}
                  New account
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="eyebrow px-5 py-2.5 font-medium">Account</th>
                  <th className="eyebrow px-4 py-2.5 font-medium">Type</th>
                  <th className="eyebrow px-4 py-2.5 font-medium">Stage</th>
                  <th className="eyebrow px-4 py-2.5 font-medium">Last contact</th>
                  <th className="eyebrow px-4 py-2.5 font-medium">Next action</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accounts.map((a) => {
                  const overdue = isOverdue(a.nextActionDate, now);
                  const dueSoon = !overdue && isDueForVisit(a.nextActionDate, now, 7);
                  return (
                    <tr key={a.id} className="group transition hover:bg-gray-50/70">
                      <td className="px-5 py-3">
                        <Link href={`/accounts/${a.id}`} className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">
                            {initials(a.name)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-gray-900 group-hover:underline group-hover:underline-offset-4">
                              {a.name}
                            </span>
                            <span className="block truncate text-xs text-gray-500">
                              {[a.addressLine, a.city].filter(Boolean).join(", ") || `${a.city}, ${a.state}`}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{typeLabel(a.accountType)}</td>
                      <td className="px-4 py-3">
                        <StageBadge stage={a.pipelineStage} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-600">
                        {formatDate(a.lastInteractionDate)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {a.nextActionDate ? (
                          <span className="flex items-center gap-2">
                            <span className={overdue ? "font-medium text-red-600" : "text-gray-600"}>
                              {formatDate(a.nextActionDate)}
                            </span>
                            {overdue && <Badge tone="danger">Overdue</Badge>}
                            {dueSoon && <Badge tone="warning">This week</Badge>}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-300 group-hover:text-gray-500">
                        <Link href={`/accounts/${a.id}`} aria-label={`Open ${a.name}`}>
                          {Icons.arrowRight}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-gray-100 px-5 py-2.5 text-xs text-gray-500">
              {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
              {filtersActive ? " match" : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
