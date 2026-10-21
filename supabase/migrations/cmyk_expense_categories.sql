-- CMYK expense categories: lets admins add / remove categories from the Expenses page.
create table if not exists public.cmyk_expense_categories (
  id uuid primary key default gen_random_uuid(),
  value text not null unique,
  label text not null,
  color text not null default 'slate',
  is_system boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.cmyk_expense_categories enable row level security;
drop policy if exists auth_all_cmyk_expense_categories on public.cmyk_expense_categories;
create policy auth_all_cmyk_expense_categories on public.cmyk_expense_categories
  for all to authenticated using (true) with check (true);
insert into public.cmyk_expense_categories (value,label,color,is_system,sort_order) values
 ('transportation','Transportation','blue',false,1),
 ('electricity','Electricity','yellow',false,2),
 ('maintenance','Maintenance','orange',false,3),
 ('consumables','Consumables','purple',false,4),
 ('labor','Labor','green',false,5),
 ('other','Other','slate',true,99)
on conflict (value) do nothing;
