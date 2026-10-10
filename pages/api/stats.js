import { supabase } from '../../lib/supabase';
import { requireUser } from '../../lib/auth';

export default async function handler(req, res) {
    if (!(await requireUser(req))) return res.status(401).json({ success: false });

    // Deleted members are left out of every count. If that filter fails (for example the database has no
    // deleted_at column yet), count everything instead, so the dashboard never goes blank because of it.
    // (A count request has no reply body, so the error cannot be read: any failure with the filter means retry without it.)
    let hideDeleted = true;

    async function count(addFilter) {
        for (let attempt = 0; attempt < 2; attempt++) {
            const withFilter = hideDeleted;
            let q = supabase.from('members').select('*', { count: 'exact', head: true });
            q = addFilter(q);
            if (withFilter) q = q.is('deleted_at', null);
            const { count: n, error } = await q;
            if (error && withFilter) {
                hideDeleted = false;
                continue;
            }
            if (error) throw new Error(error.message || 'a count query failed (the database gave no details)');
            return n || 0;
        }
        return 0;
    }

    const byStatus = (status) => count((q) => (status === null ? q.is('status', null) : q.eq('status', status)));

    try {
        const [total, approved, rejected, expired, newCount, needReview, pendingSet1, pendingSet2, deletedMembers, deletedTeam] = await Promise.all([
            count((q) => q),
            byStatus('approved'),
            byStatus('rejected'),
            byStatus('expired'),
            byStatus('new'),
            byStatus('need_review'),
            byStatus('pending'),
            byStatus(null),
            (async () => {
                const { count: n, error } = await supabase
                    .from('members').select('*', { count: 'exact', head: true }).not('deleted_at', 'is', null);
                return error ? 0 : n || 0; // only for the admin's Deleted card, never worth breaking the dashboard
            })(),
            (async () => {
                const { data, error } = await supabase.from('team_members').select('*');
                return error ? 0 : (data || []).filter((m) => m.deleted_at).length;
            })(),
        ]);

        const stats = {
            total,
            pending: pendingSet1 + pendingSet2,
            approved,
            rejected,
            expired,
            new: newCount,
            needReview,
            deleted: deletedMembers + deletedTeam,
        };

        return res.json({ success: true, stats });
    } catch (e) {
        console.error('[stats] failed:', (e && e.message) || e); // shows the reason in the terminal / Vercel Logs
        return res.status(500).json({ success: false, message: (e && e.message) || 'Could not count the members' });
    }
}
