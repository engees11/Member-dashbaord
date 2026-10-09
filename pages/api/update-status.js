import { supabase } from '../../lib/supabase';
import { requireUser } from '../../lib/auth';
import { logActivity, memberLabel } from '../../lib/activity';

const STATUSES = ['pending', 'approved', 'rejected', 'expired', 'new', 'need_review'];

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id, status, note } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'Member id is required' });
    if (!STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value: ' + status });
    }

    const { data: before } = await supabase
        .from('members')
        .select('id, status, first_name, father_name, last_name, email, whatsapp_number')
        .eq('id', id)
        .maybeSingle();
    if (!before) return res.status(404).json({ success: false, message: 'Member not found' });

    const { error } = await supabase
        .from('members')
        .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user.id })
        .eq('id', id);
    if (error) return res.status(500).json({ success: false, message: error.message });

    await logActivity(user, 'status_change', {
        memberId: id,
        memberLabel: memberLabel(before),
        oldStatus: before.status || 'pending',
        newStatus: status,
        note: typeof note === 'string' ? note.trim().slice(0, 500) : null,
    });

    return res.json({ success: true });
}
