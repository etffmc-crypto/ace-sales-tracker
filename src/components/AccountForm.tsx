"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { AccountInput } from "@/types/account";
import { Spinner, humanize, typeLabel } from "@/components/ui";

const TYPES = ["CONTRACTOR", "RESTAURANT", "PROPERTY_MGMT", "MUNICIPAL", "OTHER"];
const SOURCES = ["INHERITED", "PROSPECTED"];

export function AccountForm({
  initial,
  onSubmit,
  submitLabel = "Save",
  secondaryAction,
}: {
  initial?: Partial<AccountInput>;
  onSubmit: (input: AccountInput) => Promise<void>;
  submitLabel?: string;
  /** Optional element rendered next to the submit button (e.g. Cancel). */
  secondaryAction?: ReactNode;
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="alert-error">{error}</p>}

      <div>
        <label htmlFor="af-name" className="label">
          Business name <span className="text-red-500">*</span>
        </label>
        <input
          id="af-name"
          placeholder="e.g. Keystone Contracting"
          className="input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>

      <div>
        <label htmlFor="af-address" className="label">
          Street address
        </label>
        <input
          id="af-address"
          placeholder="123 Market St"
          className="input"
          value={form.addressLine ?? ""}
          onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-6 gap-3">
        <div className="col-span-6 sm:col-span-3">
          <label htmlFor="af-city" className="label">
            City
          </label>
          <input
            id="af-city"
            placeholder="City"
            className="input"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="af-state" className="label">
            State
          </label>
          <input
            id="af-state"
            placeholder="PA"
            className="input"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
          />
        </div>
        <div className="col-span-4 sm:col-span-2">
          <label htmlFor="af-zip" className="label">
            ZIP
          </label>
          <input
            id="af-zip"
            placeholder="17101"
            className="input"
            value={form.zip ?? ""}
            onChange={(e) => setForm({ ...form, zip: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label htmlFor="af-phone" className="label">
          Phone
        </label>
        <input
          id="af-phone"
          placeholder="(717) 555-0100"
          className="input"
          value={form.phone ?? ""}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="af-type" className="label">
            Account type
          </label>
          <select
            id="af-type"
            className="select"
            value={form.accountType}
            onChange={(e) =>
              setForm({ ...form, accountType: e.target.value as AccountInput["accountType"] })
            }
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="af-source" className="label">
            Source
          </label>
          <select
            id="af-source"
            className="select"
            value={form.source}
            onChange={(e) =>
              setForm({ ...form, source: e.target.value as AccountInput["source"] })
            }
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving && <Spinner />}
          {saving ? "Saving…" : submitLabel}
        </button>
        {secondaryAction}
      </div>
    </form>
  );
}
