-- =====================================================================
-- TradeMate SA: initial database schema (Phase 2)
-- Run this once in the Supabase SQL Editor.
-- Money is stored as whole cents (R10.50 = 1050) so maths is exact.
-- One user = one business. Every row belongs to a business, and Row
-- Level Security (RLS) makes sure users only ever see their own rows.
-- =====================================================================

-- ---------- TABLES ----------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'My Business',
  phone text,
  email text,
  address text,
  logo_url text,
  currency text not null default 'ZAR',
  vat_enabled boolean not null default false,
  vat_rate numeric(5,2) not null default 15.00 check (vat_rate >= 0 and vat_rate <= 100),
  vat_number text,
  quote_prefix text not null default 'Q-',
  next_quote_number integer not null default 1 check (next_quote_number >= 1),
  default_terms text,
  created_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, business_id)
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid,
  quote_number text not null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  issue_date date not null default current_date,
  expiry_date date,
  vat_enabled boolean not null default false,
  vat_rate numeric(5,2) not null default 15.00 check (vat_rate >= 0 and vat_rate <= 100),
  labour_cents bigint not null default 0 check (labour_cents >= 0),
  transport_cents bigint not null default 0 check (transport_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  subtotal_cents bigint not null default 0,
  vat_cents bigint not null default 0,
  total_cents bigint not null default 0,
  notes text,
  terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  unique (business_id, quote_number),
  -- a quotation can only point at a customer of the SAME business
  foreign key (customer_id, business_id)
    references public.customers (id, business_id) on delete set null (customer_id)
);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  quotation_id uuid not null,
  kind text not null default 'material' check (kind in ('material', 'service')),
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_price_cents bigint not null default 0 check (unit_price_cents >= 0),
  sort_order integer not null default 0,
  foreign key (quotation_id, business_id)
    references public.quotations (id, business_id) on delete cascade
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid,
  quotation_id uuid,
  title text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (customer_id, business_id)
    references public.customers (id, business_id) on delete set null (customer_id),
  foreign key (quotation_id, business_id)
    references public.quotations (id, business_id) on delete set null (quotation_id)
);

create index on public.customers (business_id);
create index on public.quotations (business_id);
create index on public.quotation_items (quotation_id);
create index on public.jobs (business_id);

-- ---------- HELPER FUNCTIONS ----------

-- Which business does the logged-in user own?
create or replace function public.current_business_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from public.businesses where owner_id = (select auth.uid()) limit 1
$$;

-- Creates a business automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.businesses (owner_id, name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''), 'My Business')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Hands out the next quotation number (e.g. Q-0001) safely, one at a time.
create or replace function public.generate_quote_number()
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  result text;
begin
  update public.businesses
     set next_quote_number = next_quote_number + 1
   where owner_id = (select auth.uid())
  returning quote_prefix || lpad((next_quote_number - 1)::text, 4, '0') into result;

  if result is null then
    raise exception 'No business found for this user';
  end if;
  return result;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger quotations_updated_at before update on public.quotations
  for each row execute function public.set_updated_at();
create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

-- ---------- SECURITY (Row Level Security) ----------

alter table public.businesses       enable row level security;
alter table public.customers        enable row level security;
alter table public.quotations       enable row level security;
alter table public.quotation_items  enable row level security;
alter table public.jobs             enable row level security;

-- Businesses: you can read and edit only your own.
create policy "read own business" on public.businesses
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "update own business" on public.businesses
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Everything else: only rows that belong to your business.
create policy "own customers" on public.customers
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "own quotations" on public.quotations
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "own quotation items" on public.quotation_items
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create policy "own jobs" on public.jobs
  for all to authenticated
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- ---------- PERMISSIONS ----------
-- Logged-out visitors (anon) get nothing. Logged-in users get only what they need.

revoke all on public.businesses, public.customers, public.quotations,
              public.quotation_items, public.jobs from anon;

grant select, update on public.businesses to authenticated;
grant select, insert, update, delete
  on public.customers, public.quotations, public.quotation_items, public.jobs
  to authenticated;

revoke all on function public.current_business_id()  from public, anon;
revoke all on function public.generate_quote_number() from public, anon;
revoke all on function public.handle_new_user()       from public, anon, authenticated;
grant execute on function public.current_business_id()  to authenticated;
grant execute on function public.generate_quote_number() to authenticated;
