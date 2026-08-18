"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProspectDraftListItem } from "@/types/account";
import { EmailDraftPreview } from "@/components/EmailDraftPreview";
import { Badge, Card, EmptyState, Icons, LoadingBlock, initials } from "@/components/ui";

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
    <Card
      title="Needs review"
      description="Intro emails drafted automatically for new prospects. Copy, send, or dismiss."
      actions={
        drafts && drafts.length > 0 ? (
          <Badge tone="warning">{drafts.length} waiting</Badge>
        ) : null
      }
    >
      {error && <p className="alert-error">{error}</p>}
      {!drafts && !error && <LoadingBlock label="Loading review queue…" />}
      {drafts && drafts.length === 0 && (
        <EmptyState
          icon={Icons.check}
          title="Nothing to review right now"
          description="New drafts from the automated prospector will show up here."
        />
      )}
      {drafts && drafts.length > 0 && (
        <ul className="space-y-4">
          {drafts.map((draft) => {
            const cityState = [draft.account.city, draft.account.state]
              .filter(Boolean)
              .join(", ");
            const address = draft.account.addressLine
              ? [
                  draft.account.addressLine,
                  [cityState, draft.account.zip].filter(Boolean).join(" "),
                ]
                  .filter(Boolean)
                  .join(", ")
              : null;
            return (
              <li key={draft.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">
                    {initials(draft.account.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{draft.account.name}</p>
                    {address && <p className="truncate text-xs text-gray-500">{address}</p>}
                  </div>
                </div>
                <EmailDraftPreview
                  subject={draft.subject}
                  body={draft.body}
                  to={draft.recipientEmail}
                  actions={
                    <>
                      <button
                        onClick={() => copyDraft(draft)}
                        className="btn-primary btn-sm"
                      >
                        {copiedId === draft.id ? Icons.check : Icons.copy}
                        {copiedId === draft.id ? "Copied!" : "Copy"}
                      </button>
                      {draft.recipientEmail && (
                        <a
                          href={`mailto:${draft.recipientEmail}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                          className="btn-secondary btn-sm"
                        >
                          {Icons.mail}
                          Open in email
                        </a>
                      )}
                      <button
                        onClick={() => dismiss(draft.id)}
                        className="btn-ghost btn-sm ml-auto"
                      >
                        Dismiss
                      </button>
                    </>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
