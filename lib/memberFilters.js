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

// Search text -> does this member match? Name (in any order of words), mobile (also the last digits), membership no., email.
export function matchesSearch(m, search) {
    const q = String(search || '').trim().toLowerCase();
    if (!q) return true;
    const name = [m.first_name, m.father_name, m.last_name].filter(Boolean).join(' ').toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const digits = q.replace(/\D/g, '');
    return (
        words.every((w) => name.includes(w)) ||
        (digits.length >= 3 && String(m.whatsapp_number || '').includes(digits)) ||
        String(m.membership_no || '').toLowerCase() === q ||
        String(m.membership_no || '').toLowerCase().includes(q) ||
        String(m.email || '').toLowerCase().includes(q)
    );
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
