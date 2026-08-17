# Account/Lead Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a hosted web app (Next.js + Postgres) that lets the user track accounts, contacts, and interactions for their Ace Hardware outside sales territory in Harrisburg, PA.

**Architecture:** Single Next.js (App Router, TypeScript) app containing both the UI and API routes, backed by a Neon Postgres database via Prisma, single-user auth via Auth.js (NextAuth v5) Credentials provider, deployed on Vercel. Domain logic with real branching (pipeline stage transitions, follow-up sorting, interaction ordering) is TDD'd as pure functions in `lib/`; CRUD API routes and screens are built directly and verified by running the dev server, per the spec's pragmatic testing approach.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Prisma, Neon Postgres, Auth.js (next-auth) v5, bcryptjs, Vitest, Vercel.

**Spec:** [docs/superpowers/specs/2026-08-17-account-tracker-design.md](../specs/2026-08-17-account-tracker-design.md)

## Global Constraints

- TypeScript strict mode across the app.
- No signup flow, no user management UI — exactly one user account, created by a seed script.
- All routes except `/login` and `/api/auth/*` require an authenticated session.
- No offline support, no mobile-specific layout work in v1.
- Automated tests are required only for: pipeline stage transitions, needs-follow-up sorting, interaction ordering. Everything else is verified manually via the dev server.
- Default city/state for new accounts: Harrisburg / PA.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, `.env.example`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`

**Interfaces:**
- Produces: a runnable Next.js app (`npm run dev`), path alias `@/*` → `src/*`, Tailwind wired into `globals.css`.

- [ ] **Step 1: Scaffold the app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

When prompted, accept defaults. This creates `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`.

- [ ] **Step 2: Replace the placeholder home page**

`src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Ace Sales Tracker</h1>
      <p className="text-gray-600">Setup in progress.</p>
    </main>
  );
}
```

- [ ] **Step 3: Add `.env.example`**

```
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
AUTH_SECRET="generate-with-npx-auth-secret"
SEED_ADMIN_EMAIL="you@example.com"
SEED_ADMIN_PASSWORD="choose-a-real-password"
```

- [ ] **Step 4: Verify the app runs**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000`; visiting it shows "Ace Sales Tracker" / "Setup in progress." Stop the server (Ctrl+C) once confirmed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app"
```

---

### Task 2: Prisma schema and database connection

**Files:**
- Create: `prisma/schema.prisma`
- Modify: `package.json` (add `prisma`, `@prisma/client` deps and a `postinstall` script)
- Modify: `.gitignore` (ensure `.env` is ignored — create-next-app already does this)

**Interfaces:**
- Produces: `Account`, `Contact`, `Interaction`, `User` Prisma models with enums `AccountType`, `PipelineStage`, `AccountSource`, `InteractionType`, matching the spec's data model exactly.

- [ ] **Step 1: Install Prisma**

```bash
npm install prisma --save-dev
npm install @prisma/client
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma` and a `.env` file (already gitignored).

- [ ] **Step 2: Write the schema**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum AccountType {
  CONTRACTOR
  RESTAURANT
  PROPERTY_MGMT
  MUNICIPAL
  OTHER
}

enum PipelineStage {
  PROSPECT
  CONTACTED
  QUOTED
  ACTIVE_CUSTOMER
  INACTIVE
}

enum AccountSource {
  INHERITED
  PROSPECTED
}

enum InteractionType {
  VISIT
  CALL
  EMAIL
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}

model Account {
  id            String        @id @default(uuid())
  name          String
  addressLine   String?
  city          String        @default("Harrisburg")
  state         String        @default("PA")
  zip           String?
  phone         String?
  accountType   AccountType   @default(OTHER)
  pipelineStage PipelineStage @default(PROSPECT)
  source        AccountSource @default(PROSPECTED)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  contacts      Contact[]
  interactions  Interaction[]

  @@index([pipelineStage])
  @@index([accountType])
}

model Contact {
  id        String  @id @default(uuid())
  accountId String
  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  name      String
  title     String?
  phone     String?
  email     String?
  notes     String?

  @@index([accountId])
}

model Interaction {
  id             String           @id @default(uuid())
  accountId      String
  account        Account          @relation(fields: [accountId], references: [id], onDelete: Cascade)
  date           DateTime
  type           InteractionType
  notes          String?
  nextAction     String?
  nextActionDate DateTime?
  createdAt      DateTime         @default(now())

  @@index([accountId])
  @@index([date])
}
```

- [ ] **Step 3: Point `DATABASE_URL` at a real database**

The user must create a free Neon Postgres database and paste its connection string into `.env` as `DATABASE_URL` before this step works. (See Task 14 for the full account-creation walkthrough — for local development, a free Neon project created ad hoc is enough; the same database can be reused for the deployed app later, or a second one created for production.)

- [ ] **Step 4: Run the first migration**

Run: `npx prisma migrate dev --name init`
Expected: migration succeeds, `prisma/migrations/<timestamp>_init/migration.sql` is created, Prisma Client is generated.

- [ ] **Step 5: Commit**

```bash
git add prisma package.json package-lock.json
git commit -m "Add Prisma schema and initial migration"
```

---

### Task 3: Pipeline stage domain logic (TDD)

**Files:**
- Create: `src/lib/pipeline.ts`
- Test: `src/lib/pipeline.test.ts`
- Modify: `package.json` (add `vitest` dev dependency and `"test": "vitest run"` script)

**Interfaces:**
- Produces: `PIPELINE_ORDER: PipelineStage[]`, `nextValidStages(current: PipelineStage): PipelineStage[]`. Later tasks (account detail screen, PATCH `/api/accounts/[id]`) import `nextValidStages` to populate/validate stage-change options.
- Consumes: `PipelineStage` type, mirrored locally (see step 2) so this file has no dependency on Prisma Client.

- [ ] **Step 1: Install Vitest**

```bash
npm install vitest --save-dev
```

Add to `package.json` `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing test**

`src/lib/pipeline.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextValidStages, PIPELINE_ORDER } from "./pipeline";

describe("nextValidStages", () => {
  it("allows moving forward from PROSPECT to any later stage, or to INACTIVE", () => {
    expect(nextValidStages("PROSPECT")).toEqual([
      "CONTACTED",
      "QUOTED",
      "ACTIVE_CUSTOMER",
      "INACTIVE",
    ]);
  });

  it("only allows INACTIVE from the final active stage", () => {
    expect(nextValidStages("ACTIVE_CUSTOMER")).toEqual(["INACTIVE"]);
  });

  it("allows reactivating an INACTIVE account into any active stage", () => {
    expect(nextValidStages("INACTIVE")).toEqual(PIPELINE_ORDER);
  });

  it("never includes the current stage itself", () => {
    for (const stage of PIPELINE_ORDER) {
      expect(nextValidStages(stage)).not.toContain(stage);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/pipeline.test.ts`
Expected: FAIL — `./pipeline` has no exported member `nextValidStages`/`PIPELINE_ORDER` (module doesn't exist yet).

- [ ] **Step 4: Implement**

`src/lib/pipeline.ts`:

```ts
export type PipelineStage =
  | "PROSPECT"
  | "CONTACTED"
  | "QUOTED"
  | "ACTIVE_CUSTOMER"
  | "INACTIVE";

export const PIPELINE_ORDER: PipelineStage[] = [
  "PROSPECT",
  "CONTACTED",
  "QUOTED",
  "ACTIVE_CUSTOMER",
];

export function nextValidStages(current: PipelineStage): PipelineStage[] {
  if (current === "INACTIVE") {
    return PIPELINE_ORDER;
  }
  const idx = PIPELINE_ORDER.indexOf(current);
  const forward = PIPELINE_ORDER.slice(idx + 1);
  return [...forward, "INACTIVE"];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/pipeline.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/pipeline.ts src/lib/pipeline.test.ts package.json package-lock.json
git commit -m "Add pipeline stage transition logic"
```

---

### Task 4: Needs-follow-up sort logic (TDD)

**Files:**
- Create: `src/lib/followUp.ts`
- Test: `src/lib/followUp.test.ts`

**Interfaces:**
- Produces: `FollowUpItem` type, `sortByNeedsFollowUp<T extends FollowUpItem>(items: T[]): T[]`. Consumed by the accounts list API route (Task 8) to implement default sort.

- [ ] **Step 1: Write the failing test**

`src/lib/followUp.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sortByNeedsFollowUp } from "./followUp";

describe("sortByNeedsFollowUp", () => {
  it("orders items with a nextActionDate soonest-first", () => {
    const items = [
      { id: "a", nextActionDate: new Date("2026-09-01") },
      { id: "b", nextActionDate: new Date("2026-08-20") },
      { id: "c", nextActionDate: new Date("2026-08-25") },
    ];
    expect(sortByNeedsFollowUp(items).map((i) => i.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("puts items with no nextActionDate after all dated items", () => {
    const items = [
      { id: "a", nextActionDate: null },
      { id: "b", nextActionDate: new Date("2026-08-20") },
    ];
    expect(sortByNeedsFollowUp(items).map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("does not mutate the input array", () => {
    const items = [
      { id: "a", nextActionDate: new Date("2026-09-01") },
      { id: "b", nextActionDate: new Date("2026-08-20") },
    ];
    const original = [...items];
    sortByNeedsFollowUp(items);
    expect(items).toEqual(original);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/followUp.test.ts`
Expected: FAIL — module `./followUp` does not exist.

- [ ] **Step 3: Implement**

`src/lib/followUp.ts`:

```ts
export interface FollowUpItem {
  id: string;
  nextActionDate: Date | null;
}

export function sortByNeedsFollowUp<T extends FollowUpItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.nextActionDate && b.nextActionDate) {
      return a.nextActionDate.getTime() - b.nextActionDate.getTime();
    }
    if (a.nextActionDate) return -1;
    if (b.nextActionDate) return 1;
    return 0;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/followUp.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/followUp.ts src/lib/followUp.test.ts
git commit -m "Add needs-follow-up sort logic"
```

---

### Task 5: Interaction ordering logic (TDD)

**Files:**
- Create: `src/lib/interactions.ts`
- Test: `src/lib/interactions.test.ts`

**Interfaces:**
- Produces: `TimelineItem` type, `sortInteractionsNewestFirst<T extends TimelineItem>(items: T[]): T[]`. Consumed by the account detail screen (Task 13) and the accounts list API route (Task 8, to find each account's most recent interaction).

- [ ] **Step 1: Write the failing test**

`src/lib/interactions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sortInteractionsNewestFirst } from "./interactions";

describe("sortInteractionsNewestFirst", () => {
  it("orders items newest date first", () => {
    const items = [
      { id: "a", date: new Date("2026-08-01") },
      { id: "b", date: new Date("2026-08-15") },
      { id: "c", date: new Date("2026-08-10") },
    ];
    expect(sortInteractionsNewestFirst(items).map((i) => i.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("does not mutate the input array", () => {
    const items = [
      { id: "a", date: new Date("2026-08-01") },
      { id: "b", date: new Date("2026-08-15") },
    ];
    const original = [...items];
    sortInteractionsNewestFirst(items);
    expect(items).toEqual(original);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/interactions.test.ts`
Expected: FAIL — module `./interactions` does not exist.

- [ ] **Step 3: Implement**

`src/lib/interactions.ts`:

```ts
export interface TimelineItem {
  id: string;
  date: Date;
}

export function sortInteractionsNewestFirst<T extends TimelineItem>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => b.date.getTime() - a.date.getTime());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/interactions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/interactions.ts src/lib/interactions.test.ts
git commit -m "Add interaction ordering logic"
```

---

### Task 6: Prisma client singleton and seed script

**Files:**
- Create: `src/lib/prisma.ts`, `prisma/seed.ts`
- Modify: `package.json` (add `bcryptjs`, `@types/bcryptjs`, `tsx` deps; add `"prisma": { "seed": "tsx prisma/seed.ts" }`)

**Interfaces:**
- Produces: `prisma` (singleton `PrismaClient` instance), exported from `src/lib/prisma.ts`. Every later API route imports this instead of instantiating its own client.
- Consumes: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` env vars.

- [ ] **Step 1: Install seed dependencies**

```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs tsx
```

- [ ] **Step 2: Write the Prisma client singleton**

`src/lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 3: Write the seed script**

`prisma/seed.ts`:

```ts
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to seed the admin user",
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  console.log(`Seeded user: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Add the `prisma.seed` config to `package.json`**

In `package.json`, add a top-level key:

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 5: Run the seed and verify**

Run: `npx prisma db seed`
Expected: prints `Seeded user: <your email>`. Verify with `npx prisma studio` that one row exists in `User` with a non-empty `passwordHash`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/prisma.ts prisma/seed.ts package.json package-lock.json
git commit -m "Add Prisma client singleton and admin seed script"
```

---

### Task 7: Authentication (Auth.js Credentials provider) and login page

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/providers.tsx`
- Modify: `src/app/layout.tsx` (wrap children in `<Providers>`)

**Interfaces:**
- Produces: `auth()`, `signIn`, `signOut`, `handlers` exported from `src/lib/auth.ts`. `middleware.ts` protects all routes except `/login` and `/api/auth/*`.
- Consumes: `prisma` from Task 6, `AUTH_SECRET` env var.

- [ ] **Step 1: Install Auth.js**

```bash
npm install next-auth@beta
```

- [ ] **Step 2: Write the auth config**

`src/lib/auth.ts`:

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
```

- [ ] **Step 3: Wire the API route handler**

`src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 4: Add route protection middleware**

`src/middleware.ts`:

```ts
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 5: Add a session provider wrapper**

`src/app/providers.tsx`:

```tsx
"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

Modify `src/app/layout.tsx` to wrap `{children}` with `<Providers>{children}</Providers>` (import `{ Providers } from "./providers"`).

- [ ] **Step 6: Write the login page**

`src/app/login/page.tsx`:

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-8">
        <h1 className="text-xl font-semibold">Ace Sales Tracker</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          className="w-full rounded border px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full rounded border px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          className="w-full rounded bg-blue-600 px-3 py-2 text-white"
        >
          Log in
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Generate `AUTH_SECRET` and verify login manually**

Run: `npx auth secret` (or `openssl rand -base64 32`) and put the result in `.env` as `AUTH_SECRET`.

Run: `npm run dev`, visit `http://localhost:3000` — expect a redirect to `/login`. Log in with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from Task 6.
Expected: successful login redirects to `/` and shows the placeholder home page instead of bouncing back to `/login`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth src/middleware.ts src/app/providers.tsx src/app/login src/app/layout.tsx package.json package-lock.json
git commit -m "Add single-user authentication"
```

---

### Task 8: Accounts API routes

**Files:**
- Create: `src/app/api/accounts/route.ts`, `src/app/api/accounts/[id]/route.ts`
- Create: `src/types/account.ts`

**Interfaces:**
- Consumes: `prisma` (Task 6), `sortByNeedsFollowUp` (Task 4), `nextValidStages` (Task 3).
- Produces:
  - `GET /api/accounts?stage=&type=&q=&sort=` → `AccountListItem[]`
  - `POST /api/accounts` (body: `AccountInput`) → created `AccountListItem`
  - `GET /api/accounts/[id]` → `AccountDetail`
  - `PATCH /api/accounts/[id]` (body: `Partial<AccountInput>`) → updated `AccountDetail`
  - Types `AccountListItem`, `AccountDetail`, `AccountInput` defined in `src/types/account.ts`, imported by later UI tasks (11, 12, 13).

- [ ] **Step 1: Define shared types**

`src/types/account.ts`:

```ts
import type {
  AccountType,
  PipelineStage,
  AccountSource,
} from "@prisma/client";

export interface AccountInput {
  name: string;
  addressLine?: string | null;
  city?: string;
  state?: string;
  zip?: string | null;
  phone?: string | null;
  accountType?: AccountType;
  pipelineStage?: PipelineStage;
  source?: AccountSource;
}

export interface AccountListItem {
  id: string;
  name: string;
  accountType: AccountType;
  pipelineStage: PipelineStage;
  lastInteractionDate: string | null;
  nextActionDate: string | null;
}

export interface AccountDetail extends AccountListItem {
  addressLine: string | null;
  city: string;
  state: string;
  zip: string | null;
  phone: string | null;
  source: AccountSource;
  contacts: {
    id: string;
    name: string;
    title: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
  }[];
  interactions: {
    id: string;
    date: string;
    type: "VISIT" | "CALL" | "EMAIL";
    notes: string | null;
    nextAction: string | null;
    nextActionDate: string | null;
  }[];
}
```

- [ ] **Step 2: Write the list + create route**

`src/app/api/accounts/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sortByNeedsFollowUp } from "@/lib/followUp";
import type { AccountInput, AccountListItem } from "@/types/account";
import type { AccountType, PipelineStage } from "@prisma/client";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const stage = params.get("stage") as PipelineStage | null;
  const type = params.get("type") as AccountType | null;
  const q = params.get("q");

  const accounts = await prisma.account.findMany({
    where: {
      ...(stage ? { pipelineStage: stage } : {}),
      ...(type ? { accountType: type } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    include: {
      interactions: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  const items: AccountListItem[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    accountType: a.accountType,
    pipelineStage: a.pipelineStage,
    lastInteractionDate: a.interactions[0]?.date.toISOString() ?? null,
    nextActionDate: a.interactions[0]?.nextActionDate?.toISOString() ?? null,
  }));

  const sorted = sortByNeedsFollowUp(
    items.map((i) => ({
      ...i,
      nextActionDate: i.nextActionDate ? new Date(i.nextActionDate) : null,
    })),
  ).map((i) => ({
    ...i,
    nextActionDate: i.nextActionDate ? i.nextActionDate.toISOString() : null,
  }));

  return NextResponse.json(sorted);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AccountInput;

  if (!body.name || body.name.trim() === "") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const account = await prisma.account.create({
    data: {
      name: body.name,
      addressLine: body.addressLine ?? null,
      city: body.city ?? "Harrisburg",
      state: body.state ?? "PA",
      zip: body.zip ?? null,
      phone: body.phone ?? null,
      accountType: body.accountType ?? "OTHER",
      pipelineStage: body.pipelineStage ?? "PROSPECT",
      source: body.source ?? "PROSPECTED",
    },
  });

  return NextResponse.json(account, { status: 201 });
}
```

- [ ] **Step 3: Write the detail + update route**

`src/app/api/accounts/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextValidStages } from "@/lib/pipeline";
import type { AccountInput } from "@/types/account";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      contacts: true,
      interactions: { orderBy: { date: "desc" } },
    },
  });

  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(account);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as Partial<AccountInput>;

  if (body.pipelineStage) {
    const current = await prisma.account.findUnique({
      where: { id },
      select: { pipelineStage: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const allowed = nextValidStages(current.pipelineStage);
    if (
      body.pipelineStage !== current.pipelineStage &&
      !allowed.includes(body.pipelineStage)
    ) {
      return NextResponse.json(
        { error: `Cannot move from ${current.pipelineStage} to ${body.pipelineStage}` },
        { status: 400 },
      );
    }
  }

  const account = await prisma.account.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(account);
}
```

- [ ] **Step 4: Verify by hand**

Run: `npm run dev`. With a logged-in browser session (or a REST client sending the session cookie), `POST /api/accounts` with `{"name":"Test Co"}`, then `GET /api/accounts` and confirm it appears, then `PATCH /api/accounts/<id>` with `{"pipelineStage":"CONTACTED"}` and confirm it updates, then with `{"pipelineStage":"PROSPECT"}` again and confirm it's rejected with a 400 (backward move not allowed).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/accounts src/types/account.ts
git commit -m "Add accounts API routes"
```

---

### Task 9: Contacts API routes

**Files:**
- Create: `src/app/api/accounts/[id]/contacts/route.ts`, `src/app/api/contacts/[id]/route.ts`
- Modify: `src/types/account.ts` (add `ContactInput`)

**Interfaces:**
- Consumes: `prisma` (Task 6).
- Produces:
  - `POST /api/accounts/[id]/contacts` (body: `ContactInput`) → created contact
  - `PATCH /api/contacts/[id]` (body: `Partial<ContactInput>`) → updated contact
  - `DELETE /api/contacts/[id]` → `{ ok: true }`

- [ ] **Step 1: Add the `ContactInput` type**

Append to `src/types/account.ts`:

```ts
export interface ContactInput {
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}
```

- [ ] **Step 2: Write the create route**

`src/app/api/accounts/[id]/contacts/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ContactInput } from "@/types/account";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as ContactInput;

  if (!body.name || body.name.trim() === "") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const contact = await prisma.contact.create({
    data: {
      accountId: id,
      name: body.name,
      title: body.title ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json(contact, { status: 201 });
}
```

- [ ] **Step 3: Write the update/delete route**

`src/app/api/contacts/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ContactInput } from "@/types/account";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as Partial<ContactInput>;

  const contact = await prisma.contact.update({
    where: { id },
    data: body,
  });

  return NextResponse.json(contact);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Verify by hand**

With the dev server running and a logged-in session, `POST /api/accounts/<accountId>/contacts` with `{"name":"Jane Doe","email":"jane@example.com"}`, confirm 201 and the contact appears when you `GET /api/accounts/<accountId>`. `PATCH /api/contacts/<contactId>` with `{"phone":"555-1234"}` and confirm it updates. `DELETE /api/contacts/<contactId>` and confirm it's gone.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/accounts/[id]/contacts src/app/api/contacts src/types/account.ts
git commit -m "Add contacts API routes"
```

---

### Task 10: Interactions API route

**Files:**
- Create: `src/app/api/accounts/[id]/interactions/route.ts`
- Modify: `src/types/account.ts` (add `InteractionInput`)

**Interfaces:**
- Consumes: `prisma` (Task 6).
- Produces: `POST /api/accounts/[id]/interactions` (body: `InteractionInput`) → created interaction.

- [ ] **Step 1: Add the `InteractionInput` type**

Append to `src/types/account.ts`:

```ts
export interface InteractionInput {
  date: string;
  type: "VISIT" | "CALL" | "EMAIL";
  notes?: string | null;
  nextAction?: string | null;
  nextActionDate?: string | null;
}
```

- [ ] **Step 2: Write the create route**

`src/app/api/accounts/[id]/interactions/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { InteractionInput } from "@/types/account";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as InteractionInput;

  if (!body.date || !body.type) {
    return NextResponse.json(
      { error: "date and type are required" },
      { status: 400 },
    );
  }

  const interaction = await prisma.interaction.create({
    data: {
      accountId: id,
      date: new Date(body.date),
      type: body.type,
      notes: body.notes ?? null,
      nextAction: body.nextAction ?? null,
      nextActionDate: body.nextActionDate ? new Date(body.nextActionDate) : null,
    },
  });

  return NextResponse.json(interaction, { status: 201 });
}
```

- [ ] **Step 3: Verify by hand**

`POST /api/accounts/<accountId>/interactions` with `{"date":"2026-08-17","type":"VISIT","notes":"Dropped off samples","nextAction":"Follow up on quote","nextActionDate":"2026-08-24"}`. Confirm 201, and that `GET /api/accounts` now shows this account's `nextActionDate` as `2026-08-24` and it sorts ahead of accounts with later/no next action dates.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/accounts/[id]/interactions src/types/account.ts
git commit -m "Add interactions API route"
```

---

### Task 11: Account list screen

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/page.tsx`, `src/components/AccountList.tsx`
- Modify: `src/app/page.tsx` — delete it (superseded by `src/app/(dashboard)/page.tsx`)

**Interfaces:**
- Consumes: `GET /api/accounts` (Task 8), `AccountListItem` type (Task 8).
- Produces: default route `/` renders the account list; `AccountList` component consumed by Task 12/13 nav links.

- [ ] **Step 1: Add a dashboard layout with simple nav**

`src/app/(dashboard)/layout.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <nav className="flex items-center gap-4 border-b p-4">
        <Link href="/" className="font-semibold">
          Ace Sales Tracker
        </Link>
        <Link href="/accounts/new" className="text-blue-600">
          + New account
        </Link>
      </nav>
      <div className="p-4">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Delete the old placeholder home page**

Run: remove `src/app/page.tsx` (its content moves into the dashboard route group below).

- [ ] **Step 3: Write the `AccountList` component**

`src/components/AccountList.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AccountListItem } from "@/types/account";

const STAGES = ["PROSPECT", "CONTACTED", "QUOTED", "ACTIVE_CUSTOMER", "INACTIVE"];
const TYPES = ["CONTRACTOR", "RESTAURANT", "PROPERTY_MGMT", "MUNICIPAL", "OTHER"];

export function AccountList() {
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [stage, setStage] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (stage) params.set("stage", stage);
    if (type) params.set("type", type);
    if (q) params.set("q", q);

    setLoading(true);
    fetch(`/api/accounts?${params.toString()}`)
      .then((res) => res.json())
      .then(setAccounts)
      .finally(() => setLoading(false));
  }, [stage, type, q]);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          placeholder="Search by name"
          className="rounded border px-3 py-2"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded border px-3 py-2"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="rounded border px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : accounts.length === 0 ? (
        <p className="text-gray-600">No accounts yet — add your first one.</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="p-2">Name</th>
              <th className="p-2">Type</th>
              <th className="p-2">Stage</th>
              <th className="p-2">Last contact</th>
              <th className="p-2">Next action</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b hover:bg-gray-50">
                <td className="p-2">
                  <Link href={`/accounts/${a.id}`} className="text-blue-600">
                    {a.name}
                  </Link>
                </td>
                <td className="p-2">{a.accountType}</td>
                <td className="p-2">{a.pipelineStage}</td>
                <td className="p-2">
                  {a.lastInteractionDate
                    ? new Date(a.lastInteractionDate).toLocaleDateString()
                    : "—"}
                </td>
                <td className="p-2">
                  {a.nextActionDate
                    ? new Date(a.nextActionDate).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the page**

`src/app/(dashboard)/page.tsx`:

```tsx
import { AccountList } from "@/components/AccountList";

export default function AccountsPage() {
  return <AccountList />;
}
```

- [ ] **Step 5: Verify by hand**

Run: `npm run dev`, log in, visit `/`. Confirm the account(s) created in Tasks 8–10 show up, filtering by stage/type narrows the list, and search by name works.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard) src/components/AccountList.tsx
git rm src/app/page.tsx
git commit -m "Add account list screen"
```

---

### Task 12: New account form screen

**Files:**
- Create: `src/app/(dashboard)/accounts/new/page.tsx`, `src/components/AccountForm.tsx`

**Interfaces:**
- Consumes: `POST /api/accounts` (Task 8), `AccountInput` type (Task 8).
- Produces: `AccountForm` component, reused (in edit mode) by Task 13.

- [ ] **Step 1: Write the reusable `AccountForm` component**

`src/components/AccountForm.tsx`:

```tsx
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
```

- [ ] **Step 2: Write the new-account page**

`src/app/(dashboard)/accounts/new/page.tsx`:

```tsx
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
```

- [ ] **Step 3: Verify by hand**

Visit `/accounts/new`, fill in a business name, submit. Confirm it redirects to `/accounts/<id>` (a 404 is expected there until Task 13 lands — confirm via `GET /api/accounts` or Prisma Studio that the row was created correctly instead).

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/accounts/new src/components/AccountForm.tsx
git commit -m "Add new account form screen"
```

---

### Task 13: Account detail screen

**Files:**
- Create: `src/app/(dashboard)/accounts/[id]/page.tsx`, `src/components/InteractionTimeline.tsx`, `src/components/InteractionForm.tsx`, `src/components/ContactList.tsx`

**Interfaces:**
- Consumes: `GET/PATCH /api/accounts/[id]` (Task 8), `POST /api/accounts/[id]/contacts` and `/api/contacts/[id]` (Task 9), `POST /api/accounts/[id]/interactions` (Task 10), `sortInteractionsNewestFirst` (Task 5), `nextValidStages` (Task 3), `AccountForm` (Task 12).

- [ ] **Step 1: Write `InteractionTimeline`**

`src/components/InteractionTimeline.tsx`:

```tsx
import { sortInteractionsNewestFirst } from "@/lib/interactions";
import type { AccountDetail } from "@/types/account";

export function InteractionTimeline({
  interactions,
}: {
  interactions: AccountDetail["interactions"];
}) {
  const sorted = sortInteractionsNewestFirst(
    interactions.map((i) => ({ ...i, date: new Date(i.date) })),
  );

  if (sorted.length === 0) {
    return <p className="text-gray-600">No interactions logged yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {sorted.map((i) => (
        <li key={i.id} className="border-b pb-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{i.type}</span>
            <span>{i.date.toLocaleDateString()}</span>
          </div>
          {i.notes && <p>{i.notes}</p>}
          {i.nextAction && (
            <p className="text-sm text-blue-700">
              Next: {i.nextAction}
              {i.nextActionDate &&
                ` (by ${new Date(i.nextActionDate).toLocaleDateString()})`}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Write `InteractionForm`**

`src/components/InteractionForm.tsx`:

```tsx
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
```

- [ ] **Step 3: Write `ContactList`**

`src/components/ContactList.tsx`:

```tsx
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
```

- [ ] **Step 4: Write the account detail page**

`src/app/(dashboard)/accounts/[id]/page.tsx`:

```tsx
"use client";

import { use, useCallback, useEffect, useState } from "react";
import { nextValidStages, type PipelineStage } from "@/lib/pipeline";
import { InteractionTimeline } from "@/components/InteractionTimeline";
import { InteractionForm } from "@/components/InteractionForm";
import { ContactList } from "@/components/ContactList";
import { AccountForm } from "@/components/AccountForm";
import type { AccountDetail, AccountInput } from "@/types/account";

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/accounts/${id}`)
      .then((res) => res.json())
      .then(setAccount);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!account) return <p>Loading...</p>;

  async function changeStage(stage: PipelineStage) {
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipelineStage: stage }),
    });
    load();
  }

  async function updateInfo(input: AccountInput) {
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    setEditing(false);
    load();
  }

  async function logInteraction(input: {
    date: string;
    type: "VISIT" | "CALL" | "EMAIL";
    notes: string;
    nextAction: string;
    nextActionDate: string;
  }) {
    await fetch(`/api/accounts/${id}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: input.date,
        type: input.type,
        notes: input.notes || null,
        nextAction: input.nextAction || null,
        nextActionDate: input.nextActionDate || null,
      }),
    });
    load();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        {editing ? (
          <div>
            <AccountForm
              initial={account}
              onSubmit={updateInfo}
              submitLabel="Save changes"
            />
            <button
              onClick={() => setEditing(false)}
              className="mt-2 text-sm text-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">{account.name}</h1>
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-blue-600"
              >
                Edit
              </button>
            </div>
            <p className="text-gray-600">
              {account.addressLine ? `${account.addressLine}, ` : ""}
              {account.city}, {account.state} {account.zip}
            </p>
            <p className="text-gray-600">{account.phone}</p>
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded bg-gray-100 px-2 py-1 text-sm">
            {account.pipelineStage}
          </span>
          {nextValidStages(account.pipelineStage).map((stage) => (
            <button
              key={stage}
              onClick={() => changeStage(stage)}
              className="rounded border px-2 py-1 text-sm"
            >
              Move to {stage}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Contacts</h2>
        <ContactList accountId={id} contacts={account.contacts} onChange={load} />
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Log an interaction</h2>
        <InteractionForm onSubmit={logInteraction} />
      </div>

      <div>
        <h2 className="mb-2 font-semibold">History</h2>
        <InteractionTimeline interactions={account.interactions} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify by hand**

Visit an account created earlier at `/accounts/<id>`. Confirm: business info displays; clicking "Edit" shows the `AccountForm` pre-filled with the account's current values, and saving updates the displayed info and exits edit mode; adding a contact shows it immediately; logging an interaction adds it to History and, if it set a next action date, that the account list's "Next action" column updates accordingly; clicking a "Move to X" button changes the stage badge and only offers valid next stages.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/accounts/[id] src/components/InteractionTimeline.tsx src/components/InteractionForm.tsx src/components/ContactList.tsx
git commit -m "Add account detail screen"
```

---

### Task 14: Deployment

**Files:**
- Create: `README.md`
- Modify: `.env.example` (confirm it lists everything needed in production)

**Interfaces:**
- Produces: a deployed, publicly reachable (but login-gated) instance of the app on Vercel.

- [ ] **Step 1: Write `README.md` with a deployment walkthrough**

```markdown
# Ace Sales Tracker

Account/lead tracker for outside sales at Ace Hardware (Harrisburg, PA).

## Local development

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (see below), `AUTH_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
2. `npm install`
3. `npx prisma migrate deploy`
4. `npx prisma db seed`
5. `npm run dev`

## Deploying (one-time setup)

1. **Create a Neon Postgres database:** go to neon.tech, sign up, create a project. Copy the connection string it gives you — that's your `DATABASE_URL`.
2. **Push this repo to GitHub:** create a new (private) repo on GitHub and push this project to it.
3. **Create a Vercel account and import the repo:** go to vercel.com, sign up (GitHub login is easiest), click "Add New Project", and import the GitHub repo you just created.
4. **Set environment variables in Vercel:** in the project's Settings → Environment Variables, add `DATABASE_URL`, `AUTH_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` with the same values as your local `.env`.
5. **Deploy:** Vercel deploys automatically on import and on every push to the main branch.
6. **Run migrations and seed against the production database:** from your local machine, temporarily point `.env`'s `DATABASE_URL` at the same Neon database Vercel is using (it already is, if you used the same one in steps 1 and 4), then run `npx prisma migrate deploy` and `npx prisma db seed` once.
7. Visit the URL Vercel gives you and log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

Every future `git push` to the main branch redeploys automatically.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add deployment documentation"
```

- [ ] **Step 3: Walk through deployment with the user**

This step is done together with the user, not solo — they must create the Neon, GitHub, and Vercel accounts themselves (Claude cannot create accounts or enter credentials on their behalf). Follow the README steps above interactively, confirming each one succeeds before moving to the next, until the app is live and login works at the Vercel URL.

---

## Post-plan check

After Task 14, the user should be able to: log in from a browser at a real URL, see an empty account list, add the handful of inherited customers by hand, log a visit against one, and see it reflected in the list's "next action" sort — fulfilling the Phase 1 spec in full. Phases 2–4 (follow-ups, routing, prospecting/proposals) are separate specs/plans to be brainstormed when the user is ready to start each one.
