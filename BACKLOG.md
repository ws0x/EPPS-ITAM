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

## Status update (2026-07-10) — Phases A–D are done

Everything above this line describes what was *planned*. As of now it's done and verified: checkout/acceptance flow (with e-signature), the approval-request cycle (UI + backend), analytics dashboards, the legacy data migration (assets/users/departments/locations + a follow-up pass for licenses/license seats/consumables/kits/historical acceptances), and production deployment (Vercel project `itam`, live, auto-deploying on push to `main`, all core env vars set — `RESEND_API_KEY` is the one still missing, so the approval cycle can't send email yet).

Current data scale, for context on everything below: 1,351 assets, 278 users, 970 license seats, 479 checkouts/acceptances (migrated from history — the source system had no discrete checkout-event log, only current assignment, so these are historically-dated but not literally 479 independent transactions in the way new ones will be), 21 departments, 39 locations. **This is real company data now, not a sandbox** — treat it accordingly (no throwaway test rows, no destructive experiments without a backup plan).

Two known open issues from that work, still unaddressed: the Assets list page has no pagination (will render all 1,351+ rows at once — a real scalability problem now, not theoretical), and there's a batch of pre-existing lint debt (React purity violations, unescaped JSX entities) in the checkout/request dialog components — build still succeeds, nothing is broken, just quality debt.

## Phase E — Comprehensive activity log

**Current state, precisely:** the `audit_logs` table exists and is queried by an admin-only viewer page (`/audit-logs`), but as of today it has **zero rows in production** — the only three places that ever write to it (`src/lib/actions/checkout.ts`, `acceptances.ts`, `requests.ts`) log checkout/check-in, accept/decline, and request create/decide events, and none of those code paths have been exercised against production data yet (the 479 migrated checkouts were inserted directly by the migration script, bypassing the application layer entirely). **Nothing logs CRUD on any other module** (assets, licenses, consumables, kits, locations, departments, manufacturers, models, users, categories), and **nothing logs login/logout**.

What "an activity log like Snipe-IT's" actually means in Snipe-IT: a global chronological feed of every create/update/delete/checkout/checkin/login-type event across the whole system, each row showing actor, action, target, and timestamp, plus (this is the part easy to miss) a **filtered "History" view scoped to one specific record** — Snipe-IT shows this as a tab on every asset/user/license detail page, not just as one global un-scoped feed.

Build plan:
1. A single `logActivity({ actorUserId, actionType, targetType, targetId, meta })` helper in `src/lib/audit.ts`, wrapping the existing `auditLogs` insert pattern already used in checkout.ts/acceptances.ts/requests.ts (don't reinvent the shape, just centralize it so it's called consistently instead of copy-pasted per module).
2. Call it from **every** create/update/delete Server Action across every module — this is mechanical but touches a lot of files (assets, licenses, consumables, kits, locations, departments, manufacturers, models, users, categories). Best done as one focused pass per module, testing each as you go, not all at once blind.
3. Login/logout: hook into `src/app/login/actions.ts`'s `login()` (log both success and failed attempts — failed-login visibility is itself a security-relevant feature, not just nice-to-have) and `src/lib/auth/actions.ts`'s `logout()`.
4. The existing `/audit-logs` page becomes the global feed — add filters (by actor, by action type, by date range, by target type) since a raw unfiltered feed over real data volume stops being useful fast.
5. Add a "History" section to each detail page that already exists (asset `/assets/[id]`, license `/licenses/[id]`, kit `/kits/[id]`) filtered to `targetType + targetId` — reusing the same query, just parameterized.
6. **Open design question, flagged below rather than assumed:** should edits log field-level before/after diffs (e.g., "purchaseCost changed from 500 to 550"), or just "asset X was updated" with a link to view current state? Diffs are meaningfully more valuable for a real audit trail and are what Snipe-IT actually does, but cost more to build (need to capture the pre-update row before every mutation and compute a diff) — this is the single biggest scope/complexity fork in this whole epic.

## Phase F — Checkout/check-in history (per-item and per-person)

**Current state:** the `checkouts` table has real data (479 rows) and the app can create new checkout/checkin events, but **there is no UI anywhere that shows this history** — not on an asset's detail page, not anywhere for a person. This is a different, narrower thing than Phase E's audit log: Phase E is "everything that happened, system-wide, for compliance/security," this is "the custody timeline of this one asset" or "everything this one person currently has and has ever had" — both are needed, they serve different questions.

Build plan:
1. **Per-item history**: a "Checkout History" tab/section on the asset/license/kit/consumable detail pages — chronological list of `checkouts` rows for that `checkoutableId`, showing who had it, checked-out/checked-in dates, notes, and the linked acceptance status if one exists.
2. **Per-person history**: this needs a **User Detail page, which doesn't exist yet** — Users today is list + edit-dialog only, no detail view. Build `/users/[id]` showing: everything currently assigned to them (assets/consumables/license seats), plus their full historical checkout log. This is very likely also where the offboarding bulk check-in (Phase G) belongs, UI-wise.

## Phase G — Bulk operations

Snipe-IT features named explicitly: bulk check-in (especially tied to removing/offboarding a person — check in everything they hold in one action) and a "checkout all" style flow. Currently there is **no multi-select mechanism anywhere in this app** — every list is single-row-action only.

Build plan, roughly in value order:
1. **Bulk check-in on user offboarding** — on the new `/users/[id]` page (Phase F), an "Check in everything" action that, in one transaction, checks in every currently-assigned asset, releases every assigned license seat, and returns every consumable quantity tied to that person. This is the one explicitly motivated by a real workflow ("if I want to delete the user and check in all of his items").
2. **Bulk check-in from the Assets list** — multi-select checkboxes on `/assets`, a "N selected" action bar, bulk check-in for the selected deployed assets.
3. **Bulk checkout** — multi-select assets → one dialog → assign all selected to one person in one transaction (mirrors the existing single-asset checkout dialog's logic, just fanned out).
Needs a genuine UI pattern addition (row checkboxes + sticky selection action bar) that doesn't exist in any list page today — build it once as a reusable pattern, not per-page.

## Phase H — Asset coding engine + Purchase Orders

These are two connected but distinct features — a coding/tagging scheme for *newly created* assets, and a PO document-generation workflow. Bundled here because the user's ask connected them, but they can be built and shipped independently.

### H1 — Coding engine (auto-generated asset tags)

**The category-based scheme is the right call, and here's the actual reasoning, not just agreement:** a pure sequential global tag (`ITAM-000001`, `ITAM-000002`, ...) — which is exactly what the *migrated* legacy assets already have — tells you nothing about the item from the tag alone; you always need to look it up. A category-scoped scheme (`LAP-0001`, `MON-0001`, `PRN-0001`, one counter per category) is the actual industry-standard warehouse/asset-tagging convention for good reason: the tag itself is self-describing, which matters enormously for physical labels, barcode scans during a walk-through audit, and a manager skimming a spreadsheet without the app open. This is not a stylistic choice — it's the more correct design for the stated goal (warehouse-style coding), and it's what I'd recommend even without the user's lean toward it.

Concrete design (needs your confirmation, not just my recommendation, on two specific points — see questions below):
- Add a `codePrefix` column to `categories` (e.g., Laptop→`LAP`, Monitor→`MON`, Printer→`PRN`). **Don't auto-derive this from the category name** (first 3 letters) — with categories like "Laptop" and "Laptop Bag" both starting `LAP`, auto-derivation collides. Make it an explicit, admin-editable field, pre-filled with a suggested value the admin can override, validated for uniqueness across categories at save time.
- Per-category sequence counter, stored safely against concurrent creates (two admins adding assets in the same category at the same moment must never get the same number) — a Postgres sequence per category, or a `SELECT ... FOR UPDATE`-guarded counter column on `categories`, not a naive `count(*) + 1` (which race-conditions under concurrency).
- Format: `{PREFIX}-{zero-padded sequence}`, e.g. `LAP-0042`. Padding width (4 digits handles 9,999 per category — almost certainly enough per-category, but confirm) and separator style are cheap to bikeshed now and annoying to change later once real tags exist.
- **Critical constraint, already correctly identified by the user:** this only applies going forward. The 1,351 migrated assets keep their legacy `ITAM-XXXXXXX` tags exactly as imported — no backfill, no renumbering. Implementation-wise this is simple: the asset creation form's `assetTag` field switches from free-text entry to auto-generated + read-only (category selection determines the generated tag before submit), full stop — no migration touches existing rows.

### H2 — Purchase Order generation

**Complete as of 2026-07-16.** Schema (`purchase_orders`, `purchase_order_lines`, `po_beneficiary_companies`, `po_beneficiary_departments`, `po_counters`, plus `companies.managingDirectorUserId`) migrated and seeded on the live database; `it_manager` role granted `purchase_orders:*`. Server actions (`src/lib/actions/purchase-orders.ts`) cover create/update/line-item add-remove/submit/decide, with a concurrency-safe atomic PO-number counter (`src/lib/po-number.ts`, verified under simulated concurrent creates) and the exact totals formula (`src/lib/po-totals.ts`). Full UI at `/purchase-orders` (list, create dialog, detail/edit page with header form + line items + totals, submit button) and the public Managing-Director decision page at `/purchase-orders/decide` (token + 7-day expiry + admin override, mirroring `requests/decide`). PDF export at `/purchase-orders/[id]/pdf` via `@react-pdf/renderer`, rendering the real letterhead/footer brand images and matching the Excel template's layout and totals exactly — hit and fixed a real Windows-only bug where a raw absolute file path broke `@react-pdf/image`'s local-file detection (drive letter parsed as a URL protocol, silently falling through to a failed network fetch); fixed by reading the brand images as Buffers instead. Full flow (create → add line → submit → approve → PDF) verified live in-browser against the real Supabase database, with all test data cleaned up afterward. Still blocked: `RESEND_API_KEY` is not configured, so the MD approval email doesn't actually send yet (fails gracefully, PO still submits and the decide link still works if reached directly).

**Unblocked as of 2026-07-15** — the user provided the real Excel template (`ORDER IT 23-2026A.xlsx`) and its approved PDF output. Inspected directly with openpyxl (both the formula view and the cached-value view), not just eyeballed the PDF, so the logic below is exact, not inferred.

**Real fields and layout (sheet "PO"):** PO NO, DATE, PR NO header row. Supplier Details: Supplier Name/Address/Tel/Fax/Email (left, per-order input) vs. Client Name/Address/Tel/Fax/Email (right, **fixed** — always Makka's own letterhead info, never changes per order). Line table: `#, ITEM CODE, ITEM DESCRIPTION, UNIT, PRICE (EGP), QUANTITY, BENEFICIARY COMPANY, BENEFICIARY DEPT., BENEFICIARY EMPLOYEE, TOTAL PRICE (EGP)` — multi-row capable (the template's total formula, `=SUM(L22:INDEX(L:L, ROW(L23)-1))`, sums everything above the totals row dynamically). Commercial Terms table: Payment Term, Delivery date, Note (free text — used in the example for an e-invoice number, not a fixed field). Signature block: "Technology Department" (preparer) + "Managing Director" (approver).

**Totals — exact formulas to replicate server-side (never let the user type a total, always computed):**
```
subtotal        = SUM(line.unitPrice * line.quantity)
vatAmount       = vatRegistered ? subtotal * 0.14 : 0
whtAmount       = advancePaymentRegistered ? 0 : subtotal * 0.01   // note the inverse logic — WHT applies when NOT registered for advance payments
miscWithVat     = eInvoiced ? miscAmount * 1.14 : miscAmount
totalAmount     = subtotal + vatAmount + miscWithVat - whtAmount
```
`vatRegistered`, `advancePaymentRegistered`, and `eInvoiced` are each a Yes/No toggle on the order (not per-line). `miscAmount` + `miscType` (dropdown: Shipping Cost / Installation Fees / Repairing Fees / Transportations) is a single miscellaneous-charge line, separate from the item table.

**Confirmed decisions (2026-07-15):**
- **Managing Director is one fixed approver for every PO**, regardless of requester/department — model as a single well-known user (or a dedicated `managing_director` role), not a per-department lookup.
- **PO numbers auto-generate** as `IT {n}-{year}`, sequential per year (matches the existing manual convention exactly — e.g. next after `IT 23-2026` is `IT 24-2026`, then `IT 1-2027`). Needs the same concurrency care as the asset-coding engine in H1 (a real per-year counter, not `count(*) + 1`).
- **Beneficiary Company and Beneficiary Department are their own separate, admin-editable reference lists** — deliberately *not* merged into ITAM's existing `departments` table, since they're a different taxonomy serving a different purpose (finance beneficiary-tracking on POs, not org structure). Seed them verbatim from the template's "Ranges" sheet:
  - **Beneficiary Companies**: Makka, Fibco Global, Factory - MIG, Factory - Conveyors Components, Factory - Conveyors, 3A.
  - **Beneficiary Departments** (23): Accounts Receivables, Agricultural Agencies, Agricultural Products, Automation, Business Development, CEO, Factory Equipment, General Accounting, HR & Personnel, IT, Legal Affairs, Local Purchasing, Machinery Sales, Maintenance, Marketing, MIG Commercial, Plastic Agencies, Material Sales, Reception, Sales Coordination, Supply Chain, Support Services, Warehouses.

**Brand assets — extracted directly from the xlsx's embedded images (not redrawn, not approximated) and already committed to the repo at `public/brand/`:**
- `makka-letterhead.png` — full header banner (wordmark "Egyptian Packaging & Plastic Systems / Makka Al-Mokarama", tagline "Your First Choice in the Packaging World", logo mark), maroon/brown (`#3D1F12`-ish) and tan/beige (`#D4B896`-ish) on white.
- `makka-logo-mark.png` — the circular logo mark alone (the stylized "mo" monogram + globe icon).
- `makka-po-footer.png` — the footer contact-info bar (phones, emails, website, address) in the same maroon icon style.
- The user said to keep this identity as-is (logo, brand colors) while allowed to "revise and optimize" everything else about the layout — read that as license to clean up spacing/typography/table styling, not to touch the letterhead, logo, or brand colors.

**Build plan:**
1. `purchase_orders` + `purchase_order_lines` schema, plus `po_beneficiary_companies` and `po_beneficiary_departments` lookup tables (seeded as above) — `companyId`-scoped like everything else here. Fields per order: `poNumber` (auto), `date`, `prNumber` (nullable), supplier name/address/tel/fax/email, `vatRegistered`/`advancePaymentRegistered`/`eInvoiced` (bools), `miscAmount`/`miscType` (nullable), `paymentTerm`, `deliveryDate`, `note`, `preparedByUserId`, `approverUserId` (always the Managing Director), `status` (draft/pending_approval/approved/rejected), the same hashed-token + 7-day-expiry approval fields already proven in `requests`. Per line: `itemCode` (nullable — leave room to wire to the H1 coding engine later, not required now), `description`, `unit`, `unitPrice`, `quantity`, `beneficiaryCompany`, `beneficiaryDepartment`, `beneficiaryEmployee`.
2. Create/edit UI — a form plus a line-item editor; the closest existing precedent in this codebase is the kit-item-management pattern on `/kits/[id]` (add/remove line items against a parent record) — reuse that shape, don't invent a new one.
3. PDF generation via **`@react-pdf/renderer`** (pure JS, no Chromium binary — matters on Vercel serverless) rendering the letterhead image, the exact table/totals layout above, and the footer image. Single-page structured document, comfortably within react-pdf's layout model — no reason to reach for a heavier Puppeteer-based approach here.
4. Approval reuses the existing single-step pattern from `src/lib/actions/requests.ts` (hashed token link, email, 7-day expiry) — approver is always the Managing Director, not resolved per-department like item-allocation requests are.

## Phase I — Checkout flow policy change: IT-staff checkouts need IT-manager notification/approval

**This is a behavior change to something that already works today, not a pure addition — flagging clearly rather than quietly altering existing functionality.** Right now, checkout dialogs on the asset/consumable/kit detail pages let a technician or admin directly check an item out to any user, immediately, no approval gate — that's separate from the item-allocation `requests` flow (which is for an *employee* self-requesting something, approved by their manager). The new ask is that when **IT staff initiate** a checkout (assigning item X to person Y), that should itself become an approval-gated action, notifying the **IT manager specifically** (not the assignee's manager), with its own dashboard view for "checkout assignments awaiting my approval" — distinct from the existing `/requests` page, which is for employee-initiated item requests.

Mechanically this is a smaller lift than it sounds, since the approval-request machinery already exists — it's largely a matter of: should a direct-checkout action get replaced with "create a pending checkout-approval" for some/all roles, then only actually call the existing `checkout.ts` logic once approved. But the *scope* of this change needs a decision only you can make (see questions) — applying it universally vs. selectively changes both the engineering shape and, more importantly, whether it's a net workflow improvement or new friction for people who currently rely on instant checkout.

## Phase J — Visual theme: more casual, fancy, and visually appealing

Re-opening a decision made earlier in this project: the current theme (deep teal, dark persistent sidebar, dense "ERP-professional" — uppercase labels, stat cards with accent bars) was deliberately modeled on FAERP's *structural* design language while picking a different accent color. FAERP itself, on inspection, is also fundamentally a buttoned-up professional ERP look (deep blue, dark navy sidebar) — not casual or playful. So "more casual, more fancy, more visually appealing, like FAERP but more" isn't a small nudge on the existing direction, it's asking for something with more personality than either system currently has. That's a legitimate direction to take this, but it needs concrete creative input, not my guess — see questions below before any theme work starts, since re-doing a full visual pass twice is expensive and avoidable.

## A note on how this file came to exist

This backlog was written after actually reading the current code (not from a stale plan) — the "gaps" in Phase A were discovered by grepping for things that *should* exist if the feature were complete (e.g., no `acceptCheckout` action exists anywhere in the repo, no page calls `createRequestAction`) rather than trusting the commit message `"feat: implement checkout/checkin flows and email-based approval cycle"` at face value. Whoever picks this up next should do the same gut-check before assuming this document is still accurate — check `git log` since this was written, and re-verify anything you're about to build isn't already there.
