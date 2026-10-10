import { supabase } from '../../lib/supabase';
import { requireUser } from '../../lib/auth';
import { missingDeletedColumn } from '../../lib/softDelete';

export default async function handler(req, res) {
    if (!(await requireUser(req))) return res.status(401).json({ success: false });

    let allMembers = [];
    let from = 0;
    const pageSize = 1000;
    let hideDeleted = true; // switched off only if the database has no deleted_at column yet

    while (true) {
        let q = supabase.from('members').select('*');
        if (hideDeleted) q = q.is('deleted_at', null);
        const { data, error } = await q
            .order('created_at', { ascending: false })
            .order('id', { ascending: true })
            .range(from, from + pageSize - 1);

        if (error && hideDeleted && missingDeletedColumn(error)) {
            hideDeleted = false;
            continue;
        }
        if (error) return res.json({ success: false, message: error.message });
        allMembers = allMembers.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
    }

    const members = allMembers.map((m) => ({ ...m, effective_status: m.status }));

    const stats = {
        total: members.length,
        pending: members.filter((m) => m.status === 'pending' || !m.status).length,
        approved: members.filter((m) => m.status === 'approved').length,
        rejected: members.filter((m) => m.status === 'rejected').length,
        expired: members.filter((m) => m.status === 'expired').length,
        new: members.filter((m) => m.status === 'new').length,
        needReview: members.filter((m) => m.status === 'need_review').length,
    };

    return res.json({ success: true, members, stats });
}
