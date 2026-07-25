import { supabase } from '../../lib/supabase';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    try {
        const { member_id, whatsapp_number, ...rest } = req.body || {};
        if (!whatsapp_number) return res.json({ success: false, message: 'WhatsApp number required hai' });

        const fields = { ...rest, whatsapp_number, status: 'new', updated_at: new Date().toISOString() };
        Object.keys(fields).forEach((k) => (fields[k] == null || fields[k] === '') && delete fields[k]);

        let existing = null;
        if (member_id) {
            const { data } = await supabase.from('members').select('id').eq('id', member_id).maybeSingle();
            existing = data;
        }
        if (!existing) {
            const { data } = await supabase.from('members').select('id').eq('whatsapp_number', whatsapp_number).maybeSingle();
            existing = data;
        }

        let error;
        if (existing) {
            ({ error } = await supabase.from('members').update(fields).eq('id', existing.id));
        } else {
            ({ error } = await supabase.from('members').insert(fields));
        }
        if (error) return res.json({ success: false, message: error.message });

        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
}