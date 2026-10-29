-- NearBase family accounts. Run this in the Supabase SQL editor.
-- The service role key (used only by Netlify functions) bypasses these policies.
-- Families sign in with an email magic link. There are no passwords.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  email text not null default '',
  plan text not null default '',
  status text not null default '',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  base_id text,
  hours text,
  cost_ceiling text,
  ages jsonb not null default '[]'::jsonb,
  philosophies jsonb not null default '[]'::jsonb,
  mccyn boolean not null default false,
  subsidy boolean not null default false,
  efmp boolean not null default false,
  timing text,
  quiz_votes jsonb not null default '{}'::jsonb,
  spot_alerts jsonb not null default '{"enabled":false,"slugs":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  school_slug text not null,
  school_name text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, school_slug)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  email text not null default '',
  sku text not null,
  status text not null default 'paid',
  stripe_customer_id text,
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.preferences enable row level security;
alter table public.favorites enable row level security;
alter table public.orders enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions
  for select using (
    user_id = auth.uid()
    or email = (select email from public.profiles where id = auth.uid())
  );

drop policy if exists "read own preferences" on public.preferences;
create policy "read own preferences" on public.preferences
  for select using (user_id = auth.uid());

drop policy if exists "insert own preferences" on public.preferences;
create policy "insert own preferences" on public.preferences
  for insert with check (user_id = auth.uid());

drop policy if exists "update own preferences" on public.preferences;
create policy "update own preferences" on public.preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read own favorites" on public.favorites;
create policy "read own favorites" on public.favorites
  for select using (user_id = auth.uid());

drop policy if exists "insert own favorites" on public.favorites;
create policy "insert own favorites" on public.favorites
  for insert with check (user_id = auth.uid());

drop policy if exists "delete own favorites" on public.favorites;
create policy "delete own favorites" on public.favorites
  for delete using (user_id = auth.uid());

drop policy if exists "read own orders" on public.orders;
create policy "read own orders" on public.orders
  for select using (
    user_id = auth.uid()
    or email = (select email from public.profiles where id = auth.uid())
  );

-- Check-ins, ranking votes, and research votes stay anonymous.
-- They are not stored in these tables and are never joined to an account.
