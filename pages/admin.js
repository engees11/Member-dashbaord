import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import StatCard from '../components/StatCard';
import TeamSidebar from '../components/TeamSidebar';
import AddMemberModal from '../components/AddMemberModal';
import NotificationBell from '../components/NotificationBell';
import { authFetch, clearSession, getToken, getUser } from '../lib/session';
import {
    IconUsers, IconClock, IconCheck, IconX, IconHourglass, IconFile, IconStar,
    IconGrid, IconUpload, IconUserPlus, IconLogout, IconTrash,
} from '../components/Icons';

const CARDS = [
    { key: 'total', status: 'all', title: 'Total Members', variant: 'total', Icon: IconUsers },
    { key: 'pending', status: 'pending', title: 'Pending', variant: 'pending', Icon: IconClock },
    { key: 'approved', status: 'approved', title: 'Approved', variant: 'approved', Icon: IconCheck },
    { key: 'rejected', status: 'rejected', title: 'Rejected', variant: 'rejected', Icon: IconX },
    { key: 'expired', status: 'expired', title: 'Expired', variant: 'expired', Icon: IconHourglass },
    { key: 'new', status: 'new', title: 'New', variant: 'new', Icon: IconFile },
    { key: 'needReview', status: 'need_review', title: 'Need Review', variant: 'review', Icon: IconStar },
    { key: 'deleted', href: '/admin/deleted', title: 'Deleted', variant: 'deleted', Icon: IconTrash, adminOnly: true },
];

export default function Admin() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [team, setTeam] = useState([]);
    const [teamLoading, setTeamLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [addOpen, setAddOpen] = useState(false);

    const admin = user && user.role === 'admin';

    const fetchStats = async () => {
        try {
            const res = await authFetch('/api/stats');
            const data = await res.json();
            if (data.success) setStats(data.stats);
        } catch { /* 401 par authFetch redirect kar deta hai */ }
    };

    const fetchTeam = async () => {
        setTeamLoading(true);
        try {
            const res = await authFetch('/api/team');
            const data = await res.json();
            if (data.success) setTeam(data.team);
        } catch { /* ignore */ }
        setTeamLoading(false);
    };

    useEffect(() => {
        if (!getToken()) {
            router.push('/');
            return;
        }
        // Purane login (user info ke bina) ko admin maan lo; server phir bhi check karta hai
        const u = getUser() || { role: 'admin', name: 'Admin' };
        setUser(u);
        fetchStats();
        if (u.role === 'admin') fetchTeam();
    }, []);

    const logout = () => {
        clearSession();
        router.push('/');
    };

    const handleImportFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImporting(true);
        setImportResult(null);
        try {
            const text = await file.text();
            const res = await authFetch('/api/import-members', { method: 'POST', body: { csv: text } });
            const data = await res.json();
            setImportResult(data);
            if (data.success) await fetchStats();
        } catch (err) {
            if (err.message !== 'Session expired') {
                setImportResult({ success: false, message: 'File read ya upload nahi hui: ' + err.message });
            }
        }
        setImporting(false);
        e.target.value = '';
    };

    if (!user) return null;

    return (
        <div className="td-page">
            <Head><title>Team Management Dashboard</title></Head>
            <div className="td-layout">
                {admin && <TeamSidebar team={team} loading={teamLoading} />}

                <main className="td-main">
                    <header className="td-header">
                        <div className="td-header-title">
                            <span className="td-icon-chip td-icon-chip-solid"><IconGrid size={26} /></span>
                            <div>
                                <h1>Team Management Dashboard</h1>
                                <p>{admin ? 'Team members aur unka kaam ek jagah' : `Welcome, ${user.name}`}</p>
                            </div>
                        </div>
                        <div className="td-header-actions">
                            {admin && (
                                <label className={`td-btn td-btn-soft ${importing ? 'is-busy' : ''}`}>
                                    <IconUpload size={18} />
                                    {importing ? 'Importing...' : 'Import CSV'}
                                    <input type="file" accept=".csv" className="td-hidden-input" onChange={handleImportFile} disabled={importing} />
                                </label>
                            )}
                            {admin && (
                                <button type="button" className="td-btn td-btn-soft" onClick={() => setAddOpen(true)}>
                                    <IconUserPlus size={18} />
                                    Add Team Member
                                </button>
                            )}
                            <NotificationBell />
                            <button type="button" className="td-btn td-btn-gray" onClick={logout}>
                                <IconLogout size={18} />
                                Logout
                            </button>
                        </div>
                    </header>

                    {importResult && (
                        <div className={`msg ${importResult.success ? 'msg-ok' : 'msg-err'}`}>
                            {importResult.success
                                ? `Import done: ${importResult.inserted} added/updated, ${importResult.skipped} skipped, total ${importResult.total}.`
                                : importResult.message}
                            {importResult.errors && importResult.errors.length > 0 && (
                                <details style={{ marginTop: 8 }}>
                                    <summary style={{ cursor: 'pointer' }}>Details dekho</summary>
                                    <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                                        {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                                    </ul>
                                </details>
                            )}
                        </div>
                    )}

                    <section className="td-stats" aria-label="Member status">
                        {CARDS.filter((c) => !c.adminOnly || admin).map(({ key, status, href, title, variant, Icon }) => (
                            <StatCard
                                key={key}
                                title={title}
                                variant={variant}
                                value={stats ? stats[key] : '-'}
                                icon={<Icon />}
                                onClick={() => router.push(href || `/admin/members?status=${status}`)}
                            />
                        ))}
                    </section>
                </main>
            </div>

            <AddMemberModal
                open={addOpen}
                onClose={() => setAddOpen(false)}
                onAdded={() => fetchTeam()}
            />
        </div>
    );
}
