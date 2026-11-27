import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { uploadDoc, validateFile } from '../../lib/supabaseClient';
import { BLOOD_GROUPS } from '../../lib/memberFields';
import { typingPhone, typingAadhaar, mobileProblem, aadhaarProblem, panProblem, nameProblem, isFutureIso } from '../../lib/validators';
import { squareJpeg, isPhone, canUseCamera } from '../../lib/photo';
import Avatar from '../../components/Avatar';
import CameraCapture from '../../components/CameraCapture';

const TOTAL_FIELDS = 12;
const Warn = ({ text }) => (text ? <div role="alert" style={{ fontSize: 13, color: '#B42318', fontWeight: 600, marginTop: 6 }}>{text}</div> : null);

export default function UpdateDetails() {
    const router = useRouter();
    const memberId = router.query.id || null;

    const [form, setForm] = useState({
        first_name: '', father_name: '', last_name: '', email: '',
        phone: '', dob: '', native_place: '', address: '', area: '', aadhaar_number: '', pan_number: '',
        blood_group: '', qualification: '', hobbies: '', marriage_date: '', business_name: '', business_description: '',
    });
    const [photo, setPhoto] = useState(null); // the member's photo, already cut to a small square
    const [preview, setPreview] = useState('');
    const [cam, setCam] = useState(false);
    const fileRef = useRef(null);
    const camRef = useRef(null);
    const [front, setFront] = useState(null);
    const [back, setBack] = useState(null);
    const [payment, setPayment] = useState(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [done, setDone] = useState(false);

    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

    useEffect(() => {
        if (!photo) { setPreview(''); return undefined; }
        const u = URL.createObjectURL(photo);
        setPreview(u);
        return () => URL.revokeObjectURL(u);
    }, [photo]);
    // upload: any picture is cut to a small square; camera: a phone opens its own camera, a computer opens the webcam here
    const takeFile = async (file) => {
        if (!file) return;
        if (!/^image\//.test(file.type || '')) { setErr('Please choose a photo (JPG, PNG or WEBP).'); return; }
        setErr('');
        try { setPhoto(await squareJpeg(file)); } catch (e) { setErr('Could not read this photo. Please try another one.'); }
    };
    const openCamera = () => { if (isPhone() || !canUseCamera()) { if (camRef.current) camRef.current.click(); } else setCam(true); };
    const filled = [
        form.first_name, form.father_name, form.last_name, form.phone,
        form.dob, form.native_place, form.address, form.area, form.aadhaar_number, form.pan_number, front, back,
    ].filter(Boolean).length;
    const pct = Math.round((filled / TOTAL_FIELDS) * 100);

    const submit = async () => {
        setErr('');
        const required = ['first_name', 'father_name', 'last_name', 'phone', 'dob', 'native_place', 'address', 'area', 'aadhaar_number'];
        for (const k of required) {
            if (!form[k]) return setErr('All fields marked with * are required.');
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (form.email && !emailRegex.test(form.email)) return setErr('Please enter a valid email address.');
        const mobileErr = mobileProblem(form.phone);
        if (mobileErr) return setErr(mobileErr);
        for (const [k, label] of [['first_name', 'First name'], ['father_name', 'Father name'], ['last_name', 'Last name']]) {
            const nameErr = nameProblem(form[k], label);
            if (nameErr) return setErr(nameErr);
        }
        if (isFutureIso(form.dob)) return setErr('Birth date cannot be in the future.');
        if (form.marriage_date && (isFutureIso(form.marriage_date) || form.marriage_date <= form.dob)) return setErr('Marriage date must be after your birth date and not in the future.');
        const aadhaarErr = aadhaarProblem(form.aadhaar_number);
        if (aadhaarErr) return setErr(aadhaarErr);
        const pan = form.pan_number.replace(/\s/g, '').toUpperCase();
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return setErr('Please enter a valid PAN number. Example: ABCDE1234F');
        const e1 = validateFile(front); if (e1) return setErr('Aadhaar Front: ' + e1);
        const e2 = validateFile(back); if (e2) return setErr('Aadhaar Back: ' + e2);
        if (payment) {
            const e3 = validateFile(payment); if (e3) return setErr('Payment Proof: ' + e3);
        }
        setLoading(true);
        try {
            const frontUrl = await uploadDoc('aadhaar-front', form.phone, front);
            const backUrl = await uploadDoc('aadhaar-back', form.phone, back);
            const paymentUrl = payment ? await uploadDoc('payment-proof', form.phone, payment) : '';
            const photoUrl = photo ? await uploadDoc('profile-photo', form.phone, photo) : '';
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
                    pan_number: pan,
                    aadhaar_front_url: frontUrl,
                    aadhaar_back_url: backUrl,
                    payment_proof_url: paymentUrl,
                    blood_group: form.blood_group,
                    qualification: form.qualification,
                    hobbies: form.hobbies,
                    marriage_date: form.marriage_date,
                    business_name: form.business_name,
                    business_description: form.business_description,
                    photo_url: photoUrl,
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
                <label>Your Photo (optional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                    <Avatar member={{ first_name: form.first_name }} size={88} src={preview} />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="gform-submit-btn" style={{ padding: '10px 16px', fontSize: 14 }} onClick={() => fileRef.current && fileRef.current.click()}>Upload photo</button>
                        <button type="button" className="gform-submit-btn" style={{ padding: '10px 16px', fontSize: 14 }} onClick={openCamera}>Take photo</button>
                        {preview && <button type="button" className="gform-submit-btn" style={{ padding: '10px 16px', fontSize: 14, background: '#64748b' }} onClick={() => setPhoto(null)}>Remove</button>}
                    </div>
                </div>
                <div style={{ fontSize: 12, color: '#4B5563', marginTop: 8 }}>A clear photo of your face. It is cut to a small square automatically.</div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { takeFile(e.target.files[0]); e.target.value = ''; }} />
                <input ref={camRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => { takeFile(e.target.files[0]); e.target.value = ''; }} />
            </div>
            {cam && <CameraCapture onCapture={(file) => { setCam(false); setPhoto(file); setErr(''); }} onClose={() => setCam(false)} />}

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
                <input type="text" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: typingPhone(e.target.value) })} placeholder="10-digit mobile number" />
                <Warn text={mobileProblem(form.phone)} />
            </div>

            <div className="gform-q">
                <label>Birth Date<span className="req">*</span></label>
                <input type="date" max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={set('dob')} />
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
                <label>Blood Group</label>
                <select value={form.blood_group} onChange={set('blood_group')}>
                    <option value="">Not known</option>
                    {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
            </div>

            <div className="gform-q">
                <label>Qualification</label>
                <input type="text" value={form.qualification} onChange={set('qualification')} placeholder="Your answer" />
            </div>

            <div className="gform-q">
                <label>Hobbies</label>
                <input type="text" value={form.hobbies} onChange={set('hobbies')} placeholder="Your answer" />
            </div>

            <div className="gform-q">
                <label>Marriage Date</label>
                <input type="date" max={new Date().toISOString().slice(0, 10)} value={form.marriage_date} onChange={set('marriage_date')} />
                <div style={{ fontSize: 12, color: '#4B5563', marginTop: 8 }}>Leave empty if not married.</div>
            </div>

            <div className="gform-q">
                <label>Business / Profession Name</label>
                <input type="text" value={form.business_name} onChange={set('business_name')} placeholder="Your answer" />
            </div>

            <div className="gform-q">
                <label>Business / Profession Description</label>
                <textarea rows={3} value={form.business_description} onChange={set('business_description')} placeholder="Your answer" />
            </div>

            <div className="gform-q">
                <label>Aadhaar Number<span className="req">*</span></label>
                <input type="text" inputMode="numeric" maxLength={14} value={form.aadhaar_number} onChange={(e) => setForm({ ...form, aadhaar_number: typingAadhaar(e.target.value) })} placeholder="1234 5678 9012" />
                <div style={{ fontSize: 12, color: '#4B5563', marginTop: 8 }}>12 digits</div>
                <Warn text={aadhaarProblem(form.aadhaar_number)} />
            </div>

            <div className="gform-q">
                <label>PAN Number<span className="req">*</span></label>
                <input type="text" value={form.pan_number} onChange={(e) => setForm({ ...form, pan_number: e.target.value.toUpperCase() })} placeholder="Your answer" maxLength={10} />
                <div style={{ fontSize: 12, color: '#4B5563', marginTop: 8 }}>Example: ABCDE1234F</div>
                <Warn text={panProblem(form.pan_number)} />
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

            <div className="gform-q">
                <label>Upload Payment Screenshot / Receipt (optional)</label>
                <div className={`gform-file-zone ${payment ? 'has-file' : ''}`}>
                    <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => setPayment(e.target.files[0])} />
                    <div className="icon">{payment ? '✅' : '📎'}</div>
                    {payment ? (
                        <div className="filename">{payment.name}</div>
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