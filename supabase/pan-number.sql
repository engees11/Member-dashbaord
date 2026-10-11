-- PAN number for members + membership number (safe to run more than once). Run ONCE in Supabase -> SQL Editor.
alter table members add column if not exists pan_number text;
alter table members add column if not exists membership_no text;
create index if not exists members_membership_no_idx on members (membership_no);
