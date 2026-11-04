// "Retired" = 45 years or more. It is worked out from the birth date on the day you look (India time), never stored,
// so when a wrong birth date is corrected in Edit details the member comes back (or goes) by itself.
export const RETIRE_AGE = 45;

// today's date in India as a Date whose UTC parts are the Indian date
export const istToday = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000);

// completed years on the day `ref`; null when there is no usable birth date
export function ageOn(birth, ref = istToday()) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birth || ''));
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const rm = ref.getUTCMonth() + 1, rd = ref.getUTCDate();
    let age = ref.getUTCFullYear() - y;
    if (rm < mo || (rm === mo && rd < d)) age--;
    return age;
}

export function isRetired(member, ref = istToday()) {
    const a = ageOn(member && member.birth_date, ref);
    return a !== null && a >= RETIRE_AGE;
}

// the day the age is counted on: the annual meeting date (YYYY-MM-DD) when one is set, otherwise today
export function refFromIso(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? d : null; // refuses 31 Feb etc.
}
export const retiredRef = (meetingIso) => refFromIso(meetingIso) || istToday();

// retired by age OR marked Retired with the button
export const isRetiredMember = (member, ref = istToday()) => !!member && (member.status === 'retired' || isRetired(member, ref));

// born on or before this date = 45 or more on `ref` (used to count in the database)
export function retiredCutoffIso(ref = istToday()) {
    return new Date(Date.UTC(ref.getUTCFullYear() - RETIRE_AGE, ref.getUTCMonth(), ref.getUTCDate())).toISOString().slice(0, 10);
}
