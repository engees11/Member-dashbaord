-- "NEW" on top of the Members list: a member is NEW until somebody opens it (View). This adds the mark that remembers it.
-- Run ONCE in Supabase > SQL Editor ("Run and enable RLS" is not needed, no table is created).
-- Everybody who is in the dashboard right now counts as already seen, so only members who come in AFTER this are NEW.
-- It is safe to run twice: the second time it does nothing (it never marks new members as seen).
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'members' and column_name = 'seen_at') then
    alter table members add column seen_at timestamptz;
    update members set seen_at = now();
  end if;
end $$;
