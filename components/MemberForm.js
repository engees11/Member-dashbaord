import { useEffect, useState } from 'react';
import { authFetch } from '../lib/session';
import { fmtDate } from '../lib/format';
import { uploadDoc, validateFile } from '../lib/supabaseClient';

const EMPTY = {
    membership_no: '', first_name: '', father_name: '', last_name: '', birth_date: '', native_place: '',
    whatsapp_number: '', email: '', address: '', area: '', aadhaar_number: '', pan_number: '',
    form_type: 'details_update', status: 'new',
};
const phoneForForm = (v) => (/^91\d{10}$/.test(String(v || '')) ? String(v).slice(2) : String(v || ''));
const Star = () => <span className="mf-star" aria-hidden="true">*</span>;

// One form for both: Add Member (member = null) and Edit member
export default function MemberForm({ open, member, onClose, onSaved, initial, note }) {
    const editing = !!member;
    const [f, setF] = useState(EMPTY);
    const [err, setErr] = useState('');
    const [saving, setSaving] = useState(false);
    const [front, setFront] = useState(null); // Aadhaar photos chosen in this form
    const [back, setBack] = useState(null);

    useEffect(() => {
        if (!open) return undefined;
        setErr('');
        setSaving(false);
        setFront(null);
        setBack(null);
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
            form_type: member.form_type || '',
            status: member.status || 'new',
        } : { ...EMPTY, ...(initial || {}) });
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, member, initial]);

    if (!open) return null;

    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setErr('');
        if (!f.first_name.trim()) return setErr('First name is required');
        if (!editing && !f.last_name.trim()) return setErr('Surname is required');
        if (f.whatsapp_number.replace(/\D/g, '').length < 10) return setErr('Enter the 10-digit mobile number');
        for (const [file, label] of [[front, 'front'], [back, 'back']]) {
            const bad = file ? validateFile(file) : null;
            if (bad) return setErr(`Aadhaar ${label} photo: ${bad}`);
        }
        setSaving(true);
        try {
            // upload the chosen photos first, then save the member with their links
            const phone = '91' + f.whatsapp_number.replace(/\D/g, '').slice(-10);
            const photos = {};
            if (front) photos.aadhaar_front_url = await uploadDoc('aadhaar-front', phone, front);
            if (back) photos.aadhaar_back_url = await uploadDoc('aadhaar-back', phone, back);
            const { status, ...rest } = f; // status is chosen only when adding; later use the Approve / Reject buttons
            const res = await authFetch(editing ? '/api/update-member' : '/api/create-member', {
                method: 'POST',
                body: editing ? { id: member.id, ...rest, ...photos } : { ...f, ...photos },
            });
            const data = await res.json();
            if (data.success) {
                onSaved && onSaved(data.member);
                onClose();
            } else {
                setErr(data.message || 'Could not save');
            }
        } catch (e2) {
            if (e2.message !== 'Session expired') setErr(String(e2.message || '').startsWith('Upload failed') ? e2.message : 'Network error, please try again');
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
                    {note && !editing && <div className="msg" style={{ background: '#FEF0C7', color: '#93370D' }}>{note}</div>}
                    {err && <div className="msg msg-err">{err}</div>}
                    <p className="mf-note"><Star /> means required. Everything else can be left empty.</p>
                    <div className="mf-grid">
                        <div className="mf-h">LIST</div>
                        <div className="td-field">
                            <label htmlFor="mf-ft">Section</label>
                            <select id="mf-ft" value={f.form_type} onChange={set('form_type')}>
                                <option value="details_update">Full Details (Details Update tab)</option>
                                <option value="aadhaar_update">Aadhaar only (Aadhaar Update tab)</option>
                                <option value="">Not submitted yet (Not Submitted tab)</option>
                            </select>
                        </div>
                        {!editing && (
                            <div className="td-field">
                                <label htmlFor="mf-st">Status</label>
                                <select id="mf-st" value={f.status} onChange={set('status')}>
                                    <option value="new">New</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="need_review">Need Review</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="expired">Expired</option>
                                </select>
                            </div>
                        )}

                        <div className="mf-h">MEMBERSHIP</div>
                        <div className="td-field mf-full"><label htmlFor="mf-no">Membership No.</label><input id="mf-no" value={f.membership_no} onChange={set('membership_no')} placeholder="Leave empty if not given yet" /><span className="mf-hint">Each membership number can be used for one member only.</span></div>

                        <div className="mf-h">PERSONAL</div>
                        <div className="td-field"><label htmlFor="mf-fn">First name <Star /></label><input id="mf-fn" value={f.first_name} onChange={set('first_name')} required /></div>
                        <div className="td-field"><label htmlFor="mf-fa">Father name</label><input id="mf-fa" value={f.father_name} onChange={set('father_name')} /></div>
                        <div className="td-field"><label htmlFor="mf-ln">Surname {!editing && <Star />}</label><input id="mf-ln" value={f.last_name} onChange={set('last_name')} required={!editing} /></div>
                        <div className="td-field"><label htmlFor="mf-dob">Birth date</label><input id="mf-dob" value={f.birth_date} onChange={set('birth_date')} placeholder="17/09/1992" /><span className="mf-hint">DD/MM/YYYY</span></div>
                        <div className="td-field mf-full"><label htmlFor="mf-np">Native place</label><input id="mf-np" value={f.native_place} onChange={set('native_place')} /></div>

                        <div className="mf-h">CONTACT</div>
                        <div className="td-field">
                            <label htmlFor="mf-ph">Mobile number <Star /></label>
                            <div className="otp-phone"><span className="otp-cc">+91</span><input id="mf-ph" inputMode="numeric" value={f.whatsapp_number} onChange={(e) => setF({ ...f, whatsapp_number: e.target.value.replace(/[^\d]/g, '') })} placeholder="98765 43210" required /></div>
                            <span className="mf-hint">10 digits. One number can belong to one member only.</span>
                        </div>
                        <div className="td-field"><label htmlFor="mf-em">Email</label><input id="mf-em" value={f.email} onChange={set('email')} placeholder="name@example.com" /></div>
                        <div className="td-field mf-full"><label htmlFor="mf-ad">Address</label><input id="mf-ad" value={f.address} onChange={set('address')} /></div>
                        <div className="td-field mf-full"><label htmlFor="mf-ar">Area</label><input id="mf-ar" value={f.area} onChange={set('area')} /></div>

                        <div className="mf-h">DOCUMENTS</div>
                        <div className="td-field"><label htmlFor="mf-aa">Aadhaar number</label><input id="mf-aa" value={f.aadhaar_number} onChange={set('aadhaar_number')} /></div>
                        <div className="td-field"><label htmlFor="mf-pan">PAN number</label><input id="mf-pan" value={f.pan_number} onChange={(e) => setF({ ...f, pan_number: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10} /><span className="mf-hint">5 letters, 4 digits, 1 letter</span></div>
                        <div className="td-field mf-full">
                            <label htmlFor="mf-front">Aadhaar front photo</label>
                            <input id="mf-front" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFront(e.target.files[0] || null)} />
                            <span className="mf-hint">{member && member.aadhaar_front_url ? <>Already uploaded (<a href={member.aadhaar_front_url} target="_blank" rel="noreferrer">view</a>). Choose a file only to replace it.</> : 'Not uploaded yet. JPG, PNG, WEBP or PDF, up to 10 MB.'}</span>
                        </div>
                        <div className="td-field mf-full">
                            <label htmlFor="mf-back">Aadhaar back photo</label>
                            <input id="mf-back" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setBack(e.target.files[0] || null)} />
                            <span className="mf-hint">{member && member.aadhaar_back_url ? <>Already uploaded (<a href={member.aadhaar_back_url} target="_blank" rel="noreferrer">view</a>). Choose a file only to replace it.</> : 'Not uploaded yet. JPG, PNG, WEBP or PDF, up to 10 MB.'}</span>
                        </div>
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
