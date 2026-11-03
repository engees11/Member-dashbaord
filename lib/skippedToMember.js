import { fmtDate } from './format';

// A skipped row -> what the Add Member form should start with, and a one-line note for the admin
export function skippedToInitial(r) {
    const digits = String(r.whatsapp_number || '').replace(/\D/g, '');
    const ten = /^91\d{10}$/.test(digits) ? digits.slice(2) : digits;
    // the mobile of these rows already belongs to another member, so the person needs their own number
    const needsOwnMobile = r.reason === 'Shared mobile' || r.reason === 'Repeated mobile';
    const initial = {
        membership_no: r.membership_no || '',
        first_name: r.first_name || '',
        father_name: r.father_name || '',
        last_name: r.last_name || '',
        birth_date: r.birth_date ? fmtDate(r.birth_date) : '',
        whatsapp_number: needsOwnMobile ? '' : ten,
        aadhaar_number: r.aadhaar_number || '',
        form_type: '',
        status: 'pending',
    };
    const note = needsOwnMobile
        ? `Skipped: ${r.reason}${r.detail ? ` (${r.detail})` : ''}. The file had mobile ${ten}, which another member already has. Type this person's own mobile number, then save.`
        : `Skipped: ${r.reason}${r.detail ? ` (${r.detail})` : ''}. Check the details and save to add this person.`;
    return { initial, note };
}
