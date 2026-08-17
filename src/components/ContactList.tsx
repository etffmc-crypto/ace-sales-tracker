"use client";

import { useState, type FormEvent } from "react";
import type { AccountDetail } from "@/types/account";

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
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  async function addContact(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch(`/api/accounts/${accountId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone }),
    });
    setName("");
    setEmail("");
    setPhone("");
    onChange();
  }

  async function removeContact(id: string) {
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="space-y-2">
      {contacts.length === 0 ? (
        <p className="text-gray-600">No contacts yet.</p>
      ) : (
        <ul className="space-y-1">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between">
              <span>
                {c.name}
                {c.title ? ` — ${c.title}` : ""}
                {c.email ? ` (${c.email})` : ""}
              </span>
              <button
                onClick={() => removeContact(c.id)}
                className="text-sm text-red-600"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={addContact} className="flex gap-2">
        <input
          placeholder="Name"
          className="rounded border px-2 py-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
        <button type="submit" className="rounded border px-3 py-1">
          Add
        </button>
      </form>
    </div>
  );
}
