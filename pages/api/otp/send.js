import { supabase } from '../../../lib/supabase';
import { normalizeIndianPhone } from '../../../lib/phone';
import { adminIdentity } from '../../../lib/adminIdentity';
import {
    generateOtp, hashOtp, sendOtp,
    otpTtlMs, OTP_RESEND_MS, OTP_MAX_PER_HOUR,
} from '../../../lib/otp';

// The same answer whether or not the number is registered, so this cannot be used to find out who is on the team.
const REPLY = { success: true, message: 'If this number is registered, an OTP has been sent on WhatsApp.', resendIn: 60 };

// POST /api/otp/send { name, phone }   (login, step 1)
// The mobile number is the identity. `name` is only asked for on the login page, it is NOT used to check anything.
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const phone = normalizeIndianPhone((req.body || {}).phone);
    if (!phone) return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number' });

    try {
        // Who is this? The main admin (from .env) or a team member (from the database)
        const adm = adminIdentity();
        let who = null;
        if (adm && phone === adm.phone) {
            who = { name: adm.name };
        } else {
            const { data: tm } = await supabase
                .from('team_members').select('id, name, is_active').eq('phone', phone).maybeSingle();
            if (tm && tm.is_active) who = tm;
        }

        // Number not on the team / switched off: nothing is sent, no OTP is created
        if (!who) return res.json(REPLY);

        const now = Date.now();
        const { data: recent } = await supabase
            .from('login_otps')
            .select('created_at')
            .eq('phone', phone)
            .gte('created_at', new Date(now - 3600 * 1000).toISOString())
            .order('created_at', { ascending: false });
        const list = recent || [];

        if (list.length) {
            const since = now - new Date(list[0].created_at).getTime();
            if (since < OTP_RESEND_MS) {
                const wait = Math.ceil((OTP_RESEND_MS - since) / 1000);
                return res.status(429).json({ success: false, message: `Please wait ${wait} seconds before asking for a new OTP`, retryAfter: wait });
            }
        }
        if (list.length >= OTP_MAX_PER_HOUR) {
            return res.status(429).json({ success: false, message: 'Too many OTP requests. Please try again in an hour.' });
        }

        const code = generateOtp();
        const { data: row, error } = await supabase
            .from('login_otps')
            .insert({ phone, code_hash: hashOtp(phone, code), expires_at: new Date(now + otpTtlMs()).toISOString() })
            .select('id')
            .single();
        if (error) throw error;

        const sent = await sendOtp(phone, code, who.name);
        if (!sent.ok) {
            await supabase.from('login_otps').delete().eq('id', row.id);
            return res.status(502).json({ success: false, message: 'Could not send the OTP right now. Please try again, or ask the admin.' });
        }

        // housekeeping: forget OTPs older than a day
        await supabase.from('login_otps').delete().eq('phone', phone).lt('created_at', new Date(now - 24 * 3600 * 1000).toISOString());

        return res.json(REPLY);
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
}
