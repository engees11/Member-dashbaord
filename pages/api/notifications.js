import { supabase } from '../../lib/supabase';
import { requireUser } from '../../lib/auth';

// Bell icon ke liye: team ki latest activity (login chhod ke)
export default async function handler(req, res) {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false });

    const { data, error } = await supabase
        .from('member_activity')
        .select('id, actor_name, action, member_label, new_status, created_at')
        .neq('action', 'login')
        .neq('action', 'form_submit')
        .order('created_at', { ascending: false })
        .limit(20);
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, items: data || [] });
}
