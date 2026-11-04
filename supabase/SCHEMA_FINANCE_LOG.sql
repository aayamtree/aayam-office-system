-- Finance log (separate from activity_logs) + ledger balance check.
-- Applied to project aayam-fresh on 2026-11-04 as migration "finance_log_and_balance_check".
create table if not exists public.finance_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  action text not null check (action in ('added','edited','deleted','warning')),
  category text not null check (category in ('transaction','contact','account','rule','setting')),
  entity_type text,
  entity_id text,
  entity_label text,
  changes jsonb,
  snapshot jsonb,
  note text
);
create index if not exists finance_log_created_at_idx on public.finance_log (created_at desc);
create index if not exists finance_log_category_idx on public.finance_log (category, created_at desc);
alter table public.finance_log enable row level security;
drop policy if exists finance_log_read on public.finance_log;
create policy finance_log_read on public.finance_log
  for select to authenticated using ((select public.fn_is_admin())); -- admin only (changed 2026-11-04)
drop policy if exists finance_log_insert on public.finance_log;
create policy finance_log_insert on public.finance_log
  for insert to authenticated
  with check ((select public.fn_is_finance_staff()) and user_id = auth.uid());
revoke update, delete on public.finance_log from authenticated, anon;

create or replace function public.fn_ledger_balance_check()
returns table(total_debit numeric, total_credit numeric, difference numeric, unbalanced_entries bigint)
language sql stable security invoker set search_path = public
as $$
  select
    coalesce(sum(debit_amount),0),
    coalesce(sum(credit_amount),0),
    round(coalesce(sum(debit_amount),0) - coalesce(sum(credit_amount),0), 2),
    (select count(*) from (
        select journal_entry_id from public.journal_entry_lines
        group by journal_entry_id
        having round(sum(debit_amount) - sum(credit_amount), 2) <> 0
     ) x)
  from public.journal_entry_lines
$$;
