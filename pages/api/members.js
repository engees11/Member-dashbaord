import { supabase } from '../../lib/supabase';
import { verifyAdmin } from '../../lib/auth';

export default async function handler(req, res) {
    if (!verifyAdmin(req)) return res.status(401).json({ success: false });

    const { data, error } = await supabase
        .from('members').select('*').order('created_at', { ascending: false });
    if (error) return res.json({ success: false, message: error.message });

    const members = data.map((m) => ({ ...m, effective_status: m.status }));

    const stats = {
        total: members.length,
        pending: members.filter((m) => m.status === 'pending' || !m.status).length,
        approved: members.filter((m) => m.status === 'approved').length,
        rejected: members.filter((m) => m.status === 'rejected').length,
        expired: members.filter((m) => m.status === 'expired').length,
    };

    return res.json({ success: true, members, stats });
}