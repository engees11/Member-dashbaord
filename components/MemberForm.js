import { useEffect, useState } from 'react';
import { authFetch } from '../lib/session';
import { fmtDate } from '../lib/format';

const EMPTY = {
    membership_no: '', first_name: '', father_name: '', last_name: '', birth_date: '', native_place: '',
    whatsapp_number: '', email: '', address: '', area: '', aadhaar_number: '', pan_number: '',
};
const phoneForForm = (v) => (/^91\d{10}$/.test(String(v || '')) ? String(v).slice(2) : String(v || ''));

// One form for both: Add Member (member = null) and Edit member
export default function MemberForm({ open, member, onClose, onSaved }) {
    const editing = !!member;
    const [f, setF] = useState(EMPTY);
    const [err, setErr] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return undefined;
        setErr('');
        setSaving(false);
        setF(member ? {
            membership_no: member.membership_no || '',
            first_name: member.first_name || '',
            father_name: member.father_name || '',
            last_name: member.last_name || '',
            birth_date: member.birth_date ? fmtDate(member.birth_date) : '',
            native_place: member.native_place || '',
            whatsapp_number: phoneForForm(member.whatsapp_number),
            email: member.email || '',
            address: member.address || '',
            area: member.area || '',
            aadhaar_number: member.aadhaar_number || '',
            pan_number: member.pan_number || '',
        } : EMPTY);
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, member]);

    if (!open) return null;

    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setErr('');
        if (!f.first_name.trim()) return setErr('First name is required');
        if (f.whatsapp_number.replace(/\D/g, '').length < 10) return setErr('Enter the 10-digit mobile number');
        setSaving(true);
        try {
            const res = await authFetch(editing ? '/api/update-member' : '/api/create-member', {
                method: 'POST',
                body: editing ? { id: member.id, ...f } : f,
            });
            const data = await res.json();
            if (data.success) {
                onSaved && onSaved(data.member);
                onClose();
            } else {
                setErr(data.message || 'Could not save');
            }
        } catch (e2) {
            if (e2.message !== 'Session expired') setErr('Network error, please try again');
        }
        setSaving(false);
    };

    return (
        <div className="td-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="td-modal mf-modal" role="dialog" aria-modal="true" aria-labelledby="mf-title">
                <div className="td-modal-head">
                    <h2 id="mf-title">{editing ? 'Edit member' : 'Add member'}</h2>
                    <button type="button" className="td-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <form onSubmit={submit} className="td-form">
                    {err && <div className="msg msg-err">{err}</div>}
                    <div className="mf-grid">
                        <div className="mf-h">MEMBERSHIP</div>
                        <div className="td-field mf-full"><label htmlFor="mf-no">Membership No.</label><input id="mf-no" value={f.membership_no} onChange={set('membership_no')} placeholder="Leave empty if not given yet" /></div>

                        <div className="mf-h">PERSONAL</div>
                        <div className="td-field"><label htmlFor="mf-fn">First name</label><input id="mf-fn" value={f.first_name} onChange={set('first_name')} /></div>
                        <div className="td-field"><label htmlFor="mf-fa">Father name</label><input id="mf-fa" value={f.father_name} onChange={set('father_name')} /></div>
                        <div className="td-field"><label htmlFor="mf-ln">Surname</label><input id="mf-ln" value={f.last_name} onChange={set('last_name')} /></div>
                        <div className="td-field"><label htmlFor="mf-dob">Birth date (DD/MM/YYYY)</label><input id="mf-dob" value={f.birth_date} onChange={set('birth_date')} placeholder="17/09/1992" /></div>
                        <div className="td-field mf-full"><label htmlFor="mf-np">Native place</label><input id="mf-np" value={f.native_place} onChange={set('native_place')} /></div>

                        <div className="mf-h">CONTACT</div>
                        <div className="td-field">
                            <label htmlFor="mf-ph">Mobile number</label>
                            <div className="otp-phone"><span className="otp-cc">+91</span><input id="mf-ph" inputMode="numeric" value={f.whatsapp_number} onChange={(e) => setF({ ...f, whatsapp_number: e.target.value.replace(/[^\d]/g, '') })} placeholder="98765 43210" /></div>
                        </div>
                        <div className="td-field"><label htmlFor="mf-em">Email</label><input id="mf-em" value={f.email} onChange={set('email')} placeholder="name@example.com" /></div>
                        <div className="td-field mf-full"><label htmlFor="mf-ad">Address</label><input id="mf-ad" value={f.address} onChange={set('address')} /></div>
                        <div className="td-field mf-full"><label htmlFor="mf-ar">Area</label><input id="mf-ar" value={f.area} onChange={set('area')} /></div>

                        <div className="mf-h">DOCUMENTS</div>
                        <div className="td-field"><label htmlFor="mf-aa">Aadhaar number</label><input id="mf-aa" value={f.aadhaar_number} onChange={set('aadhaar_number')} /></div>
                        <div className="td-field"><label htmlFor="mf-pan">PAN number</label><input id="mf-pan" value={f.pan_number} onChange={(e) => setF({ ...f, pan_number: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button type="button" className="td-btn td-btn-gray" onClick={onClose}>Cancel</button>
                        <button type="submit" className="td-btn td-btn-primary" disabled={saving}>{saving ? 'Saving...' : (editing ? 'Save changes' : 'Add member')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
