import { supabase } from '../../lib/supabase';
import { requireUser, isAdmin } from '../../lib/auth';
import { logActivity, memberLabel } from '../../lib/activity';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isAdmin(user)) return res.status(403).json({ success: false, message: 'Sirf admin member delete kar sakta hai' });

    try {
        const { id } = req.body || {};
        if (!id) return res.status(400).json({ success: false, message: 'Member id is required' });

        // Delete se pehle snapshot, taaki log mein pata rahe kise delete kiya
        const { data: before } = await supabase
            .from('members')
            .select('id, status, first_name, father_name, last_name, email, whatsapp_number')
            .eq('id', id)
            .maybeSingle();

        const { error } = await supabase.from('members').delete().eq('id', id);
        if (error) return res.status(500).json({ success: false, message: error.message });

        await logActivity(user, 'member_delete', {
            memberId: id,
            memberLabel: memberLabel(before),
            oldStatus: before ? before.status : null,
            meta: before ? { whatsapp_number: before.whatsapp_number, email: before.email } : null,
        });

        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
}
