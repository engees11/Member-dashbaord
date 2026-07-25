import { supabase } from '../../lib/supabase';
import { verifyAdmin } from '../../lib/auth';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const admin = verifyAdmin(req);
    if (!admin) return res.status(401).json({ success: false, message: 'Unauthorized' });

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

        const { error } = await supabase.from('members').insert(record);
        if (error) return res.status(500).json({ success: false, message: error.message });

        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
}