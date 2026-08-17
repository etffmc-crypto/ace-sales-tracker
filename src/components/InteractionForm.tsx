"use client";

import { useState, type FormEvent } from "react";

// Returns today's date in the browser's local timezone as "YYYY-MM-DD".
// `new Date().toISOString().slice(0, 10)` looks equivalent but is today in
// UTC, not local time — it pre-fills tomorrow's date for anyone in a
// timezone behind UTC (e.g. US timezones, roughly 8pm-midnight Eastern).
function todayLocalDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
}

export function InteractionForm({
  onSubmit,
}: {
  onSubmit: (input: {
    date: string;
    type: "VISIT" | "CALL" | "EMAIL";
    notes: string;
    nextAction: string;
    nextActionDate: string;
  }) => Promise<void>;
}) {
  const [date, setDate] = useState(todayLocalDate());
  const [type, setType] = useState<"VISIT" | "CALL" | "EMAIL">("VISIT");
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ date, type, notes, nextAction, nextActionDate });
      setNotes("");
      setNextAction("");
      setNextActionDate("");
    } catch {
      setError("Failed to log interaction. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded border p-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <input
          type="date"
          className="rounded border px-2 py-1"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <select
          className="rounded border px-2 py-1"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          <option value="VISIT">Visit</option>
          <option value="CALL">Call</option>
          <option value="EMAIL">Email</option>
        </select>
      </div>
      <textarea
        placeholder="Notes"
        className="w-full rounded border px-2 py-1"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          placeholder="Next action"
          className="w-full rounded border px-2 py-1"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
        />
        <input
          type="date"
          className="rounded border px-2 py-1"
          value={nextActionDate}
          onChange={(e) => setNextActionDate(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : "Log interaction"}
      </button>
    </form>
  );
}
