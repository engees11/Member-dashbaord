import { normalizeIndianPhone } from './phone';
import { dmyToIso, normalizePan, isValidPan } from './format';

const TEXT = ['first_name', 'father_name', 'last_name', 'native_place', 'address', 'area', 'aadhaar_number', 'membership_no'];
// six extra details of the paper membership form (all optional)
const PAPER_TEXT = { qualification: 'Qualification', hobbies: 'Hobbies', business_name: 'Business / profession', business_description: 'Business description' };
export const PAPER_KEYS = ['blood_group', ...Object.keys(PAPER_TEXT), 'marriage_date'];
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
// "o positive", "O +ve", "ab-" -> O+, O+, AB-.  Empty stays empty, anything else gives null
export function normalizeBlood(v) {
    let t = String(v == null ? '' : v).toUpperCase().replace(/\s+/g, '');
    if (!t) return '';
    t = t.replace(/POSITIVE|POS|\+VE|VE\+/g, '+').replace(/NEGATIVE|NEG|-VE|VE-/g, '-');
    return BLOOD_GROUPS.includes(t) ? t : null;
}
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
    for (const k of ['aadhaar_front_url', 'aadhaar_back_url']) {
        if (k in b && String(b[k] || '').trim()) {
            const v = String(b[k]).trim();
            if (!/^https:\/\/\S+$/.test(v) || v.length > 1000) return { error: 'The photo link is not valid' };
            out[k] = v;
        }
    }
    if ('photo_url' in b) {
        const v = String(b.photo_url == null ? '' : b.photo_url).trim();
        if (v && (!/^https:\/\/\S+$/.test(v) || v.length > 1000)) return { error: 'The photo link is not valid' };
        out.photo_url = v || null; // empty = the photo is removed
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
            // unchanged in the form: a 10-digit number gets its 91 now; a hopeless old number (glued digits...) stays as it is
            out.whatsapp_number = normalizeIndianPhone(raw) || existing.whatsapp_number;
        } else {
            const p = normalizeIndianPhone(raw);
            if (!p) return { error: 'Enter a valid 10-digit Indian mobile number' };
            out.whatsapp_number = p;
        }
    }
    // the paper form details
    for (const [k, label] of Object.entries(PAPER_TEXT)) {
        if (!(k in b)) continue;
        const v = String(b[k] == null ? '' : b[k]).trim();
        if (v.length > 500) return { error: `${label} is too long (500 characters at most)` };
        out[k] = v || null;
    }
    if ('blood_group' in b) {
        const v = normalizeBlood(b.blood_group);
        if (v === null) return { error: 'Blood group must be like A+, B-, O+ or AB+' };
        out.blood_group = v || null;
    }
    if ('marriage_date' in b) {
        const iso = dmyToIso(b.marriage_date);
        if (iso === null) return { error: 'Marriage date must be a real date like 24/11/2019' };
        out.marriage_date = iso || null;
    }
    return { fields: out };
}

export const FIELD_LABELS = {
    membership_no: 'membership no', first_name: 'first name', father_name: 'father name', last_name: 'surname',
    birth_date: 'birth date', native_place: 'native place', whatsapp_number: 'mobile number', email: 'email',
    address: 'address', area: 'area', aadhaar_number: 'aadhaar number', pan_number: 'PAN number', form_type: 'section',
    aadhaar_front_url: 'Aadhaar front photo', aadhaar_back_url: 'Aadhaar back photo',
    blood_group: 'blood group', qualification: 'qualification', hobbies: 'hobbies', marriage_date: 'marriage date',
    business_name: 'business / profession', business_description: 'business description', photo_url: 'photo',
};
