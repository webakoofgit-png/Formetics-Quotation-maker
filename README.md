# Formatix Quote Manager

React 19, TypeScript, TanStack Start, Tailwind, shadcn/ui, Lucide, Recharts and Supabase. The existing Lovable stack is preserved.

## Run locally

```sh
npm ci
cp .env.example .env
npm run dev
```

The app opens on a dedicated **client demo login screen**. The default mode works on Vercel and locally **without any Supabase connection or registration**.

- Username: `admin`
- Password: `Formatix@123`

These are intentionally public demonstration credentials, checked in the browser. They are not secure production authentication. The demo remembers access in the current tab using session storage, keeps saved records in browser-local storage, and offers Sign out in Account. Different browsers/devices do not share records. Download PDFs to attach manually in WhatsApp; this mode does not host PDF links.

`VITE_AUTH_MODE` defaults to `local`. Supabase authentication is not initialized in this mode, even if old Supabase variables are present. For the optional cloud workflow below, explicitly set `VITE_AUTH_MODE=cloud`. Only cloud mode supports registration and authenticated shared records. Cloud mode can expose an optional browser demo entry with `VITE_ENABLE_DEMO=true`; this never authorizes cloud data.

No customer records or business metrics are fabricated. The illustrative catalog is editable and is **not official Formatix pricing**. The supplied Formatix logo is used in login, sidebar, previews, PDFs and the favicon. Its source image is preserved; layout clips the unused outer space. The original quotation HTML and screenshot were not supplied. Replace demo services/prices and configure studio details before business use.

## Enable persistent cloud mode

This is optional and is **not needed for the client demo**. Enable it only by explicitly setting `VITE_AUTH_MODE=cloud`.

1. Apply `supabase/migrations/202611020001_formatix.sql` in the connected Supabase SQL editor or deploy it through your usual migration workflow. It adds new `formatix_*` tables without touching existing application tables.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in your deployment. Only public publishable credentials belong in the frontend. Never add a service-role key.
3. Configure Supabase Auth email/password sign-in, email confirmation and your deployment URL.
4. On the opening login screen, create/confirm an account, sign in, then choose **Create studio workspace** if this is a new studio. Existing employees need their Admin to add their registered email. Cloud workspaces start empty and never silently import demo records.
5. Enter company details in Settings and add verified services. An Admin can add registered employees by email and assign Admin or Staff access. Each account belongs to one studio.

Cloud activation was **not performed in this session**: the Lovable connection returned “This app connection requires reauthentication.” Live authentication, hosted storage and production deployment remain unverified. The migration and authorization RPCs were executed in a disposable local PostgreSQL instance during testing.

## Available workflows

- Responsive collapsible sidebar and accessible mobile drawer; hash navigation supports back/forward without reloading. Unsaved forms survive page navigation; local drafts also survive refresh.
- Record-based dashboard: quotation value, bookings, follow-ups, conversion, monthly charts, status filters, top services, recent quotations and employee results.
- Car/bike builder, vehicle categories, multiple services, Admin custom items/price edits, discounts, GST, advances and balance. Phone normalization groups customers with multiple vehicles.
- Draft/Sent/Booked/Lost; searchable, date-filtered, sortable, paginated quotation list; view, edit, duplicate, PDF and follow-up actions.
- Customer histories/notes; follow-up list/calendar, scheduling, rescheduling, completion and reopening.
- Catalog with category-specific prices, vehicle applicability, active status and ordering. Quotations keep their saved prices when the catalog changes.
- CSV reports for quotations, employees, lead sources and booked service value. Quotation/booked values are distinct from manually recorded advances; no verified collection ledger is implied.
- Multipage A4 PDF preview/download with validity, vehicle, itemized prices, GST, advances, balance, terms and payment details.
- Cloud WhatsApp sharing uploads a private PDF and shares a signed URL valid for seven days. WhatsApp receives a link, not an automatically attached document. Treat signed links as access-bearing links. Local mode supports download without pretending to have a hosted URL.

## Money, persistence and permissions

Amounts are **integer paise**. Prices include 18% GST. Discount is applied to the inclusive subtotal, taxable value is rounded from `total * 100 / 118`, GST is the exact remainder and balance is total minus booking amount. Invalid discounts, negative prices, excessive advances and unsafe totals are rejected. Tax stays fixed at 18%.

Authenticated atomic RPCs recompute totals, validate Staff item prices, enforce Admin-only catalog/settings/member changes, and update relational customers, vehicles, services, vehicle prices, quotations, quotation items, follow-ups and settings. RLS restricts reads to studio membership; direct table writes are revoked. Audit entries record actor, revision and action. Optimistic revisions reject stale saves: use Account > Refresh cloud records before retrying.

The workspace document and relational projections are saved in one transaction, with a 5 MB document limit. This suits a small studio. Larger deployments should move to per-record mutations, retained audit diffs, server pagination and a verified payment ledger. Manually refresh to retrieve another session's changes; realtime sync is not implemented.

## Verification

```sh
npx tsc --noEmit
npm test
npm run build
```

Tests cover financial invariants, PDF page breaks, customer deduplication, navigation/save persistence, the actual SQL migration, stale revisions, role enforcement and cross-workspace isolation. Database tests emulate Supabase Auth/Storage primitives locally; they do not prove hosted auth or signed-link delivery.

For browser QA, start the dev server on port 8080 and run:

```sh
node scripts/verify-browser.mjs
```

The browser script uses installed Chrome on Windows by default. Set `CHROME_PATH` to another executable, or install Playwright Chromium. Screenshots and a PDF are saved to ignored `artifacts/`. It checks desktop/mobile quotation creation, booking changes, follow-up calendar, PDF preview/download, drawer navigation and overflow.

Repository: https://github.com/webakoofgit-png/Formetics-Quotation-maker

Preserve connected Lovable history: do not force push, rebase or amend published commits. Environment files, dependencies, build output and test artifacts are excluded from Git. Copy `.env.example` to `.env` and configure the public Supabase connection values locally. Cloud activation and deployment are separate from pushing the source code.
