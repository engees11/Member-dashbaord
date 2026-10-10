import { supabase } from '../../lib/supabase';
import { requireUser } from '../../lib/auth';
import { missingDeletedColumn } from '../../lib/softDelete';

export default async function handler(req, res) {
    if (!(await requireUser(req))) return res.status(401).json({ success: false });

    // Deleted members are left out of every count. If the database has no deleted_at column yet, count everything.
    let hideDeleted = true;

    async function count(addFilter) {
        for (let attempt = 0; attempt < 2; attempt++) {
            const withFilter = hideDeleted;
            let q = supabase.from('members').select('*', { count: 'exact', head: true });
            q = addFilter(q);
            if (withFilter) q = q.is('deleted_at', null);
            const { count: n, error } = await q;
            if (error && withFilter && missingDeletedColumn(error)) {
                hideDeleted = false;
                continue;
            }
            if (error) throw error;
            return n || 0;
        }
        return 0;
    }

    const byStatus = (status) => count((q) => (status === null ? q.is('status', null) : q.eq('status', status)));

    try {
        const [total, approved, rejected, expired, newCount, needReview, pendingSet1, pendingSet2, deleted] = await Promise.all([
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
                if (error) {
                    if (missingDeletedColumn(error)) return 0;
                    throw error;
                }
                return n || 0;
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
            deleted,
        };

        return res.json({ success: true, stats });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
}
