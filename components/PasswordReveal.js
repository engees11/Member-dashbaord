import { useState } from 'react';
import { formatPhone } from '../lib/phone';

// Shows a new / reset password once, with copy buttons. Login id is the email if there is one, else the mobile number.
export default function PasswordReveal({ name, email, phone, password }) {
    const [copied, setCopied] = useState('');
    const loginUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const loginLabel = email ? 'Email' : 'Mobile number';
    const loginId = email || formatPhone(phone);
    const message = `Hi ${name}, team dashboard login:\n${loginUrl}\n${loginLabel}: ${loginId}\nPassword: ${password}`;

    const copy = async (text, which) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(which);
            setTimeout(() => setCopied(''), 2000);
        } catch {
            setCopied('');
        }
    };

    return (
        <div className="td-reveal">
            <p className="td-reveal-note">Yeh password sirf abhi dikh raha hai. Copy karke {name} ko bhej do.</p>
            <div className="td-reveal-box">
                <div>
                    <span className="td-reveal-label">{loginLabel}</span>
                    <span className="td-reveal-value">{loginId}</span>
                </div>
                <div>
                    <span className="td-reveal-label">Password</span>
                    <span className="td-reveal-value td-reveal-pass">{password}</span>
                </div>
            </div>
            <div className="td-reveal-actions">
                <button type="button" className="td-btn td-btn-soft" onClick={() => copy(password, 'pass')}>
                    {copied === 'pass' ? 'Copied' : 'Copy password'}
                </button>
                <button type="button" className="td-btn td-btn-primary" onClick={() => copy(message, 'msg')}>
                    {copied === 'msg' ? 'Copied' : 'Copy WhatsApp message'}
                </button>
            </div>
        </div>
    );
}
