// Sort / "added" filter and the NEW tag for the members list
const DAY = 24 * 3600 * 1000;

// When the member last came in: the form was filled, or the member was added by hand
export const stamp = (m) => {
    const t = new Date(m.submitted_at || m.created_at || 0).getTime();
    return Number.isFinite(t) ? t : 0;
};

// NEW (old rule, no longer used by the list) = came in during the last 3 days
export const isNewMember = (m, now = Date.now()) => {
    const t = stamp(m);
    return t > 0 && now - t <= 3 * DAY && now - t >= -DAY;
};

// NEW = nobody has opened this member yet (seen_at is empty). Only counts when the database has the seen_at column,
// so before the one-time SQL nobody is marked NEW by mistake.
export const isUnseen = (m) => !!m && Object.prototype.hasOwnProperty.call(m, 'seen_at') && !m.seen_at;

// added: 'any' | 'today' | '7' | '30'
export function applyAddedFilter(list, added, now = Date.now()) {
    if (!added || added === 'any') return list;
    return list.filter((m) => {
        const t = stamp(m);
        if (!t) return false;
        if (added === 'today') return new Date(t).toDateString() === new Date(now).toDateString();
        const days = added === '7' ? 7 : added === '30' ? 30 : null;
        return days ? now - t <= days * DAY : true;
    });
}

const nameOf = (m) => [m.first_name, m.father_name, m.last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
// membership no. as a number (2 comes before 10); null when the member has none
const memNo = (m) => {
    const t = String(m.membership_no == null ? '' : m.membership_no).trim();
    if (!/\d/.test(t)) return null;
    const n = Number(t.replace(/\D/g, ''));
    return Number.isFinite(n) ? n : null;
};

// sort: 'latest' (newest first) | 'oldest' | 'mem_asc' (membership no. low to high, members without a number last).
// In Latest first the NEW members (not opened yet) come first, newest first among themselves.
export function sortMembers(list, sort) {
    if (sort === 'mem_asc') {
        return [...list].sort((a, b) => {
            const x = memNo(a); const y = memNo(b);
            if (x === null && y === null) return nameOf(a).localeCompare(nameOf(b)) || String(a.id).localeCompare(String(b.id));
            if (x === null) return 1;
            if (y === null) return -1;
            return (x - y) || nameOf(a).localeCompare(nameOf(b)) || String(a.id).localeCompare(String(b.id));
        });
    }
    const dir = sort === 'oldest' ? 1 : -1;
    const sorted = [...list].sort((a, b) => dir * (stamp(a) - stamp(b)) || String(a.id).localeCompare(String(b.id)));
    if (sort === 'oldest') return sorted;
    const fresh = sorted.filter(isUnseen);
    return fresh.length ? [...fresh, ...sorted.filter((m) => !isUnseen(m))] : sorted;
}

// Search from the first letter or digit.
// Text: name (the words in any order, father's name too), email, PAN number, membership no.
// Numbers (typed any way: 84691-71726, +91 8469171726, 08469171726): mobile, Aadhaar (with or without dashes), membership no.
// One or two digits only match the START of a mobile / Aadhaar / membership no., so a single digit does not match everybody.
export function matchesSearch(m, search) {
    const raw = String(search || '').trim();
    if (!raw) return true;
    const q = raw.toLowerCase();
    if (!/^[\d\s+\-().]+$/.test(raw)) {
        const text = [m.first_name, m.father_name, m.last_name, m.email].filter(Boolean).join(' ').toLowerCase();
        const compact = q.replace(/\s+/g, '');
        return q.split(/\s+/).filter(Boolean).every((w) => text.includes(w))
            || String(m.pan_number || '').toLowerCase().includes(compact)
            || String(m.membership_no || '').toLowerCase().includes(compact);
    }
    const typed = raw.replace(/\D/g, '');
    let t = typed;
    if (t.length >= 11 && t.startsWith('91')) t = t.slice(2); // +91 / 91 in front
    else if (t.length === 11 && t.startsWith('0')) t = t.slice(1); // 0 in front
    if (!t) return false;
    const mobile = String(m.whatsapp_number || '').replace(/\D/g, '');
    const national = mobile.length > 10 ? mobile.slice(-10) : mobile;
    const aadhaar = String(m.aadhaar_number || '').replace(/\D/g, '');
    const mem = String(m.membership_no || '').replace(/\D/g, '');
    if (t.length <= 2) return national.startsWith(t) || aadhaar.startsWith(t) || mem.startsWith(t);
    return national.includes(t) || mobile.includes(typed) || aadhaar.includes(typed) || mem.includes(t);
}

export const PAGE_SIZES = [10, 25, 50, 100];

// one page of a list: { rows, page, pages, total, from, to } (page is kept inside 1..pages)
export function paginate(list, page, size) {
    const total = list.length;
    const per = Math.max(1, Number(size) || 10);
    const pages = Math.max(1, Math.ceil(total / per));
    const cur = Math.min(Math.max(1, Number(page) || 1), pages);
    const start = (cur - 1) * per;
    return { rows: list.slice(start, start + per), page: cur, pages, total, from: total ? start + 1 : 0, to: Math.min(total, start + per) };
}
