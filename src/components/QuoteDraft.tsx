"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccountDetail } from "@/types/account";
import { todayLocalDate } from "@/components/InteractionForm";
import { EmailDraftPreview } from "@/components/EmailDraftPreview";
import { Icons, Spinner } from "@/components/ui";

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
      <p className="muted">
        Add an email address to a contact to draft quotes.
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

  const locked = !!draft || loading;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {draft && (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Line items are locked while this draft is open. Close it to make changes.
          </p>
        )}
        <div className="hidden grid-cols-[1fr_4.5rem_6.5rem_auto] gap-2 px-0.5 sm:grid">
          <span className="eyebrow">Item</span>
          <span className="eyebrow">Qty</span>
          <span className="eyebrow">Unit price</span>
          <span className="w-7" />
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_4.5rem_6.5rem_auto] gap-2">
            <input
              placeholder="Description"
              className="input"
              value={row.description}
              onChange={(e) => updateRow(i, "description", e.target.value)}
              disabled={locked}
            />
            <input
              placeholder="Qty"
              type="number"
              className="input tabular-nums"
              value={row.quantity}
              onChange={(e) => updateRow(i, "quantity", e.target.value)}
              disabled={locked}
            />
            <input
              placeholder="0.00"
              type="number"
              step="0.01"
              className="input tabular-nums"
              value={row.unitPrice}
              onChange={(e) => updateRow(i, "unitPrice", e.target.value)}
              disabled={locked}
            />
            <button
              onClick={() => removeRow(i)}
              disabled={locked}
              className="btn-danger-ghost h-9 w-7 px-0"
              aria-label="Remove line"
              title="Remove line"
            >
              ×
            </button>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <button onClick={addRow} disabled={locked} className="btn-ghost btn-sm -ml-2">
            {Icons.plus} Add line
          </button>
          <p className="text-sm text-gray-600">
            Total{" "}
            <span className="ml-1 font-semibold tabular-nums text-gray-900">
              ${runningTotal.toFixed(2)}
            </span>
          </p>
        </div>
      </div>

      {!draft && !showPicker && (
        <button
          onClick={handleDraftClick}
          disabled={loading || !hasValidItems}
          className="btn-secondary"
        >
          {loading ? <Spinner /> : Icons.sparkles}
          {loading ? "Drafting…" : "Draft quote email"}
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
              <button onClick={copyEmail} className="btn-primary btn-sm">
                {copied ? Icons.check : Icons.copy}
                {copied ? "Copied!" : "Copy"}
              </button>
              <a
                href={`mailto:${draftContact.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                className="btn-secondary btn-sm"
              >
                {Icons.mail}
                Send via email
              </a>
              <button
                onClick={logQuote}
                disabled={logStatus === "saving" || logStatus === "success"}
                className="btn-secondary btn-sm"
              >
                {logStatus === "saving" ? (
                  <Spinner />
                ) : logStatus === "success" ? (
                  Icons.check
                ) : null}
                {logStatus === "saving"
                  ? "Logging…"
                  : logStatus === "success"
                    ? "Logged"
                    : "Log this quote"}
              </button>
              <button
                onClick={() => {
                  setDraft(null);
                  setSelectedContactId("");
                  setLogStatus("idle");
                }}
                className="btn-ghost btn-sm ml-auto"
              >
                Close
              </button>
            </>
          }
          footer={
            logStatus === "error" ? (
              <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
                Failed to log this quote. Please try again.
              </p>
            ) : null
          }
        />
      )}
    </div>
  );
}
