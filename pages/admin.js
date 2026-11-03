import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import StatCard from '../components/StatCard';
import AddMemberModal from '../components/AddMemberModal';
import { authFetch, getToken, getUser, saveUser } from '../lib/session';
import {
    IconUsers, IconClock, IconCheck, IconX, IconHourglass, IconFile, IconStar,
    IconGrid, IconUpload, IconUserPlus, IconTrash,
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
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [addOpen, setAddOpen] = useState(false);
    const [importMode, setImportMode] = useState('update');

    const admin = user && user.role === 'admin';

    const fetchStats = async () => {
        try {
            const res = await authFetch('/api/stats');
            const data = await res.json();
            if (data.success) setStats(data.stats);
        } catch { /* 401 par authFetch redirect kar deta hai */ }
    };

    useEffect(() => {
        if (!getToken()) {
            router.push('/');
            return;
        }
        // Purane login (user info ke bina) ko admin maan lo; server phir bhi check karta hai
        setUser(getUser() || { role: 'admin', name: 'Admin' });
        fetchStats();

        // The role can change after login (someone made you admin): ask the server and refresh
        (async () => {
            try {
                const res = await authFetch('/api/me');
                const data = await res.json();
                if (data.success && data.user) {
                    saveUser(data.user);
                    setUser(data.user);
                }
            } catch { /* 401 par authFetch login par bhej deta hai */ }
        })();
    }, []);

    const handleImportFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImporting(true);
        setImportResult(null);
        try {
            const text = await file.text();
            // 1) a preview first: nothing is saved yet
            const pre = await (await authFetch('/api/import-members', { method: 'POST', body: { csv: text, dryRun: true, mode: importMode } })).json();
            if (!pre.success) {
                setImportResult(pre);
            } else {
                const lines = [
                    `This file has ${pre.total} rows.`,
                    `${pre.added} new members will be ADDED`,
                    pre.mode === 'fill'
                        ? `${pre.updated} existing members will get their EMPTY fields filled`
                        : `${pre.updated} existing members will be UPDATED`,
                    `${pre.unchanged} existing members have nothing new (not touched)`,
                    `${pre.skipped} rows will be SKIPPED (duplicate or invalid)`,
                ];
                if (pre.changeSummary && pre.changeSummary.length) {
                    lines.push('', 'What will change in the existing members:');
                    pre.changeSummary.forEach((c) => lines.push(`  ${c.field}: ${c.count} members`));
                }
                if (pre.mode === 'fill' && pre.kept) {
                    lines.push('', `${pre.kept} values in the file differ from the dashboard. They are KEPT as in the dashboard (safe mode):`);
                    pre.keptSummary.forEach((c) => lines.push(`  ${c.field}: ${c.count}`));
                }
                lines.push('', 'Continue?');
                // 2) only after the admin says OK
                if (window.confirm(lines.join('\n'))) {
                    const res = await authFetch('/api/import-members', { method: 'POST', body: { csv: text, mode: importMode } });
                    const data = await res.json();
                    setImportResult(data);
                    if (data.success) await fetchStats();
                } else {
                    setImportResult({ success: false, message: 'Import cancelled. Nothing was saved.' });
                }
            }
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
            <Head><title>Dashboard</title></Head>
            <div className="td-layout td-layout-solo">
                <main className="td-main">
                    <header className="td-header">
                        <div className="td-header-title">
                            <span className="td-icon-chip td-icon-chip-solid"><IconGrid size={26} /></span>
                            <div>
                                <h1>Dashboard</h1>
                                <p>{admin ? 'Members ka status ek jagah' : `Welcome, ${user.name}`}</p>
                            </div>
                        </div>
                        <div className="td-header-actions">
                            {admin && (
                                <select className="filter-sel" aria-label="Import mode" value={importMode} onChange={(e) => setImportMode(e.target.value)} disabled={importing}>
                                    <option value="update">Import: add new + update same entries</option>
                                    <option value="fill">Import: add new + only fill blanks (safer)</option>
                                </select>
                            )}
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
                        </div>
                    </header>

                    {importResult && (
                        <div className={`msg ${importResult.success ? 'msg-ok' : 'msg-err'}`}>
                            {importResult.success
                                ? `Import done: ${importResult.added} added, ${importResult.updated} updated, ${importResult.unchanged} had nothing new, ${importResult.skipped} skipped (${importResult.total} rows in the file).`
                                : importResult.message}
                            {[
                                ['Updated: what changed', importResult.updatedList],
                                ['Kept as in the dashboard (the file had a different value)', importResult.keptList],
                                ['Skipped (nothing was added or changed for these rows)', importResult.skippedList],
                                ['Notes', importResult.warnings],
                                ['Errors', importResult.errors],
                            ].filter(([, list]) => list && list.length > 0).map(([title, list]) => (
                                <details key={title} style={{ marginTop: 8 }}>
                                    <summary style={{ cursor: 'pointer' }}>{title}: {list.length}</summary>
                                    <ul style={{ margin: '8px 0 0', paddingLeft: 20, maxHeight: 260, overflowY: 'auto' }}>
                                        {list.map((e, i) => <li key={i}>{e}</li>)}
                                    </ul>
                                </details>
                            ))}
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
                onAdded={() => window.dispatchEvent(new Event('team-changed'))}
            />
        </div>
    );
}
