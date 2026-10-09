import jwt from 'jsonwebtoken';
import { supabase } from './supabase';

// Token ka payload deta hai (admin ya team member). Purane API isi naam se use karte hain.
export function verifyAdmin(req) {
    const header = req.headers.authorization || '';
    const token = header.replace('Bearer ', '');
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

// Logged-in user lao. Team member ke liye DB check bhi hota hai,
// taaki deactivate karte hi uska purana token bhi kaam karna band kar de.
export async function requireUser(req) {
    const p = verifyAdmin(req);
    if (!p) return null;

    if (p.role === 'admin') {
        return { id: null, name: p.name || 'Admin', email: p.email, role: 'admin' };
    }
    if (p.role !== 'member' || !p.id) return null;

    const { data } = await supabase
        .from('team_members')
        .select('id, name, email, phone, is_active')
        .eq('id', p.id)
        .maybeSingle();
    if (!data || !data.is_active) return null;
    return { id: data.id, name: data.name, email: data.email, phone: data.phone, role: 'member' };
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
