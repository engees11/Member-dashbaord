import { supabase } from '../../lib/supabase';
import { requireUser, isAdmin } from '../../lib/auth';
import { logActivity } from '../../lib/activity';
import { normalizeIndianPhone } from '../../lib/phone';
import { dmyToIso, normalizePan, isValidPan } from '../../lib/format';
import { FIELD_LABELS } from '../../lib/memberFields';

export const config = { maxDuration: 60, api: { bodyParser: { sizeLimit: '8mb' } } };

function parseCSV(text) {
    const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map((line) => {
        const values = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') inQuotes = !inQuotes;
            else if (ch === ',' && !inQuotes) { values.push(cur); cur = ''; }
            else cur += ch;
        }
        values.push(cur);
        const row = {};
        headers.forEach((h, i) => { row[h] = (values[i] || '').trim(); });
        return row;
    });
    return { headers, rows };
}

const ALLOWED_COLUMNS = [
    'sr_no', 'membership_no', 'first_name', 'father_name', 'last_name', 'email',
    'birth_date', 'native_place', 'address', 'area', 'aadhaar_number',
    'aadhaar_front_url', 'aadhaar_back_url', 'status', 'form_type', 'pan_number',
];
// For a member who is already there, these are never changed by an import
const NEVER_UPDATE = ['sr_no', 'status', 'form_type'];
const SECTIONS = ['aadhaar_update', 'details_update'];
const STATUSES = ['new', 'pending', 'approved', 'need_review', 'rejected', 'expired'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BATCH_SIZE = 300;
const PARALLEL = 25;

const letters = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
const fullKey = (r) => `${letters(r.first_name)}|${letters(r.father_name)}|${letters(r.last_name)}`;
const firstLastKey = (r) => `${letters(String(r.first_name || '').trim().split(/\s+/)[0])}|${letters(r.last_name)}`;
const firstToken = (r) => letters(String(r.first_name || '').trim().split(/\s+/)[0]);
const who = (m) => [m.first_name, m.father_name, m.last_name].filter(Boolean).join(' ') || m.whatsapp_number;
const clean = (v) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
const short = (v) => { const s = clean(v); return s.length > 40 ? s.slice(0, 37) + '...' : s; };

// same value, ignoring capital letters, extra spaces and (for Aadhaar) dashes
const same = (col, a, b) => {
    if (col === 'aadhaar_number') return String(a || '').replace(/\D/g, '') === String(b || '').replace(/\D/g, '') && !/X/i.test(String(a || ''));
    return clean(a).toUpperCase() === clean(b).toUpperCase();
};

// Is this CSV row the same person as the member who already holds this mobile?
// (a mobile can be shared by relatives, and we must not overwrite one with the other)
function samePerson(existing, rec) {
    if (!existing.first_name || !rec.first_name) return true;
    if (firstToken(existing) && firstToken(existing) === firstToken(rec)) return true;
    if (existing.membership_no && rec.membership_no && String(existing.membership_no).trim() === rec.membership_no) return true;
    if (existing.birth_date && rec.birth_date && String(existing.birth_date).slice(0, 10) === rec.birth_date) return true;
    return false;
}

// POST /api/import-members { csv, dryRun, mode }  (admin). An import never deletes anybody.
//  mode "update" (default): a member who is already there is UPDATED: a value that differs in the file replaces the one in the dashboard.
//  mode "fill":             a member who is already there only gets his EMPTY fields filled; values the dashboard already has are kept
//                           (listed, so they can be checked).
//  - a mobile that is NOT in the dashboard  -> a new member is added (unless it would be a duplicate by name / membership no.)
//  - a mobile that IS in the dashboard      -> that member is updated, but only with what really changed, blank cells never erase anything,
//                                              and status / section are never touched. Nothing changed -> nothing is written.
//  - dryRun: true gives the same counts without writing anything (the dashboard asks the admin to confirm with them)
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isAdmin(user)) return res.status(403).json({ success: false, message: 'Sirf admin CSV import kar sakta hai' });

    try {
        const { csv, dryRun } = req.body || {};
        const mode = (req.body || {}).mode === 'fill' ? 'fill' : 'update';
        if (!csv) return res.status(400).json({ success: false, message: 'No CSV data received' });

        const { rows } = parseCSV(csv);
        if (rows.length === 0) return res.status(400).json({ success: false, message: 'CSV appears to be empty' });

        // everybody in the dashboard now (deleted ones too: they still hold their mobile and number)
        const existing = [];
        for (let from = 0; ; from += 1000) {
            const { data, error } = await supabase
                .from('members').select('*').order('id', { ascending: true }).range(from, from + 999);
            if (error) return res.status(500).json({ success: false, message: 'Could not read the existing members: ' + error.message });
            existing.push(...(data || []));
            if (!data || data.length < 1000) break;
        }
        const byPhone = new Map(); const byMem = new Map(); const byFull = new Map(); const byFirstLast = new Map();
        const index = (m, label) => {
            const e = { ...m, label };
            if (m.whatsapp_number) byPhone.set(m.whatsapp_number, e);
            if (m.membership_no) byMem.set(String(m.membership_no).trim(), e);
            if (!byFull.has(fullKey(m))) byFull.set(fullKey(m), e);
            if (!byFirstLast.has(firstLastKey(m))) byFirstLast.set(firstLastKey(m), e);
            return e;
        };
        existing.forEach((m) => index(m, `${who(m)} (already in the dashboard)`));

        const toAdd = [];
        const toUpdate = [];
        const skippedList = [];
        const warnings = [];
        const updatedList = [];
        const byField = {};
        const keptList = [];
        const keptByField = {};
        let unchanged = 0;
        const seenPhone = new Map();
        const skip = (row, reason) => skippedList.push(`Row ${row}: ${reason}`);

        for (let i = 0; i < rows.length; i++) {
            const raw = rows[i];
            const rowNo = i + 2;

            const phone = normalizeIndianPhone(raw.whatsapp_number);
            if (!phone) { skip(rowNo, `mobile number "${raw.whatsapp_number || ''}" is missing or is not a 10-digit Indian number`); continue; }
            if (seenPhone.has(phone)) { skip(rowNo, `mobile ${phone} is used again in this file (first in row ${seenPhone.get(phone)}), only the first row is used`); continue; }
            seenPhone.set(phone, rowNo);

            const record = {};
            for (const col of ALLOWED_COLUMNS) {
                if (raw[col]) record[col] = String(raw[col]).trim();
            }
            // tidy values; a bad value is left out (and reported) instead of failing the file
            if (record.birth_date) {
                const iso = dmyToIso(record.birth_date);
                if (iso) record.birth_date = iso;
                else { warnings.push(`Row ${rowNo}: birth date "${record.birth_date}" not understood, left out`); delete record.birth_date; }
            }
            if (record.pan_number) {
                const pan = normalizePan(record.pan_number);
                if (isValidPan(pan)) record.pan_number = pan;
                else { warnings.push(`Row ${rowNo}: PAN "${record.pan_number}" is not valid, left out`); delete record.pan_number; }
            }
            if (record.email) {
                record.email = record.email.toLowerCase();
                if (!EMAIL_RE.test(record.email)) { warnings.push(`Row ${rowNo}: email is not valid, left out`); delete record.email; }
            }
            if (record.form_type && !SECTIONS.includes(record.form_type)) delete record.form_type;
            if (record.status && !STATUSES.includes(record.status)) delete record.status;

            const current = byPhone.get(phone);

            // ---------- the mobile is already in the dashboard: UPDATE what changed
            if (current) {
                if (!samePerson(current, record)) {
                    skip(rowNo, `mobile ${phone} belongs to ${current.label}, but this row is a different person (name, membership no. and birth date all differ). Shared mobile? Not changed`);
                    continue;
                }
                const changes = {};
                const notes = [];
                const keptNotes = [];
                for (const col of ALLOWED_COLUMNS) {
                    if (NEVER_UPDATE.includes(col) || record[col] === undefined) continue;
                    if (same(col, current[col], record[col])) continue;
                    // safe mode: what the dashboard already has stays (a masked Aadhaar like XXXX-XXXX-0246 counts as empty)
                    if (mode === 'fill' && clean(current[col]) !== '' && !(col === 'aadhaar_number' && /X/i.test(String(current[col])))) {
                        const label = FIELD_LABELS[col] || col;
                        keptByField[label] = (keptByField[label] || 0) + 1;
                        keptNotes.push(`${label}: dashboard has "${short(current[col])}", file has "${short(record[col])}"`);
                        continue;
                    }
                    if (col === 'membership_no') {
                        const holder = byMem.get(record.membership_no);
                        if (holder && holder.id !== current.id) {
                            warnings.push(`Row ${rowNo}: membership no. ${record.membership_no} is already used by ${holder.label}, so ${who(current)} keeps ${current.membership_no || 'no number'}`);
                            continue;
                        }
                    }
                    changes[col] = record[col];
                    notes.push(`${FIELD_LABELS[col] || col}: "${short(current[col])}" -> "${short(record[col])}"`);
                    byField[FIELD_LABELS[col] || col] = (byField[FIELD_LABELS[col] || col] || 0) + 1;
                }
                if (keptNotes.length) keptList.push(`Row ${rowNo}: ${who(current)}: ${keptNotes.join('; ')}`);
                if (Object.keys(changes).length === 0) { unchanged++; continue; }
                toUpdate.push({ id: current.id, changes });
                updatedList.push(`Row ${rowNo}: ${who(current)}: ${notes.join('; ')}`);
                // keep the lookups in step with what will be saved
                const merged = { ...current, ...changes };
                if (changes.membership_no) { if (current.membership_no) byMem.delete(String(current.membership_no).trim()); byMem.set(changes.membership_no, merged); }
                byPhone.set(phone, merged);
                continue;
            }

            // ---------- a new mobile: ADD, unless it would be a duplicate
            if (record.membership_no && byMem.has(record.membership_no)) { skip(rowNo, `membership no. ${record.membership_no} is already used by ${byMem.get(record.membership_no).label}`); continue; }
            const sameName = byFull.get(fullKey(record));
            if (record.first_name && sameName) { skip(rowNo, `same full name as ${sameName.label}. Could be a duplicate, not added`); continue; }
            const near = byFirstLast.get(firstLastKey(record));
            if (record.first_name && near) { skip(rowNo, `same first name and surname as ${near.label}. Could be the same person, not added`); continue; }

            record.whatsapp_number = phone;
            if (!record.status) record.status = 'pending';
            toAdd.push(record);
            index(record, `${who(record)} (row ${rowNo} of this file)`);
        }

        const summary = Object.entries(byField).sort((a, b) => b[1] - a[1]).map(([field, count]) => ({ field, count }));
        const answer = {
            success: true,
            dryRun: !!dryRun,
            total: rows.length,
            added: toAdd.length,
            updated: toUpdate.length,
            unchanged,
            skipped: skippedList.length,
            mode,
            kept: Object.values(keptByField).reduce((a, b) => a + b, 0),
            keptSummary: Object.entries(keptByField).sort((a, b) => b[1] - a[1]).map(([field, count]) => ({ field, count })),
            keptList: keptList.slice(0, 300),
            changeSummary: summary,
            updatedList: updatedList.slice(0, 300),
            skippedList: skippedList.slice(0, 1000),
            warnings: warnings.slice(0, 200),
            errors: [],
        };
        if (dryRun) return res.json(answer);

        // updates first (one may free a membership number), then the new members
        let updated = 0;
        const stamp = new Date().toISOString();
        for (let i = 0; i < toUpdate.length; i += PARALLEL) {
            const chunk = toUpdate.slice(i, i + PARALLEL);
            const results = await Promise.all(chunk.map((u) => supabase.from('members').update({ ...u.changes, updated_at: stamp }).eq('id', u.id)));
            results.forEach((r, k) => {
                if (r && r.error) answer.errors.push(`Updating ${chunk[k].id}: ${r.error.message}`);
                else updated++;
            });
        }

        let added = 0;
        for (let i = 0; i < toAdd.length; i += BATCH_SIZE) {
            const batch = toAdd.slice(i, i + BATCH_SIZE);
            // ignoreDuplicates: if anyone slipped in meanwhile with the same mobile, the database keeps theirs
            const { error } = await supabase.from('members').upsert(batch, { onConflict: 'whatsapp_number', ignoreDuplicates: true });
            if (error) answer.errors.push(`Adding rows ${i + 1} to ${i + batch.length}: ${error.message}`);
            else added += batch.length;
        }
        answer.added = added;
        answer.updated = updated;
        answer.errors = answer.errors.slice(0, 20);
        answer.inserted = added; // older name, kept so nothing else breaks
        await logActivity(user, 'import', { meta: { mode, total: rows.length, added, updated, unchanged, skipped: skippedList.length } });
        return res.json(answer);
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
}
