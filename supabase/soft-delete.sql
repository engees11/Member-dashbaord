-- Delete + Restore for members.  Run ONCE in Supabase -> SQL Editor.
-- A deleted member is not removed, only marked. It disappears from the lists and counts
-- and shows in the admin's "Deleted" list, from where it can be restored.

alter table members add column if not exists deleted_at timestamptz;
alter table members add column if not exists deleted_by_name text;

create index if not exists members_deleted_at_idx on members (deleted_at);
