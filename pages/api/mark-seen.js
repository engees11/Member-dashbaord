import { supabase } from '../../lib/supabase';
import { requireUser } from '../../lib/auth';

// A member is NEW until somebody opens it. This marks it as seen, for everybody. It never changes anything else about the member.
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    if (!(await requireUser(req))) return res.status(401).json({ success: false });
    const { id } = req.body || {};
    if (id === undefined || id === null || id === '') return res.status(400).json({ success: false, message: 'id is required' });
    // only members that are still NEW are touched, so the first time it was opened is kept
    const { error } = await supabase.from('members').update({ seen_at: new Date().toISOString() }).eq('id', id).is('seen_at', null);
    if (error) return res.json({ success: false, message: error.message });
    return res.json({ success: true });
}
