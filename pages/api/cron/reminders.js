import { supabase } from '../../../lib/supabase';

export default async function handler(req, res) {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ success: false });
    }

    const { data: pending, error } = await supabase
        .from('members')
        .select('id, full_name, phone, member_type')
        .eq('status', 'not_submitted');

    if (error) return res.json({ success: false, message: error.message });

    const base = process.env.FORM_BASE_URL || '';
    let sent = 0;

    for (const m of pending || []) {
        if (!m.phone) continue;
        const link = m.member_type === 'old' ? `${base}/update` : `${base}/register`;
        const message =
            `Namaste ${m.full_name || 'Member'} ji!\n\n` +
            `Aapka membership form abhi tak submit nahi hua hai. ` +
            `Kripya jald se jald form bharein:\n${link}\n\n` +
            `- Member Management Team`;
        try {
            await fetch('https://api.11za.in/apis/sendMessage/sendMessages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sendto: m.phone,
                    authToken: process.env.WHATSAPP_TOKEN,
                    originWebsite: process.env.ORIGIN_WEBSITE,
                    originWebsites: process.env.ORIGIN_WEBSITE,
                    contentType: 'text',
                    text: message,
                }),
            });
            sent++;
        } catch (e) {
            console.error('WhatsApp send failed for', m.phone, e.message);
        }
    }

    return res.json({ success: true, reminders_sent: sent, total_pending: (pending || []).length });
}