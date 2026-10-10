import { supabase } from '../../lib/supabase';
import { requireUser, isAdmin } from '../../lib/auth';
import { missingDeletedColumn } from '../../lib/softDelete';

// GET /api/deleted-members  (admin): everybody in the Deleted list, latest first
export default async function handler(req, res) {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isAdmin(user)) return res.status(403).json({ success: false, message: 'Only the admin can see deleted members' });

    const { data, error } = await supabase
        .from('members')
        .select('id, first_name, father_name, last_name, whatsapp_number, area, status, deleted_at, deleted_by_name')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(1000);

    if (error) {
        // soft-delete.sql not run yet: nothing can be deleted, so the list is simply empty
        if (missingDeletedColumn(error)) return res.json({ success: true, members: [], needsSetup: true });
        return res.status(500).json({ success: false, message: error.message });
    }
    return res.json({ success: true, members: data || [] });
}
