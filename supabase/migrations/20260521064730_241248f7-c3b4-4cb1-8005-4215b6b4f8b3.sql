
-- People (no auth; just two static rows)
create table public.people (
  id text primary key,
  display_name text not null,
  color text not null
);
insert into public.people (id, display_name, color) values
  ('slawek', 'Slawek', 'teal'),
  ('natalia', 'Natalia', 'coral');

-- Recurring expense templates
create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric(10,2) not null check (amount >= 0),
  day_of_month int not null check (day_of_month between 1 and 31),
  category text not null,
  person_id text not null references public.people(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Receipts
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  extracted_total numeric(10,2),
  raw_ocr_text text,
  person_id text not null references public.people(id),
  created_at timestamptz not null default now()
);

-- Expenses
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  amount numeric(10,2) not null check (amount >= 0),
  category text not null check (category in (
    'food','utilities','rent','fuel','hobbies','gaming',
    'clothing','health','restaurants','subscriptions','other'
  )),
  spent_on date not null default current_date,
  description text not null default '',
  person_id text not null references public.people(id),
  receipt_id uuid references public.receipts(id) on delete set null,
  recurring_id uuid references public.recurring_expenses(id) on delete set null,
  created_at timestamptz not null default now()
);
create index expenses_spent_on_idx on public.expenses (spent_on desc);
create index expenses_person_idx on public.expenses (person_id);

-- Recurring instances (materialization tracking)
create table public.recurring_instances (
  id uuid primary key default gen_random_uuid(),
  recurring_id uuid not null references public.recurring_expenses(id) on delete cascade,
  year_month text not null,
  expense_id uuid references public.expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (recurring_id, year_month)
);

-- Settings
create table public.settings (
  id int primary key default 1,
  monthly_budget numeric(10,2),
  constraint settings_singleton check (id = 1)
);
insert into public.settings (id, monthly_budget) values (1, null);

-- RLS: shared household, no auth -> permissive
alter table public.people enable row level security;
alter table public.expenses enable row level security;
alter table public.recurring_expenses enable row level security;
alter table public.recurring_instances enable row level security;
alter table public.receipts enable row level security;
alter table public.settings enable row level security;

create policy "people open" on public.people for all using (true) with check (true);
create policy "expenses open" on public.expenses for all using (true) with check (true);
create policy "recurring open" on public.recurring_expenses for all using (true) with check (true);
create policy "recurring_instances open" on public.recurring_instances for all using (true) with check (true);
create policy "receipts open" on public.receipts for all using (true) with check (true);
create policy "settings open" on public.settings for all using (true) with check (true);

-- Storage bucket for receipts
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true)
  on conflict (id) do nothing;

create policy "receipts bucket read" on storage.objects
  for select using (bucket_id = 'receipts');
create policy "receipts bucket insert" on storage.objects
  for insert with check (bucket_id = 'receipts');
create policy "receipts bucket update" on storage.objects
  for update using (bucket_id = 'receipts');
create policy "receipts bucket delete" on storage.objects
  for delete using (bucket_id = 'receipts');
