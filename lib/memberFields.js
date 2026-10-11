import { normalizeIndianPhone } from './phone';
import { dmyToIso, normalizePan, isValidPan } from './format';

const TEXT = ['first_name', 'father_name', 'last_name', 'native_place', 'address', 'area', 'aadhaar_number', 'membership_no'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Checks and cleans member details typed by an admin. Only the keys that are present are returned.
// -> { error } or { fields }
export function cleanMemberInput(body, { existing } = {}) {
    const b = body || {};
    const out = {};

    for (const k of TEXT) {
        if (k in b) out[k] = String(b[k] == null ? '' : b[k]).trim() || null;
    }
    if ('email' in b) {
        const v = String(b.email || '').trim().toLowerCase();
        if (v && !EMAIL_RE.test(v)) return { error: 'Enter a valid email' };
        out.email = v || null;
    }
    if ('birth_date' in b) {
        const iso = dmyToIso(b.birth_date);
        if (iso === null) return { error: 'Birth date must be a real date like 17/09/1992' };
        out.birth_date = iso || null;
    }
    if ('pan_number' in b) {
        const v = normalizePan(b.pan_number);
        if (v && !isValidPan(v)) return { error: 'PAN must be 5 letters, 4 digits, 1 letter (like ABCDE1234F)' };
        out.pan_number = v || null;
    }
    if ('whatsapp_number' in b) {
        const raw = String(b.whatsapp_number || '').trim();
        const digits = raw.replace(/\D/g, '');
        if (existing && digits && digits === existing.whatsapp_number) {
            out.whatsapp_number = existing.whatsapp_number; // untouched, even if it is an odd old number
        } else {
            const p = normalizeIndianPhone(raw);
            if (!p) return { error: 'Enter a valid 10-digit Indian mobile number' };
            out.whatsapp_number = p;
        }
    }
    return { fields: out };
}

export const FIELD_LABELS = {
    membership_no: 'membership no', first_name: 'first name', father_name: 'father name', last_name: 'surname',
    birth_date: 'birth date', native_place: 'native place', whatsapp_number: 'mobile number', email: 'email',
    address: 'address', area: 'area', aadhaar_number: 'aadhaar number', pan_number: 'PAN number',
};
