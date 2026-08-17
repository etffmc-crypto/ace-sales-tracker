"use client";

import { useState, type FormEvent } from "react";

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
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<"VISIT" | "CALL" | "EMAIL">("VISIT");
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ date, type, notes, nextAction, nextActionDate });
      setNotes("");
      setNextAction("");
      setNextActionDate("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded border p-3">
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
