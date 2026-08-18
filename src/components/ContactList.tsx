"use client";

import { useState, type FormEvent } from "react";
import type { AccountDetail, ContactInput } from "@/types/account";
import { Icons, Spinner, initials } from "@/components/ui";

export function ContactList({
  accountId,
  contacts,
  onChange,
}: {
  accountId: string;
  contacts: AccountDetail["contacts"];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ContactInput>({ name: "" });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  async function addContact(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    const res = await fetch(`/api/accounts/${accountId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        title: title || null,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
      }),
    });
    if (!res.ok) {
      setError("Failed to add contact. Please try again.");
      return;
    }
    setName("");
    setTitle("");
    setEmail("");
    setPhone("");
    setNotes("");
    onChange();
  }

  async function removeContact(id: string) {
    setError(null);
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to remove contact. Please try again.");
      return;
    }
    onChange();
  }

  function startEdit(contact: AccountDetail["contacts"][number]) {
    setEditingId(contact.id);
    setEditForm({
      name: contact.name,
      title: contact.title ?? "",
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      notes: contact.notes ?? "",
    });
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    if (!editForm.name?.trim()) {
      setEditError("Name is required.");
      return;
    }
    setEditError(null);
    setEditSaving(true);
    try {
      const res = await fetch(`/api/contacts/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          title: editForm.title || null,
          phone: editForm.phone || null,
          email: editForm.email || null,
          notes: editForm.notes || null,
        }),
      });
      if (!res.ok) {
        setEditError("Failed to save contact. Please try again.");
        return;
      }
      setEditingId(null);
      onChange();
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="alert-error">{error}</p>}
      {contacts.length === 0 ? (
        <p className="muted">No contacts yet. Add the people you talk to at this account.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {contacts.map((c) =>
            editingId === c.id ? (
              <li key={c.id} className="py-3">
                <form onSubmit={saveEdit} className="space-y-3 rounded-lg bg-gray-50 p-3">
                  {editError && <p className="alert-error">{editError}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="Name"
                      className="input"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                    <input
                      placeholder="Title"
                      className="input"
                      value={editForm.title ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    />
                    <input
                      placeholder="Email"
                      className="input"
                      value={editForm.email ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                    <input
                      placeholder="Phone"
                      className="input"
                      value={editForm.phone ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <textarea
                    placeholder="Notes"
                    className="input min-h-[64px]"
                    value={editForm.notes ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <button type="submit" disabled={editSaving} className="btn-primary btn-sm">
                      {editSaving && <Spinner />}
                      {editSaving ? "Saving…" : "Save"}
                    </button>
                    <button type="button" onClick={cancelEdit} className="btn-ghost btn-sm">
                      Cancel
                    </button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={c.id} className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">
                  {initials(c.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {c.name}
                    {c.title && <span className="font-normal text-gray-500"> · {c.title}</span>}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-gray-900">
                        {Icons.mail} {c.email}
                      </a>
                    )}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-gray-900">
                        {Icons.phone} {c.phone}
                      </a>
                    )}
                  </div>
                  {c.notes && <p className="mt-1 text-xs text-gray-500">{c.notes}</p>}
                </div>
                <span className="flex shrink-0 gap-1 opacity-70 transition group-hover:opacity-100">
                  <button onClick={() => startEdit(c)} className="btn-ghost btn-sm">
                    Edit
                  </button>
                  <button onClick={() => removeContact(c.id)} className="btn-danger-ghost btn-sm">
                    Remove
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      {showAdd ? (
        <form onSubmit={addContact} className="space-y-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-3">
          <p className="text-xs font-medium text-gray-700">New contact</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <input
              placeholder="Title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              placeholder="Email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              placeholder="Phone"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <input
            placeholder="Notes"
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary btn-sm">
              {Icons.plus} Add contact
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost btn-sm">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setShowAdd(true)} className="btn-secondary btn-sm">
          {Icons.plus} Add contact
        </button>
      )}
    </div>
  );
}
