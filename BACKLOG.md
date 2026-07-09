# ITAM Backlog — Next Phases

This is a working backlog for whoever picks up this project next (currently handed to Gemini). It assumes **no prior context from any conversation** — everything you need to know about decisions already made, gotchas already hit, and what's actually built vs. what only looks built is here.

Repo: [github.com/ws0x/EPPS-ITAM](https://github.com/ws0x/EPPS-ITAM). This is a from-scratch rebuild of Makka Corp's Snipe-IT-based IT Asset Management system, on Next.js 16 + Supabase (Postgres + Auth) + Drizzle ORM + Vercel, for a single company (EPPS HQ / Makka Corp).

## Read this first — things that will waste your time if you don't know them

1. **This project uses Base UI (`@base-ui/react`), not Radix.** The shadcn preset installed is "Nova" on the Base UI library. Composition uses a **`render` prop**, not Radix's `asChild`. E.g. `<Button render={<Link href="/x" />}>` not `<Button asChild><Link>...</Link></Button>`. If you see a TypeScript error about `asChild` not existing, this is why. Also: `Button` needs `nativeButton={false}` when its `render` target isn't a real `<button>` (e.g. a `Link`), or Base UI logs a console warning.
2. **Next.js 16 renamed `middleware.ts` to `proxy.ts`.** The file is `src/proxy.ts`, exporting `function proxy(request)` (or default export), not `middleware`. Don't "fix" this back to middleware.ts — it's intentional and matches the installed Next version. If confused about any other Next 16 API, check `node_modules/next/dist/docs/` before assuming your training data is current — this codebase's `AGENTS.md` warns about this explicitly.
3. **Row Level Security does not apply here, on purpose.** Drizzle connects straight to Postgres with a service-level connection string, not through Supabase's PostgREST data API — so Supabase RLS policies (if any exist) are never evaluated for this app's queries. **All authorization must be enforced in application code.** The pattern: every Server Action starts with `const user = await requireUser()` then `requirePermission(user, "resource:*")` (see `src/lib/auth/dal.ts` and `src/lib/auth/permissions.ts`). If you add a new mutation and skip this, you've added an unauthenticated/unauthorized hole, not a shortcut.
4. **Database connection quirks (Supabase-specific, cost real time to figure out once already):**
   - The direct connection host (`db.<ref>.supabase.co:5432`) requires IPv6 and doesn't resolve on all networks. Use the **session pooler** (`aws-0-<region>.pooler.supabase.com:5432`) for migrations (`DIRECT_URL` in `.env.local`) and the **transaction pooler** (port 6543) for app runtime (`DATABASE_URL`). `drizzle.config.ts` already prefers `DIRECT_URL` for this reason — don't change it back to the direct host without checking IPv6 works in your environment first.
   - Supabase-generated DB passwords can contain a literal `:` character, which breaks a `postgresql://user:password@host` connection string unless the password is percent-encoded (`:` → `%3A`). If you ever regenerate the DB password, re-encode it in `.env.local`.
   - `.env.local` is gitignored (correctly) — ask the user for credentials directly, don't expect to find them in the repo.
5. **Permission strings are coarse, resource-scoped wildcards**, not fine-grained CRUD verbs: `"assets:*"`, `"licenses:*"`, `"consumables:*"`, `"kits:*"`, `"users:manage"`, `"requests:approve_any"`, `"requests:approve_own_reports"`, `"requests:create_own"`, `"assets:view_own"`. Roles are seeded in `src/db/seed/data.ts`: `admin` (`*`), `it_manager`, `department_approver`, `technician`, `employee`. If a new feature needs a permission that doesn't exist yet, add the string to the relevant role(s) in that seed file and note it — don't invent ad-hoc checks elsewhere.
6. **Category taxonomy is a deliberate, already-cleaned artifact — don't regenerate it from raw Snipe-IT data.** The legacy system had 124 categories; only 67 are actually active (the rest are old soft-deleted duplicates from prior reorganizations). `src/db/seed/data.ts` already has the correct 67 (49 asset, 15 license, 3 consumable), derived via `scripts/parse-legacy-categories.mjs`. Accessory and Component category types were **intentionally excluded from v1** — every accessory/component category in the legacy system turned out to already be soft-deleted, confirming they're not needed yet.
7. **Legacy data quality issues to expect when you get to the migration script (Phase C below):** a stray category literally named "Consumables" is typed `asset` in the legacy system (looks like a miscategorized catch-all — decide its fate once you see real row counts); several assets reference soft-deleted status labels (e.g. status_id for "Deployed Deployed") that need remapping to the clean equivalent ("Deployed"); the legacy `assets` table stores ~90 custom fields as literal columns (`_snipeit_ram_6` etc.) — this project replaces that with a JSONB `attributes` column per category (see `src/db/schema/catalog.ts`'s `CategoryAttributeDef` type), so migration needs to fold those columns into JSON, not recreate them as columns.
8. **The single-step approval cycle (direct manager only) was a deliberate v1 scope decision**, not an oversight — a tiered/value-based approval workflow was explicitly deferred to a later phase. Don't "improve" it to a multi-step workflow without checking with the user first.

## Current state — what's actually built (verified against the live code, not just commit messages)

Done and working (typecheck/lint/build all pass as of the last commit `43433d1`):
- Schema (22 tables), auth (Supabase Auth + custom RBAC), full CRUD for Assets/Licenses/Consumables/Kits/Locations/Departments/Manufacturers/Models/Users.
- Checkout/checkin for assets, consumables, kits, and license seats (`src/lib/actions/checkout.ts`), including creating an `acceptances` row when a category's `requiresAcceptance` flag is set.
- An approval-request backend (`src/lib/actions/requests.ts`): `createRequestAction` and `decideRequestAction`, with SHA-256-hashed approval tokens (not raw tokens stored), a 7-day link expiry, audit logging, and approver-fallback routing (requester's manager → IT Manager → Admin → any user in the company).
- A decision page at `/requests/decide` (outside the main app shell, meant to be reached via the emailed link) with an approve/reject form.
- A visual theme redesign (deep teal, dark persistent sidebar, stat cards, mono font for technical fields) — inspired by a sibling project's ERP look but intentionally distinct.

**Gaps in what looks done — found by actually reading the code, not assumed from the commit message:**
- **No employee-facing UI to actually submit a request.** `createRequestAction` exists and works, but nothing in `src/app` calls it — there is no "Request an Item" button/form/page anywhere in the app. Right now the only way to create a request is by calling the server action directly (e.g. from a script). This is most of Phase A below.
- **The acceptance/e-signature loop is only half-built.** `acceptances` rows get created with `status: "pending"` on checkout, but there is no page or action anywhere for the assignee to actually view the EULA and accept/decline it (no `acceptCheckout`/`declineCheckout` action exists, confirmed via repo-wide search). Every acceptance created today will sit in "pending" forever.
- **Email will hard-fail right now.** `RESEND_API_KEY` is not set in `.env.local`. `createRequestAction` explicitly throws if `sendEmail()` reports failure, which means **the entire request-creation transaction rolls back** if email isn't configured — so until this is fixed, nobody can create a request at all, not even without email working. Also, `src/lib/email.ts` sends from `onboarding@resend.dev` (Resend's shared test address), which won't reliably deliver in production — a verified sending domain is needed.
- **No visibility into pending approvals/acceptances anywhere in the UI** — no dashboard widget, no nav badge, no "My Requests" page. Approvers only find out via the emailed link; if that link is missed, the request is invisible until someone thinks to check.
- **No audit log viewer.** `auditLogs` rows are being written correctly by both checkout and request actions, but there's no page to read them back.
- A Vercel project is already linked (`.vercel/project.json` → project `itam`) — deployment (Phase D) may be partially set up already; verify rather than assuming a blank slate.

## Phase A — Close the gaps in the approval/acceptance loop (recommended P0; do this before analytics/migration, since it's the highest-value unfinished work and the gaps are narrow and well-understood)

1. **Configure Resend properly.** Get an API key, add `RESEND_API_KEY` to `.env.local` (and to Vercel's env vars for prod), and either verify a real sending domain in Resend or clearly document that the test address is a placeholder. Consider making `createRequestAction` degrade gracefully (log + continue) instead of hard-failing the whole transaction if email delivery fails, so a transient email outage doesn't block someone from submitting a request — discuss with the user before changing that behavior, since "no request without a working notification" might be intentional.
2. **Build the employee-facing "Request an Item" flow.** A form (model or category + quantity + justification) that calls `createRequestAction`. Natural entry points: a button on `/assets` (or a dedicated `/requests/new` page), plus probably a `/requests` page listing "my requests" and their status. Wire real navigation for this — right now there's no sidebar entry for it either.
3. **Build the acceptance/e-signature flow for the assignee.** At minimum: a page showing the assignee's pending acceptances (EULA snapshot text + accept/decline), and two new Server Actions (`acceptCheckout`, `declineCheckout`) that update the `acceptances` row (`status`, `acceptedAt`/`declinedAt`) — mirroring the transaction-safety and audit-logging patterns already used in `checkout.ts`. Decide with the user whether a real signature (typed name, drawn canvas signature, or just a checkbox) is needed for v1 — Snipe-IT's original had a signature image, but a typed-name + checkbox may be an acceptable v1 simplification given the "temporary password over a form field" precedent set for user creation.
4. **Surface pending items.** A dashboard stat card or sidebar badge for "pending approvals" (for approvers) and "pending acceptances" (for assignees) — reuse the existing `StatCard` component pattern from `src/components/stat-card.tsx`.
5. *(Nice-to-have, not blocking)* A simple audit log viewer page — the data is already there, just needs a read-only table view, probably admin-only (`requirePermission(user, "*")` or a new `"audit:view"` permission).

## Phase B — Analytics dashboards

Build out real ITAM analytics beyond the current basic dashboard stat cards (total assets, deployed count, total value, user count — see `src/lib/actions/dashboard.ts`). Prioritize, roughly in order of value:
1. **Utilization** — deployed vs. idle/in-storage ratio, by category and by department.
2. **Cost & depreciation** — total asset value over time, using the existing `depreciations` table (defined in schema, currently unused by any query) and `purchaseCost`/`purchaseDate`.
3. **Expiry forecasting** — licenses expiring in the next 30/60/90 days (the `expiresAt` field already exists and is displayed as a badge on the Licenses list; turn it into a dashboard widget), warranty expirations on assets.
4. **Audit/compliance** — % of assets audited within their `nextAuditDate` window (fields exist on `assets`, currently unused by any workflow — there's no "run an audit" action yet either, which may itself be a small Phase B/C task).
5. **Checkout turnaround** — average time between `checkedOutAt` and `checkedInAt` on the `checkouts` table.

This project has a `dataviz` skill available (if working in Claude Code) with house style guidance for chart colors/forms — check for an equivalent guideline if working in a different tool, and otherwise keep charts consistent with the existing teal-accent theme rather than introducing a new default color scheme.

## Phase C — Legacy data migration script

Goal: import the real Snipe-IT data (SQL dump + CSV exports the user has) into this schema. A `migration/` folder already exists as a placeholder (`migration/README.md`) for the user to drop the backup files into.

- **Scope decision already made: full history migration** — all assets (including archived), the full audit trail, licenses, consumables, kits, users, departments, locations. Not a "current state only" import.
- Reuse `scripts/parse-legacy-categories.mjs` as a reference for parsing `INSERT INTO ... VALUES (...)` tuples out of a mysqldump — it handles quoted-string escaping and the CRLF-line-ending gotcha (searching for `;\n` as a statement terminator fails on a CRLF dump; search for a bare `;` instead, since no legacy category name contains one).
- Map legacy `_snipeit_*` custom-field columns on `assets` into the new `attributes` JSONB column, keyed by the category's `attributesSchema` (see `src/db/schema/catalog.ts`).
- Expect and handle the known data-quality issues listed in item 7 of "Read this first" above.
- This should almost certainly be a one-off script under `scripts/` (following the pattern of `scripts/parse-legacy-categories.mjs` and `src/db/seed/*.ts`), run manually against the real DB once ready — not a UI feature.

## Phase D — Production deployment

- Verify the existing Vercel project link (`.vercel/project.json`, project `itam`) actually has the right environment variables set (all of `.env.local`'s keys, appropriately split between server-only and `NEXT_PUBLIC_*`).
- **Before real company data goes in:** the Supabase project is on the free tier, which pauses after 7 days of inactivity and has no point-in-time backups — upgrade the relevant Supabase org to Pro before this becomes a production system holding real employee PII and asset custody records, not after.
- Custom domain, if the user wants one, is a Vercel dashboard task, not a code task.
- Confirm `git push` to `main` actually triggers a Vercel deploy (should be automatic once the GitHub integration is connected via the Vercel dashboard) — this hasn't been explicitly verified yet.

## A note on how this file came to exist

This backlog was written after actually reading the current code (not from a stale plan) — the "gaps" in Phase A were discovered by grepping for things that *should* exist if the feature were complete (e.g., no `acceptCheckout` action exists anywhere in the repo, no page calls `createRequestAction`) rather than trusting the commit message `"feat: implement checkout/checkin flows and email-based approval cycle"` at face value. Whoever picks this up next should do the same gut-check before assuming this document is still accurate — check `git log` since this was written, and re-verify anything you're about to build isn't already there.
