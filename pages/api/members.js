import { supabase } from '../../lib/supabase';
import { verifyAdmin } from '../../lib/auth';

export default async function handler(req, res) {
    if (!verifyAdmin(req)) return res.status(401).json({ success: false });

    let allMembers = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('members')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, from + pageSize - 1);

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
    };

    return res.json({ success: true, members, stats });
}