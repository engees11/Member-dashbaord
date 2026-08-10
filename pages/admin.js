import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import StatCard from '../components/StatCard';

export default function Admin() {
    const router = useRouter();
    const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, expired: 0, new: 0, needReview: 0 });
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);

    const token = () => localStorage.getItem('admin_token');

    const fetchStats = async () => {
        const res = await fetch('/api/stats', { headers: { Authorization: `Bearer ${token()}` } });
        if (res.status === 401) return router.push('/');
        const data = await res.json();
        if (data.success) setStats(data.stats);
        setLoading(false);
    };

    useEffect(() => {
        if (!localStorage.getItem('admin_token')) return router.push('/');
        fetchStats();
    }, []);

    const logout = () => {
        localStorage.removeItem('admin_token');
        router.push('/');
    };

    const goTo = (status) => router.push(`/admin/members?status=${status}`);

    const handleImportFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImporting(true);
        setImportResult(null);
        try {
            const text = await file.text();
            const res = await fetch('/api/import-members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
                body: JSON.stringify({ csv: text }),
            });
            const data = await res.json();
            setImportResult(data);
            if (data.success) await fetchStats();
        } catch (err) {
            setImportResult({ success: false, message: 'Failed to read or upload file: ' + err.message });
        }
        setImporting(false);
        e.target.value = '';
    };

    return (
        <div className="page">
            <div className="topbar">
                <div>
                    <h1>Member Dashboard</h1>
                    <p>Live status of all members in one place</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <label className="btn btn-blue" style={{ cursor: 'pointer', margin: 0 }}>
                        {importing ? 'Importing...' : 'Import CSV'}
                        <input
                            type="file"
                            accept=".csv"
                            style={{ display: 'none' }}
                            onChange={handleImportFile}
                            disabled={importing}
                        />
                    </label>
                    <button className="btn btn-gray" onClick={logout}>Logout</button>
                </div>
            </div>

            {importResult && (
                <div className={`msg ${importResult.success ? 'msg-ok' : 'msg-err'}`} style={{ marginBottom: 16 }}>
                    {importResult.success
                        ? `Import done: ${importResult.inserted} added, ${importResult.updated || 0} updated, ${importResult.skipped} skipped out of ${importResult.total}.`
                        : importResult.message}
                    {importResult.errors && importResult.errors.length > 0 && (
                        <details style={{ marginTop: 8 }}>
                            <summary style={{ cursor: 'pointer' }}>Show details</summary>
                            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                                {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </details>
                    )}
                </div>
            )}

            <div className="stats-row">
                <StatCard title="Total Members" value={loading ? '-' : stats.total} variant="total" onClick={() => goTo('all')} />
                <StatCard title="Pending" value={loading ? '-' : stats.pending} variant="pending" onClick={() => goTo('pending')} />
                <StatCard title="Approved" value={loading ? '-' : stats.approved} variant="approved" onClick={() => goTo('approved')} />
                <StatCard title="Rejected" value={loading ? '-' : stats.rejected} variant="rejected" onClick={() => goTo('rejected')} />
                <StatCard title="Expired" value={loading ? '-' : stats.expired} variant="expired" onClick={() => goTo('expired')} />
                <StatCard title="New" value={loading ? '-' : stats.new} variant="new" onClick={() => goTo('new')} />
                <StatCard title="Need Review" value={loading ? '-' : stats.needReview} variant="needreview" onClick={() => goTo('need_review')} />
            </div>

            <div className="table-card">
                <div className="empty" style={{ padding: 60 }}>
                    Click a status card above to view that list of members.
                </div>
            </div>
        </div>
    );
}