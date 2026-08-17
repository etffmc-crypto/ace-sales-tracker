"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountDetail } from "@/types/account";
import { todayLocalDate } from "@/components/InteractionForm";

interface LineItemRow {
  description: string;
  quantity: string;
  unitPrice: string;
}

function emptyRow(): LineItemRow {
  return { description: "", quantity: "1", unitPrice: "" };
}

export function QuoteDraft({
  accountId,
  contacts,
  onChange,
}: {
  accountId: string;
  contacts: AccountDetail["contacts"];
  onChange: () => void;
}) {
  const router = useRouter();
  const contactsWithEmail = contacts.filter(
    (c): c is typeof c & { email: string } => !!c.email,
  );

  const [rows, setRows] = useState<LineItemRow[]>([emptyRow()]);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<
    { subject: string; body: string; total: number } | null
  >(null);
  const [copied, setCopied] = useState(false);
  const [logStatus, setLogStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  if (contactsWithEmail.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        Add an email to a contact to draft quotes.
      </p>
    );
  }

  function updateRow(index: number, field: keyof LineItemRow, value: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const parsedItems = rows
    .map((row) => ({
      description: row.description.trim(),
      quantity: Number(row.quantity) || 0,
      unitPrice: Number(row.unitPrice) || 0,
    }))
    .filter((item) => item.description !== "");

  const runningTotal = parsedItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  async function requestDraft(contactId: string) {
    setLoading(true);
    setError(null);
    setDraft(null);
    setLogStatus("idle");
    try {
      const res = await fetch(`/api/accounts/${accountId}/quote-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, lineItems: parsedItems }),
      });
      if (res.redirected) {
        router.push("/login");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          (data && typeof data.error === "string" && data.error) ||
            "Failed to draft quote. Please try again.",
        );
        return;
      }
      setDraft(data);
      setShowPicker(false);
    } catch {
      setError("Failed to draft quote. Please try again.");
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

  function copyEmail() {
    if (!draft) return;
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopied(true);
  }

  async function logQuote() {
    if (!draft) return;
    setLogStatus("saving");
    const notesLines = parsedItems.map(
      (item) =>
        `${item.description}: ${item.quantity} x $${item.unitPrice.toFixed(2)} = $${(item.quantity * item.unitPrice).toFixed(2)}`,
    );
    const notes = `Quote:\n${notesLines.join("\n")}\nTotal: $${draft.total.toFixed(2)}`;
    try {
      const res = await fetch(`/api/accounts/${accountId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayLocalDate(),
          type: "EMAIL",
          notes,
          nextAction: null,
          nextActionDate: null,
        }),
      });
      if (!res.ok) {
        setLogStatus("error");
        return;
      }
      setLogStatus("success");
      onChange();
    } catch {
      setLogStatus("error");
    }
  }

  const hasValidItems = parsedItems.length > 0;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {draft && (
          <p className="text-sm text-gray-600">
            Line items are locked while this draft is open. Close it to make
            changes.
          </p>
        )}
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <input
              placeholder="Description"
              className="flex-1 rounded border px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-500"
              value={row.description}
              onChange={(e) => updateRow(i, "description", e.target.value)}
              disabled={!!draft}
            />
            <input
              placeholder="Qty"
              type="number"
              className="w-20 rounded border px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-500"
              value={row.quantity}
              onChange={(e) => updateRow(i, "quantity", e.target.value)}
              disabled={!!draft}
            />
            <input
              placeholder="Unit price"
              type="number"
              step="0.01"
              className="w-28 rounded border px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-500"
              value={row.unitPrice}
              onChange={(e) => updateRow(i, "unitPrice", e.target.value)}
              disabled={!!draft}
            />
            <button
              onClick={() => removeRow(i)}
              disabled={!!draft}
              className="text-sm text-red-600 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          onClick={addRow}
          disabled={!!draft}
          className="text-sm text-blue-600 disabled:opacity-50"
        >
          + Add line
        </button>
        <p className="text-sm font-semibold">
          Total: ${runningTotal.toFixed(2)}
        </p>
      </div>

      {!draft && !showPicker && (
        <button
          onClick={handleDraftClick}
          disabled={loading || !hasValidItems}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          {loading ? "Drafting..." : "Draft quote email"}
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
          <button onClick={() => setShowPicker(false)} className="text-sm text-gray-600">
            Cancel
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {draft && draftContact && (
        <div className="space-y-2 rounded border p-3">
          <p className="text-sm font-semibold">Subject: {draft.subject}</p>
          <p className="whitespace-pre-wrap text-sm">{draft.body}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyEmail}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <a
              href={`mailto:${draftContact.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
              className="rounded border px-3 py-1 text-sm"
            >
              Send via email
            </a>
            <button
              onClick={logQuote}
              disabled={logStatus === "saving"}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              {logStatus === "saving"
                ? "Logging..."
                : logStatus === "success"
                  ? "Logged ✓"
                  : "Log this quote"}
            </button>
            <button
              onClick={() => {
                setDraft(null);
                setSelectedContactId("");
                setLogStatus("idle");
              }}
              className="text-sm text-gray-600"
            >
              Close
            </button>
          </div>
          {logStatus === "error" && (
            <p className="text-sm text-red-600">
              Failed to log this quote. Please try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
