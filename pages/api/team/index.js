import { supabase } from '../../../lib/supabase';
import { requireUser, isAdmin } from '../../../lib/auth';
import { logActivity } from '../../../lib/activity';
import { normalizeIndianPhone } from '../../../lib/phone';
import { adminIdentity, mainAdminEntry } from '../../../lib/adminIdentity';
import { publicMember, missingColumn, TEAM_SETUP_MESSAGE } from '../../../lib/teamUtil';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET  /api/team  -> the team (deleted people left out) + the main admin entry (admin)
// POST /api/team  -> new team member { name, email, phone, role } (admin). No password: they log in with a WhatsApp OTP.
export default async function handler(req, res) {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isAdmin(user)) return res.status(403).json({ success: false, message: 'Only an admin can manage the team' });

    if (req.method === 'GET') {
        // select('*') and filter here: works before the new columns exist, and the team is small
        const { data, error } = await supabase.from('team_members').select('*');
        if (error) return res.status(500).json({ success: false, message: error.message });
        const team = (data || [])
            .filter((m) => !m.deleted_at)
            .map(publicMember)
            .sort((a, b) => Number(b.is_active) - Number(a.is_active) || String(a.name).localeCompare(String(b.name)));
        return res.json({ success: true, team, main: mainAdminEntry() });
    }

    if (req.method === 'POST') {
        const body = req.body || {};
        const name = String(body.name || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const phone = normalizeIndianPhone(body.phone);
        const role = body.role === 'admin' ? 'admin' : 'member';

        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
        if (!EMAIL_RE.test(email)) return res.status(400).json({ success: false, message: 'Enter a valid email' });
        if (!phone) return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number' });
        if (email === String(process.env.ADMIN_EMAIL || '').toLowerCase()) {
            return res.status(400).json({ success: false, message: 'This is the main admin email, please use a different one' });
        }
        const main = adminIdentity();
        if (main && phone === main.phone) {
            return res.status(409).json({ success: false, message: 'This number is the main admin\'s number' });
        }

        const { data: sameEmail } = await supabase.from('team_members').select('*').eq('email', email).maybeSingle();
        if (sameEmail) {
            return res.status(409).json({ success: false, message: sameEmail.deleted_at ? 'This email belongs to a deleted team member. Restore them from the Deleted list.' : 'A team member with this email already exists' });
        }
        const { data: samePhone } = await supabase.from('team_members').select('*').eq('phone', phone).maybeSingle();
        if (samePhone) {
            return res.status(409).json({ success: false, message: samePhone.deleted_at ? 'This number belongs to a deleted team member. Restore them from the Deleted list.' : 'This number already belongs to a team member' });
        }

        const row = { name, email, phone };
        if (role === 'admin') row.role = 'admin'; // only written when needed, so a plain member never depends on the new column
        const { data: created, error } = await supabase.from('team_members').insert(row).select('*').single();
        if (error) {
            if (role === 'admin' && missingColumn(error)) return res.status(500).json({ success: false, message: TEAM_SETUP_MESSAGE });
            return res.status(500).json({ success: false, message: error.message });
        }

        await logActivity(user, 'team_add', { memberLabel: name, meta: { email, phone, role } });
        return res.json({ success: true, member: publicMember(created) });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
}
