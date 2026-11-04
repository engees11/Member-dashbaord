import { supabase } from './supabase';
import { retiredCutoffIso, retiredRef } from './retired';

// the stored annual meeting date (YYYY-MM-DD) with who changed it and the date before; date is null when none is set / the table is not created yet
export async function getMeetingDate() {
    const { data, error } = await supabase.from('app_settings').select('key, value, updated_by, updated_at').in('key', ['meeting_date', 'meeting_date_previous']);
    if (error) return { date: null, previousDate: null, updatedBy: null, updatedAt: null, missingTable: true };
    const ok = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
    const row = (data || []).find((r) => r.key === 'meeting_date');
    const prev = (data || []).find((r) => r.key === 'meeting_date_previous');
    return {
        date: row && ok(row.value) ? row.value : null,
        previousDate: prev && ok(prev.value) ? prev.value : null,
        updatedBy: row ? row.updated_by || null : null,
        updatedAt: row ? row.updated_at || null : null,
        missingTable: false,
    };
}

// members counted as Retired on a date: marked Retired with the button, or 45+ by that date (deleted members left out)
export async function countRetired(meetingIso) {
    const cutoff = retiredCutoffIso(retiredRef(meetingIso));
    let q = supabase.from('members').select('*', { count: 'exact', head: true }).or(`status.eq.retired,birth_date.lte.${cutoff}`).is('deleted_at', null);
    let { count, error } = await q;
    if (error) ({ count, error } = await supabase.from('members').select('*', { count: 'exact', head: true }).or(`status.eq.retired,birth_date.lte.${cutoff}`));
    return error ? 0 : count || 0;
}
