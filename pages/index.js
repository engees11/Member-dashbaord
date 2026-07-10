import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async () => {
        setErr('');
        setLoading(true);
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('admin_token', data.token);
                router.push('/admin');
            } else {
                setErr(data.message || 'Login failed');
            }
        } catch {
            setErr('Network error, dobara try karo.');
        }
        setLoading(false);
    };

    return (
        <div className="login-page">
            <div className="login-box">
                <h1>Admin Login</h1>
                <p>TYP Surat Member Verification System</p>
                {err && <div className="msg msg-err">{err}</div>}
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
                <button className="btn btn-blue submit-btn" onClick={handleLogin} disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                </button>
            </div>
        </div>
    );
}