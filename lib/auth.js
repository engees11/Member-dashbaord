import jwt from 'jsonwebtoken';
import { supabase } from './supabase';

// Returns the token payload (admin or team member). Older APIs use this same name.
export function verifyAdmin(req) {
    const header = req.headers.authorization || '';
    const token = header.replace('Bearer ', '');
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

// Gets the logged-in user. For team members the DB is checked too,
// so that deactivating someone stops their old token from working right away.
export async function requireUser(req) {
    const p = verifyAdmin(req);
    if (!p) return null;

    // The main admin from .env: no id, no database row
    if (p.role === 'admin' && !p.id) {
        return { id: null, name: p.name || 'Admin', email: p.email, role: 'admin', main: true };
    }
    if (!p.id || (p.role !== 'member' && p.role !== 'admin')) return null;

    // select('*') so this keeps working before the role / deleted_at columns exist
    const { data } = await supabase.from('team_members').select('*').eq('id', p.id).maybeSingle();
    if (!data || !data.is_active || data.deleted_at) return null;
    // The role is read from the database every time, so making someone admin (or taking it back) works at once
    return { id: data.id, name: data.name, email: data.email, phone: data.phone, role: data.role === 'admin' ? 'admin' : 'member' };
}

export const isAdmin = (user) => !!user && user.role === 'admin';

export function signToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export function calcAge(dob) {
    if (!dob) return null;
    const d = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age;
}

export function effectiveStatus(member) {
    if (member.status === 'approved') {
        const age = calcAge(member.dob);
        if (age !== null && age >= 45) return 'expired';
    }
    return member.status;
}
