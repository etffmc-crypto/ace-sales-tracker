"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { nextValidStages, type PipelineStage } from "@/lib/pipeline";
import { InteractionTimeline } from "@/components/InteractionTimeline";
import { InteractionForm } from "@/components/InteractionForm";
import { ContactList } from "@/components/ContactList";
import { AccountForm } from "@/components/AccountForm";
import { FollowUpEmailDraft } from "@/components/FollowUpEmailDraft";
import type { AccountDetail, AccountInput } from "@/types/account";

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

  if (notFound) return <p>Account not found.</p>;
  if (!account) return <p>Loading...</p>;

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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        {editing ? (
          <div>
            <AccountForm
              initial={account}
              onSubmit={updateInfo}
              submitLabel="Save changes"
            />
            <button
              onClick={() => setEditing(false)}
              className="mt-2 text-sm text-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">{account.name}</h1>
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-blue-600"
              >
                Edit
              </button>
            </div>
            <p className="text-gray-600">
              {account.addressLine ? `${account.addressLine}, ` : ""}
              {account.city}, {account.state} {account.zip}
            </p>
            <p className="text-gray-600">{account.phone}</p>
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded bg-gray-100 px-2 py-1 text-sm">
            {account.pipelineStage}
          </span>
          {nextValidStages(account.pipelineStage).map((stage) => (
            <button
              key={stage}
              onClick={() => changeStage(stage)}
              className="rounded border px-2 py-1 text-sm"
            >
              Move to {stage}
            </button>
          ))}
        </div>
        {stageError && <p className="mt-2 text-sm text-red-600">{stageError}</p>}
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Contacts</h2>
        <ContactList accountId={id} contacts={account.contacts} onChange={load} />
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Log an interaction</h2>
        <InteractionForm onSubmit={logInteraction} />
      </div>

      <div>
        <h2 className="mb-2 font-semibold">History</h2>
        <InteractionTimeline interactions={account.interactions} />
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Follow-up</h2>
        <FollowUpEmailDraft accountId={id} contacts={account.contacts} />
      </div>
    </div>
  );
}
