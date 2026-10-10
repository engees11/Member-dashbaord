// What the browser may see about a team member (never the password hash). Works even if the new columns do not exist yet.
export const publicMember = (m) => ({
    id: m.id,
    name: m.name,
    email: m.email || null,
    phone: m.phone || null,
    is_active: m.is_active !== false,
    role: m.role === 'admin' ? 'admin' : 'member',
    last_login_at: m.last_login_at || null,
    created_at: m.created_at || null,
    deleted_at: m.deleted_at || null,
    deleted_by_name: m.deleted_by_name || null,
});

// A write failed because supabase/team-roles-and-delete.sql has not been run yet
export const missingColumn = (error) =>
    !!error && (error.code === '42703' || error.code === 'PGRST204' || /column/i.test(String(error.message || '')));

export const TEAM_SETUP_MESSAGE =
    'This needs one database update. Run supabase/team-roles-and-delete.sql in the Supabase SQL Editor first.';
