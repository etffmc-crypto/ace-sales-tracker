"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { nextValidStages, PIPELINE_ORDER, type PipelineStage } from "@/lib/pipeline";
import { InteractionTimeline } from "@/components/InteractionTimeline";
import { InteractionForm } from "@/components/InteractionForm";
import { ContactList } from "@/components/ContactList";
import { AccountForm } from "@/components/AccountForm";
import { FollowUpEmailDraft } from "@/components/FollowUpEmailDraft";
import { QuoteDraft } from "@/components/QuoteDraft";
import type { AccountDetail, AccountInput } from "@/types/account";
import Link from "next/link";
import { isOverdue } from "@/lib/routePlanning";
import {
  Badge,
  Card,
  EmptyState,
  Icons,
  LoadingBlock,
  StageBadge,
  formatDate,
  humanize,
  initials,
  stageLabel,
  typeLabel,
} from "@/components/ui";

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/accounts/${id}`);
    if (res.status === 404) {
      // The body of a 404 is `{ error: "Not found" }` — truthy JSON that
      // must NOT be accepted as a real account (downstream components like
      // ContactList assume account.contacts exists).
      setNotFound(true);
      return;
    }
    if (!res.ok || res.redirected) {
      // A non-ok response means the request failed outright. A *redirected*
      // response can still be `ok` (200) — that's what happens when the
      // session expired and the proxy redirected this fetch to the login
      // page: `fetch` follows it and returns the login HTML with status
      // 200, so `res.ok` alone won't catch it.
      router.push("/login");
      return;
    }
    setNotFound(false);
    const data = await res.json();
    setAccount(data);
  }, [id, router]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  if (notFound)
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card">
          <EmptyState
            icon={Icons.building}
            title="Account not found"
            description="It may have been removed, or the link is wrong."
            action={
              <Link href="/" className="btn-secondary">
                Back to accounts
              </Link>
            }
          />
        </div>
      </div>
    );
  if (!account)
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card px-5">
          <LoadingBlock label="Loading account…" />
        </div>
      </div>
    );

  async function changeStage(stage: PipelineStage) {
    setStageError(null);
    const res = await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineStage: stage }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setStageError(
        (data && typeof data.error === "string" && data.error) ||
          "Failed to change stage.",
      );
      return;
    }
    load();
  }

  async function updateInfo(input: AccountInput) {
    const res = await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      // Thrown so AccountForm's own catch block shows its inline error
      // message instead of silently closing the edit form.
      throw new Error("Failed to update account");
    }
    setEditing(false);
    load();
  }

  async function logInteraction(input: {
    date: string;
    type: "VISIT" | "CALL" | "EMAIL";
    notes: string;
    nextAction: string;
    nextActionDate: string;
  }) {
    const res = await fetch(`/api/accounts/${id}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: input.date,
        type: input.type,
        notes: input.notes || null,
        nextAction: input.nextAction || null,
        nextActionDate: input.nextActionDate || null,
      }),
    });
    if (!res.ok) {
      // Thrown so InteractionForm's catch block shows its inline error.
      throw new Error("Failed to log interaction");
    }
    load();
  }

  const overdue = isOverdue(account.nextActionDate, new Date());
  const address = [
    account.addressLine,
    `${account.city}, ${account.state} ${account.zip ?? ""}`.trim(),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <nav className="text-xs text-gray-500" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-gray-900">
          Accounts
        </Link>
        <span className="mx-1.5 text-gray-300">/</span>
        <span className="text-gray-700">{account.name}</span>
      </nav>

      {/* Header card */}
      <section className="card">
        {editing ? (
          <div className="card-pad">
            <h2 className="section-title mb-4">Edit account</h2>
            <AccountForm
              initial={account}
              onSubmit={updateInfo}
              submitLabel="Save changes"
              secondaryAction={
                <button type="button" onClick={() => setEditing(false)} className="btn-ghost">
                  Cancel
                </button>
              }
            />
          </div>
        ) : (
          <div className="card-pad">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-sm font-semibold text-white">
                  {initials(account.name)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="page-title">{account.name}</h1>
                    <StageBadge stage={account.pipelineStage} />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{address}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                    {account.phone && (
                      <span className="inline-flex items-center gap-1.5">
                        {Icons.phone} {account.phone}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      {Icons.building} {typeLabel(account.accountType)}
                    </span>
                    <span>Source: {humanize(account.source)}</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button onClick={() => setEditing(true)} className="btn-secondary">
                  Edit
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-5 sm:grid-cols-3">
              <div>
                <p className="eyebrow">Last contact</p>
                <p className="mt-1 text-sm font-medium tabular-nums text-gray-900">
                  {formatDate(account.lastInteractionDate)}
                </p>
              </div>
              <div>
                <p className="eyebrow">Next action</p>
                <p
                  className={`mt-1 flex items-center gap-2 text-sm font-medium tabular-nums ${
                    overdue ? "text-red-600" : "text-gray-900"
                  }`}
                >
                  {formatDate(account.nextActionDate)}
                  {overdue && <Badge tone="danger">Overdue</Badge>}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="eyebrow">Contacts</p>
                <p className="mt-1 text-sm font-medium tabular-nums text-gray-900">
                  {account.contacts.length}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline */}
        <div className="border-t border-gray-100 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <ol className="flex flex-wrap items-center gap-1.5" aria-label="Pipeline">
              {PIPELINE_ORDER.map((stage, i) => {
                const currentIdx = PIPELINE_ORDER.indexOf(
                  account.pipelineStage as PipelineStage,
                );
                const inactive = account.pipelineStage === "INACTIVE";
                const done = !inactive && i < currentIdx;
                const current = !inactive && i === currentIdx;
                return (
                  <li key={stage} className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        current
                          ? "bg-gray-900 text-white"
                          : done
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {done && Icons.check}
                      {stageLabel(stage)}
                    </span>
                    {i < PIPELINE_ORDER.length - 1 && (
                      <span className="text-gray-300">{Icons.arrowRight}</span>
                    )}
                  </li>
                );
              })}
              {account.pipelineStage === "INACTIVE" && (
                <li>
                  <span className="ml-1 inline-flex items-center rounded-full bg-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600">
                    Inactive
                  </span>
                </li>
              )}
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              {nextValidStages(account.pipelineStage).map((stage) => (
                <button
                  key={stage}
                  onClick={() => changeStage(stage)}
                  className={stage === "INACTIVE" ? "btn-ghost btn-sm" : "btn-secondary btn-sm"}
                >
                  {stage === "INACTIVE" ? "Mark inactive" : `Move to ${stageLabel(stage)}`}
                </button>
              ))}
            </div>
          </div>
          {stageError && <p className="alert-error mt-3">{stageError}</p>}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card
            title="Log an interaction"
            description="Record a visit, call or email and set the next step."
          >
            <InteractionForm onSubmit={logInteraction} />
          </Card>

          <Card
            title="History"
            actions={
              <span className="text-xs text-gray-500">
                {account.interactions.length}{" "}
                {account.interactions.length === 1 ? "entry" : "entries"}
              </span>
            }
          >
            <InteractionTimeline interactions={account.interactions} />
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Contacts"
            actions={<span className="text-xs text-gray-500">{account.contacts.length}</span>}
          >
            <ContactList accountId={id} contacts={account.contacts} onChange={load} />
          </Card>

          <Card
            title="Follow-up email"
            description="Draft a follow-up based on your recent history with this account."
          >
            <FollowUpEmailDraft accountId={id} contacts={account.contacts} />
          </Card>

          <Card title="Quote" description="Build a quick quote and draft the email to send it.">
            <QuoteDraft accountId={id} contacts={account.contacts} onChange={load} />
          </Card>
        </div>
      </div>
    </div>
  );
}
