import { supabase } from '../../lib/supabase';
import { requireUser, isAdmin } from '../../lib/auth';
import { missingDeletedColumn } from '../../lib/softDelete';
import { publicMember } from '../../lib/teamUtil';

// GET /api/deleted-members  (admin): everybody in the Deleted list (members and team members), latest first
export default async function handler(req, res) {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isAdmin(user)) return res.status(403).json({ success: false, message: 'Only the admin can see deleted members' });

    // deleted team members (the team is small, so filter here: works before the new column exists)
    let team = [];
    const { data: teamRows, error: teamErr } = await supabase.from('team_members').select('*');
    if (!teamErr) {
        team = (teamRows || [])
            .filter((m) => m.deleted_at)
            .map(publicMember)
            .sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
    }

    const { data, error } = await supabase
        .from('members')
        .select('id, first_name, father_name, last_name, whatsapp_number, area, status, deleted_at, deleted_by_name')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(1000);

    if (error) {
        // soft-delete.sql not run yet: nothing can be deleted, so the list is simply empty
        if (missingDeletedColumn(error)) return res.json({ success: true, members: [], team, needsSetup: true });
        return res.status(500).json({ success: false, message: error.message });
    }
    return res.json({ success: true, members: data || [], team });
}
