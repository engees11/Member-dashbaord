import { supabase } from '../../lib/supabase';
import { requireUser, isAdmin } from '../../lib/auth';
import { getMeetingDate, countRetired } from '../../lib/settings';
import { refFromIso, istToday } from '../../lib/retired';

// 17/03/2027, 17-03-2027 or 2027-03-17 -> 2027-03-17 (a meeting is in the future, so the birth-date checker is not used here)
function toIso(raw) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(raw);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}
const dmy = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// GET  -> the annual meeting date, who changed it and the date before (anyone logged in)
// POST { meetingDate, confirm, acceptWarnings }  (admin only)
//   - a date that is not real, or whose YEAR is not between last year and two years from now, is refused
//   - without confirm nothing is saved: the reply says how many Retired members the new date gives, plus any warnings
//   - with confirm: true the date is saved; if there are warnings, acceptWarnings: true is needed as well
export default async function handler(req, res) {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    if (req.method === 'GET') {
        const cur = await getMeetingDate();
        return res.json({ success: true, meetingDate: cur.date, previousDate: cur.previousDate, updatedBy: cur.updatedBy, updatedAt: cur.updatedAt, needsSetup: cur.missingTable });
    }

    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    if (!isAdmin(user)) return res.status(403).json({ success: false, message: 'Only the admin can change the meeting date' });

    const body = req.body || {};
    const iso = toIso(String(body.meetingDate || '').trim());
    const day = refFromIso(iso);
    if (!day) return res.status(400).json({ success: false, message: 'Enter a real date, like 17/03/2027' });

    const today = istToday();
    const thisYear = today.getUTCFullYear();
    if (day.getUTCFullYear() < thisYear - 1 || day.getUTCFullYear() > thisYear + 2) {
        return res.status(400).json({ success: false, message: `The year ${day.getUTCFullYear()} looks wrong. The meeting year must be between ${thisYear - 1} and ${thisYear + 2}.` });
    }

    const cur = await getMeetingDate();
    if (cur.missingTable) return res.status(500).json({ success: false, message: 'Run supabase/app-settings.sql once in Supabase, then try again.' });
    if (cur.date === iso) return res.json({ success: true, unchanged: true, message: `${dmy(iso)} is already the meeting date. Nothing to change.` });

    // things that are possible but suspicious: shown to the admin, who must accept them
    const warnings = [];
    const todayIso = today.toISOString().slice(0, 10);
    if (iso < todayIso) warnings.push('This date is already over.');
    if (cur.date && iso < cur.date) warnings.push(`This date is earlier than the current meeting date (${dmy(cur.date)}).`);
    const farIso = new Date(Date.UTC(thisYear + 1, today.getUTCMonth(), today.getUTCDate())).toISOString().slice(0, 10);
    if (iso > farIso) warnings.push('This date is more than 12 months away.');

    const [currentCount, newCount] = await Promise.all([countRetired(cur.date), countRetired(iso)]);
    const info = { current: { date: cur.date, retired: currentCount }, proposed: { date: iso, retired: newCount }, warnings };

    if (body.confirm !== true || (warnings.length > 0 && body.acceptWarnings !== true)) {
        return res.json({ success: true, needsConfirm: true, ...info });
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from('app_settings').upsert({ key: 'meeting_date', value: iso, updated_by: user.name || null, updated_at: now }, { onConflict: 'key' });
    if (error) return res.status(500).json({ success: false, message: error.message });
    if (cur.date) await supabase.from('app_settings').upsert({ key: 'meeting_date_previous', value: cur.date, updated_by: user.name || null, updated_at: now }, { onConflict: 'key' });
    return res.json({ success: true, saved: true, ...info });
}
