-- =====================================================================
-- Facility Service Request System - Supabase (PostgreSQL) schema
-- Run ONCE in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Matches the "Database Design" document (5 tables + Auth + Storage).
-- =====================================================================

-- ---------- 1. TABLES ----------
create table public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  full_name  varchar(100) not null,
  email      varchar(100) not null unique,
  role       text not null default 'reporter' check (role in ('reporter', 'admin', 'technician')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  category_id bigint generated always as identity primary key,
  name        varchar(50) not null unique,
  description varchar(255),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.complaints (
  complaint_id bigint generated always as identity primary key,
  ticket_code  varchar(12) not null unique,
  reporter_id  uuid not null references public.profiles (user_id) on delete restrict,
  category_id  bigint not null references public.categories (category_id) on delete restrict,
  assigned_to  uuid references public.profiles (user_id) on delete set null,
  location     varchar(150) not null,
  description  text not null check (char_length(btrim(description)) >= 10),
  status       text not null default 'New' check (status in ('New', 'In Progress', 'Resolved')),
  priority     text check (priority in ('Low', 'Medium', 'High')),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.complaint_status_history (
  history_id   bigint generated always as identity primary key,
  complaint_id bigint not null references public.complaints (complaint_id) on delete cascade on update cascade,
  changed_by   uuid not null references public.profiles (user_id) on delete restrict,
  old_status   text,
  new_status   text not null check (new_status in ('New', 'In Progress', 'Resolved')),
  note         varchar(255),
  changed_at   timestamptz not null default now()
);

create table public.complaint_attachments (
  attachment_id bigint generated always as identity primary key,
  complaint_id  bigint not null references public.complaints (complaint_id) on delete cascade on update cascade,
  file_name     varchar(255) not null,
  file_path     varchar(500) not null,
  file_type     text not null check (file_type in ('jpg', 'png')),
  file_size_kb  integer not null check (file_size_kb <= 2048),
  uploaded_at   timestamptz not null default now()
);

-- ---------- 2. INDEXES (unique indexes come from the UNIQUE constraints above) ----------
create index idx_complaints_reporter on public.complaints (reporter_id, created_at desc);
create index idx_complaints_status   on public.complaints (status, priority);
create index idx_complaints_assigned on public.complaints (assigned_to, status);
create index idx_complaints_category on public.complaints (category_id);
create index idx_history_complaint   on public.complaint_status_history (complaint_id, changed_at);
create index idx_attachments_complaint on public.complaint_attachments (complaint_id);

-- ---------- 3. HELPER FUNCTIONS AND TRIGGERS ----------
-- Role of the logged-in user (NULL for inactive or unknown users). Bypasses RLS on purpose.
create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where user_id = auth.uid() and is_active = true
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_profiles_updated   before update on public.profiles   for each row execute function public.set_updated_at();
create trigger trg_categories_updated before update on public.categories for each row execute function public.set_updated_at();
create trigger trg_complaints_updated before update on public.complaints for each row execute function public.set_updated_at();

-- Every new Auth user gets a profile. The role is always 'reporter' (never taken from user input).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, full_name, email)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)), new.email);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Normal users cannot change their own role, active flag or email.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(public.current_user_role(), '') <> 'admin' then
    new.role := old.role;
    new.is_active := old.is_active;
    new.email := old.email;
  end if;
  return new;
end $$;

create trigger trg_profiles_protect before update on public.profiles
for each row execute function public.protect_profile_columns();

-- Human-readable ticket number, e.g. FC-001.
create or replace function public.set_ticket_code()
returns trigger language plpgsql set search_path = public as $$
begin
  new.ticket_code := 'FC-' || lpad(new.complaint_id::text, 3, '0');
  return new;
end $$;

create trigger trg_complaints_ticket before insert on public.complaints
for each row execute function public.set_ticket_code();

-- Business rules on UPDATE: who may change which column.
create or replace function public.guard_complaint_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if new.status = 'Resolved' and old.status <> 'Resolved' then
    new.resolved_at := now();
  elsif new.status <> 'Resolved' then
    new.resolved_at := null;
  end if;

  if auth.uid() is null then  -- SQL editor / service role
    return new;
  end if;

  r := public.current_user_role();
  if new.reporter_id is distinct from old.reporter_id then
    raise exception 'reporter_id cannot be changed';
  end if;

  if r = 'admin' then
    null;
  elsif r = 'reporter' then
    if new.status is distinct from old.status or new.priority is distinct from old.priority
       or new.assigned_to is distinct from old.assigned_to then
      raise exception 'Reporters can only edit category, location and description';
    end if;
  elsif r = 'technician' then
    if new.category_id is distinct from old.category_id or new.location is distinct from old.location
       or new.description is distinct from old.description or new.priority is distinct from old.priority
       or new.assigned_to is distinct from old.assigned_to then
      raise exception 'Technicians can only update the status';
    end if;
    if new.status is distinct from old.status and new.status = 'New' then
      raise exception 'Technicians cannot move a complaint back to New';
    end if;
  else
    raise exception 'Not allowed';
  end if;

  if new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null then
    if not exists (select 1 from public.profiles p where p.user_id = new.assigned_to and p.role = 'technician' and p.is_active) then
      raise exception 'assigned_to must be an active technician';
    end if;
  end if;
  return new;
end $$;

create trigger trg_complaints_guard before update on public.complaints
for each row execute function public.guard_complaint_update();

-- Status timeline: one history row on submit and one on every status change.
create or replace function public.log_complaint_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.complaint_status_history (complaint_id, changed_by, old_status, new_status)
    values (new.complaint_id, coalesce(auth.uid(), new.reporter_id), null, new.status);
  elsif new.status is distinct from old.status then
    insert into public.complaint_status_history (complaint_id, changed_by, old_status, new_status)
    values (new.complaint_id, coalesce(auth.uid(), new.reporter_id), old.status, new.status);
  end if;
  return new;
end $$;

create trigger trg_complaints_history after insert or update of status on public.complaints
for each row execute function public.log_complaint_status();

-- ---------- 4. ROW LEVEL SECURITY ----------
alter table public.profiles                 enable row level security;
alter table public.categories               enable row level security;
alter table public.complaints               enable row level security;
alter table public.complaint_status_history enable row level security;
alter table public.complaint_attachments    enable row level security;

-- profiles: own row, all rows for admin, staff rows (admin/technician) visible to everyone logged in
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.current_user_role() = 'admin' or role in ('admin', 'technician'));
create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- categories: everyone logged in can read, only admin can write
create policy categories_select on public.categories for select to authenticated using (true);
create policy categories_admin_write on public.categories for all to authenticated
  using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- complaints
create policy complaints_select on public.complaints for select to authenticated using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() is not null and (reporter_id = (select auth.uid()) or assigned_to = (select auth.uid()))));
create policy complaints_insert on public.complaints for insert to authenticated with check (
  reporter_id = (select auth.uid()) and public.current_user_role() = 'reporter'
  and status = 'New' and priority is null and assigned_to is null);
create policy complaints_update on public.complaints for update to authenticated using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'reporter' and reporter_id = (select auth.uid()) and status = 'New')
  or (public.current_user_role() = 'technician' and assigned_to = (select auth.uid())))
  with check (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'reporter' and reporter_id = (select auth.uid()))
  or (public.current_user_role() = 'technician' and assigned_to = (select auth.uid())));
create policy complaints_delete on public.complaints for delete to authenticated using (
  public.current_user_role() = 'admin'
  or (public.current_user_role() = 'reporter' and reporter_id = (select auth.uid()) and status = 'New'));

-- history: readable when the complaint is readable; written only by the trigger above
create policy history_select on public.complaint_status_history for select to authenticated
  using (exists (select 1 from public.complaints c where c.complaint_id = complaint_status_history.complaint_id));

-- attachments
create policy attachments_select on public.complaint_attachments for select to authenticated
  using (exists (select 1 from public.complaints c where c.complaint_id = complaint_attachments.complaint_id));
create policy attachments_insert on public.complaint_attachments for insert to authenticated
  with check (exists (select 1 from public.complaints c where c.complaint_id = complaint_attachments.complaint_id and c.reporter_id = (select auth.uid())));
create policy attachments_delete on public.complaint_attachments for delete to authenticated
  using (public.current_user_role() = 'admin'
         or exists (select 1 from public.complaints c where c.complaint_id = complaint_attachments.complaint_id and c.reporter_id = (select auth.uid())));

-- ---------- 5. STORAGE (private bucket for complaint photos, max 2 MB, JPG/PNG) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('complaint-photos', 'complaint-photos', false, 2097152, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'complaint-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'complaint-photos'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or public.current_user_role() in ('admin', 'technician')));
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'complaint-photos'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or public.current_user_role() = 'admin'));

-- ---------- 5b. LOCK DOWN FUNCTIONS (trigger functions must not be callable through the API) ----------
revoke execute on function public.guard_complaint_update() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_complaint_status() from public, anon, authenticated;
revoke execute on function public.protect_profile_columns() from public, anon, authenticated;
revoke execute on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated;

-- ---------- 6. SEED DATA ----------
insert into public.categories (name, description) values
  ('Electrical', 'Lights, sockets, wiring'),
  ('Plumbing', 'Leaks, taps, toilets'),
  ('Air Conditioning', 'AC not cooling or leaking'),
  ('Furniture', 'Broken chairs, desks, doors'),
  ('Cleanliness', 'Trash, dirty rooms or restrooms'),
  ('Other', 'Anything else');

-- ---------- 7. MAKE YOUR FIRST ADMIN (after you have registered in the app) ----------
-- update public.profiles set role = 'admin' where email = 'your-admin@email.com';
-- Technicians: the admin can promote users in the app (Admin page -> Users).
