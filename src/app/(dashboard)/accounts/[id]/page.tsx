"use client";

import { use, useCallback, useEffect, useState } from "react";
import { nextValidStages, type PipelineStage } from "@/lib/pipeline";
import { InteractionTimeline } from "@/components/InteractionTimeline";
import { InteractionForm } from "@/components/InteractionForm";
import { ContactList } from "@/components/ContactList";
import { AccountForm } from "@/components/AccountForm";
import type { AccountDetail, AccountInput } from "@/types/account";

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/accounts/${id}`);
    const data = await res.json();
    setAccount(data);
  }, [id]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  if (!account) return <p>Loading...</p>;

  async function changeStage(stage: PipelineStage) {
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineStage: stage }),
    });
    load();
  }

  async function updateInfo(input: AccountInput) {
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
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
    await fetch(`/api/accounts/${id}/interactions`, {
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
    </div>
  );
}
