import { supabase } from '../../lib/supabase';

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    try {
        const { member_type, full_name, dob, phone, email, address, document } = req.body || {};
        if (!phone) return res.json({ success: false, message: 'Phone number required hai' });

        let document_url = null;
        if (document && document.base64) {
            const path = `${phone}-${Date.now()}-${(document.name || 'doc').replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const { error: upErr } = await supabase.storage
                .from('documents')
                .upload(path, Buffer.from(document.base64, 'base64'), {
                    contentType: document.type || 'application/octet-stream',
                });
            if (upErr) return res.json({ success: false, message: 'Document upload fail: ' + upErr.message });
            const { data: pub } = supabase.storage.from('documents').getPublicUrl(path);
            document_url = pub.publicUrl;
        }

        const { data: existing } = await supabase
            .from('members').select('id').eq('phone', phone).maybeSingle();

        const fields = {
            member_type,
            status: 'pending',
            submitted_at: new Date().toISOString(),
        };
        if (full_name) fields.full_name = full_name;
        if (dob) fields.dob = dob;
        if (email) fields.email = email;
        if (address) fields.address = address;
        if (document_url) fields.document_url = document_url;

        let error;
        if (existing) {
            ({ error } = await supabase.from('members').update(fields).eq('id', existing.id));
        } else {
            ({ error } = await supabase.from('members').insert({ phone, ...fields }));
        }
        if (error) return res.json({ success: false, message: error.message });

        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
}