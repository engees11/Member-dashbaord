import { supabase } from '../../lib/supabase';
import { verifyAdmin } from '../../lib/auth';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const admin = verifyAdmin(req);
    if (!admin) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id, status } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'Member id is required' });
    if (!['pending', 'approved', 'rejected', 'expired', 'new', 'need_review'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value: ' + status });
    }

    const { error } = await supabase
        .from('members')
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq('id', id);

    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true });
}