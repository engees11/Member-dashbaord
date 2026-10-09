import crypto from 'crypto';

// How long an OTP works. Keep it the SAME as the expiry set in the 11za template (the message says e.g. "expires in 15 minutes").
// env OTP_EXPIRY_MINUTES, 1-90, default 15
export function otpTtlMs() {
    const m = parseInt(process.env.OTP_EXPIRY_MINUTES, 10);
    return (Number.isFinite(m) && m >= 1 && m <= 90 ? m : 15) * 60 * 1000;
}
export const OTP_RESEND_MS = 60 * 1000;       // one new OTP per minute
export const OTP_MAX_PER_HOUR = 5;            // and at most 5 per hour per number
export const OTP_MAX_ATTEMPTS = 5;            // wrong guesses allowed per OTP
export const OTP_MAX_GUESSES_PER_HOUR = 10;   // and at most 10 guesses per number per hour, across all its OTPs

export const generateOtp = () => String(crypto.randomInt(100000, 1000000));

// The OTP itself is never stored, only a keyed hash of it
export function hashOtp(phone, code) {
    return crypto.createHmac('sha256', process.env.JWT_SECRET || '').update(`${phone}:${code}`).digest('hex');
}

export function sameHash(a, b) {
    const x = Buffer.from(String(a), 'hex');
    const y = Buffer.from(String(b), 'hex');
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function timedFetch(url, opts, ms = 10000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { ...opts, signal: ctrl.signal });
    } finally {
        clearTimeout(t);
    }
}

async function safeJson(res) {
    try { return await res.json(); } catch { return null; }
}

// Which way the OTP travels: "whatsapp" (default, approved 11za template) or "sms"  -> env OTP_CHANNEL
export function otpChannel() {
    return String(process.env.OTP_CHANNEL || 'whatsapp').toLowerCase() === 'sms' ? 'sms' : 'whatsapp';
}

// Sends the OTP by SMS. Provider is chosen with SMS_PROVIDER = fast2sms | msg91 | 2factor
// (the provider writes the message text, we only hand it the OTP). Keys are never logged.
export async function sendOtpSms(phone, code) {
    const provider = String(process.env.SMS_PROVIDER || '').toLowerCase();
    const key = process.env.SMS_API_KEY;

    if (!provider || !key) {
        if (process.env.NODE_ENV !== 'production') {
            // Local testing only: the OTP shows in the terminal, never in production
            console.log(`[DEV] OTP for ${phone}: ${code}  (SMS not configured, nothing was sent)`);
            return { ok: true, dev: true };
        }
        return { ok: false, error: 'SMS OTP is not configured on the server' };
    }

    const ten = phone.slice(2); // 91XXXXXXXXXX -> XXXXXXXXXX
    try {
        let res;
        let body;
        let accepted = false;

        if (provider === 'fast2sms') {
            res = await timedFetch('https://www.fast2sms.com/dev/bulkV2', {
                method: 'POST',
                headers: { authorization: key, 'Content-Type': 'application/json' },
                body: JSON.stringify({ route: 'otp', variables_values: code, numbers: ten }),
            });
            body = await safeJson(res);
            accepted = res.ok && !!body && body.return === true;
        } else if (provider === 'msg91') {
            const templateId = process.env.SMS_TEMPLATE_ID;
            if (!templateId) return { ok: false, error: 'SMS_TEMPLATE_ID is missing (needed for MSG91)' };
            const qs = new URLSearchParams({ template_id: templateId, mobile: phone, authkey: key, otp: code, otp_expiry: '5' });
            res = await timedFetch(`https://control.msg91.com/api/v5/otp?${qs.toString()}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
            });
            body = await safeJson(res);
            accepted = res.ok && !!body && body.type === 'success';
        } else if (provider === '2factor') {
            const tpl = process.env.SMS_TEMPLATE_ID ? `/${encodeURIComponent(process.env.SMS_TEMPLATE_ID)}` : '';
            res = await timedFetch(`https://2factor.in/API/V1/${encodeURIComponent(key)}/SMS/${ten}/${code}${tpl}`, { method: 'GET' });
            body = await safeJson(res);
            accepted = res.ok && !!body && body.Status === 'Success';
        } else {
            return { ok: false, error: `Unknown SMS_PROVIDER "${provider}"` };
        }

        if (!accepted) {
            console.error(`SMS (${provider}) OTP send failed:`, res.status, JSON.stringify(body));
            return { ok: false, error: 'The SMS provider did not accept the message' };
        }
        return { ok: true };
    } catch (e) {
        console.error(`SMS (${provider}) OTP send error:`, e.name === 'AbortError' ? 'timed out' : e.message);
        return { ok: false, error: 'Could not reach the SMS provider' };
    }
}

// One entry point for the API: sends by the configured channel
export async function sendOtp(phone, code, name) {
    return otpChannel() === 'whatsapp' ? sendOtpWhatsApp(phone, code, name) : sendOtpSms(phone, code);
}

// Sends the OTP on WhatsApp through the 11za template API (the approved template has ONE variable: the OTP).
// Needs an approved 11za template with ONE variable (the OTP) -> env WHATSAPP_OTP_TEMPLATE
// The OTP is sent as the body variable and as the button value (Copy Code button of Authentication templates).
export async function sendOtpWhatsApp(phone, code, name) {
    const template = process.env.WHATSAPP_OTP_TEMPLATE;
    if (!template || !process.env.WHATSAPP_TOKEN) {
        if (process.env.NODE_ENV !== 'production') {
            // Local testing only: the OTP shows in the terminal, never in production
            console.log(`[DEV] OTP for ${phone}: ${code}  (WhatsApp not configured, nothing was sent)`);
            return { ok: true, dev: true };
        }
        return { ok: false, error: 'WhatsApp OTP is not configured on the server' };
    }
    try {
        const res = await fetch('https://api.11za.in/apis/template/sendTemplate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                authToken: process.env.WHATSAPP_TOKEN,
                name: name || 'Team member',
                sendto: phone,
                originWebsite: process.env.ORIGIN_WEBSITE,
                templateName: template,
                language: process.env.WHATSAPP_OTP_LANGUAGE || 'en',
                data: [code],
                buttonValue: code, // for the Copy Code button of an Authentication template
            }),
        });
        let body = null;
        try { body = await res.json(); } catch { /* not json */ }
        const failed = !res.ok || (body && (body.success === false || /fail|error/i.test(String(body.status || ''))));
        if (failed) {
            console.error('11za OTP send failed:', res.status, JSON.stringify(body));
            return { ok: false, error: 'WhatsApp did not accept the message' };
        }
        return { ok: true };
    } catch (e) {
        console.error('11za OTP send error:', e.message);
        return { ok: false, error: 'Could not reach the WhatsApp service' };
    }
}

// Checks the OTP typed for this number. Every guess is counted; one OTP works once.
export async function consumeOtp(supabase, phone, code) {
    const { data: row } = await supabase
        .from('login_otps')
        .select('id, code_hash, expires_at, attempts')
        .eq('phone', phone)
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
        return { ok: false, status: 401, message: 'This OTP has expired or was not requested. Please request a new OTP.' };
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
        return { ok: false, status: 429, message: 'Too many wrong attempts. Please send a new OTP.' };
    }

    // overall cap: guesses across ALL OTPs of this number in the last hour
    const { data: lastHour } = await supabase
        .from('login_otps')
        .select('attempts')
        .eq('phone', phone)
        .gte('created_at', new Date(Date.now() - 3600 * 1000).toISOString());
    const guesses = (lastHour || []).reduce((n, r) => n + (r.attempts || 0), 0);
    if (guesses >= OTP_MAX_GUESSES_PER_HOUR) {
        return { ok: false, status: 429, message: 'Too many wrong attempts for this number. Please try again after an hour.' };
    }

    // count this guess first (atomically) so parallel guessing cannot beat the limit
    const { data: bumped } = await supabase
        .from('login_otps')
        .update({ attempts: row.attempts + 1 })
        .eq('id', row.id)
        .eq('attempts', row.attempts)
        .select('id');
    if (!bumped || !bumped.length) {
        return { ok: false, status: 429, message: 'Please try again.' };
    }

    if (!sameHash(row.code_hash, hashOtp(phone, code))) {
        const left = OTP_MAX_ATTEMPTS - (row.attempts + 1);
        return {
            ok: false, status: 401,
            message: left > 0 ? `Incorrect OTP. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Incorrect OTP. Please send a new one.',
        };
    }

    const { data: claimed } = await supabase
        .from('login_otps').update({ used: true }).eq('id', row.id).eq('used', false).select('id');
    if (!claimed || !claimed.length) {
        return { ok: false, status: 401, message: 'This OTP was already used. Please send a new one.' };
    }
    return { ok: true };
}
