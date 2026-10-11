import { supabase } from '../../lib/supabase';
import { requireUser, isAdmin } from '../../lib/auth';
import { fmtDate } from '../../lib/format';
import { buildXlsx } from '../../lib/xlsx';

const HEADER = [
    'Membership No', 'Sr No', 'First Name', 'Father Name', 'Surname', 'WhatsApp Number', 'Email', 'Birth Date',
    'Native Place', 'Address', 'Area', 'Aadhaar Number', 'PAN Number', 'Status', 'Form', 'Added On', 'Deleted',
];
const WIDTHS = [14, 8, 16, 16, 16, 18, 26, 12, 16, 40, 16, 18, 14, 12, 16, 12, 9];
const STATUS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', expired: 'Expired', new: 'New', need_review: 'Need Review' };
const FORM = { aadhaar_update: 'Aadhaar form', details_update: 'Full Details form' };

const rowOf = (m) => [
    m.membership_no, m.sr_no, m.first_name, m.father_name, m.last_name, m.whatsapp_number, m.email,
    m.birth_date ? fmtDate(m.birth_date) : '', m.native_place, m.address, m.area, m.aadhaar_number, m.pan_number,
    STATUS[m.status] || m.status || '', FORM[m.form_type] || (m.form_type ? m.form_type : 'Not submitted'),
    m.created_at ? fmtDate(m.created_at) : '', m.deleted_at ? 'Yes' : '',
].map((v) => (v == null ? '' : String(v)));

const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;

// GET /api/export-members?format=xlsx|csv&deleted=1   (admin): every member in one file
export default async function handler(req, res) {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!isAdmin(user)) return res.status(403).json({ success: false, message: 'Only the admin can export' });

    try {
        const all = [];
        for (let from = 0; ; from += 1000) {
            const { data, error } = await supabase
                .from('members').select('*')
                .order('created_at', { ascending: true }).order('id', { ascending: true })
                .range(from, from + 999);
            if (error) throw new Error(error.message || 'Could not read the members');
            all.push(...(data || []));
            if (!data || data.length < 1000) break;
        }

        const withDeleted = req.query.deleted === '1';
        const members = all.filter((m) => withDeleted || !m.deleted_at);
        const rows = members.map(rowOf);
        const today = new Date().toISOString().slice(0, 10);

        res.setHeader('Cache-Control', 'no-store');
        if (req.query.format === 'csv') {
            const text = '\uFEFF' + [HEADER, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="members-${today}.csv"`);
            return res.status(200).send(text);
        }
        const file = buildXlsx({ sheetName: 'Members', header: HEADER, rows, widths: WIDTHS });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="members-${today}.xlsx"`);
        return res.status(200).send(file);
    } catch (e) {
        console.error('[export] failed:', e.message);
        return res.status(500).json({ success: false, message: 'Export failed: ' + e.message });
    }
}
