"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccountForm } from "@/components/AccountForm";
import type { AccountInput } from "@/types/account";
import { Card, PageHeader } from "@/components/ui";

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
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New account"
        subtitle="Add a business you're working or want to start working."
      />
      <Card>
        <AccountForm
          onSubmit={handleSubmit}
          submitLabel="Create account"
          secondaryAction={
            <Link href="/" className="btn-ghost">
              Cancel
            </Link>
          }
        />
      </Card>
    </div>
  );
}
