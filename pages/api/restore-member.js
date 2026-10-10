import { supabase } from '../../lib/supabase';
import { requireUser, isAdmin } from '../../lib/auth';
import { logActivity, memberLabel } from '../../lib/activity';
import { missingDeletedColumn, SETUP_MESSAGE } from '../../lib/softDelete';

// POST /api/restore-member { id }  (admin): brings a deleted member back with the same status and data
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isAdmin(user)) return res.status(403).json({ success: false, message: 'Only the admin can restore a member' });

    try {
        const { id } = req.body || {};
        if (!id) return res.status(400).json({ success: false, message: 'Member id is required' });

        const { data: member } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
        if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
        if (!member.deleted_at) return res.json({ success: true });

        const { error } = await supabase
            .from('members')
            .update({ deleted_at: null, deleted_by_name: null })
            .eq('id', id);
        if (error) {
            if (missingDeletedColumn(error)) return res.status(500).json({ success: false, message: SETUP_MESSAGE });
            return res.status(500).json({ success: false, message: error.message });
        }

        await logActivity(user, 'member_restore', {
            memberId: id,
            memberLabel: memberLabel(member),
            newStatus: member.status || 'pending',
        });

        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
}
