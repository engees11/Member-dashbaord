import { supabase } from '../../lib/supabase';
import { requireUser, isAdmin } from '../../lib/auth';
import { logActivity } from '../../lib/activity';
import { normalizeIndianPhone } from '../../lib/phone';
import { dmyToIso, normalizePan, isValidPan } from '../../lib/format';
import { FIELD_LABELS } from '../../lib/memberFields';

export const config = { maxDuration: 60, api: { bodyParser: { sizeLimit: '8mb' } } };

// Column names as they usually appear in the Excel sheets -> the names the dashboard uses
const ALIASES = {
    srno: 'sr_no', serialno: 'sr_no', membershipno: 'membership_no', membershipnumber: 'membership_no', memno: 'membership_no',
    firstname: 'first_name', fathername: 'father_name', husbandname: 'father_name', surname: 'last_name', lastname: 'last_name',
    email: 'email', emailid: 'email',
    mobileno: 'whatsapp_number', mobile: 'whatsapp_number', mobilenumber: 'whatsapp_number', whatsappno: 'whatsapp_number',
    whatsappnumber: 'whatsapp_number', phone: 'whatsapp_number', phoneno: 'whatsapp_number', contactno: 'whatsapp_number',
    birthdate: 'birth_date', dob: 'birth_date', dateofbirth: 'birth_date',
    nativeplace: 'native_place', native: 'native_place', address: 'address', area: 'area',
    aadharno: 'aadhaar_number', aadhaarno: 'aadhaar_number', aadharnumber: 'aadhaar_number', aadhaarnumber: 'aadhaar_number',
    aadhar: 'aadhaar_number', aadhaar: 'aadhaar_number', panno: 'pan_number', pannumber: 'pan_number', pan: 'pan_number',
    status: 'status', formtype: 'form_type',
};
const KNOWN = ['sr_no', 'membership_no', 'first_name', 'father_name', 'last_name', 'email', 'whatsapp_number', 'birth_date', 'native_place', 'address', 'area', 'aadhaar_number', 'aadhaar_front_url', 'aadhaar_back_url', 'status', 'form_type', 'pan_number'];
const canonHeader = (h) => {
    const raw = String(h || '').trim().replace(/^"|"$/g, '').trim();
    if (KNOWN.includes(raw)) return raw;
    return ALIASES[raw.toLowerCase().replace(/[^a-z0-9]/g, '')] || raw;
};

// "9876543210", "+91 98765 43210" or two numbers in one cell ("8905631008/9879251010"): the first good number is used
function pickPhone(raw) {
    const whole = normalizeIndianPhone(raw);
    if (whole) return whole;
    for (const part of String(raw || '').split(/[\/,;|]|\s{2,}|\band\b/i)) {
        const p = normalizeIndianPhone(part);
        if (p) return p;
    }
    return null;
}

function parseCSV(text) {
    const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return { headers: [], rows: [] };
    const headers = lines[0].split(',').map(canonHeader);
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
const firstToken = (r) => letters(String(r.first_name || '').trim().split(/\s+/)[0]);
const who = (m) => [m.first_name, m.father_name, m.last_name].filter(Boolean).join(' ') || m.whatsapp_number;
// a real 12-digit Aadhaar number (a masked one like XXXX-XXXX-0246, or a fake like 111111111111, does not count)
const aad = (m) => {
    const raw = String(m.aadhaar_number || '');
    const d = raw.replace(/\D/g, '');
    return d.length === 12 && !/X/i.test(raw) && !/^(\d)\1{11}$/.test(d) ? d : '';
};
const clean = (v) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
const short = (v) => { const s = clean(v); return s.length > 40 ? s.slice(0, 37) + '...' : s; };

// same value, ignoring capital letters, extra spaces and (for Aadhaar) dashes
const same = (col, a, b) => {
    if (col === 'aadhaar_number') return String(a || '').replace(/\D/g, '') === String(b || '').replace(/\D/g, '') && !/X/i.test(String(a || ''));
    return clean(a).toUpperCase() === clean(b).toUpperCase();
};

// Is this CSV row the same person as the member who already holds this mobile?
// A mobile number cannot belong to two people. When it does show up for two people, the row is a DIFFERENT person only if
// the NAME is different AND the Aadhaar number is not the same (different, or not known). Then the new row is skipped.
function samePerson(existing, rec) {
    if (!existing.first_name || !rec.first_name) return true; // nothing to compare
    const x = aad(existing); const y = aad(rec);
    if (x && y && x === y) return true;                       // same Aadhaar: same person
    if (firstToken(existing) && firstToken(existing) === firstToken(rec)) return true; // same name: same person
    if (existing.membership_no && rec.membership_no && String(existing.membership_no).trim() === rec.membership_no) return true;
    if (existing.birth_date && rec.birth_date && String(existing.birth_date).slice(0, 10) === rec.birth_date) return true;
    return false;
}

// POST /api/import-members { csv, dryRun, mode }  (admin). An import never deletes anybody.
//  - a mobile that is NOT in the dashboard -> a new member is added (names may repeat)
//  - a mobile that IS in the dashboard     -> the same member: missing data is filled in (nothing is replaced in the default mode),
//                                             status / section are never touched. Nothing new -> nothing is written.
//  - the same AADHAAR number as a member on another mobile = the same person: that member is updated, no second entry is made
//  - a row is kept out as a DUPLICATE (saved in the Duplicates list with a 1-2 word reason) only when it is:
//      "Shared mobile"   the mobile is already used by a different person (name and Aadhaar differ)
//      "Repeated mobile" the same mobile again in the same file
//      "Same Aadhaar"    the same Aadhaar number twice inside this file (a member already in the dashboard with that Aadhaar is updated instead)
//      "Bad mobile"      missing or not a 10-digit number
//  - mode "fill" (default) keeps values the dashboard already has; mode "update" (not offered on screen) replaces them.
//  - dryRun: true gives the same counts without writing anything (the dashboard asks the admin to confirm with them)
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isAdmin(user)) return res.status(403).json({ success: false, message: 'Sirf admin CSV import kar sakta hai' });

    try {
        const { csv, dryRun } = req.body || {};
        const mode = (req.body || {}).mode === 'update' ? 'update' : 'fill';
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
        const byPhone = new Map(); const byMem = new Map(); const byAadhaar = new Map();
        const index = (m, label) => {
            const e = { ...m, label };
            if (m.whatsapp_number) byPhone.set(m.whatsapp_number, e);
            if (m.membership_no) byMem.set(String(m.membership_no).trim(), e);
            if (aad(m)) byAadhaar.set(aad(m), e);
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
        const skippedRows = [];
        const skip = (row, raw, reason, detail) => {
            skippedList.push(`Row ${row}: ${reason}${detail ? ` (${detail})` : ''}`);
            skippedRows.push({
                file_row: row, reason, detail: detail || '',
                sr_no: raw.sr_no || '', membership_no: raw.membership_no || '', first_name: raw.first_name || '',
                father_name: raw.father_name || '', last_name: raw.last_name || '', whatsapp_number: raw.whatsapp_number || '',
                birth_date: raw.birth_date || '', aadhaar_number: raw.aadhaar_number || '',
            });
        };

        for (let i = 0; i < rows.length; i++) {
            const raw = rows[i];
            const rowNo = i + 2;

            const phone = pickPhone(raw.whatsapp_number);
            if (!phone) { skip(rowNo, raw, 'Bad mobile', raw.whatsapp_number ? `"${raw.whatsapp_number}" is not a 10-digit number` : 'mobile is missing'); continue; }
            if (seenPhone.has(phone)) { skip(rowNo, raw, 'Repeated mobile', `first used in row ${seenPhone.get(phone)}`); continue; }
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

            // the Aadhaar number already belongs to a member on ANOTHER mobile: the same person, so that member is updated
            // (missing data filled, the dashboard mobile is kept) instead of adding a second entry
            const rowAad = aad(record);
            let current = byPhone.get(phone);
            let viaAadhaar = false;
            if (!current && rowAad && byAadhaar.has(rowAad)) {
                const hit = byAadhaar.get(rowAad);
                if (!hit.id) { skip(rowNo, raw, 'Same Aadhaar', `same as ${hit.label}`); continue; } // the same person twice inside this file
                current = hit;
                viaAadhaar = true;
                warnings.push(`Row ${rowNo}: the Aadhaar number matches ${who(hit)} (mobile ${hit.whatsapp_number}), the file has mobile ${phone}. Treated as the same person: missing data filled, the dashboard mobile is kept`);
            }

            // ---------- the mobile is already in the dashboard: UPDATE what changed
            if (current) {
                if (!viaAadhaar && !samePerson(current, record)) {
                    skip(rowNo, raw, 'Shared mobile', `mobile is ${who(current)}'s`);
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
                byPhone.set(current.whatsapp_number, merged);
                if (aad(merged)) byAadhaar.set(aad(merged), merged);
                continue;
            }

            // ---------- a new mobile: ADD. The mobile number is what identifies a member, names may repeat
            // the person is new, only the membership number is taken: add the person WITHOUT that number
            if (record.membership_no && byMem.has(record.membership_no)) {
                warnings.push(`Row ${rowNo}: membership no. ${record.membership_no} is already used by ${byMem.get(record.membership_no).label}, so ${who(record)} was added without a membership number`);
                delete record.membership_no;
            }

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
            skippedRows: skippedRows.slice(0, 2000),
            skippedSaved: null,
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
        // every duplicate / problem row is kept in its own list (Duplicates, in the left menu), with its reason
        if (skippedRows.length) {
            const batch = new Date().toISOString().slice(0, 16).replace('T', ' ');
            let known = new Set();
            const { data: oldRows } = await supabase.from('import_skipped').select('whatsapp_number, reason, first_name, last_name').limit(20000);
            (oldRows || []).forEach((r) => known.add(`${r.whatsapp_number}|${r.reason}|${r.first_name}|${r.last_name}`));
            const fresh = skippedRows.filter((r) => !known.has(`${r.whatsapp_number}|${r.reason}|${r.first_name}|${r.last_name}`)).slice(0, 5000)
                .map((r) => ({ ...r, batch, uploaded_by: user.name || null }));
            let saved = true;
            for (let i = 0; i < fresh.length; i += 300) {
                const { error } = await supabase.from('import_skipped').insert(fresh.slice(i, i + 300));
                if (error) {
                    saved = false;
                    answer.errors.push(`The duplicate rows could not be saved in the Duplicates list (${error.message}). Run supabase/import-skipped.sql once.`);
                    break;
                }
            }
            answer.skippedSaved = saved;
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
