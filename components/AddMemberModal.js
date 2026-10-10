import { useEffect, useRef, useState } from 'react';
import { authFetch } from '../lib/session';
import { formatPhone } from '../lib/phone';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AddMemberModal({ open, onClose, onAdded }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState('member');
    const [err, setErr] = useState('');
    const [saving, setSaving] = useState(false);
    const [added, setAdded] = useState(null);
    const [copied, setCopied] = useState(false);
    const nameRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        setName(''); setEmail(''); setPhone(''); setRole('member'); setErr(''); setSaving(false); setAdded(null); setCopied(false);
        setTimeout(() => nameRef.current && nameRef.current.focus(), 30);
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    if (!open) return null;

    const submit = async (e) => {
        e.preventDefault();
        setErr('');
        if (!name.trim()) return setErr('Name is required');
        if (!EMAIL_RE.test(email.trim())) return setErr('Enter a valid email');
        if (phone.replace(/\D/g, '').length < 10) return setErr('Enter the 10-digit mobile number');
        setSaving(true);
        try {
            const res = await authFetch('/api/team', { method: 'POST', body: { name, email, phone, role } });
            const data = await res.json();
            if (!data.success) {
                setErr(data.message || 'Could not add the team member');
            } else {
                setAdded(data.member);
                onAdded && onAdded(data.member);
            }
        } catch (e2) {
            if (e2.message !== 'Session expired') setErr('Network error, please try again');
        }
        setSaving(false);
    };

    const loginUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const message = added
        ? `Hi ${added.name}, you can now log in to the team dashboard:\n${loginUrl}\nEnter your mobile number (${formatPhone(added.phone)}) and the OTP you get on WhatsApp.`
        : '';

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(message);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="td-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="td-modal" role="dialog" aria-modal="true" aria-labelledby="add-member-title">
                <div className="td-modal-head">
                    <h2 id="add-member-title">{added ? 'Team member added' : 'New team member'}</h2>
                    <button type="button" className="td-close" onClick={onClose} aria-label="Close">×</button>
                </div>

                {added ? (
                    <>
                        <div className="td-reveal">
                            <p className="td-reveal-note">
                                {added.name} can log in now. On the login page they enter their mobile number and get an OTP on WhatsApp. No password is needed.
                            </p>
                            <div className="td-reveal-box">
                                <div>
                                    <span className="td-reveal-label">Name</span>
                                    <span className="td-reveal-value">{added.name}</span>
                                </div>
                                <div>
                                    <span className="td-reveal-label">Mobile number</span>
                                    <span className="td-reveal-value">{formatPhone(added.phone)}</span>
                                </div>
                            </div>
                            <div className="td-reveal-actions">
                                <button type="button" className="td-btn td-btn-primary" onClick={copy}>
                                    {copied ? 'Copied' : 'Copy login message'}
                                </button>
                            </div>
                        </div>
                        <button type="button" className="td-btn td-btn-gray td-btn-block" onClick={onClose}>Done</button>
                    </>
                ) : (
                    <form onSubmit={submit} className="td-form">
                        {err && <div className="msg msg-err">{err}</div>}
                        <div className="td-field">
                            <label htmlFor="tm-name">Name</label>
                            <input id="tm-name" ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required />
                        </div>
                        <div className="td-field">
                            <label htmlFor="tm-email">Email</label>
                            <input id="tm-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
                        </div>
                        <div className="td-field">
                            <label htmlFor="tm-phone">Mobile number</label>
                            <div className="otp-phone otp-phone-modal">
                                <span className="otp-cc">+91</span>
                                <input
                                    id="tm-phone"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={phone}
                                    maxLength={13}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                    placeholder="98765 43210"
                                    required
                                />
                            </div>
                        </div>
                        <div className="td-field">
                            <label htmlFor="tm-role">Role</label>
                            <select id="tm-role" value={role} onChange={(e) => setRole(e.target.value)}>
                                <option value="member">Team member</option>
                                <option value="admin">Admin (can also import, delete members and manage the team)</option>
                            </select>
                        </div>
                        <p className="td-muted td-small">The member logs in with this mobile number. An OTP is sent on WhatsApp each time.</p>
                        <button type="submit" className="td-btn td-btn-primary td-btn-block" disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
