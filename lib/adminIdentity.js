import { normalizeIndianPhone } from './phone';

// The main admin logs in with the same OTP form as everybody else.
// Who the admin is comes from .env:  ADMIN_PHONE (10-digit mobile), ADMIN_NAME (default "Admin")
export function adminIdentity() {
    const phone = normalizeIndianPhone(process.env.ADMIN_PHONE);
    if (!phone) return null;
    return {
        phone,
        name: String(process.env.ADMIN_NAME || '').trim() || 'Admin',
        email: String(process.env.ADMIN_EMAIL || '').trim().toLowerCase() || null,
    };
}

// The main admin (from .env) is not in the database, so the sidebar and the person page get this entry
export function mainAdminEntry() {
    const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    return {
        id: 'main',
        name: String(process.env.ADMIN_NAME || '').trim() || 'Admin',
        email: email || null,
        phone: normalizeIndianPhone(process.env.ADMIN_PHONE) || null,
        role: 'admin',
        is_active: true,
        main: true,
        last_login_at: null,
        created_at: null,
    };
}
