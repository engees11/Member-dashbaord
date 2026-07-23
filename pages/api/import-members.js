import { supabase } from '../../lib/supabase';
import { verifyAdmin } from '../../lib/auth';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
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
    'sr_no', 'membership_no', 'first_name', 'father_name', 'last_name', 'email', 'whatsapp_number',
    'birth_date', 'native_place', 'address', 'area', 'aadhaar_number',
    'aadhaar_front_url', 'aadhaar_back_url', 'status', 'form_type',
];

const BATCH_SIZE = 300;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const admin = verifyAdmin(req);
    if (!admin) return res.status(401).json({ success: false, message: 'Unauthorized' });

    try {
        const { csv } = req.body || {};
        if (!csv) return res.status(400).json({ success: false, message: 'No CSV data received' });

        const { rows } = parseCSV(csv);
        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: 'CSV appears to be empty' });
        }

        const records = [];
        let skipped = 0;
        const errors = [];
        const seenInFile = new Set();

        for (let i = 0; i < rows.length; i++) {
            const raw = rows[i];
            const phone = (raw.whatsapp_number || '').replace(/\D/g, '');
            if (!phone) {
                skipped++;
                errors.push(`Row ${i + 2}: missing whatsapp_number, skipped`);
                continue;
            }

            const record = { whatsapp_number: phone };
            for (const col of ALLOWED_COLUMNS) {
                if (col === 'whatsapp_number') continue;
                if (raw[col]) record[col] = raw[col];
            }
            if (!record.status) record.status = 'pending';

            if (seenInFile.has(phone)) {
                const idx = records.findIndex((r) => r.whatsapp_number === phone);
                if (idx !== -1) records[idx] = { ...records[idx], ...record };
                continue;
            }
            seenInFile.add(phone);
            records.push(record);
        }

        let upserted = 0;
        for (let i = 0; i < records.length; i += BATCH_SIZE) {
            const batch = records.slice(i, i + BATCH_SIZE);
            const phones = batch.map((r) => r.whatsapp_number);

            const { data: existingRows } = await supabase
                .from('members')
                .select('whatsapp_number, form_type')
                .in('whatsapp_number', phones);

            const existingMap = {};
            (existingRows || []).forEach((r) => { existingMap[r.whatsapp_number] = r.form_type; });

            const adjustedBatch = batch.map((r) => {
                const existingType = existingMap[r.whatsapp_number];
                if (existingType === 'details_update' && r.form_type === 'aadhaar_update') {
                    const { form_type, ...rest } = r;
                    return rest;
                }
                return r;
            });

            const { error } = await supabase
                .from('members')
                .upsert(adjustedBatch, { onConflict: 'whatsapp_number' });
            if (error) {
                errors.push(`Batch starting row ${i + 1}: ${error.message}`);
            } else {
                upserted += adjustedBatch.length;
            }
        }

        return res.json({
            success: true,
            total: rows.length,
            inserted: upserted,
            updated: 0,
            skipped,
            errors: errors.slice(0, 20),
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
}