import { supabase } from '../../lib/supabase';
import { logActivity, memberLabel } from '../../lib/activity';
import { normalizePan, isValidPan } from '../../lib/format';
import { missingColumn } from '../../lib/teamUtil';
import { cleanMemberInput, PAPER_KEYS } from '../../lib/memberFields';
import { normalizeIndianPhone } from '../../lib/phone';
import { dmyToIso } from '../../lib/format';
import { aadhaarProblem, aadhaarDigits, nameProblem, isFutureIso } from '../../lib/validators';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// new optional details: checked here, and the form is still saved if their database columns are not there yet
const EXTRA = [...PAPER_KEYS, 'photo_url'];
const OPTIONAL_COLUMNS = [...EXTRA, 'seen_at', 'pan_number']; // columns that come from a later SQL: if one is not there yet, the form is saved without it

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    try {
        const { member_id, whatsapp_number: typedNumber, ...rest } = req.body || {};
        if (!typedNumber) return res.json({ success: false, message: 'Please enter your WhatsApp mobile number.' });
        // data rules: the same ones the forms show while typing, checked again here
        const whatsapp_number = normalizeIndianPhone(typedNumber); // 10 digits (+91 / 0 in front is fine) -> 91XXXXXXXXXX
        if (!whatsapp_number) return res.json({ success: false, message: 'Please enter a valid 10-digit mobile number (it starts with 6, 7, 8 or 9).' });
        for (const [k, label] of [['first_name', 'First name'], ['father_name', 'Father name'], ['last_name', 'Last name']]) {
            const problem = k in rest ? nameProblem(rest[k], label) : '';
            if (problem) return res.json({ success: false, message: problem });
        }
        if (rest.email && !EMAIL_RE.test(String(rest.email).trim())) return res.json({ success: false, message: 'Please enter a valid email address.' });
        if (rest.birth_date) {
            const iso = dmyToIso(rest.birth_date);
            if (!iso) return res.json({ success: false, message: 'Birth date is not a real date.' });
            if (isFutureIso(iso)) return res.json({ success: false, message: 'Birth date cannot be in the future.' });
            rest.birth_date = iso;
        }
        if (rest.aadhaar_number) {
            const problem = aadhaarProblem(rest.aadhaar_number);
            if (problem) return res.json({ success: false, message: problem });
            rest.aadhaar_number = aadhaarDigits(rest.aadhaar_number);
        }

        if ('pan_number' in rest) {
            const pan = normalizePan(rest.pan_number);
            if (pan && !isValidPan(pan)) return res.json({ success: false, message: 'PAN number is not valid. Example: ABCDE1234F' });
            rest.pan_number = pan;
        }
        // blood group, qualification, hobbies, marriage date, business, photo: the same checks as in the dashboard
        const extra = {};
        for (const k of EXTRA) if (k in rest) extra[k] = rest[k];
        if (Object.keys(extra).length) {
            const c = cleanMemberInput(extra);
            if (c.error) return res.json({ success: false, message: c.error });
            for (const k of Object.keys(extra)) rest[k] = c.fields[k];
        }
        const nowIso = new Date().toISOString();
        const fields = { ...rest, whatsapp_number, status: 'new', updated_at: nowIso, submitted_at: nowIso };
        Object.keys(fields).forEach((k) => (fields[k] == null || fields[k] === '') && delete fields[k]);
        fields.seen_at = null; // a form that comes in is NEW until somebody opens it

        let existing = null;
        if (member_id) {
            const { data } = await supabase.from('members').select('id').eq('id', member_id).maybeSingle();
            existing = data;
        }
        if (!existing) {
            const { data } = await supabase.from('members').select('id').eq('whatsapp_number', whatsapp_number).maybeSingle();
            existing = data;
        }

        let error;
        let savedId = existing ? existing.id : null;
        const save = async () => {
            if (existing) {
                ({ error } = await supabase.from('members').update(fields).eq('id', existing.id));
            } else {
                const ins = await supabase.from('members').insert(fields).select('id').maybeSingle();
                error = ins.error;
                savedId = ins.data ? ins.data.id : null;
            }
        };
        await save();
        if (error && 'seen_at' in fields && missingColumn(error) && /seen_at/.test(String(error.message || ''))) {
            // supabase/new-members-seen.sql was not run yet: save the form without the NEW mark
            delete fields.seen_at;
            await save();
        }
        if (error && fields.pan_number && missingColumn(error)) {
            // supabase/pan-number.sql was not run yet: save everything else so the member's form is not lost
            console.error('[submit-form] the pan_number column is missing, saved without PAN. Run supabase/pan-number.sql');
            delete fields.pan_number;
            await save();
        }
        // a new optional column that is not in the database yet (its SQL was not run): save the form without that detail, nobody loses their form
        for (let i = 0; i < OPTIONAL_COLUMNS.length && error && missingColumn(error); i++) {
            const col = (/'([a-z_]+)' column/.exec(String(error.message || '')) || [])[1];
            if (!col || !OPTIONAL_COLUMNS.includes(col) || !(col in fields)) break;
            console.error(`[submit-form] the ${col} column is missing, saved without it. Run the SQL for it in supabase/`);
            delete fields[col];
            await save();
        }
        if (error) return res.json({ success: false, message: error.message });

        await logActivity({ role: 'public', name: 'Member (form)' }, 'form_submit', {
            memberId: savedId,
            memberLabel: memberLabel(fields),
            newStatus: 'new',
        });

        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
}