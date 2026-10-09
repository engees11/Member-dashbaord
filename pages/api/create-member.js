import { supabase } from '../../lib/supabase';
import { requireUser } from '../../lib/auth';
import { logActivity, memberLabel } from '../../lib/activity';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    try {
        const body = req.body || {};
        const phone = (body.whatsapp_number || '').replace(/\D/g, '');
        if (!phone) return res.status(400).json({ success: false, message: 'WhatsApp number is required' });

        const record = {
            whatsapp_number: phone,
            first_name: body.first_name || null,
            father_name: body.father_name || null,
            last_name: body.last_name || null,
            email: body.email || null,
            birth_date: body.birth_date || null,
            native_place: body.native_place || null,
            address: body.address || null,
            area: body.area || null,
            aadhaar_number: body.aadhaar_number || null,
            form_type: body.form_type || 'details_update',
            status: 'new',
        };

        const { data: existing } = await supabase
            .from('members').select('id').eq('whatsapp_number', phone).maybeSingle();

        if (existing) {
            return res.status(409).json({ success: false, message: 'A member with this WhatsApp number already exists.' });
        }

        const { data: created, error } = await supabase.from('members').insert(record).select('id').maybeSingle();
        if (error) return res.status(500).json({ success: false, message: error.message });

        await logActivity(user, 'member_create', { memberId: created && created.id, memberLabel: memberLabel(record), newStatus: 'new' });

        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
}