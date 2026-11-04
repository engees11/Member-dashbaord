import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { clearSession, getToken, getUser, authFetch } from '../../lib/session';
import { fmtDate } from '../../lib/format';
import { formatPhone } from '../../lib/phone';

export default function Settings() {
    const router = useRouter();
    const [user, setUser] = useState(null);

    useEffect(() => {
        if (!getToken()) { router.push('/'); return; }
        setUser(getUser() || { role: 'admin', name: 'Admin' });
    }, []);

    // annual meeting date: Retired (45+) is counted on this date. A new date is checked first, then confirmed.
    const [meeting, setMeeting] = useState(null);
    const [last, setLast] = useState({ by: null, at: null, prev: null });
    const [needsSetup, setNeedsSetup] = useState(false);
    const [dateInput, setDateInput] = useState('');
    const [preview, setPreview] = useState(null);
    const [checked, setChecked] = useState(false);
    const [meetMsg, setMeetMsg] = useState({ ok: true, text: '' });
    const [busy, setBusy] = useState(false);
    const yr = new Date().getFullYear();
    const words = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const loadMeeting = async () => {
        try {
            const res = await authFetch('/api/settings');
            const d = await res.json();
            if (d.success) { setMeeting(d.meetingDate || null); setNeedsSetup(!!d.needsSetup); setLast({ by: d.updatedBy, at: d.updatedAt, prev: d.previousDate }); }
        } catch { /* the section just stays empty */ }
    };
    useEffect(() => { if (getToken()) loadMeeting(); }, []);

    const sendDate = async (confirm) => {
        setBusy(true);
        setMeetMsg({ ok: true, text: '' });
        try {
            const res = await authFetch('/api/settings', { method: 'POST', body: { meetingDate: dateInput, confirm, acceptWarnings: confirm } });
            const d = await res.json();
            if (!d.success) { setPreview(null); setMeetMsg({ ok: false, text: d.message || 'Could not save the date' }); }
            else if (d.unchanged) { setPreview(null); setMeetMsg({ ok: true, text: d.message }); }
            else if (d.needsConfirm) { setChecked(false); setPreview(d); }
            else if (d.saved) { setPreview(null); setChecked(false); setDateInput(''); setMeetMsg({ ok: true, text: `Saved. Retired is now counted on ${fmtDate(d.proposed.date)}: ${d.proposed.retired} members.` }); await loadMeeting(); }
        } catch (e) {
            if (e.message !== 'Session expired') setMeetMsg({ ok: false, text: 'Network error, please try again.' });
        }
        setBusy(false);
    };

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
                        <h2>Team and roles</h2>
                        <p>Add people, make someone Admin or Team member, deactivate or delete. Open Team in the left menu, then click a name.</p>
                        <div className="st-row"><span>Add a team member</span><Link href="/admin">Open Dashboard</Link></div>
                    </section>
                )}

                {admin && (
                    <section className="st-card">
                        <h2>Data</h2>
                        <p>Bring members in, take them out, or bring deleted ones back.</p>
                        <div className="st-row"><span>Import members from a CSV file</span><Link href="/admin">Open Dashboard</Link></div>
                        <div className="st-row"><span>Download all members as Excel or CSV</span><Link href="/admin/members?status=all">Open Members</Link></div>
                        <div className="st-row"><span>Deleted members and team members</span><Link href="/admin/deleted">Open Deleted</Link></div>
                    </section>
                )}

                {admin && (
                    <section className="st-card">
                        <h2>Annual meeting</h2>
                        <p>Retired = age 45 or more on the meeting date. A wrong date changes who shows as Retired, so the new date is checked first and nothing changes until you confirm. No member data is changed by this date.</p>
                        {needsSetup && <div className="msg msg-err">One database step is pending: run supabase/app-settings.sql in Supabase. Until then Retired is counted on today's date.</div>}
                        <div className="st-row"><span>Counted on</span><b>{meeting ? fmtDate(meeting) : "today's date"}</b></div>
                        {last.by && <div className="st-row"><span>Last changed</span><b>{last.by}{last.at ? ` on ${fmtDate(last.at)}` : ''}{last.prev ? ` (was ${fmtDate(last.prev)})` : ''}</b></div>}
                        <div className="st-row">
                            <span>New meeting date</span>
                            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <input type="date" value={dateInput} min={`${yr - 1}-01-01`} max={`${yr + 2}-12-31`} onChange={(e) => { setDateInput(e.target.value); setPreview(null); setChecked(false); setMeetMsg({ ok: true, text: '' }); }} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d0d5dd' }} />
                                <button type="button" className="btn btn-blue" disabled={!dateInput || busy} onClick={() => sendDate(false)}>Check date</button>
                            </span>
                        </div>
                        {preview && (
                            <div className="msg" style={{ background: '#FEF0C7', color: '#93370D' }}>
                                <p style={{ margin: '0 0 8px' }}>
                                    Meeting date will change from <b>{preview.current.date ? fmtDate(preview.current.date) : "today's date"}</b> to <b>{words(preview.proposed.date)}</b>.
                                    Retired members: <b>{preview.current.retired}</b> → <b>{preview.proposed.retired}</b>.
                                </p>
                                {preview.warnings && preview.warnings.length > 0 && (
                                    <ul style={{ margin: '0 0 8px', paddingLeft: 18, color: '#B42318', fontWeight: 600 }}>
                                        {preview.warnings.map((w) => <li key={w}>{w}</li>)}
                                    </ul>
                                )}
                                <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '0 0 10px' }}>
                                    <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                                    I have checked: the meeting date is {words(preview.proposed.date)}{preview.warnings && preview.warnings.length > 0 ? ', and I accept the warning above' : ''}.
                                </label>
                                <button type="button" className="btn btn-green" disabled={busy || !checked} onClick={() => sendDate(true)}>Confirm and start</button>{' '}
                                <button type="button" className="btn btn-gray" disabled={busy} onClick={() => { setPreview(null); setChecked(false); }}>Cancel</button>
                            </div>
                        )}
                        {meetMsg.text && <div className={`msg ${meetMsg.ok ? 'msg-ok' : 'msg-err'}`}>{meetMsg.text}</div>}
                    </section>
                )}

                <section className="st-card">
                    <h2>Login and security</h2>
                    <p>You log in with your mobile number and an OTP on WhatsApp. No password is used.</p>
                    <div className="st-row"><span>You stay logged in on this device for</span><b>7 days</b></div>
                    <div className="st-row"><span>Log out from this device now</span><button type="button" className="btn btn-red" onClick={() => { clearSession(); router.push('/'); }}>Logout</button></div>
                </section>

                <section className="st-card">
                    <h2>Display</h2>
                    <p>How dates look on every screen.</p>
                    <div className="st-row"><span>Date format</span><b>DD/MM/YYYY (Indian)</b></div>
                </section>
            </div>
        </div>
    );
}
