"use client";

import { useState } from "react";
import type { AccountDetail } from "@/types/account";

export function FollowUpEmailDraft({
  accountId,
  contacts,
}: {
  accountId: string;
  contacts: AccountDetail["contacts"];
}) {
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
      <p className="text-sm text-gray-600">
        Add an email to a contact to draft follow-up emails.
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
    <div className="space-y-2">
      {!draft && !showPicker && (
        <button
          onClick={handleDraftClick}
          disabled={loading}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          {loading ? "Drafting..." : "Draft follow-up email"}
        </button>
      )}

      {showPicker && !draft && (
        <div className="flex items-center gap-2">
          <select
            className="rounded border px-2 py-1 text-sm"
            value={selectedContactId}
            onChange={(e) => setSelectedContactId(e.target.value)}
          >
            <option value="">Choose a contact...</option>
            {contactsWithEmail.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
          <button
            onClick={() => selectedContactId && requestDraft(selectedContactId)}
            disabled={!selectedContactId || loading}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            {loading ? "Drafting..." : "Draft"}
          </button>
          <button
            onClick={() => setShowPicker(false)}
            className="text-sm text-gray-600"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {draft && draftContact && (
        <div className="space-y-2 rounded border p-3">
          <p className="text-sm font-semibold">Subject: {draft.subject}</p>
          <p className="whitespace-pre-wrap text-sm">{draft.body}</p>
          <div className="flex gap-2">
            <a
              href={`mailto:${draftContact.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            >
              Send via email
            </a>
            <button
              onClick={() => {
                setDraft(null);
                setSelectedContactId("");
              }}
              className="text-sm text-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
