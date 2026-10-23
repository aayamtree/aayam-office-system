-- CMYK petty cash: one shared cash box, topped up from another CMYK account and counted by hand.
alter table public.cmyk_accounts add column if not exists is_petty_cash boolean not null default false;
alter table public.cmyk_accounts add column if not exists float_amount numeric not null default 0;
create unique index if not exists cmyk_accounts_one_petty_cash on public.cmyk_accounts (is_petty_cash) where is_petty_cash;

insert into public.cmyk_accounts (name, type, opening_balance, is_active, sort_order, is_petty_cash, float_amount, notes)
select 'Petty Cash', 'cash', 0, true, 50, true, 5000, 'Small cash box for daily spends. Topped up from another CMYK account.'
where not exists (select 1 from public.cmyk_accounts where is_petty_cash);

-- Money moved between two CMYK accounts (a petty cash top-up is one of these).
create table if not exists public.cmyk_account_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_date date not null default current_date,
  from_account_id uuid not null references public.cmyk_accounts(id),
  to_account_id uuid not null references public.cmyk_accounts(id),
  amount numeric not null check (amount > 0),
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);
alter table public.cmyk_account_transfers enable row level security;
drop policy if exists auth_all_cmyk_account_transfers on public.cmyk_account_transfers;
create policy auth_all_cmyk_account_transfers on public.cmyk_account_transfers
  for all to authenticated using (true) with check (true);

-- Physical cash counts of the petty cash box.
create table if not exists public.cmyk_petty_cash_counts (
  id uuid primary key default gen_random_uuid(),
  count_date date not null default current_date,
  book_amount numeric not null,
  counted_amount numeric not null check (counted_amount >= 0),
  difference numeric not null,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.cmyk_petty_cash_counts enable row level security;
drop policy if exists auth_all_cmyk_petty_cash_counts on public.cmyk_petty_cash_counts;
create policy auth_all_cmyk_petty_cash_counts on public.cmyk_petty_cash_counts
  for all to authenticated using (true) with check (true);
