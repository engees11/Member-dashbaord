-- Team management: run this once in Supabase → SQL Editor

-- 1) Team members (sirf naam + email; password auto-generate hota hai)
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password_hash text not null,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- 2) Activity log: kaun, kab, kya kiya
create table if not exists member_activity (
  id bigserial primary key,
  actor_id uuid references team_members(id) on delete set null,
  actor_name text not null,
  action text not null,          -- login | status_change | member_create | member_delete | import | team_add | team_deactivate | team_activate | password_reset
  member_id text,                -- members.id (text, taaki delete ke baad bhi record rahe)
  member_label text,             -- naam / number snapshot
  old_status text,
  new_status text,
  note text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists member_activity_actor_time on member_activity (actor_id, created_at desc);
create index if not exists member_activity_time on member_activity (created_at desc);

-- 3) Kis team member ne last review kiya
alter table members add column if not exists reviewed_by uuid references team_members(id) on delete set null;

-- 4) Security: browser wali anon key in tables ko na padh sake
--    (server service-role key use karta hai, us par RLS lagta nahi)
alter table team_members enable row level security;
alter table member_activity enable row level security;
