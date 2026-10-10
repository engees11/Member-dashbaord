// True when the database does not have the deleted_at column yet (supabase/soft-delete.sql was not run)
export function missingDeletedColumn(error) {
    if (!error) return false;
    return error.code === '42703' || /deleted_at/i.test(String(error.message || ''));
}

export const SETUP_MESSAGE =
    'Delete & Restore needs one database update. Run supabase/soft-delete.sql in the Supabase SQL Editor first.';
