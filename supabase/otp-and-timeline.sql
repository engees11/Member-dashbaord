-- Phone OTP login + status timeline.  Run ONCE in Supabase -> SQL Editor.
-- (team-management.sql must already have been run, because this builds on team_members and member_activity.)

-- 1) Team members now log in with a WhatsApp number instead of email + password
alter table team_members add column if not exists phone text;
create unique index if not exists team_members_phone_key on team_members (phone) where phone is not null;
alter table team_members alter column email drop not null;
alter table team_members alter column password_hash drop not null;

-- 2) One-time passwords (only a hash of the code is stored, never the code)
create table if not exists login_otps (
  id bigserial primary key,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists login_otps_phone_time on login_otps (phone, created_at desc);
alter table login_otps enable row level security;

-- 3) Faster status timeline per member
create index if not exists member_activity_member on member_activity (member_id, created_at);
