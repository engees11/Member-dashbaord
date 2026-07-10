import { supabase } from '../../lib/supabase';
import { verifyAdmin, effectiveStatus, calcAge } from '../../lib/auth';

export default async function handler(req, res) {
    if (!verifyAdmin(req)) return res.status(401).json({ success: false });

    const { data, error } = await supabase
        .from('members').select('*').order('created_at', { ascending: false });
    if (error) return res.json({ success: false, message: error.message });

    const members = data.map((m) => ({
        ...m,
        age: calcAge(m.dob),
        effective_status: effectiveStatus(m),
    }));

    const stats = {
        total: members.length,
        pending: members.filter((m) => m.effective_status === 'pending' || m.effective_status === 'not_submitted').length,
        approved: members.filter((m) => m.effective_status === 'approved').length,
        rejected: members.filter((m) => m.effective_status === 'rejected').length,
        expired: members.filter((m) => m.effective_status === 'expired').length,
    };

    return res.json({ success: true, members, stats });
}