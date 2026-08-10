import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

const LABELS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', expired: 'Expired', new: 'New', need_review: 'Need Review' };
const fullName = (m) => [m.first_name, m.father_name, m.last_name].filter(Boolean).join(' ');
const rowType = (m) => m.form_type || 'not_submitted';

export default function MembersList() {
    const router = useRouter();
    const status = router.query.status || 'all';

    const [members, setMembers] = useState([]);
    const [tab, setTab] = useState('aadhaar_update');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionMsg, setActionMsg] = useState('');

    const token = () => localStorage.getItem('admin_token');

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/members', { headers: { Authorization: `Bearer ${token()}` } });
            if (res.status === 401) return router.push('/');
            const data = await res.json();
            if (data.success) setMembers(data.members);
        } catch {
            setActionMsg('Could not load members. Check your connection.');
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!localStorage.getItem('admin_token')) return router.push('/');
        fetchData();
    }, []);

    const updateStatus = async (id, newStatus) => {
        if (newStatus === 'rejected' && !confirm('Are you sure you want to reject this member?')) return;
        setActionMsg('');
        try {
            const res = await fetch('/api/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
                body: JSON.stringify({ id, status: newStatus }),
            });
            const data = await res.json();
            if (data.success) {
                setSelected((prev) => (prev ? { ...prev, status: newStatus } : prev));
                await fetchData();
            } else {
                setActionMsg(data.message || 'Could not update status.');
            }
        } catch {
            setActionMsg('Network error while updating status.');
        }
    };

    const deleteMember = async (id) => {
        if (!confirm('This will permanently delete this member. Are you sure?')) return;
        setActionMsg('');
        try {
            const res = await fetch('/api/delete-member', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
                body: JSON.stringify({ id }),
            });
            const data = await res.json();
            if (data.success) {
                setSelected(null);
                await fetchData();
            } else {
                setActionMsg(data.message || 'Could not delete member.');
            }
        } catch {
            setActionMsg('Network error while deleting member.');
        }
    };

    const byStatus = members.filter((m) => status === 'all' || m.status === status);
    const byTab = byStatus.filter((m) => rowType(m) === tab);
    const filtered = byTab.filter((m) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            fullName(m).toLowerCase().includes(q) ||
            (m.whatsapp_number || '').includes(q) ||
            (m.email || '').toLowerCase().includes(q)
        );
    });

    const aadhaarCount = byStatus.filter((m) => rowType(m) === 'aadhaar_update').length;
    const detailsCount = byStatus.filter((m) => rowType(m) === 'details_update').length;
    const notSubmittedCount = byStatus.filter((m) => rowType(m) === 'not_submitted').length;

    return (
        <div className="page">
            <div className="topbar">
                <div>
                    <h1>{status === 'all' ? 'All members' : `${LABELS[status]} members`}</h1>
                    <p>{byStatus.length} total in this status</p>
                </div>
                <button className="btn btn-gray" onClick={() => router.push('/admin')}>Back to dashboard</button>
            </div>

            {actionMsg && <div className="msg msg-err" style={{ marginBottom: 16 }}>{actionMsg}</div>}

            {selected && (
                <div className="table-card detail-view" style={{ marginBottom: 24 }}>
                    <div className="table-head">
                        <div>
                            <h3>{fullName(selected) || selected.email || 'Member detail'}</h3>
                            <p>Full record and Aadhaar images</p>
                        </div>
                        <button className="btn btn-gray btn-sm" onClick={() => setSelected(null)}>Back</button>
                    </div>
                    <div className="detail-grid">
                        {rowType(selected) !== 'aadhaar_update' && (
                            <>
                                <div className="item"><b>First name</b>{selected.first_name || '-'}</div>
                                <div className="item"><b>Father name</b>{selected.father_name || '-'}</div>
                                <div className="item"><b>Last name</b>{selected.last_name || '-'}</div>
                                <div className="item"><b>Birth date</b>{selected.birth_date || '-'}</div>
                                <div className="item"><b>Native place</b>{selected.native_place || '-'}</div>
                                <div className="item"><b>Address</b>{selected.address || '-'}</div>
                                <div className="item"><b>Area</b>{selected.area || '-'}</div>
                            </>
                        )}
                        <div className="item"><b>Email</b>{selected.email || '-'}</div>
                        <div className="item"><b>WhatsApp number</b>{selected.whatsapp_number || '-'}</div>
                        <div className="item"><b>Aadhaar number</b>{selected.aadhaar_number || '-'}</div>
                        <div className="item"><b>Status</b><span className={`badge b-${selected.status}`}>{LABELS[selected.status] || selected.status}</span></div>
                        <div className="item"><b>Aadhaar front</b>{selected.aadhaar_front_url ? <a href={selected.aadhaar_front_url} target="_blank" rel="noreferrer">View image</a> : 'Not uploaded'}</div>
                        <div className="item"><b>Aadhaar back</b>{selected.aadhaar_back_url ? <a href={selected.aadhaar_back_url} target="_blank" rel="noreferrer">View image</a> : 'Not uploaded'}</div>
                    </div>
                    <div style={{ padding: '0 26px 24px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button className="btn btn-green" disabled={selected.status === 'approved'} onClick={() => updateStatus(selected.id, 'approved')}>Approve</button>
                        <button className="btn btn-red" disabled={selected.status === 'rejected'} onClick={() => updateStatus(selected.id, 'rejected')}>Reject</button>
                        <button className="btn btn-gray" disabled={selected.status === 'expired'} onClick={() => updateStatus(selected.id, 'expired')}>Mark expired</button>
                        <button className="btn btn-gray" disabled={selected.status === 'need_review'} onClick={() => updateStatus(selected.id, 'need_review')}>Need Review</button>
                        {selected.status !== 'pending' && (
                            <button className="btn btn-gray" onClick={() => updateStatus(selected.id, 'pending')}>Mark pending</button>
                        )}
                        <button className="btn btn-red" onClick={() => deleteMember(selected.id)} style={{ marginLeft: 'auto' }}>Delete member</button>
                    </div>
                </div>
            )}

            <div className="table-card">
                <div className="table-head" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                                className={tab === 'aadhaar_update' ? 'btn btn-blue btn-sm' : 'btn btn-gray btn-sm'}
                                onClick={() => setTab('aadhaar_update')}
                            >
                                Aadhaar Update ({aadhaarCount})
                            </button>
                            <button
                                className={tab === 'details_update' ? 'btn btn-blue btn-sm' : 'btn btn-gray btn-sm'}
                                onClick={() => setTab('details_update')}
                            >
                                Details Update ({detailsCount})
                            </button>
                            <button
                                className={tab === 'not_submitted' ? 'btn btn-blue btn-sm' : 'btn btn-gray btn-sm'}
                                onClick={() => setTab('not_submitted')}
                            >
                                Not Submitted ({notSubmittedCount})
                            </button>
                        </div>
                        <input className="searchbar" placeholder="Search name / whatsapp / email" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{filtered.length} records</p>
                </div>

                <div className="table-wrap">
                    {tab === 'aadhaar_update' && (
                        <table>
                            <thead>
                                <tr><th>Email</th><th>WhatsApp number</th><th>Submitted date</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} className="empty">Loading...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={5} className="empty">No records found.</td></tr>
                                ) : (
                                    filtered.map((m) => (
                                        <tr key={m.id}>
                                            <td>{m.email || '-'}</td>
                                            <td>{m.whatsapp_number || '-'}</td>
                                            <td>{m.submitted_at ? new Date(m.submitted_at).toLocaleDateString() : (m.created_at ? new Date(m.created_at).toLocaleDateString() : '-')}</td>
                                            <td><span className={`badge b-${m.status}`}>{LABELS[m.status] || m.status}</span></td>
                                            <td><button className="btn btn-blue btn-sm" onClick={() => setSelected(m)}>View</button></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}

                    {tab === 'details_update' && (
                        <table>
                            <thead>
                                <tr><th>Name</th><th>WhatsApp number</th><th>Email</th><th>Birth date</th><th>Area</th><th>Aadhaar number</th><th>Submitted date</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={9} className="empty">Loading...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={9} className="empty">No records found.</td></tr>
                                ) : (
                                    filtered.map((m) => (
                                        <tr key={m.id}>
                                            <td>{fullName(m) || '-'}</td>
                                            <td>{m.whatsapp_number || '-'}</td>
                                            <td>{m.email || '-'}</td>
                                            <td>{m.birth_date || '-'}</td>
                                            <td>{m.area || '-'}</td>
                                            <td>{m.aadhaar_number || '-'}</td>
                                            <td>{m.submitted_at ? new Date(m.submitted_at).toLocaleDateString() : (m.created_at ? new Date(m.created_at).toLocaleDateString() : '-')}</td>
                                            <td><span className={`badge b-${m.status}`}>{LABELS[m.status] || m.status}</span></td>
                                            <td><button className="btn btn-blue btn-sm" onClick={() => setSelected(m)}>View</button></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}

                    {tab === 'not_submitted' && (
                        <table>
                            <thead>
                                <tr><th>Name</th><th>WhatsApp number</th><th>Native place</th><th>Area</th><th>Aadhaar number</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} className="empty">Loading...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={7} className="empty">No records found.</td></tr>
                                ) : (
                                    filtered.map((m) => (
                                        <tr key={m.id}>
                                            <td>{fullName(m) || '-'}</td>
                                            <td>{m.whatsapp_number || '-'}</td>
                                            <td>{m.native_place || '-'}</td>
                                            <td>{m.area || '-'}</td>
                                            <td>{m.aadhaar_number || '-'}</td>
                                            <td><span className={`badge b-${m.status}`}>{LABELS[m.status] || m.status}</span></td>
                                            <td><button className="btn btn-blue btn-sm" onClick={() => setSelected(m)}>View</button></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}