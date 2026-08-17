"use client";

import { useState, type FormEvent } from "react";
import type { AccountInput } from "@/types/account";

const TYPES = ["CONTRACTOR", "RESTAURANT", "PROPERTY_MGMT", "MUNICIPAL", "OTHER"];
const SOURCES = ["INHERITED", "PROSPECTED"];

export function AccountForm({
  initial,
  onSubmit,
  submitLabel = "Save",
}: {
  initial?: Partial<AccountInput>;
  onSubmit: (input: AccountInput) => Promise<void>;
  submitLabel?: string;
}) {
  const [form, setForm] = useState<AccountInput>({
    name: initial?.name ?? "",
    addressLine: initial?.addressLine ?? "",
    city: initial?.city ?? "Harrisburg",
    state: initial?.state ?? "PA",
    zip: initial?.zip ?? "",
    phone: initial?.phone ?? "",
    accountType: initial?.accountType ?? "OTHER",
    source: initial?.source ?? "PROSPECTED",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSubmit(form);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <input
        placeholder="Business name"
        className="w-full rounded border px-3 py-2"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        required
      />
      <input
        placeholder="Address"
        className="w-full rounded border px-3 py-2"
        value={form.addressLine ?? ""}
        onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
      />
      <div className="flex gap-2">
        <input
          placeholder="City"
          className="w-full rounded border px-3 py-2"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
        />
        <input
          placeholder="State"
          className="w-24 rounded border px-3 py-2"
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
        />
        <input
          placeholder="Zip"
          className="w-28 rounded border px-3 py-2"
          value={form.zip ?? ""}
          onChange={(e) => setForm({ ...form, zip: e.target.value })}
        />
      </div>
      <input
        placeholder="Phone"
        className="w-full rounded border px-3 py-2"
        value={form.phone ?? ""}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <select
        className="w-full rounded border px-3 py-2"
        value={form.accountType}
        onChange={(e) =>
          setForm({ ...form, accountType: e.target.value as AccountInput["accountType"] })
        }
      >
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        className="w-full rounded border px-3 py-2"
        value={form.source}
        onChange={(e) =>
          setForm({ ...form, source: e.target.value as AccountInput["source"] })
        }
      >
        {SOURCES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
