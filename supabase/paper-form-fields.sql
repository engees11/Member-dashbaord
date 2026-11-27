-- Six extra details from the paper membership form. All optional (they can stay empty).
-- Run ONCE in Supabase > SQL Editor. It only adds empty columns; no member's data is changed. Safe to run twice.
alter table members
  add column if not exists blood_group text,
  add column if not exists qualification text,
  add column if not exists hobbies text,
  add column if not exists marriage_date date,
  add column if not exists business_name text,
  add column if not exists business_description text;
