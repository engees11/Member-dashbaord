import { supabase } from '../../lib/supabase';
import { logActivity, memberLabel } from '../../lib/activity';

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
        let savedId = existing ? existing.id : null;
        if (existing) {
            ({ error } = await supabase.from('members').update(fields).eq('id', existing.id));
        } else {
            const ins = await supabase.from('members').insert(fields).select('id').maybeSingle();
            error = ins.error;
            savedId = ins.data ? ins.data.id : null;
        }
        if (error) return res.json({ success: false, message: error.message });

        await logActivity({ role: 'public', name: 'Member (form)' }, 'form_submit', {
            memberId: savedId,
            memberLabel: memberLabel(fields),
            newStatus: 'new',
        });

        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
}