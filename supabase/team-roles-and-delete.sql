-- Admin / Team member roles + Delete & Restore for team members.  Run ONCE in Supabase -> SQL Editor.

alter table team_members add column if not exists role text not null default 'member' check (role in ('admin', 'member'));
alter table team_members add column if not exists deleted_at timestamptz;
alter table team_members add column if not exists deleted_by_name text;
