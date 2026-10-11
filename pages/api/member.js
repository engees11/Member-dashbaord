import { supabase } from '../../lib/supabase';
import { requireUser } from '../../lib/auth';

// GET /api/member?id=...  : one member's full record (deleted members are hidden)
export default async function handler(req, res) {
    if (!(await requireUser(req))) return res.status(401).json({ success: false });
    const { id } = req.query;
    if (!id) return res.status(400).json({ success: false, message: 'Member id is required' });

    const { data, error } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
    if (error) {
        console.error('[member] failed:', error.message);
        return res.json({ success: false, message: error.message });
    }
    if (!data || data.deleted_at) return res.status(404).json({ success: false, message: 'Member not found' });
    return res.json({ success: true, member: data });
}
