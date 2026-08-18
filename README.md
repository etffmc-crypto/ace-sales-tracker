# Ace Sales Tracker

Account/lead tracker for outside sales at Ace Hardware (Harrisburg, PA).

## Local development

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (see below), `AUTH_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`, `CRON_SECRET` (shared secret Vercel Cron sends as a bearer token to authenticate the automated prospecting job).
2. `npm install`
3. `npx prisma migrate deploy`
4. `npx prisma db seed`
5. `npm run dev`

## Deploying (one-time setup)

1. **Create a Neon Postgres database:** go to neon.tech, sign up, create a project. Copy the connection string it gives you — that's your `DATABASE_URL`.
2. **Push this repo to GitHub:** create a new (private) repo on GitHub and push this project to it.
3. **Create a Vercel account and import the repo:** go to vercel.com, sign up (GitHub login is easiest), click "Add New Project", and import the GitHub repo you just created.
4. **Set environment variables in Vercel:** in the project's Settings → Environment Variables, add `DATABASE_URL`, `AUTH_SECRET`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`, `CRON_SECRET` (shared secret Vercel Cron sends as a bearer token to authenticate the automated prospecting job) with the same values as your local `.env`.
5. **Deploy:** Vercel deploys automatically on import and on every push to the main branch.
6. **Run migrations and seed against the production database:** from your local machine, temporarily point `.env`'s `DATABASE_URL` at the same Neon database Vercel is using (it already is, if you used the same one in steps 1 and 4), then run `npx prisma migrate deploy` and `npx prisma db seed` once.
7. Visit the URL Vercel gives you and log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

Every future `git push` to the main branch redeploys automatically.
