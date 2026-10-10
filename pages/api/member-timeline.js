import { supabase } from '../../lib/supabase';
import { requireUser } from '../../lib/auth';

// GET /api/member-timeline?id=<member id>
// Every status this member has been through, oldest first, built from the activity log.
export default async function handler(req, res) {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const id = String(req.query.id || '');
    if (!id) return res.status(400).json({ success: false, message: 'Member id is required' });

    try {
        const { data: m } = await supabase
            .from('members')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (!m) return res.status(404).json({ success: false, message: 'Member not found' });

        const { data: rows, error } = await supabase
            .from('member_activity')
            .select('id, action, actor_name, old_status, new_status, note, created_at')
            .eq('member_id', id)
            .in('action', ['status_change', 'member_create', 'form_submit', 'member_delete', 'member_restore'])
            .order('created_at', { ascending: true })
            .limit(300);
        if (error) throw error;

        const events = [];
        for (const a of rows || []) {
            if (a.action === 'status_change') {
                events.push({ id: a.id, status: a.new_status, from: a.old_status, at: a.created_at, by: a.actor_name, note: a.note, label: null });
            } else if (a.action === 'member_delete') {
                events.push({ id: a.id, status: 'deleted', from: a.old_status, at: a.created_at, by: a.actor_name, note: null, label: 'Deleted' });
            } else if (a.action === 'member_restore') {
                events.push({ id: a.id, status: a.new_status || 'pending', from: null, at: a.created_at, by: a.actor_name, note: null, label: 'Restored' });
            } else if (a.action === 'member_create') {
                events.push({ id: a.id, status: a.new_status || 'new', from: null, at: a.created_at, by: a.actor_name, note: null, label: 'Added manually' });
            } else {
                events.push({ id: a.id, status: a.new_status || 'new', from: null, at: a.created_at, by: null, note: null, label: 'Form submitted' });
            }
        }

        // "Earlier it was Pending": show the status it had before the first recorded change
        if (events.length && events[0].from) {
            events.unshift({ id: 'before', status: events[0].from, from: null, at: null, by: null, note: null, label: 'Earlier status' });
        }

        const current = m.deleted_at ? 'deleted' : (m.status || 'pending');
        if (!events.length) {
            events.push({
                id: 'current', status: current, from: null,
                at: m.reviewed_at || m.updated_at || m.created_at, by: null, note: null,
                label: 'Current status (earlier history was not recorded)',
            });
        } else if (events[events.length - 1].status !== current) {
            events.push({
                id: 'current', status: current, from: null,
                at: m.reviewed_at || m.updated_at || null, by: null, note: null, label: 'Current status',
            });
        }

        return res.json({ success: true, events });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
}
