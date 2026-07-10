import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import StatCard from '../components/StatCard';

const LABELS = {
    not_submitted: 'Form Pending',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    expired: 'Expired',
};

export default function Admin() {
    const router = useRouter();
    const [members, setMembers] = useState([]);
    const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, expired: 0 });
    const [filter, setFilter] = useState(null);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);

    const token = () => localStorage.getItem('admin_token');

    const fetchData = async () => {
        setLoading(true);
        const res = await fetch('/api/members', {
            headers: { Authorization: `Bearer ${token()}` },
        });
        if (res.status === 401) return router.push('/login');
        const data = await res.json();
        if (data.success) {
            setMembers(data.members);
            setStats(data.stats);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!localStorage.getItem('admin_token')) return router.push('/login');
        fetchData();
    }, []);

    const updateStatus = async (id, status) => {
        if (status === 'rejected' && !confirm('Pakka reject karna hai?')) return;
        const res = await fetch('/api/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
            body: JSON.stringify({ id, status }),
        });
        const data = await res.json();
        if (data.success) {
            setSelected(null);
            fetchData();
        } else alert(data.message);
    };

    const logout = () => {
        localStorage.removeItem('admin_token');
        router.push('/login');
    };

    const filtered = members.filter((m) => {
        if (filter && m.effective_status !== filter) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                (m.full_name || '').toLowerCase().includes(q) ||
                (m.phone || '').includes(q) ||
                (m.email || '').toLowerCase().includes(q)
            );
        }
        return true;
    });

    const toggleFilter = (f) => setFilter(filter === f ? null : f);

    return (
        <div className="page">
            <div className="topbar">
                <div>
                    <h1>Member Dashboard</h1>
                    <p>Sab members ka live status ek jagah</p>
                </div>
                <button className="btn btn-gray" onClick={logout}>Logout</button>
            </div>

            <div className="stats-row">
                <StatCard title="Total Members" value={stats.total} variant="total" active={filter === null} onClick={() => setFilter(null)} />
                <StatCard title="Pending" value={stats.pending} variant="pending" active={filter === 'pending'} onClick={() => toggleFilter('pending')} />
                <StatCard title="Approved" value={stats.approved} variant="approved" active={filter === 'approved'} onClick={() => toggleFilter('approved')} />
                <StatCard title="Rejected" value={stats.rejected} variant="rejected" active={filter === 'rejected'} onClick={() => toggleFilter('rejected')} />
                <StatCard title="Expired" value={stats.expired} variant="expired" active={filter === 'expired'} onClick={() => toggleFilter('expired')} />
            </div>

            {selected && (
                <div className="table-card detail-view" style={{ marginBottom: 24 }}>
                    <div className="table-head">
                        <div>
                            <h3>{selected.full_name || 'Member Detail'}</h3>
                            <p>Pura record + document</p>
                        </div>
                        <button className="btn btn-gray btn-sm" onClick={() => setSelected(null)}>Back</button>
                    </div>
                    <div className="detail-grid">
                        <div className="item"><b>Name</b>{selected.full_name || '-'}</div>
                        <div className="item"><b>DOB</b>{selected.dob || '-'} {selected.age !== null && `(${selected.age} yrs)`}</div>
                        <div className="item"><b>Phone</b>{selected.phone}</div>
                        <div className="item"><b>Email</b>{selected.email || '-'}</div>
                        <div className="item"><b>Address</b>{selected.address || '-'}</div>
                        <div className="item"><b>Type</b>{selected.member_type}</div>
                        <div className="item"><b>Status</b><span className={`badge b-${selected.effective_status}`}>{LABELS[selected.effective_status]}</span></div>
                        <div className="item"><b>Document</b>
                            {selected.document_url
                                ? <a href={selected.document_url} target="_blank" rel="noreferrer">View Document</a>
                                : 'Not uploaded'}
                        </div>
                    </div>
                    <div style={{ padding: '0 26px 24px', display: 'flex', gap: 12 }}>
                        <button className="btn btn-green" disabled={selected.status === 'approved'}
                            onClick={() => updateStatus(selected.id, 'approved')}>Approve</button>
                        <button className="btn btn-red" disabled={selected.status === 'rejected'}
                            onClick={() => updateStatus(selected.id, 'rejected')}>Reject</button>
                        {selected.status !== 'pending' && (
                            <button className="btn btn-gray" onClick={() => updateStatus(selected.id, 'pending')}>Mark Pending</button>
                        )}
                    </div>
                </div>
            )}

            <div className="table-card">
                <div className="table-head">
                    <div>
                        <h3>Members {filter ? `— ${LABELS[filter]}` : ''}</h3>
                        <p>{filtered.length} records</p>
                    </div>
                    <input className="searchbar" placeholder="Search name / phone / email"
                        value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th><th>Phone</th><th>DOB</th><th>Type</th><th>Status</th><th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="empty">Loading...</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="empty">No records found.</td></tr>
                            ) : (
                                filtered.map((m) => (
                                    <tr key={m.id}>
                                        <td>{m.full_name || '-'}</td>
                                        <td>{m.phone}</td>
                                        <td>{m.dob || '-'}</td>
                                        <td>{m.member_type}</td>
                                        <td><span className={`badge b-${m.effective_status}`}>{LABELS[m.effective_status]}</span></td>
                                        <td><button className="btn btn-blue btn-sm" onClick={() => setSelected(m)}>View</button></td>
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