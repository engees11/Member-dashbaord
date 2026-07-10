import Link from 'next/link';

export default function Home() {
    return (
        <div className="login-page">
            <div className="login-box">
                <h1>Member Portal</h1>
                <p>Apna option choose karo</p>
                <Link href="/register"><button className="btn btn-blue submit-btn">New Member Registration</button></Link>
                <div style={{ height: 12 }} />
                <Link href="/update"><button className="btn btn-gray submit-btn">Old Member - Update Details</button></Link>
                <div style={{ height: 24 }} />
                <Link href="/login" style={{ fontSize: 13, color: '#64748b' }}>Admin Login</Link>
            </div>
        </div>
    );
}