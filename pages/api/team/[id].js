import { supabase } from '../../../lib/supabase';
import { requireUser, isAdmin } from '../../../lib/auth';
import { logActivity } from '../../../lib/activity';
import { mainAdminEntry } from '../../../lib/adminIdentity';
import { publicMember, missingColumn, TEAM_SETUP_MESSAGE } from '../../../lib/teamUtil';

// GET  /api/team/:id?from=ISO&to=ISO  -> person + that day's activity   (id "main" = the main admin from .env)
// POST /api/team/:id { action }  (admin): deactivate | activate | make_admin | make_member | delete | restore
export default async function handler(req, res) {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.query;
    // An admin can see everybody, a team member only themselves
    if (!isAdmin(user) && user.id !== id) {
        return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    const isMain = id === 'main';
    let member;
    if (isMain) {
        member = mainAdminEntry();
    } else {
        const { data, error: mErr } = await supabase.from('team_members').select('*').eq('id', id).maybeSingle();
        if (mErr) return res.status(500).json({ success: false, message: mErr.message });
        if (!data) return res.status(404).json({ success: false, message: 'Team member nahi mila' });
        member = publicMember(data);
    }

    if (req.method === 'GET') {
        if (member.deleted_at) return res.status(404).json({ success: false, message: 'Team member nahi mila' });

        const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 24 * 3600 * 1000);
        const to = req.query.to ? new Date(req.query.to) : new Date();
        if (isNaN(from) || isNaN(to)) return res.status(400).json({ success: false, message: 'Galat date' });

        let q = supabase
            .from('member_activity')
            .select('id, action, member_id, member_label, old_status, new_status, note, meta, created_at')
            .gte('created_at', from.toISOString())
            .lt('created_at', to.toISOString())
            .order('created_at', { ascending: false })
            .limit(1000);
        // The main admin is not in the database: his work is saved without an id, under his name
        q = isMain ? q.is('actor_id', null).in('actor_name', [...new Set([member.name, 'Admin'])]) : q.eq('actor_id', id);
        const { data: activity, error } = await q;
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
        if (isMain) return res.status(400).json({ success: false, message: 'The main admin cannot be changed from here' });
        if (user.id === id) return res.status(400).json({ success: false, message: 'You cannot do this on your own account' });

        const { action } = req.body || {};
        const now = new Date().toISOString();
        const ACTIONS = {
            deactivate: { patch: { is_active: false }, log: 'team_deactivate' },
            activate: { patch: { is_active: true }, log: 'team_activate' },
            make_admin: { patch: { role: 'admin' }, log: 'team_make_admin' },
            make_member: { patch: { role: 'member' }, log: 'team_make_member' },
            delete: { patch: { deleted_at: now, deleted_by_name: user.name || null }, log: 'team_delete' },
            restore: { patch: { deleted_at: null, deleted_by_name: null }, log: 'team_restore' },
        };
        const todo = ACTIONS[action];
        if (!todo) return res.status(400).json({ success: false, message: 'Unknown action' });
        if (member.deleted_at && action !== 'restore') {
            return res.status(400).json({ success: false, message: 'This team member is deleted. Restore them first.' });
        }

        const { error } = await supabase.from('team_members').update(todo.patch).eq('id', id);
        if (error) {
            if (missingColumn(error) && ['make_admin', 'make_member', 'delete', 'restore'].includes(action)) {
                return res.status(500).json({ success: false, message: TEAM_SETUP_MESSAGE });
            }
            return res.status(500).json({ success: false, message: error.message });
        }

        const { data: fresh } = await supabase.from('team_members').select('*').eq('id', id).maybeSingle();
        await logActivity(user, todo.log, { memberLabel: member.name });
        return res.json({ success: true, member: fresh ? publicMember(fresh) : { ...member, ...todo.patch } });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
}
