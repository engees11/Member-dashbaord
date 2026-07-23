import { useState } from 'react';
import { useRouter } from 'next/router';
import { uploadDoc, validateFile } from '../../lib/supabaseClient';

const TOTAL_FIELDS = 4;

export default function AadhaarUpload() {
    const router = useRouter();
    const memberId = router.query.id || null;

    const [form, setForm] = useState({ email: '', phone: '' });
    const [front, setFront] = useState(null);
    const [back, setBack] = useState(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [done, setDone] = useState(false);

    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const filled = [form.email, form.phone, front, back].filter(Boolean).length;
    const pct = Math.round((filled / TOTAL_FIELDS) * 100);

    const submit = async () => {
        setErr('');
        if (!form.email || !form.phone) return setErr('Email and WhatsApp number are required.');
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
                    form_type: 'aadhaar_update',
                    email: form.email,
                    whatsapp_number: form.phone,
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
                <h1>Aadhaar Verification</h1>
                <p>Please upload your Aadhaar card to verify your details.</p>
            </div>
            <div className="gform-progress">
                <div className="bar"><div className="fill" style={{ width: pct + '%' }} /></div>
                <div className="count">{filled} of {TOTAL_FIELDS} completed</div>
            </div>

            {err && <div className="gform-banner err">{err}</div>}

            <div className="gform-q">
                <label>Email<span className="req">*</span></label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="Your answer" />
            </div>

            <div className="gform-q">
                <label>Whatsapp Mobile Number<span className="req">*</span></label>
                <input type="text" value={form.phone} onChange={set('phone')} placeholder="Your answer" />
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

            <div className="gform-submit-row">
                <button className="gform-submit-btn" onClick={submit} disabled={loading}>
                    {loading ? 'Uploading...' : 'Submit'}
                </button>
            </div>
        </div>
    );
}