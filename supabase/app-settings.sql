-- One small table for settings. Right now it keeps the annual meeting date (Retired = 45+ on that date).
-- Run ONCE in Supabase > SQL Editor. Until then everything keeps working, counted on today's date.
create table if not exists app_settings (
    key text primary key,
    value text,
    updated_by text,
    updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
-- the 2026 meeting (17 May 2026) is the starting date; the admin changes it in Settings when the next meeting date is known
insert into app_settings (key, value, updated_by) values ('meeting_date', '2026-05-17', 'setup') on conflict (key) do nothing;
