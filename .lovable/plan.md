# Household Budget App — Plan

A shared budget app for two people (Slawek & Natalia). No login — a simple user switcher decides who is currently adding entries. Mobile-first, soft teal/green palette, EN labels (easy to swap to PL later).

## 1. Stack & setup

- React + TanStack Start (existing template)
- Lovable Cloud (Supabase) for DB + Storage
- Lovable AI Gateway (Gemini vision) for receipt OCR — no extra API key needed
- Recharts for charts
- shadcn/ui components, Tailwind, teal/mint theme tokens in `src/styles.css`

## 2. Data model (Supabase)

```text
profiles_static (seeded, not auth)
  - id text PK ('slawek' | 'natalia')
  - display_name text
  - color text

expenses
  - id uuid PK
  - amount numeric(10,2)
  - category text       -- enum-checked
  - spent_on date
  - description text
  - person_id text FK -> profiles_static.id
  - receipt_id uuid NULL FK -> receipts.id
  - recurring_id uuid NULL FK -> recurring_expenses.id
  - created_at timestamptz

recurring_expenses
  - id uuid PK
  - name text
  - amount numeric(10,2)
  - day_of_month int (1-31)
  - category text
  - person_id text FK
  - active bool default true
  - created_at timestamptz

recurring_instances
  - id uuid PK
  - recurring_id uuid FK
  - year_month text     -- 'YYYY-MM'
  - expense_id uuid FK NULL  -- set once materialized/paid
  - unique(recurring_id, year_month)

receipts
  - id uuid PK
  - storage_path text   -- in 'receipts' bucket
  - extracted_total numeric NULL
  - raw_ocr_text text NULL
  - person_id text FK
  - created_at timestamptz

settings
  - id int PK default 1
  - monthly_budget numeric NULL
```

Categories (CHECK constraint): food, utilities, rent, fuel, hobbies, gaming, clothing, health, restaurants, subscriptions, other.

Since there's no auth, tables get **permissive RLS** (open read/write) — explicitly acceptable for this personal-use app. Will be flagged in security memory.

Storage: public `receipts` bucket.

## 3. Routes (TanStack file-based)

```text
src/routes/
  __root.tsx          -- shell + bottom nav + person switcher in header
  index.tsx           -- Dashboard
  add.tsx             -- Add Expense (with receipt-scan tab)
  recurring.tsx       -- Recurring bills CRUD + month status
  receipts.tsx        -- Receipts gallery
```

Bottom nav: Dashboard / Add / Recurring / Receipts.

## 4. Features

**Person switcher** — persisted in localStorage, shown as pill in header (Slawek = teal, Natalia = coral). Drives `person_id` on new entries.

**Add Expense** — amount, category (icon grid), date (default today), description, person (prefilled, editable). Optional "Scan receipt" entry path that opens camera/file picker.

**Receipt OCR** — upload image → store in `receipts` bucket → server function calls Lovable AI Gateway (`google/gemini-2.5-flash` with vision) asking for structured JSON `{ total, currency, merchant?, date? }` → prefill Add Expense form. Receipt row linked to created expense.

**Recurring expenses** — list with edit/delete. Each month, a "materialize" action (and auto on dashboard load for current month) creates `expenses` rows for the month if missing. Visual badges: upcoming (within 5 days), overdue (past due, not yet logged this month), paid.

**Dashboard**
- Month picker (default current)
- Tiles: total this month, Slawek total, Natalia total, remaining vs `monthly_budget`
- Pie chart: spending by category (combined)
- Stacked bar: per-person split by category
- Recent expenses feed with person badge, category icon, amount
- Filter chips: All / Slawek / Natalia

## 5. Server functions

- `createExpense`, `updateExpense`, `deleteExpense`
- `listExpenses({ month, personId? })`
- `upsertRecurring`, `listRecurring`, `materializeRecurringForMonth(month)`
- `uploadReceipt` (signed upload) + `parseReceipt(receiptId)` — calls AI gateway
- `getMonthlyStats(month)` returns totals/by-category/by-person
- `getSettings` / `updateSettings`

All under `src/lib/*.functions.ts`. No auth middleware (open app), but inputs validated with Zod.

## 6. Design

- Theme tokens: teal primary (`oklch(0.7 0.13 180)`), mint surfaces, warm coral accent for Natalia, deep teal for Slawek. Rounded-2xl cards, generous spacing, soft shadows.
- Mobile-first; bottom nav fixed; FAB-style "+" on dashboard linking to Add.
- Category icons via lucide-react.

## 7. Build order

1. Enable Lovable Cloud; create schema migration, seed `profiles_static`, create storage bucket.
2. Theme tokens + root layout + bottom nav + person switcher.
3. Add Expense flow + expenses list.
4. Recurring expenses + monthly materialization.
5. Dashboard with charts + budget setting.
6. Receipt upload + AI OCR + receipts gallery.
7. Polish, empty states, loading skeletons.

## Open assumptions (will proceed unless you say otherwise)

- EN labels for now (easy to swap).
- Single currency, no symbol config — defaults to PLN (zł).
- No auth; data is shared/open within the app.
- OCR extracts total only (merchant/date as nice-to-haves if model returns them).