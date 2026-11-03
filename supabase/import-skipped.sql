-- Keeps every row an import skipped, with a 1-2 word reason, so it can be looked at later. Run ONCE in Supabase -> SQL Editor.
create table if not exists import_skipped (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    batch text,
    uploaded_by text,
    file_row integer,
    reason text not null,
    detail text,
    sr_no text,
    membership_no text,
    first_name text,
    father_name text,
    last_name text,
    whatsapp_number text,
    birth_date text,
    aadhaar_number text
);
create index if not exists import_skipped_created_idx on import_skipped (created_at desc);
alter table import_skipped enable row level security;
