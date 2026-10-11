import { supabase } from '../../lib/supabase';
import { requireUser, isAdmin } from '../../lib/auth';
import { logActivity, memberLabel } from '../../lib/activity';
import { cleanMemberInput } from '../../lib/memberFields';
import { missingColumn } from '../../lib/teamUtil';

// POST /api/create-member (admin): add a member by hand
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isAdmin(user)) return res.status(403).json({ success: false, message: 'Only the admin can add a member' });

    try {
        const body = req.body || {};
        if (!String(body.whatsapp_number || '').trim()) return res.status(400).json({ success: false, message: 'Mobile number is required' });
        if (!String(body.first_name || '').trim()) return res.status(400).json({ success: false, message: 'First name is required' });

        const cleaned = cleanMemberInput(body);
        if (cleaned.error) return res.status(400).json({ success: false, message: cleaned.error });
        const record = { ...cleaned.fields, form_type: 'details_update', status: 'new' };

        const { data: samePhone } = await supabase.from('members').select('id').eq('whatsapp_number', record.whatsapp_number).limit(1).maybeSingle();
        if (samePhone) return res.status(409).json({ success: false, message: 'A member with this mobile number already exists' });
        if (record.membership_no) {
            const { data: sameNo } = await supabase.from('members').select('id').eq('membership_no', record.membership_no).limit(1).maybeSingle();
            if (sameNo) return res.status(409).json({ success: false, message: 'This membership number is already used by another member' });
        }

        const { data: created, error } = await supabase.from('members').insert(record).select('*').maybeSingle();
        if (error) {
            if (record.pan_number && missingColumn(error)) {
                return res.status(500).json({ success: false, message: 'PAN needs one database update. Run supabase/pan-number.sql in the Supabase SQL Editor first.' });
            }
            return res.status(500).json({ success: false, message: error.message });
        }

        await logActivity(user, 'member_create', { memberId: created && created.id, memberLabel: memberLabel(record), newStatus: 'new' });
        return res.json({ success: true, member: created || record });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
}
