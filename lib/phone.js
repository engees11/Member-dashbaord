// Indian mobile numbers. Stored everywhere as 91XXXXXXXXXX (12 digits, no plus, no spaces).
export function normalizeIndianPhone(input) {
    let d = String(input || '').replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    if (d.length === 10) d = '91' + d;
    return /^91[6-9]\d{9}$/.test(d) ? d : null;
}

// 919876543210 -> +91 98765 43210
export function formatPhone(p) {
    const d = String(p || '').replace(/\D/g, '');
    if (/^91\d{10}$/.test(d)) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
    return p || '';
}

const norm = (v) => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

// "ravi" matches "Ravi Kumar", "Ravi Kumar" matches "Ravi Kumar", "kumar" does not
export function sameName(typed, registered) {
    const a = norm(typed);
    const b = norm(registered);
    if (!a || !b) return false;
    return a === b || b.startsWith(a + ' ');
}
