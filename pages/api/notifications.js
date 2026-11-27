import { supabase } from '../../lib/supabase';
import { requireUser } from '../../lib/auth';

// Bell icon: what the team did in the last 24 hours (logins and form submissions left out)
export default async function handler(req, res) {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false });

    const { data, error } = await supabase
        .from('member_activity')
        .select('id, actor_name, action, member_label, new_status, created_at')
        .neq('action', 'login')
        .neq('action', 'form_submit')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, items: data || [] });
}
