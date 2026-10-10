import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { authFetch, getToken, getUser } from '../../lib/session';

const LABELS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', expired: 'Expired', new: 'New', need_review: 'Need Review' };
const fullName = (m) => [m.first_name, m.father_name, m.last_name].filter(Boolean).join(' ');
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-');

export default function DeletedMembers() {
    const router = useRouter();
    const [members, setMembers] = useState([]);
    const [team, setTeam] = useState([]);
    const [loading, setLoading] = useState(true);
    const [needsSetup, setNeedsSetup] = useState(false);
    const [search, setSearch] = useState('');
    const [err, setErr] = useState('');
    const [busyId, setBusyId] = useState(null);

    const load = async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await authFetch('/api/deleted-members');
            const data = await res.json();
            if (data.success) {
                setMembers(data.members);
                setTeam(data.team || []);
                setNeedsSetup(!!data.needsSetup);
            } else {
                setErr(data.message || 'Could not load the Deleted list');
            }
        } catch (e) {
            if (e.message !== 'Session expired') setErr('Could not load the Deleted list. Check your connection.');
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!getToken()) { router.push('/'); return; }
        const u = getUser() || { role: 'admin' };
        if (u.role !== 'admin') { router.push('/admin'); return; }
        load();
    }, []);

    const restoreMember = async (m) => {
        if (!confirm(`Restore ${fullName(m) || m.whatsapp_number}? They will come back with the same status and data.`)) return;
        setBusyId(m.id);
        setErr('');
        try {
            const res = await authFetch('/api/restore-member', { method: 'POST', body: { id: m.id } });
            const data = await res.json();
            if (data.success) setMembers((list) => list.filter((x) => x.id !== m.id));
            else setErr(data.message || 'Could not restore this member');
        } catch (e) {
            if (e.message !== 'Session expired') setErr('Network error, please try again.');
        }
        setBusyId(null);
    };

    const restoreTeam = async (m) => {
        if (!confirm(`Restore ${m.name}? They can log in again.`)) return;
        setBusyId(m.id);
        setErr('');
        try {
            const res = await authFetch(`/api/team/${m.id}`, { method: 'POST', body: { action: 'restore' } });
            const data = await res.json();
            if (data.success) setTeam((list) => list.filter((x) => x.id !== m.id));
            else setErr(data.message || 'Could not restore this team member');
        } catch (e) {
            if (e.message !== 'Session expired') setErr('Network error, please try again.');
        }
        setBusyId(null);
    };

    const q = search.trim().toLowerCase();
    const shownMembers = members.filter((m) => !q || fullName(m).toLowerCase().includes(q) || (m.whatsapp_number || '').includes(q));
    const shownTeam = team.filter((m) => !q || String(m.name).toLowerCase().includes(q) || (m.phone || '').includes(q));

    return (
        <div className="page">
            <Head><title>Deleted</title></Head>
            <div className="topbar">
                <div>
                    <h1>Deleted</h1>
                    <p>{members.length} members and {team.length} team members. Restore brings them back with the same data.</p>
                </div>
                <button className="btn btn-gray" onClick={() => router.push('/admin')}>Back to dashboard</button>
            </div>

            {err && <div className="msg msg-err" style={{ marginBottom: 16 }}>{err}</div>}
            {needsSetup && (
                <div className="msg msg-err" style={{ marginBottom: 16 }}>
                    Delete &amp; Restore for members needs one database update. Run <b>supabase/soft-delete.sql</b> in the Supabase SQL Editor.
                </div>
            )}

            <div className="table-card" style={{ marginBottom: 24 }}>
                <div className="table-head">
                    <h3 style={{ margin: 0 }}>Members</h3>
                    <input className="searchbar" placeholder="Search name / number" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr><th>Name</th><th>Mobile number</th><th>Area</th><th>Status when deleted</th><th>Deleted on</th><th>Deleted by</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="empty">Loading...</td></tr>
                            ) : shownMembers.length === 0 ? (
                                <tr><td colSpan={7} className="empty">No deleted members.</td></tr>
                            ) : (
                                shownMembers.map((m) => (
                                    <tr key={m.id}>
                                        <td>{fullName(m) || '-'}</td>
                                        <td>{m.whatsapp_number || '-'}</td>
                                        <td>{m.area || '-'}</td>
                                        <td><span className={`badge b-${m.status}`}>{LABELS[m.status] || m.status || '-'}</span></td>
                                        <td>{when(m.deleted_at)}</td>
                                        <td>{m.deleted_by_name || '-'}</td>
                                        <td>
                                            <button className="btn btn-green btn-sm" disabled={busyId === m.id} onClick={() => restoreMember(m)}>
                                                {busyId === m.id ? 'Restoring...' : 'Restore'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="table-card">
                <div className="table-head">
                    <h3 style={{ margin: 0 }}>Team members</h3>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr><th>Name</th><th>Mobile number</th><th>Role</th><th>Deleted on</th><th>Deleted by</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="empty">Loading...</td></tr>
                            ) : shownTeam.length === 0 ? (
                                <tr><td colSpan={6} className="empty">No deleted team members.</td></tr>
                            ) : (
                                shownTeam.map((m) => (
                                    <tr key={m.id}>
                                        <td>{m.name}</td>
                                        <td>{m.phone || '-'}</td>
                                        <td>{m.role === 'admin' ? 'Admin' : 'Team member'}</td>
                                        <td>{when(m.deleted_at)}</td>
                                        <td>{m.deleted_by_name || '-'}</td>
                                        <td>
                                            <button className="btn btn-green btn-sm" disabled={busyId === m.id} onClick={() => restoreTeam(m)}>
                                                {busyId === m.id ? 'Restoring...' : 'Restore'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
