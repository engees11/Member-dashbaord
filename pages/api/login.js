import bcrypt from 'bcryptjs';
import { supabase } from '../../lib/supabase';
import { signToken } from '../../lib/auth';
import { logActivity } from '../../lib/activity';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const password = String((req.body || {}).password || '');
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email aur password dono daalo' });
    }

    // 1) Main admin (.env wala login, pehle jaisa)
    if (email === String(process.env.ADMIN_EMAIL || '').toLowerCase() && password === process.env.ADMIN_PASSWORD) {
        const user = { role: 'admin', name: 'Admin', email };
        return res.json({ success: true, token: signToken(user), user });
    }

    // 2) Team member
    try {
        const { data: tm } = await supabase
            .from('team_members')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        // members added with an OTP login have no password at all, so there is nothing to compare
        const ok = tm && tm.password_hash && (await bcrypt.compare(password, tm.password_hash));
        if (!ok) return res.status(401).json({ success: false, message: 'Galat email ya password' });
        if (!tm.is_active || tm.deleted_at) {
            return res.status(403).json({ success: false, message: 'Aapka account band hai. Admin se baat karein.' });
        }

        const user = { role: tm.role === 'admin' ? 'admin' : 'member', id: tm.id, name: tm.name, email: tm.email };
        await supabase.from('team_members').update({ last_login_at: new Date().toISOString() }).eq('id', tm.id);
        await logActivity(user, 'login');
        // the token says "member"; the real role is read from the database on every request
        return res.json({ success: true, token: signToken({ ...user, role: 'member' }), user });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
}
