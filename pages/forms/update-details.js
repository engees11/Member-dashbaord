import { useState } from 'react';
import { useRouter } from 'next/router';
import { uploadDoc, validateFile } from '../../lib/supabaseClient';

const TOTAL_FIELDS = 11;

export default function UpdateDetails() {
    const router = useRouter();
    const memberId = router.query.id || null;

    const [form, setForm] = useState({
        first_name: '', father_name: '', last_name: '', email: '',
        phone: '', dob: '', native_place: '', address: '', area: '', aadhaar_number: '',
    });
    const [front, setFront] = useState(null);
    const [back, setBack] = useState(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [done, setDone] = useState(false);

    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const filled = [
        form.first_name, form.father_name, form.last_name, form.phone,
        form.dob, form.native_place, form.address, form.area, form.aadhaar_number, front, back,
    ].filter(Boolean).length;
    const pct = Math.round((filled / TOTAL_FIELDS) * 100);

    const submit = async () => {
        setErr('');
        const required = ['first_name', 'father_name', 'last_name', 'phone', 'dob', 'native_place', 'address', 'area'];
        for (const k of required) {
            if (!form[k]) return setErr('All fields marked with * are required.');
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (form.email && !emailRegex.test(form.email)) return setErr('Please enter a valid email address.');
        const phoneDigits = form.phone.replace(/\D/g, '');
        if (phoneDigits.length < 10 || phoneDigits.length > 13) return setErr('Please enter a valid WhatsApp number (10-13 digits).');
        const e1 = validateFile(front); if (e1) return setErr('Aadhaar Front: ' + e1);
        const e2 = validateFile(back); if (e2) return setErr('Aadhaar Back: ' + e2);
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
                    aadhaar_number: form.aadhaar_number,
                    aadhaar_front_url: frontUrl,
                    aadhaar_back_url: backUrl,
                }),
            });
            const data = await res.json();
            if (data.success) setDone(true);
            else setErr(data.message || 'Something went wrong. Please try again.');
        } catch (e) {
            setErr(e.message || 'Network error, please try again.');
        }
        setLoading(false);
    };

    if (done) {
        return (
            <div className="gform-wrap">
                <div className="gform-success">
                    <div className="check">✓</div>
                    <h2>Your details have been submitted successfully.</h2>
                    <p>You will be notified once the admin reviews your submission.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="gform-wrap">
            <div className="gform-header">
                <h1>Update Your Details</h1>
                <p>Please fill in your correct details and upload your Aadhaar card.</p>
            </div>
            <div className="gform-progress">
                <div className="bar"><div className="fill" style={{ width: pct + '%' }} /></div>
                <div className="count">{filled} of {TOTAL_FIELDS} completed</div>
            </div>

            {err && <div className="gform-banner err">{err}</div>}

            <div className="gform-q">
                <label>First Name<span className="req">*</span></label>
                <input type="text" value={form.first_name} onChange={set('first_name')} placeholder="Your answer" />
            </div>

            <div className="gform-q">
                <label>Father Name<span className="req">*</span></label>
                <input type="text" value={form.father_name} onChange={set('father_name')} placeholder="Your answer" />
            </div>

            <div className="gform-q">
                <label>Last Name<span className="req">*</span></label>
                <input type="text" value={form.last_name} onChange={set('last_name')} placeholder="Your answer" />
            </div>

            <div className="gform-q">
                <label>Email</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="Your answer" />
            </div>

            <div className="gform-q">
                <label>Whatsapp Mobile Number<span className="req">*</span></label>
                <input type="text" value={form.phone} onChange={set('phone')} placeholder="Your answer" />
            </div>

            <div className="gform-q">
                <label>Birth Date<span className="req">*</span></label>
                <input type="date" value={form.dob} onChange={set('dob')} />
            </div>

            <div className="gform-q">
                <label>Native Place<span className="req">*</span></label>
                <input type="text" value={form.native_place} onChange={set('native_place')} placeholder="Your answer" />
            </div>

            <div className="gform-q">
                <label>Address<span className="req">*</span></label>
                <textarea rows={3} value={form.address} onChange={set('address')} placeholder="Your answer" />
            </div>

            <div className="gform-q">
                <label>Area<span className="req">*</span></label>
                <input type="text" value={form.area} onChange={set('area')} placeholder="Your answer" />
            </div>

            <div className="gform-q">
                <label>Aadhaar Number<span className="req">*</span></label>
                <input type="text" value={form.aadhaar_number} onChange={set('aadhaar_number')} placeholder="Your answer" />
            </div>

            <div className="gform-q">
                <label>Upload your Aadhaar Card Front Image<span className="req">*</span></label>
                <div className={`gform-file-zone ${front ? 'has-file' : ''}`}>
                    <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => setFront(e.target.files[0])} />
                    <div className="icon">{front ? '✅' : '📎'}</div>
                    {front ? (
                        <div className="filename">{front.name}</div>
                    ) : (
                        <>
                            <div>Click to upload or drag file</div>
                            <div className="hint">PDF or image, max 10MB</div>
                        </>
                    )}
                </div>
            </div>

            <div className="gform-q">
                <label>Upload your Aadhaar Card Back Image<span className="req">*</span></label>
                <div className={`gform-file-zone ${back ? 'has-file' : ''}`}>
                    <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => setBack(e.target.files[0])} />
                    <div className="icon">{back ? '✅' : '📎'}</div>
                    {back ? (
                        <div className="filename">{back.name}</div>
                    ) : (
                        <>
                            <div>Click to upload or drag file</div>
                            <div className="hint">PDF or image, max 10MB</div>
                        </>
                    )}
                </div>
            </div>

            <div style={{ textAlign: 'center', margin: '24px 0' }}>
                <p style={{ fontSize: 14, color: '#475569', marginBottom: 10, fontWeight: 600 }}>
                    Support us — Scan & Pay
                </p>
                <img
                    src="/donation-qr.png"
                    alt="Scan and Pay QR - M S Terapanth Yuvak Parishad"
                    style={{ maxWidth: 220, width: '100%', borderRadius: 12, border: '1px solid #e2e8f0' }}
                />
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
                    UPI ID: terapanthb089y@indianbnk
                </p>
            </div>

            <div className="gform-submit-row">
                <button className="gform-submit-btn" onClick={submit} disabled={loading}>
                    {loading ? 'Uploading...' : 'Submit'}
                </button>
            </div>
        </div>
    );
}