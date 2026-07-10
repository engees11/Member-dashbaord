import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [err, setErr] = useState('');
    const router = useRouter();

    const handleLogin = async () => {
        setErr('');
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
    };

    return (
        <div className="login-page">
            <div className="login-box">
                <h1>Admin Console</h1>
                <p>Member Management Dashboard</p>
                {err && <div className="msg msg-err">{err}</div>}
                <input
                    type="email"
                    placeholder="Admin Email"
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
                <button className="btn btn-blue submit-btn" onClick={handleLogin}>
                    Secure Login
                </button>
            </div>
        </div>
    );
}