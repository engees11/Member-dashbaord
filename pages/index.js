import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { saveSession } from '../lib/session';

async function postJson(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}

// One login for everybody (admin and team): name + mobile number + OTP on WhatsApp
export default function Home() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [step, setStep] = useState('details'); // 'details' | 'code'
    const [wait, setWait] = useState(0);
    const [err, setErr] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (wait <= 0) return;
        const t = setTimeout(() => setWait((w) => w - 1), 1000);
        return () => clearTimeout(t);
    }, [wait]);

    const sendOtp = async () => {
        setErr('');
        setInfo('');
        if (!name.trim()) return setErr('Enter your name');
        if (phone.replace(/\D/g, '').length < 10) return setErr('Enter your 10-digit mobile number');
        setLoading(true);
        try {
            const data = await postJson('/api/otp/send', { name, phone });
            if (data.success) {
                setStep('code');
                setCode('');
                setWait(data.resendIn || 60);
                setInfo(data.message);
            } else {
                setErr(data.message || 'Could not send the OTP');
            }
        } catch {
            setErr('Network error, please try again.');
        }
        setLoading(false);
    };

    const verifyOtp = async () => {
        setErr('');
        if (code.length !== 6) return setErr('Enter the 6-digit OTP');
        setLoading(true);
        try {
            const data = await postJson('/api/otp/verify', { phone, code });
            if (data.success) {
                saveSession(data.token, data.user);
                router.push('/admin');
            } else {
                setErr(data.message || 'Login failed');
            }
        } catch {
            setErr('Network error, please try again.');
        }
        setLoading(false);
    };

    return (
        <div className="login-page">
            <div className="login-box">
                <h1>Team Login</h1>
                <p>Member Verification System</p>

                {err && <div className="msg msg-err">{err}</div>}
                {info && !err && <div className="msg msg-ok">{info}</div>}

                {step === 'details' ? (
                    <>
                        <input
                            type="text"
                            autoComplete="name"
                            placeholder="Your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <div className="otp-phone">
                            <span className="otp-cc">+91</span>
                            <input
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel-national"
                                placeholder="Mobile number"
                                value={phone}
                                maxLength={13}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
                            />
                        </div>
                        <button className="btn btn-blue submit-btn" onClick={sendOtp} disabled={loading}>
                            {loading ? 'Sending...' : 'Send OTP on WhatsApp'}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="otp-hint">Enter the OTP sent to +91 {phone.replace(/\D/g, '').slice(-10)}</div>
                        <input
                            className="otp-code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="------"
                            value={code}
                            maxLength={6}
                            autoFocus
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={(e) => e.key === 'Enter' && verifyOtp()}
                        />
                        <button className="btn btn-blue submit-btn" onClick={verifyOtp} disabled={loading}>
                            {loading ? 'Checking...' : 'Verify & login'}
                        </button>
                        <div className="otp-links">
                            <button type="button" className="link-btn" onClick={() => { setStep('details'); setCode(''); setErr(''); setInfo(''); }}>
                                Change details
                            </button>
                            <button type="button" className="link-btn" onClick={sendOtp} disabled={wait > 0 || loading}>
                                {wait > 0 ? `Resend OTP in ${wait}s` : 'Resend OTP'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
