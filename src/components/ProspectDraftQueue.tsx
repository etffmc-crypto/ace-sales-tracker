"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProspectDraftListItem } from "@/types/account";

export function ProspectDraftQueue() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<ProspectDraftListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const res = await fetch("/api/prospect-drafts");
        if (res.redirected) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setError("Failed to load the review queue.");
          return;
        }
        const data = await res.json();
        setDrafts(data);
      } catch {
        setError("Failed to load the review queue.");
      }
    })();
  }, [router]);

  function copyDraft(draft: ProspectDraftListItem) {
    navigator.clipboard.writeText(
      `Subject: ${draft.subject}\n\n${draft.body}`,
    );
    setCopiedId(draft.id);
  }

  async function dismiss(id: string) {
    try {
      const res = await fetch(`/api/prospect-drafts/${id}/dismiss`, {
        method: "POST",
      });
      if (res.redirected) {
        router.push("/login");
        return;
      }
      if (!res.ok) return;
      setDrafts((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
    } catch {
      // leave the item in the queue; the user can retry the dismiss
    }
  }

  return (
    <div className="space-y-2 rounded border p-3">
      <h2 className="font-semibold">Needs review</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {drafts && drafts.length === 0 && (
        <p className="text-sm text-gray-600">Nothing to review right now.</p>
      )}
      {drafts && drafts.length > 0 && (
        <ul className="space-y-2">
          {drafts.map((draft) => (
            <li key={draft.id} className="space-y-1 rounded border p-2">
              <p className="font-semibold">{draft.account.name}</p>
              {draft.account.addressLine && (
                <p className="text-sm text-gray-600">
                  {draft.account.addressLine}
                  {draft.account.city ? `, ${draft.account.city}` : ""}
                  {draft.account.state ? `, ${draft.account.state}` : ""}
                  {draft.account.zip ? ` ${draft.account.zip}` : ""}
                </p>
              )}
              <p className="text-sm font-semibold">
                Subject: {draft.subject}
              </p>
              <p className="whitespace-pre-wrap text-sm">{draft.body}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => copyDraft(draft)}
                  className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
                >
                  {copiedId === draft.id ? "Copied!" : "Copy"}
                </button>
                {draft.recipientEmail && (
                  <a
                    href={`mailto:${draft.recipientEmail}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                    className="rounded border px-3 py-1 text-sm"
                  >
                    Open in email
                  </a>
                )}
                <button
                  onClick={() => dismiss(draft.id)}
                  className="rounded border px-3 py-1 text-sm"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
