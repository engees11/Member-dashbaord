import { supabase } from '../../../lib/supabase';
import { requireUser, isAdmin } from '../../../lib/auth';
import { logActivity } from '../../../lib/activity';

// GET  /api/team/:id?from=ISO&to=ISO  → member + us time range ki activity
// POST /api/team/:id { action: 'deactivate' | 'activate' } (admin)
export default async function handler(req, res) {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.query;
    // Admin sabko dekh sakta hai, team member sirf khud ko
    if (!isAdmin(user) && user.id !== id) {
        return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    const { data: member, error: mErr } = await supabase
        .from('team_members')
        .select('id, name, email, phone, is_active, last_login_at, created_at')
        .eq('id', id)
        .maybeSingle();
    if (mErr) return res.status(500).json({ success: false, message: mErr.message });
    if (!member) return res.status(404).json({ success: false, message: 'Team member nahi mila' });

    if (req.method === 'GET') {
        const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 24 * 3600 * 1000);
        const to = req.query.to ? new Date(req.query.to) : new Date();
        if (isNaN(from) || isNaN(to)) return res.status(400).json({ success: false, message: 'Galat date' });

        const { data: activity, error } = await supabase
            .from('member_activity')
            .select('id, action, member_id, member_label, old_status, new_status, note, meta, created_at')
            .eq('actor_id', id)
            .gte('created_at', from.toISOString())
            .lt('created_at', to.toISOString())
            .order('created_at', { ascending: false })
            .limit(1000);
        if (error) return res.status(500).json({ success: false, message: error.message });

        const changes = (activity || []).filter((a) => a.action === 'status_change');
        const stats = {
            total: changes.length,
            approved: changes.filter((a) => a.new_status === 'approved').length,
            rejected: changes.filter((a) => a.new_status === 'rejected').length,
            needReview: changes.filter((a) => a.new_status === 'need_review').length,
        };
        return res.json({ success: true, member, stats, activity: activity || [] });
    }

    if (req.method === 'POST') {
        if (!isAdmin(user)) return res.status(403).json({ success: false, message: 'Sirf admin yeh kar sakta hai' });
        const { action } = req.body || {};

        if (action === 'deactivate' || action === 'activate') {
            const is_active = action === 'activate';
            const { error } = await supabase.from('team_members').update({ is_active }).eq('id', id);
            if (error) return res.status(500).json({ success: false, message: error.message });
            await logActivity(user, is_active ? 'team_activate' : 'team_deactivate', { memberLabel: member.name });
            return res.json({ success: true, member: { ...member, is_active } });
        }

        return res.status(400).json({ success: false, message: 'Unknown action' });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
}
