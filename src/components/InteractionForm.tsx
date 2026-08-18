"use client";

import { useState, type FormEvent } from "react";
import { Spinner } from "@/components/ui";

// Returns today's date in the browser's local timezone as "YYYY-MM-DD".
// `new Date().toISOString().slice(0, 10)` looks equivalent but is today in
// UTC, not local time — it pre-fills tomorrow's date for anyone in a
// timezone behind UTC (e.g. US timezones, roughly 8pm-midnight Eastern).
export function todayLocalDate(): string {
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="alert-error">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="if-date" className="label">
            Date
          </label>
          <input
            id="if-date"
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Type</label>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1" role="radiogroup">
            {(["VISIT", "CALL", "EMAIL"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                  type === t
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {t === "VISIT" ? "Visit" : t === "CALL" ? "Call" : "Email"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="if-notes" className="label">
          Notes
        </label>
        <textarea
          id="if-notes"
          placeholder="What happened? Anything to remember next time?"
          className="input min-h-[88px] resize-y"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label htmlFor="if-next" className="label">
            Next action
          </label>
          <input
            id="if-next"
            placeholder="e.g. Drop off catalog, follow up on quote"
            className="input"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="if-next-date" className="label">
            By
          </label>
          <input
            id="if-next-date"
            type="date"
            className="input sm:w-44"
            value={nextActionDate}
            onChange={(e) => setNextActionDate(e.target.value)}
          />
        </div>
      </div>
      <div className="pt-1">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving && <Spinner />}
          {saving ? "Saving…" : "Log interaction"}
        </button>
      </div>
    </form>
  );
}
