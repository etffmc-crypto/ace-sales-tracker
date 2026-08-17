"use client";

import { useRouter } from "next/navigation";
import { AccountForm } from "@/components/AccountForm";
import type { AccountInput } from "@/types/account";

export default function NewAccountPage() {
  const router = useRouter();

  async function handleSubmit(input: AccountInput) {
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error("Failed to create account");
    const account = await res.json();
    router.push(`/accounts/${account.id}`);
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">New account</h1>
      <AccountForm onSubmit={handleSubmit} submitLabel="Create account" />
    </div>
  );
}
