import { supabase } from '../../lib/supabase';
import { requireUser, isAdmin } from '../../lib/auth';
import { logActivity, memberLabel } from '../../lib/activity';
import { missingDeletedColumn, SETUP_MESSAGE } from '../../lib/softDelete';

// POST /api/delete-member { id }  (admin)
// The member is NOT removed. It is marked as deleted, disappears from lists and counts,
// and can be brought back from the "Deleted" list.
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isAdmin(user)) return res.status(403).json({ success: false, message: 'Only the admin can delete a member' });

    try {
        const { id } = req.body || {};
        if (!id) return res.status(400).json({ success: false, message: 'Member id is required' });

        const { data: before } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
        if (!before) return res.status(404).json({ success: false, message: 'Member not found' });
        if (before.deleted_at) return res.json({ success: true });

        const { error } = await supabase
            .from('members')
            .update({ deleted_at: new Date().toISOString(), deleted_by_name: user.name || null })
            .eq('id', id);
        if (error) {
            if (missingDeletedColumn(error)) return res.status(500).json({ success: false, message: SETUP_MESSAGE });
            return res.status(500).json({ success: false, message: error.message });
        }

        await logActivity(user, 'member_delete', {
            memberId: id,
            memberLabel: memberLabel(before),
            oldStatus: before.status || null,
            meta: { whatsapp_number: before.whatsapp_number, email: before.email },
        });

        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
}
