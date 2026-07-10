import { useState } from 'react';

// OLD MEMBER UPDATE FORM
// Phone number se member identify hota hai

export default function Update() {
    const [form, setForm] = useState({
        full_name: '', dob: '', phone: '', email: '', address: '',
    });
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState(null);

    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    const fileToBase64 = (f) =>
        new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result.split(',')[1]);
            r.onerror = rej;
            r.readAsDataURL(f);
        });

    const submit = async () => {
        setMsg(null);
        if (!form.phone) return setMsg({ type: 'err', text: 'Registered phone number required hai.' });
        if (!file) return setMsg({ type: 'err', text: 'Updated document upload karna zaroori hai.' });
        if (file.size > 4 * 1024 * 1024) {
            return setMsg({ type: 'err', text: 'Document 4MB se chhota hona chahiye.' });
        }
        setLoading(true);
        try {
            const document = { name: file.name, type: file.type, base64: await fileToBase64(file) };
            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ member_type: 'old', ...form, document }),
            });
            const data = await res.json();
            if (data.success) {
                setMsg({ type: 'ok', text: 'Details update ho gayi! Admin review ke baad status milega.' });
                setForm({ full_name: '', dob: '', phone: '', email: '', address: '' });
                setFile(null);
            } else {
                setMsg({ type: 'err', text: data.message || 'Kuch galat ho gaya.' });
            }
        } catch {
            setMsg({ type: 'err', text: 'Network error, dobara try karo.' });
        }
        setLoading(false);
    };

    return (
        <div className="page">
            <div className="form-card">
                <h1>Update Your Details</h1>
                <p className="sub">Purane members apni details yahan update karein aur document upload karein.</p>

                {msg && <div className={`msg ${msg.type === 'ok' ? 'msg-ok' : 'msg-err'}`}>{msg.text}</div>}

                <div className="field">
                    <label>Registered WhatsApp Number *</label>
                    <input value={form.phone} onChange={set('phone')} placeholder="91XXXXXXXXXX" />
                </div>
                <div className="field">
                    <label>Full Name</label>
                    <input value={form.full_name} onChange={set('full_name')} placeholder="Naam update karna ho to" />
                </div>
                <div className="field">
                    <label>Date of Birth</label>
                    <input type="date" value={form.dob} onChange={set('dob')} />
                </div>
                <div className="field">
                    <label>Email</label>
                    <input type="email" value={form.email} onChange={set('email')} />
                </div>
                <div className="field">
                    <label>Address</label>
                    <textarea rows={3} value={form.address} onChange={set('address')} />
                </div>
                <div className="field">
                    <label>Updated Document Upload * (max 4MB)</label>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0])} />
                </div>

                <button className="btn btn-blue submit-btn" onClick={submit} disabled={loading}>
                    {loading ? 'Submitting...' : 'Update Details'}
                </button>
            </div>
        </div>
    );
}