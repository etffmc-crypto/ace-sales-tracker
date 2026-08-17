"use client";

import { useState, type FormEvent } from "react";
import type { AccountDetail, ContactInput } from "@/types/account";

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
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {contacts.length === 0 ? (
        <p className="text-gray-600">No contacts yet.</p>
      ) : (
        <ul className="space-y-1">
          {contacts.map((c) =>
            editingId === c.id ? (
              <li key={c.id} className="rounded border p-2">
                <form onSubmit={saveEdit} className="space-y-2">
                  {editError && <p className="text-sm text-red-600">{editError}</p>}
                  <div className="flex gap-2">
                    <input
                      placeholder="Name"
                      className="rounded border px-2 py-1"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                    <input
                      placeholder="Title"
                      className="rounded border px-2 py-1"
                      value={editForm.title ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      placeholder="Email"
                      className="rounded border px-2 py-1"
                      value={editForm.email ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                    <input
                      placeholder="Phone"
                      className="rounded border px-2 py-1"
                      value={editForm.phone ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    />
                  </div>
                  <textarea
                    placeholder="Notes"
                    className="w-full rounded border px-2 py-1"
                    value={editForm.notes ?? ""}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={editSaving}
                      className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
                    >
                      {editSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="text-sm text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </li>
            ) : (
              <li key={c.id} className="flex items-center justify-between">
                <span>
                  {c.name}
                  {c.title ? ` — ${c.title}` : ""}
                  {c.email ? ` (${c.email})` : ""}
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => startEdit(c)}
                    className="text-sm text-blue-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => removeContact(c.id)}
                    className="text-sm text-red-600"
                  >
                    Remove
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
      <form onSubmit={addContact} className="flex flex-wrap gap-2">
        <input
          placeholder="Name"
          className="rounded border px-2 py-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Title"
          className="rounded border px-2 py-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          placeholder="Email"
          className="rounded border px-2 py-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Phone"
          className="rounded border px-2 py-1"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          placeholder="Notes"
          className="rounded border px-2 py-1"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="submit" className="rounded border px-3 py-1">
          Add
        </button>
      </form>
    </div>
  );
}
