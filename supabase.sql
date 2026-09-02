-- LE JOURNAL — schéma Supabase
-- À exécuter dans Supabase > SQL Editor, dans l'ordre.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null default '',
  cover_image text,
  youtube_url text,
  category_id uuid references public.categories(id) on delete set null,
  author_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_status_published_idx on public.articles(status, published_at desc);
create index if not exists articles_category_idx on public.articles(category_id);

insert into public.categories(name,slug) values
('Actualités','actualites'),
('Dossiers','dossiers'),
('Interviews','interviews'),
('Vidéos','videos'),
('À la une','a-la-une')
on conflict (slug) do nothing;

-- Fonction d'autorisation : le JWT ne contient pas de rôle admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admin_users where user_id = auth.uid());
$$;

alter table public.admin_users enable row level security;
alter table public.categories enable row level security;
alter table public.articles enable row level security;

drop policy if exists "admin users read own" on public.admin_users;
create policy "admin users read own" on public.admin_users
for select to authenticated using (user_id = auth.uid());

drop policy if exists "categories public read" on public.categories;
create policy "categories public read" on public.categories
for select to anon, authenticated using (true);

drop policy if exists "categories admins all" on public.categories;
create policy "categories admins all" on public.categories
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "published articles public read" on public.articles;
create policy "published articles public read" on public.articles
for select to anon, authenticated using (status = 'published' or public.is_admin());

drop policy if exists "admins insert articles" on public.articles;
create policy "admins insert articles" on public.articles
for insert to authenticated with check (public.is_admin());

drop policy if exists "admins update articles" on public.articles;
create policy "admins update articles" on public.articles
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete articles" on public.articles;
create policy "admins delete articles" on public.articles
for delete to authenticated using (public.is_admin());

-- Storage : crée d'abord un bucket public nommé "journal" dans
-- Storage > New bucket si ton projet ne permet pas l'insert ci-dessous.
insert into storage.buckets (id,name,public)
values ('journal','journal',true)
on conflict (id) do update set public=true;

drop policy if exists "journal public read" on storage.objects;
create policy "journal public read" on storage.objects
for select using (bucket_id='journal');

drop policy if exists "journal admin upload" on storage.objects;
create policy "journal admin upload" on storage.objects
for insert to authenticated with check (bucket_id='journal' and public.is_admin());

drop policy if exists "journal admin update" on storage.objects;
create policy "journal admin update" on storage.objects
for update to authenticated using (bucket_id='journal' and public.is_admin()) with check (bucket_id='journal' and public.is_admin());

drop policy if exists "journal admin delete" on storage.objects;
create policy "journal admin delete" on storage.objects
for delete to authenticated using (bucket_id='journal' and public.is_admin());

-- Après avoir créé ton premier compte avec Supabase Auth,
-- récupère son UUID et exécute :
-- insert into public.admin_users(user_id) values ('UUID-DU-COMPTE-ADMIN');
