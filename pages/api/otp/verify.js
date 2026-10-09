import { supabase } from '../../../lib/supabase';
import { signToken } from '../../../lib/auth';
import { logActivity } from '../../../lib/activity';
import { normalizeIndianPhone } from '../../../lib/phone';
import { adminIdentity } from '../../../lib/adminIdentity';
import { consumeOtp } from '../../../lib/otp';

// POST /api/otp/verify { phone, code }   (team member login, step 2) -> login token
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const phone = normalizeIndianPhone((req.body || {}).phone);
    const code = String((req.body || {}).code || '').replace(/\D/g, '');
    if (!phone || code.length !== 6) {
        return res.status(400).json({ success: false, message: 'Enter the 6-digit OTP' });
    }

    try {
        const check = await consumeOtp(supabase, phone, code);
        if (!check.ok) return res.status(check.status).json({ success: false, message: check.message });

        // the main admin (same OTP login as everybody)
        const adm = adminIdentity();
        if (adm && phone === adm.phone) {
            const admin = { role: 'admin', name: adm.name, email: adm.email };
            await logActivity(admin, 'login');
            return res.json({ success: true, token: signToken(admin), user: admin });
        }

        const { data: tm } = await supabase
            .from('team_members').select('id, name, email, phone, is_active').eq('phone', phone).maybeSingle();
        if (!tm) return res.status(401).json({ success: false, message: 'This number is not registered. Please ask the admin to add you.' });
        if (!tm.is_active) return res.status(403).json({ success: false, message: 'Your account is switched off. Please talk to the admin.' });

        const user = { role: 'member', id: tm.id, name: tm.name, phone: tm.phone, email: tm.email || null };
        await supabase.from('team_members').update({ last_login_at: new Date().toISOString() }).eq('id', tm.id);
        await logActivity(user, 'login');
        return res.json({ success: true, token: signToken(user), user });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
}
