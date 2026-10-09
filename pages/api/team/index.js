import { supabase } from '../../../lib/supabase';
import { requireUser, isAdmin } from '../../../lib/auth';
import { logActivity } from '../../../lib/activity';
import { normalizeIndianPhone } from '../../../lib/phone';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELDS = 'id, name, email, phone, is_active, last_login_at, created_at';

// GET  /api/team  -> team list (admin)
// POST /api/team  -> new team member { name, email, phone } (admin).
//                    No password: the member logs in with name + number + a WhatsApp OTP.
export default async function handler(req, res) {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isAdmin(user)) return res.status(403).json({ success: false, message: 'Only the admin can manage the team' });

    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('team_members')
            .select(FIELDS)
            .order('is_active', { ascending: false })
            .order('name', { ascending: true });
        if (error) return res.status(500).json({ success: false, message: error.message });
        return res.json({ success: true, team: data || [] });
    }

    if (req.method === 'POST') {
        const body = req.body || {};
        const name = String(body.name || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const phone = normalizeIndianPhone(body.phone);

        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!EMAIL_RE.test(email)) return res.status(400).json({ success: false, message: 'Enter a valid email' });
        if (!phone) return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number' });
        if (email === String(process.env.ADMIN_EMAIL || '').toLowerCase()) {
            return res.status(400).json({ success: false, message: 'This is the admin email, please use a different one' });
        }

        const { data: sameEmail } = await supabase.from('team_members').select('id').eq('email', email).maybeSingle();
        if (sameEmail) return res.status(409).json({ success: false, message: 'A team member with this email already exists' });
        const { data: samePhone } = await supabase.from('team_members').select('id').eq('phone', phone).maybeSingle();
        if (samePhone) return res.status(409).json({ success: false, message: 'This number already belongs to a team member' });

        const { data: created, error } = await supabase
            .from('team_members')
            .insert({ name, email, phone })
            .select(FIELDS)
            .single();
        if (error) return res.status(500).json({ success: false, message: error.message });

        await logActivity(user, 'team_add', { memberLabel: name, meta: { email, phone } });
        return res.json({ success: true, member: created });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
}
