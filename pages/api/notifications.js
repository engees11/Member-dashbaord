import { supabase } from '../../lib/supabase';
import { requireUser } from '../../lib/auth';

// For the bell icon: the team's latest activity (excluding logins)
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
