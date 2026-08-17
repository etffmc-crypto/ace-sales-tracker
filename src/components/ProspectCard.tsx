"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountType } from "@prisma/client";
import type { ProspectCandidate } from "@/lib/prospecting";

export function ProspectCard({
  candidate,
  accountType,
}: {
  candidate: ProspectCandidate;
  accountType: AccountType;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(
    null,
  );
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function addProspect() {
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: candidate.name,
          addressLine: candidate.addressLine,
          city: candidate.city,
          state: candidate.state,
          zip: candidate.zip,
          phone: candidate.phone,
          accountType,
          source: "PROSPECTED",
        }),
      });
      if (res.redirected) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setAddError("Failed to add prospect. Please try again.");
        return;
      }
      const account = await res.json();
      setAccountId(account.id);

      if (candidate.email) {
        try {
          const contactRes = await fetch(
            `/api/accounts/${account.id}/contacts`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: candidate.name,
                email: candidate.email,
                phone: candidate.phone,
              }),
            },
          );
          if (!contactRes.ok) {
            console.error("Failed to create contact for prospect", account.id);
          }
        } catch (err) {
          console.error("Failed to create contact for prospect", err);
        }
      }
    } catch {
      setAddError("Failed to add prospect. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function draftEmail() {
    if (!accountId) return;
    setDrafting(true);
    setDraftError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/accounts/${accountId}/prospecting-email`, {
        method: "POST",
      });
      if (res.redirected) {
        router.push("/login");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setDraftError(
          (data && typeof data.error === "string" && data.error) ||
            "Failed to draft email. Please try again.",
        );
        return;
      }
      setDraft(data);
    } catch {
      setDraftError("Failed to draft email. Please try again.");
    } finally {
      setDrafting(false);
    }
  }

  function copyEmail() {
    if (!draft) return;
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopied(true);
  }

  return (
    <li className="space-y-2 rounded border p-3">
      <p className="font-semibold">{candidate.name}</p>
      {candidate.addressLine && (
        <p className="text-sm text-gray-600">
          {candidate.addressLine}
          {candidate.city ? `, ${candidate.city}` : ""}
          {candidate.state ? `, ${candidate.state}` : ""}
          {candidate.zip ? ` ${candidate.zip}` : ""}
        </p>
      )}
      {candidate.phone && (
        <p className="text-sm text-gray-600">{candidate.phone}</p>
      )}
      {candidate.email && (
        <p className="text-sm text-gray-600">{candidate.email}</p>
      )}
      {candidate.website && (
        <p className="text-sm text-gray-600">
          <a
            href={candidate.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600"
          >
            {candidate.website}
          </a>
        </p>
      )}
      {candidate.notes && (
        <p className="text-sm text-gray-600">{candidate.notes}</p>
      )}

      {addError && <p className="text-sm text-red-600">{addError}</p>}

      {!accountId ? (
        <button
          onClick={addProspect}
          disabled={adding}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add as prospect"}
        </button>
      ) : !draft ? (
        <button
          onClick={draftEmail}
          disabled={drafting}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          {drafting ? "Drafting..." : "Draft intro email"}
        </button>
      ) : (
        <div className="space-y-2 rounded border p-2">
          <p className="text-sm font-semibold">Subject: {draft.subject}</p>
          <p className="whitespace-pre-wrap text-sm">{draft.body}</p>
          <div className="flex gap-2">
            <button
              onClick={copyEmail}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            {candidate.email && (
              <a
                href={`mailto:${candidate.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                className="rounded border px-3 py-1 text-sm"
              >
                Open in email
              </a>
            )}
          </div>
        </div>
      )}
      {draftError && <p className="text-sm text-red-600">{draftError}</p>}
    </li>
  );
}
