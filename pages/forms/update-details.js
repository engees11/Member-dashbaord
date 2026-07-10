import { useState } from 'react';
import { useRouter } from 'next/router';
import { uploadDoc, validateFile } from '../../lib/supabaseClient';

export default function UpdateDetails() {
    const router = useRouter();
    const memberId = router.query.id || null;

    const [form, setForm] = useState({
        first_name: '', father_name: '', last_name: '', email: '',
        phone: '', dob: '', native_place: '', address: '', area: '',
    });
    const [front, setFront] = useState(null);
    const [back, setBack] = useState(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState(null);
    const [done, setDone] = useState(false);

    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const submit = async () => {
        setMsg(null);
        const required = ['first_name', 'father_name', 'last_name', 'phone', 'dob', 'native_place', 'address', 'area'];
        for (const k of required) {
            if (!form[k]) return setMsg({ type: 'err', text: 'Sari * wali fields required hain.' });
        }
        const e1 = validateFile(front); if (e1) return setMsg({ type: 'err', text: 'Aadhaar Front: ' + e1 });
        const e2 = validateFile(back); if (e2) return setMsg({ type: 'err', text: 'Aadhaar Back: ' + e2 });
        setLoading(true);
        try {
            const frontUrl = await uploadDoc('aadhaar-front', form.phone, front);
            const backUrl = await uploadDoc('aadhaar-back', form.phone, back);
            const res = await fetch('/api/submit-form', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    member_id: memberId,
                    form_type: 'details_update',
                    first_name: form.first_name,
                    father_name: form.father_name,
                    last_name: form.last_name,
                    email: form.email,
                    whatsapp_number: form.phone,
                    birth_date: form.dob,
                    native_place: form.native_place,
                    address: form.address,
                    area: form.area,
                    aadhaar_front_url: frontUrl,
                    aadhaar_back_url: backUrl,
                }),
            });
            const data = await res.json();
            if (data.success) setDone(true);
            else setMsg({ type: 'err', text: data.message || 'Kuch galat ho gaya.' });
        } catch (err) {
            setMsg({ type: 'err', text: err.message || 'Network error, dobara try karo.' });
        }
        setLoading(false);
    };

    if (done) {
        return (
            <div className="page">
                <div className="form-card" style={{ textAlign: 'center' }}>
                    <h1>✅ Thank You!</h1>
                    <p className="sub">Your details have been submitted successfully.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="form-card">
                <h1>Update Your Details</h1>
                <p className="sub">Apni sahi details bharein aur Aadhaar upload karein.</p>

                {msg && <div className={`msg ${msg.type === 'ok' ? 'msg-ok' : 'msg-err'}`}>{msg.text}</div>}

                <div className="field">
                    <label>First Name *</label>
                    <input value={form.first_name} onChange={set('first_name')} />
                </div>
                <div className="field">
                    <label>Father Name *</label>
                    <input value={form.father_name} onChange={set('father_name')} />
                </div>
                <div className="field">
                    <label>Last Name *</label>
                    <input value={form.last_name} onChange={set('last_name')} />
                </div>
                <div className="field">
                    <label>Email</label>
                    <input type="email" value={form.email} onChange={set('email')} placeholder="email@example.com" />
                </div>
                <div className="field">
                    <label>Whatsapp Mobile Number *</label>
                    <input value={form.phone} onChange={set('phone')} placeholder="91XXXXXXXXXX" />
                </div>
                <div className="field">
                    <label>Birth Date *</label>
                    <input type="date" value={form.dob} onChange={set('dob')} />
                </div>
                <div className="field">
                    <label>Native Place *</label>
                    <input value={form.native_place} onChange={set('native_place')} />
                </div>
                <div className="field">
                    <label>Address *</label>
                    <textarea rows={3} value={form.address} onChange={set('address')} />
                </div>
                <div className="field">
                    <label>Area *</label>
                    <input value={form.area} onChange={set('area')} />
                </div>
                <div className="field">
                    <label>Upload Aadhaar Card Front Image * (JPG/PNG/WEBP/PDF, max 10MB)</label>
                    <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => setFront(e.target.files[0])} />
                    {front && <p style={{ fontSize: 13, color: '#16a34a', margin: '6px 0 0' }}>📎 {front.name}</p>}
                </div>
                <div className="field">
                    <label>Upload Aadhaar Card Back Image * (JPG/PNG/WEBP/PDF, max 10MB)</label>
                    <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => setBack(e.target.files[0])} />
                    {back && <p style={{ fontSize: 13, color: '#16a34a', margin: '6px 0 0' }}>📎 {back.name}</p>}
                </div>

                <button className="btn btn-blue submit-btn" onClick={submit} disabled={loading}>
                    {loading ? 'Uploading...' : 'Submit'}
                </button>
            </div>
        </div>
    );
}