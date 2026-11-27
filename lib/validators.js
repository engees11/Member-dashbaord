// Data rules. The forms (in the browser) and the server use the SAME rules, so a wrong value is stopped in both places.
import { normalizePan, isValidPan } from './format';

// Aadhaar check digit (Verhoeff). It catches almost every typing mistake: a wrong or swapped digit.
const D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1], [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1], [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
export function verhoeff(num) {
    const s = String(num).split('').reverse();
    let c = 0;
    for (let i = 0; i < s.length; i++) c = D[c][P[i % 8][Number(s[i])]];
    return c === 0;
}

export const onlyDigits = (v) => String(v == null ? '' : v).replace(/\D/g, '');

// ---------- mobile: 10 digits, starts with 6, 7, 8 or 9 (stored as 91 + 10 digits elsewhere)
// while typing: digits only, a pasted +91 or 0 in front is dropped, 10 digits at most
export function typingPhone(v) {
    let d = onlyDigits(v);
    if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
    else if (d.length > 10 && d.startsWith('0')) d = d.slice(1);
    return d.slice(0, 10);
}
export function mobileProblem(v) {
    const d = typingPhone(v);
    if (!d) return '';
    if (d.length < 10) return 'Mobile number must be 10 digits';
    if (!/^[6-9]/.test(d)) return 'Mobile number must start with 6, 7, 8 or 9';
    return '';
}

// ---------- Aadhaar: 12 digits, not starting with 0 or 1, and the check digit must be right. Spaces and dashes are fine.
export function aadhaarDigits(v) {
    const d = onlyDigits(v);
    return /^[2-9]\d{11}$/.test(d) && verhoeff(d) ? d : null;
}
// an old copy where only the last 4 digits were kept, like XXXX-XXXX-1700
export const isMaskedAadhaar = (v) => /^[Xx*]{4}[\s-]?[Xx*]{4}[\s-]?\d{4}$/.test(String(v == null ? '' : v).trim());
export function fmtAadhaar(v) {
    const d = onlyDigits(v);
    return d.length === 12 && !/[A-Za-z]/.test(String(v)) ? `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8)}` : (v == null ? '' : String(v));
}
// while typing: digits only, shown as 1234 5678 9012
export function typingAadhaar(v) {
    const d = onlyDigits(v).slice(0, 12);
    return [d.slice(0, 4), d.slice(4, 8), d.slice(8, 12)].filter(Boolean).join(' ');
}
export function aadhaarProblem(v) {
    const raw = String(v == null ? '' : v).trim();
    if (!raw) return '';
    if (isMaskedAadhaar(raw)) return 'Enter the full 12-digit Aadhaar number, not a hidden one like XXXX-XXXX-1234';
    const d = onlyDigits(raw);
    if (/[A-Za-z]/.test(raw) || d.length !== 12) return 'Aadhaar number must be exactly 12 digits';
    if (!/^[2-9]/.test(d)) return 'Aadhaar number cannot start with 0 or 1';
    if (!verhoeff(d)) return 'This Aadhaar number does not look right. Please check every digit';
    return '';
}

// ---------- PAN: 5 letters, 4 digits, 1 letter
export function panProblem(v) {
    const p = normalizePan(v);
    if (!p) return '';
    if (!isValidPan(p)) return 'PAN must be 5 letters, 4 digits and 1 letter (like ABCDE1234F)';
    return '';
}

// ---------- names: letters (any language), spaces, and . ' - ( ). No numbers.
export const isValidName = (v) => /^[\p{L}\p{M}][\p{L}\p{M}\s.'’()-]*$/u.test(String(v == null ? '' : v).trim());
export const nameProblem = (v, label) => (String(v || '').trim() && !isValidName(v) ? `${label} can have letters only (no numbers or symbols)` : '');

// ---------- membership number: digits only, up to 6
export const isValidMembershipNo = (v) => /^\d{1,6}$/.test(String(v == null ? '' : v).trim());

// ---------- birth date given as ISO (2026-11-27): not in the future
export const isFutureIso = (iso, now = new Date()) => !!iso && String(iso).slice(0, 10) > now.toISOString().slice(0, 10);
