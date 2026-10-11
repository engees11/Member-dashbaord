import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { clearSession, getToken, getUser } from '../../lib/session';
import { formatPhone } from '../../lib/phone';

export default function Settings() {
    const router = useRouter();
    const [user, setUser] = useState(null);

    useEffect(() => {
        if (!getToken()) { router.push('/'); return; }
        setUser(getUser() || { role: 'admin', name: 'Admin' });
    }, []);

    if (!user) return null;
    const admin = user.role === 'admin';
    const roleText = admin ? (user.id ? 'Admin' : 'Main admin') : 'Team member';

    return (
        <div>
            <Head><title>Settings</title></Head>
            <div className="st-head"><h1>Settings</h1></div>
            <div className="st-grid">
                <section className="st-card">
                    <h2>Profile</h2>
                    <p>Who you are logged in as.</p>
                    <div className="st-row"><span>Name</span><b>{user.name}</b></div>
                    <div className="st-row"><span>Mobile number (used to log in)</span><b>{user.phone ? formatPhone(user.phone) : '-'}</b></div>
                    <div className="st-row"><span>Role</span><b>{roleText}</b></div>
                </section>

                {admin && (
                    <section className="st-card">
                        <h2>Data</h2>
                        <p>Bring members in, take them out, or bring deleted ones back.</p>
                        <div className="st-row"><span>Import members from a CSV file</span><Link href="/admin/import">Open Import</Link></div>
                        <div className="st-row"><span>Download all members as Excel or CSV</span><Link href="/admin/export">Open Export</Link></div>
                        <div className="st-row"><span>Deleted members and team members</span><Link href="/admin/deleted">Open Deleted</Link></div>
                    </section>
                )}

                <section className="st-card">
                    <h2>Login and security</h2>
                    <p>You log in with your mobile number and an OTP on WhatsApp. No password is used.</p>
                    <div className="st-row"><span>You stay logged in on this device for</span><b>7 days</b></div>
                    <div className="st-row"><span>Log out from this device now</span><button type="button" className="btn btn-red" onClick={() => { clearSession(); router.push('/'); }}>Logout</button></div>
                </section>
            </div>
        </div>
    );
}
