import { supabase } from '../../lib/supabase';
import { requireUser } from '../../lib/auth';
import { logActivity, memberLabel } from '../../lib/activity';
import { cleanMemberInput, FIELD_LABELS } from '../../lib/memberFields';
import { missingColumn } from '../../lib/teamUtil';

const SETUP = 'PAN needs one database update. Run supabase/pan-number.sql in the Supabase SQL Editor first.';

// POST /api/update-member { id, ...fields }  (any logged-in team member): edit a member's details
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    try {
        const body = req.body || {};
        const id = body.id;
        if (!id) return res.status(400).json({ success: false, message: 'Member id is required' });

        const { data: existing } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
        if (!existing) return res.status(404).json({ success: false, message: 'Member not found' });
        if (existing.deleted_at) return res.status(400).json({ success: false, message: 'This member is deleted. Restore them first.' });

        const cleaned = cleanMemberInput(body, { existing });
        if (cleaned.error) return res.status(400).json({ success: false, message: cleaned.error });

        // only what really changed
        const changed = {};
        for (const [k, v] of Object.entries(cleaned.fields)) {
            if ((existing[k] == null ? null : String(existing[k])) !== (v == null ? null : String(v))) changed[k] = v;
        }
        if (Object.keys(changed).length === 0) return res.json({ success: true, member: existing });

        if (changed.whatsapp_number) {
            const { data: dup } = await supabase.from('members').select('id').eq('whatsapp_number', changed.whatsapp_number).neq('id', id).limit(1).maybeSingle();
            if (dup) return res.status(409).json({ success: false, message: 'This mobile number already belongs to another member' });
        }
        if (changed.membership_no) {
            const { data: dup } = await supabase.from('members').select('id').eq('membership_no', changed.membership_no).neq('id', id).limit(1).maybeSingle();
            if (dup) return res.status(409).json({ success: false, message: 'This membership number is already used by another member' });
        }

        const { error } = await supabase.from('members').update({ ...changed, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) {
            if ('pan_number' in changed && missingColumn(error)) return res.status(500).json({ success: false, message: SETUP });
            return res.status(500).json({ success: false, message: error.message });
        }

        const names = Object.keys(changed).map((k) => FIELD_LABELS[k] || k).join(', ');
        await logActivity(user, 'member_edit', { memberId: id, memberLabel: memberLabel({ ...existing, ...changed }), note: `Changed: ${names}` });

        const { data: fresh } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
        return res.json({ success: true, member: fresh || { ...existing, ...changed } });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
}
