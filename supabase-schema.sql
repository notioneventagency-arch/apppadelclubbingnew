-- Padelclubbing initial schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.events (
 id uuid primary key default gen_random_uuid(), title text not null, description text,
 starts_at timestamptz, location text, category text default 'Training', published boolean not null default false,
 created_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null
);
create table if not exists public.news (
 id uuid primary key default gen_random_uuid(), title text not null, description text,
 image_url text, published boolean not null default false,
 created_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete set null
);
alter table public.events enable row level security;
alter table public.news enable row level security;
-- Public can read only published entries.
create policy "Public read published events" on public.events for select using (published = true);
create policy "Public read published news" on public.news for select using (published = true);
-- Any authenticated user can manage content in this starter. For production, restrict this to approved admins.
create policy "Authenticated manage events" on public.events for all to authenticated using (true) with check (true);
create policy "Authenticated manage news" on public.news for all to authenticated using (true) with check (true);
