import { supabase } from '../../lib/supabase';
import { verifyAdmin } from '../../lib/auth';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    if (!verifyAdmin(req)) return res.status(401).json({ success: false });

    const { id, status } = req.body || {};
    if (!['approved', 'rejected', 'pending'].includes(status)) {
        return res.json({ success: false, message: 'Invalid status' });
    }

    const { error } = await supabase
        .from('members')
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq('id', id);

    if (error) return res.json({ success: false, message: error.message });
    return res.json({ success: true });
}