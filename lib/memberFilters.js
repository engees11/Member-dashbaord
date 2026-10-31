// Sort / "added" filter and the NEW tag for the members list
const DAY = 24 * 3600 * 1000;

// When the member last came in: the form was filled, or the member was added by hand
export const stamp = (m) => {
    const t = new Date(m.submitted_at || m.created_at || 0).getTime();
    return Number.isFinite(t) ? t : 0;
};

// NEW = came in during the last 3 days
export const isNewMember = (m, now = Date.now()) => {
    const t = stamp(m);
    return t > 0 && now - t <= 3 * DAY && now - t >= -DAY;
};

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

// sort: 'latest' (newest first) | 'oldest'
export function sortMembers(list, sort) {
    const dir = sort === 'oldest' ? 1 : -1;
    return [...list].sort((a, b) => dir * (stamp(a) - stamp(b)) || String(a.id).localeCompare(String(b.id)));
}
