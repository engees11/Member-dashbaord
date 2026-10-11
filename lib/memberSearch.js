// Member search: matches membership no., name, mobile, Aadhaar, PAN, email,
// area, native place and dates, and puts the best matches on top.
//
// Rules:
//  - If something matches EXACTLY (membership no., mobile, Aadhaar or PAN),
//    only those exact matches are shown. Searching "15" shows member no. 15 only.
//  - Otherwise every match is shown, best first: membership no. starting with
//    the text, then name, then dates, then partial numbers, then the rest.
//  - Numbers shorter than 4 digits only look at membership no., so "15" does not
//    pull in every phone number that happens to contain "15".

const digits = (v) => String(v == null ? '' : v).replace(/\D/g, '');
const lower = (v) => String(v == null ? '' : v).toLowerCase().trim();
const compact = (v) => lower(v).replace(/[\s\-_/.+()]/g, '');
const pad2 = (s) => String(s).padStart(2, '0');

// any date value -> DD/MM/YYYY in local time ('' if empty)
export function dmy(v) {
    if (!v) return '';
    const s = String(v);
    const only = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); // plain date: no timezone shift
    if (only) return `${only[3]}/${only[2]}/${only[1]}`;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// "5-3-1990", "05.03", "5/3/90" -> "05/03/1990", "05/03", "05/03/90"; null if it is not date-like
function normDateQuery(q) {
    const m = q.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
    if (m) return [pad2(m[1]), pad2(m[2]), m[3]].filter(Boolean).join('/');
    const y = q.match(/^(\d{1,2})[\/\-.](\d{4})$/); // month/year
    if (y) return `${pad2(y[1])}/${y[2]}`;
    return null;
}

const fullName = (m) => [m.first_name, m.father_name, m.last_name].filter(Boolean).join(' ');

// trailing number of a membership no. ("MEM-015" -> 15), or null
const memNumber = (no) => {
    const t = String(no || '').match(/(\d+)\s*$/);
    return t ? Number(t[1]) : null;
};

// 1000 = exact match; 1..999 = partial match (higher is better); 0 = no match
export function scoreMember(m, rawQuery) {
    const q = lower(rawQuery);
    if (!q) return 1;
    const qc = compact(q);
    const qd = digits(q);
    const numeric = qd.length > 0 && qd === qc; // only digits (spaces/dashes ignored)

    const mem = compact(m.membership_no);
    const phone = digits(m.whatsapp_number);
    const aadhaar = digits(m.aadhaar_number);
    const pan = compact(m.pan_number);

    // ---- exact matches ----
    if (mem && mem === qc) return 1000;
    if (numeric && mem && memNumber(m.membership_no) === Number(qd)) return 1000;
    if (numeric && qd.length >= 10 && phone && (phone === qd || phone.slice(-10) === qd.slice(-10))) return 1000;
    if (numeric && qd.length === 12 && aadhaar === qd) return 1000;
    if (pan && qc.length === 10 && pan === qc) return 1000;

    let best = 0;
    const hit = (s) => { if (s > best) best = s; };

    // ---- membership no. ----
    if (mem) {
        if (mem.startsWith(qc)) hit(900);
        else if (mem.includes(qc)) hit(700);
    }

    // ---- name ----
    const name = lower(fullName(m));
    if (name && !numeric) {
        if (name === q) hit(850);
        else if (name.startsWith(q)) hit(800);
        else if (name.split(/\s+/).some((w) => w.startsWith(q))) hit(750);
        else if (name.includes(q)) hit(600);
        else {
            // every word of the query is somewhere in the name ("ramesh patel")
            const words = q.split(/\s+/).filter(Boolean);
            if (words.length > 1 && words.every((w) => name.includes(w))) hit(550);
        }
    }

    // ---- dates (birth date, submitted date) ----
    const dq = normDateQuery(q);
    const dates = [dmy(m.birth_date), dmy(m.submitted_at || m.created_at)].filter(Boolean);
    if (dq) {
        dates.forEach((d) => { if (d === dq) hit(820); else if (d.startsWith(dq) || d.includes(dq)) hit(650); });
    } else if (numeric && qd.length === 4) {
        // a year, e.g. 1990
        dates.forEach((d) => { if (d.endsWith('/' + qd)) hit(500); });
    }

    // ---- mobile / Aadhaar (only from 4 digits up, so short numbers stay on membership no.) ----
    if (numeric && qd.length >= 4) {
        if (phone && phone.endsWith(qd)) hit(450);
        else if (phone && phone.includes(qd)) hit(400);
        if (aadhaar && aadhaar.endsWith(qd)) hit(450);
        else if (aadhaar && aadhaar.includes(qd)) hit(400);
    }

    // ---- other text fields ----
    if (!numeric && q.length >= 2) {
        if (pan && pan.includes(qc)) hit(420);
        if (lower(m.email).includes(q)) hit(350);
        if (lower(m.area).includes(q)) hit(300);
        if (lower(m.native_place).includes(q)) hit(300);
    }

    return best;
}

// Filters and sorts a list. Keeps the original order when the search is empty.
export function searchMembers(list, query) {
    if (!lower(query)) return list;
    const scored = [];
    list.forEach((m, i) => {
        const s = scoreMember(m, query);
        if (s > 0) scored.push({ m, s, i });
    });
    const exact = scored.filter((x) => x.s >= 1000);
    const use = exact.length ? exact : scored;
    use.sort((a, b) => b.s - a.s || a.i - b.i);
    return use.map((x) => x.m);
}
