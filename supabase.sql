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


-- Profils membres : les comptes créés depuis le site sont suivis ici.
create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  role text not null default 'member' check (role in ('member','writer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_profiles add column if not exists role text not null default 'member';
alter table public.member_profiles drop constraint if exists member_profiles_role_check;
alter table public.member_profiles add constraint member_profiles_role_check check (role in ('member','writer'));

create index if not exists member_profiles_status_idx on public.member_profiles(status, created_at desc);
create index if not exists member_profiles_role_idx on public.member_profiles(role);

-- Les administrateurs sont automatiquement considérés comme rédacteurs.
create or replace function public.is_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
  or exists(
    select 1 from public.member_profiles
    where user_id = auth.uid() and status = 'approved' and role = 'writer'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.member_profiles(user_id, first_name, last_name, email, status)
  values (new.id, coalesce(new.raw_user_meta_data->>'first_name',''), coalesce(new.raw_user_meta_data->>'last_name',''), coalesce(new.email,''), 'pending')
  on conflict (user_id) do update set
    first_name=excluded.first_name, last_name=excluded.last_name, email=excluded.email, updated_at=now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Synchronise l'e-mail de profil quand Supabase Auth le modifie.
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.member_profiles set email=coalesce(new.email,''), updated_at=now() where user_id=new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row execute function public.handle_user_email_update();

-- Suppression complète d'un compte par un administrateur.
create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Impossible de supprimer son propre compte administrateur';
  end if;
  delete from auth.users where id=target_user_id;
end;
$$;

revoke execute on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

alter table public.admin_users enable row level security;
alter table public.member_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.articles enable row level security;

drop policy if exists "admin users read own" on public.admin_users;
create policy "admin users read own" on public.admin_users
for select to authenticated using (user_id = auth.uid());


drop policy if exists "members read own profile" on public.member_profiles;
create policy "members read own profile" on public.member_profiles
for select to authenticated using (user_id = auth.uid());

drop policy if exists "admins manage member profiles" on public.member_profiles;
create policy "admins manage member profiles" on public.member_profiles
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "categories public read" on public.categories;
create policy "categories public read" on public.categories
for select to anon, authenticated using (true);

drop policy if exists "categories admins all" on public.categories;
create policy "categories admins all" on public.categories
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "published articles public read" on public.articles;
create policy "published articles public read" on public.articles
for select to anon, authenticated using (status = 'published' or public.is_admin());

drop policy if exists "writers read all articles" on public.articles;
create policy "writers read all articles" on public.articles
for select to authenticated using (public.is_writer());

drop policy if exists "admins insert articles" on public.articles;
drop policy if exists "writers insert articles" on public.articles;
create policy "writers insert articles" on public.articles
for insert to authenticated with check (public.is_writer());

drop policy if exists "admins update articles" on public.articles;
drop policy if exists "writers update articles" on public.articles;
create policy "writers update articles" on public.articles
for update to authenticated using (public.is_writer()) with check (public.is_writer());

drop policy if exists "admins delete articles" on public.articles;
drop policy if exists "writers delete articles" on public.articles;
create policy "writers delete articles" on public.articles
for delete to authenticated using (public.is_writer());

-- Storage : crée d'abord un bucket public nommé "journal" dans
-- Storage > New bucket si ton projet ne permet pas l'insert ci-dessous.
insert into storage.buckets (id,name,public)
values ('journal','journal',true)
on conflict (id) do update set public=true;

drop policy if exists "journal public read" on storage.objects;
create policy "journal public read" on storage.objects
for select using (bucket_id='journal');

drop policy if exists "journal admin upload" on storage.objects;
drop policy if exists "journal writer upload" on storage.objects;
create policy "journal writer upload" on storage.objects
for insert to authenticated with check (bucket_id='journal' and public.is_writer());

drop policy if exists "journal admin update" on storage.objects;
drop policy if exists "journal writer update" on storage.objects;
create policy "journal writer update" on storage.objects
for update to authenticated using (bucket_id='journal' and public.is_writer()) with check (bucket_id='journal' and public.is_writer());

drop policy if exists "journal admin delete" on storage.objects;
drop policy if exists "journal writer delete" on storage.objects;
create policy "journal writer delete" on storage.objects
for delete to authenticated using (bucket_id='journal' and public.is_writer());

-- Après avoir créé ton premier compte avec Supabase Auth,
-- récupère son UUID et exécute :
-- insert into public.admin_users(user_id) values ('UUID-DU-COMPTE-ADMIN');

-- Rattrapage des comptes déjà existants avant l'installation de ce système.
insert into public.member_profiles(user_id, first_name, last_name, email, status, role)
select id, coalesce(raw_user_meta_data->>'first_name',''), coalesce(raw_user_meta_data->>'last_name',''), coalesce(email,''), 'pending', 'member'
from auth.users
on conflict (user_id) do update set
  first_name=excluded.first_name, last_name=excluded.last_name, email=excluded.email, updated_at=now();


-- Commentaires et réponses : tout compte connecté peut participer,
-- sans avoir besoin d'être approuvé.
create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.article_comments(id) on delete cascade,
  author_name text not null default 'Membre',
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists article_comments_article_idx
  on public.article_comments(article_id, created_at);
create index if not exists article_comments_parent_idx
  on public.article_comments(parent_id);

create or replace function public.set_comment_author_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  auth_email text;
begin
  select nullif(trim(concat_ws(' ', first_name, last_name)), '')
    into profile_name
    from public.member_profiles
    where user_id = new.user_id;

  select email into auth_email
    from auth.users
    where id = new.user_id;

  new.author_name := coalesce(profile_name, nullif(auth_email,''), 'Membre');
  return new;
end;
$$;

drop trigger if exists article_comments_author_name on public.article_comments;
create trigger article_comments_author_name
before insert or update of user_id on public.article_comments
for each row execute function public.set_comment_author_name();

alter table public.article_comments enable row level security;

drop policy if exists "comments authenticated read" on public.article_comments;
create policy "comments authenticated read" on public.article_comments
for select to authenticated
using (true);

drop policy if exists "comments authenticated insert own" on public.article_comments;
create policy "comments authenticated insert own" on public.article_comments
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.articles a
    where a.id = article_id and a.status = 'published'
  )
);

drop policy if exists "comments owner update" on public.article_comments;
create policy "comments owner update" on public.article_comments
for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "comments owner or admin delete" on public.article_comments;
create policy "comments owner or admin delete" on public.article_comments
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());
