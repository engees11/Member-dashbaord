import { supabase } from '../../lib/supabase';
import { requireUser, isAdmin } from '../../lib/auth';

// GET  /api/skipped-entries            -> every row an import skipped, newest first (admin)
// POST /api/skipped-entries { action: 'remove', id } | { action: 'clear' }   (admin)
export default async function handler(req, res) {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isAdmin(user)) return res.status(403).json({ success: false, message: 'Only the admin can see the duplicates' });

    if (req.method === 'GET') {
        const { data, error } = await supabase.from('import_skipped').select('*').order('id', { ascending: false }).limit(5000);
        if (error) return res.json({ success: true, rows: [], needsSetup: true });
        return res.json({ success: true, rows: data || [] });
    }

    if (req.method === 'POST') {
        const { action, id } = req.body || {};
        if (action === 'remove') {
            if (!id) return res.status(400).json({ success: false, message: 'id is required' });
            const { error } = await supabase.from('import_skipped').delete().eq('id', id);
            if (error) return res.status(500).json({ success: false, message: error.message });
            return res.json({ success: true });
        }
        if (action === 'clear') {
            const { error } = await supabase.from('import_skipped').delete().gt('id', 0);
            if (error) return res.status(500).json({ success: false, message: error.message });
            return res.json({ success: true });
        }
        return res.status(400).json({ success: false, message: 'Unknown action' });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
}
