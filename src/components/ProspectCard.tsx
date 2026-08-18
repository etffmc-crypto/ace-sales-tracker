"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountType } from "@prisma/client";
import type { ProspectCandidate } from "@/lib/prospecting";
import { EmailDraftPreview } from "@/components/EmailDraftPreview";
import { Badge, Icons, Spinner, initials } from "@/components/ui";

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

  const cityState = [candidate.city, candidate.state].filter(Boolean).join(", ");
  const address = candidate.addressLine
    ? [candidate.addressLine, [cityState, candidate.zip].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <li className="card card-pad space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
          {initials(candidate.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-gray-900">{candidate.name}</p>
            {accountId && <Badge tone="success">{Icons.check} Added</Badge>}
          </div>
          {address && <p className="text-sm text-gray-500">{address}</p>}
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            {candidate.phone && (
              <span className="inline-flex items-center gap-1.5">
                {Icons.phone} {candidate.phone}
              </span>
            )}
            {candidate.email && (
              <span className="inline-flex items-center gap-1.5">
                {Icons.mail} {candidate.email}
              </span>
            )}
            {candidate.website && (
              <a
                href={candidate.website}
                target="_blank"
                rel="noopener noreferrer"
                className="link truncate"
              >
                {candidate.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
          {candidate.notes && (
            <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {candidate.notes}
            </p>
          )}
        </div>
      </div>

      {addError && <p className="alert-error">{addError}</p>}

      {!accountId ? (
        <div>
          <button
            onClick={addProspect}
            disabled={adding}
            className="btn-secondary"
          >
            {adding ? <Spinner /> : Icons.plus}
            {adding ? "Adding…" : "Add as prospect"}
          </button>
        </div>
      ) : !draft ? (
        <div>
          <button
            onClick={draftEmail}
            disabled={drafting}
            className="btn-secondary"
          >
            {drafting ? <Spinner /> : Icons.sparkles}
            {drafting ? "Drafting…" : "Draft intro email"}
          </button>
        </div>
      ) : (
        <EmailDraftPreview
          subject={draft.subject}
          body={draft.body}
          to={candidate.email}
          actions={
            <>
              <button onClick={copyEmail} className="btn-primary btn-sm">
                {copied ? Icons.check : Icons.copy}
                {copied ? "Copied!" : "Copy"}
              </button>
              {candidate.email && (
                <a
                  href={`mailto:${candidate.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                  className="btn-secondary btn-sm"
                >
                  {Icons.mail}
                  Open in email
                </a>
              )}
            </>
          }
        />
      )}
      {draftError && <p className="alert-error">{draftError}</p>}
    </li>
  );
}
