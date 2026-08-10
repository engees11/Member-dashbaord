import { supabase } from '../../lib/supabase';
import { verifyAdmin } from '../../lib/auth';

async function countWhere(column, value) {
    let query = supabase.from('members').select('*', { count: 'exact', head: true });
    if (value === null) {
        query = query.is(column, null);
    } else {
        query = query.eq(column, value);
    }
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
}

export default async function handler(req, res) {
    if (!verifyAdmin(req)) return res.status(401).json({ success: false });

    try {
        const { count: total } = await supabase.from('members').select('*', { count: 'exact', head: true });

        const [approved, rejected, expired, newCount, needReview, pendingSet1, pendingSet2] = await Promise.all([
            countWhere('status', 'approved'),
            countWhere('status', 'rejected'),
            countWhere('status', 'expired'),
            countWhere('status', 'new'),
            countWhere('status', 'need_review'),
            countWhere('status', 'pending'),
            countWhere('status', null),
        ]);

        const stats = {
            total: total || 0,
            pending: pendingSet1 + pendingSet2,
            approved,
            rejected,
            expired,
            new: newCount,
            needReview,
        };

        return res.json({ success: true, stats });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
}