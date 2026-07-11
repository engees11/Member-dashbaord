import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import StatCard from '../components/StatCard';

export default function Admin() {
    const router = useRouter();
    const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, expired: 0 });
    const [loading, setLoading] = useState(true);

    const token = () => localStorage.getItem('admin_token');

    useEffect(() => {
        if (!localStorage.getItem('admin_token')) return router.push('/');
        (async () => {
            const res = await fetch('/api/members', { headers: { Authorization: `Bearer ${token()}` } });
            if (res.status === 401) return router.push('/');
            const data = await res.json();
            if (data.success) setStats(data.stats);
            setLoading(false);
        })();
    }, []);

    const logout = () => {
        localStorage.removeItem('admin_token');
        router.push('/');
    };

    const goTo = (status) => router.push(`/admin/members?status=${status}`);

    return (
        <div className="page">
            <div className="topbar">
                <div>
                    <h1>Member Dashboard</h1>
                    <p>Live status of all members in one place</p>
                </div>
                <button className="btn btn-gray" onClick={logout}>Logout</button>
            </div>

            <div className="stats-row">
                <StatCard title="Total Members" value={loading ? '-' : stats.total} variant="total" onClick={() => goTo('all')} />
                <StatCard title="Pending" value={loading ? '-' : stats.pending} variant="pending" onClick={() => goTo('pending')} />
                <StatCard title="Approved" value={loading ? '-' : stats.approved} variant="approved" onClick={() => goTo('approved')} />
                <StatCard title="Rejected" value={loading ? '-' : stats.rejected} variant="rejected" onClick={() => goTo('rejected')} />
                <StatCard title="Expired" value={loading ? '-' : stats.expired} variant="expired" onClick={() => goTo('expired')} />
            </div>

            <div className="table-card">
                <div className="empty" style={{ padding: 60 }}>
                    Click a status card above to view that list of members.
                </div>
            </div>
        </div>
    );
}