-- Member profile photo: one more (empty) column that keeps the link of the photo.
-- Run ONCE in Supabase > SQL Editor. It only adds an empty column; no member's data is changed. Safe to run twice.
-- The photo files go to the same storage bucket as the Aadhaar photos ("member-documents", folder "profile-photo").
alter table members add column if not exists photo_url text;
