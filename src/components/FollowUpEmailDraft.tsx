"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountDetail } from "@/types/account";
import { EmailDraftPreview } from "@/components/EmailDraftPreview";
import { Icons, Spinner } from "@/components/ui";

export function FollowUpEmailDraft({
  accountId,
  contacts,
}: {
  accountId: string;
  contacts: AccountDetail["contacts"];
}) {
  const router = useRouter();
  const contactsWithEmail = contacts.filter(
    (c): c is typeof c & { email: string } => !!c.email,
  );

  const [showPicker, setShowPicker] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(
    null,
  );

  if (contactsWithEmail.length === 0) {
    return (
      <p className="muted">
        Add an email address to a contact to draft follow-up emails.
      </p>
    );
  }

  async function requestDraft(contactId: string) {
    setLoading(true);
    setError(null);
    setDraft(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}/draft-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      if (res.redirected) {
        // A non-ok response means the request failed outright. A *redirected*
        // response can still be `ok` (200) — that's what happens when the
        // session expired and the proxy redirected this fetch to the login
        // page: `fetch` follows it and returns the login HTML with status
        // 200, so `res.ok` alone won't catch it.
        router.push("/login");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          (data && typeof data.error === "string" && data.error) ||
            "Failed to draft email. Please try again.",
        );
        return;
      }
      setDraft(data);
      setShowPicker(false);
    } catch {
      setError("Failed to draft email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDraftClick() {
    if (contactsWithEmail.length === 1) {
      const only = contactsWithEmail[0];
      setSelectedContactId(only.id);
      requestDraft(only.id);
    } else {
      setShowPicker(true);
    }
  }

  const draftContact = contactsWithEmail.find(
    (c) => c.id === selectedContactId,
  );

  return (
    <div className="space-y-3">
      {!draft && !showPicker && (
        <button
          onClick={handleDraftClick}
          disabled={loading}
          className="btn-secondary"
        >
          {loading ? <Spinner /> : Icons.sparkles}
          {loading ? "Drafting…" : "Draft follow-up email"}
        </button>
      )}

      {showPicker && !draft && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            className="select sm:flex-1"
            value={selectedContactId}
            onChange={(e) => setSelectedContactId(e.target.value)}
          >
            <option value="">Choose a contact…</option>
            {contactsWithEmail.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => selectedContactId && requestDraft(selectedContactId)}
              disabled={!selectedContactId || loading}
              className="btn-primary"
            >
              {loading ? <Spinner /> : Icons.sparkles}
              {loading ? "Drafting…" : "Draft"}
            </button>
            <button onClick={() => setShowPicker(false)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="alert-error">{error}</p>}

      {draft && draftContact && (
        <EmailDraftPreview
          subject={draft.subject}
          body={draft.body}
          to={`${draftContact.name} <${draftContact.email}>`}
          actions={
            <>
              <a
                href={`mailto:${draftContact.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                className="btn-primary btn-sm"
              >
                {Icons.mail}
                Send via email
              </a>
              <button
                onClick={() => {
                  setDraft(null);
                  setSelectedContactId("");
                }}
                className="btn-ghost btn-sm ml-auto"
              >
                Close
              </button>
            </>
          }
        />
      )}
    </div>
  );
}
