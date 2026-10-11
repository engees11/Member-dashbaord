import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getUser, clearSession } from '../../lib/session';
import MemberForm from '../../components/MemberForm';
import { fmtDate } from '../../lib/format';

const LABELS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', expired: 'Expired', new: 'New', need_review: 'Need Review' };
const fullName = (m) => [m.first_name, m.father_name, m.last_name].filter(Boolean).join(' ');
const rowType = (m) => m.form_type || 'not_submitted';

export default function MembersList() {
    const router = useRouter();
    const status = router.query.status || 'all';

    const [members, setMembers] = useState([]);
    const [tab, setTab] = useState('aadhaar_update');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [actionMsg, setActionMsg] = useState('');

    const token = () => localStorage.getItem('admin_token');

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/members', { headers: { Authorization: `Bearer ${token()}` } });
            if (res.status === 401) { clearSession(); return router.push('/'); }
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

    const isAdmin = () => (getUser() || { role: 'admin' }).role === 'admin';

    const [formOpen, setFormOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [withDeleted, setWithDeleted] = useState(false);
    const [exporting, setExporting] = useState(false);

    // the top bar search sends you here with ?q=...
    useEffect(() => {
        if (router.query.q !== undefined) setSearch(String(router.query.q));
    }, [router.query.q]);

    const doExport = async (format) => {
        setExporting(true);
        setActionMsg('');
        try {
            const res = await fetch(`/api/export-members?format=${format}&deleted=${withDeleted ? 1 : 0}`, {
                headers: { Authorization: `Bearer ${token()}` },
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                setActionMsg(j.message || 'Export failed.');
            } else {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `members-${new Date().toISOString().slice(0, 10)}.${format === 'csv' ? 'csv' : 'xlsx'}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                setExportOpen(false);
            }
        } catch (e) {
            setActionMsg('Export failed. Check your connection.');
        }
        setExporting(false);
    };

    const openMember = (m) => router.push(`/admin/members/${m.id}?from=${status}`);
    const editMember = (m) => { setEditTarget(m); setFormOpen(true); };
    const rowActions = (m) => (
        <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-blue btn-sm" onClick={() => openMember(m)}>View</button>
            <button className="btn btn-gray btn-sm" onClick={() => editMember(m)}>Edit</button>
        </div>
    );

    const byStatus = members.filter((m) => status === 'all' || m.status === status);
    const byTab = byStatus.filter((m) => rowType(m) === tab);
    const filtered = byTab.filter((m) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            fullName(m).toLowerCase().includes(q) ||
            (m.whatsapp_number || '').includes(q.replace(/\s/g, '')) ||
            (m.membership_no || '').toLowerCase().includes(q) ||
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
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {isAdmin() && (
                        <div style={{ position: 'relative' }}>
                            <button className="btn btn-gray" onClick={() => setExportOpen((o) => !o)}>Export</button>
                            {exportOpen && (
                                <div className="exp-pop">
                                    <b>Export all members</b>
                                    <label><input type="checkbox" checked={withDeleted} onChange={(e) => setWithDeleted(e.target.checked)} />Include deleted members</label>
                                    <div className="row">
                                        <button className="btn btn-blue btn-sm" disabled={exporting} onClick={() => doExport('xlsx')}>{exporting ? 'Preparing...' : 'Excel (.xlsx)'}</button>
                                        <button className="btn btn-gray btn-sm" disabled={exporting} onClick={() => doExport('csv')}>CSV</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {isAdmin() && <button className="btn btn-blue" onClick={() => { setEditTarget(null); setFormOpen(true); }}>Add Member</button>}
                    <button className="btn btn-gray" onClick={() => router.push('/admin')}>Back to dashboard</button>
                </div>
            </div>

            {actionMsg && <div className="msg msg-err" style={{ marginBottom: 16 }}>{actionMsg}</div>}

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
                        <input className="searchbar" placeholder="Search name, mobile, membership no." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{filtered.length} records</p>
                </div>

                <div className="table-wrap">
                    {tab === 'aadhaar_update' && (
                        <table>
                            <thead>
                                <tr><th>Mem. No.</th><th>Email</th><th>WhatsApp number</th><th>Submitted date</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} className="empty">Loading...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={6} className="empty">No records found.</td></tr>
                                ) : (
                                    filtered.map((m) => (
                                        <tr key={m.id}>
                                            <td><b>{m.membership_no || '-'}</b></td>
                                            <td>{m.email || '-'}</td>
                                            <td>{m.whatsapp_number || '-'}</td>
                                            <td>{m.submitted_at ? new Date(m.submitted_at).toLocaleDateString() : (m.created_at ? new Date(m.created_at).toLocaleDateString() : '-')}</td>
                                            <td><span className={`badge b-${m.status}`}>{LABELS[m.status] || m.status}</span></td>
                                            <td>{rowActions(m)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}

                    {tab === 'details_update' && (
                        <table>
                            <thead>
                                <tr><th>Mem. No.</th><th>Name</th><th>WhatsApp number</th><th>Email</th><th>Birth date</th><th>Area</th><th>Aadhaar number</th><th>Submitted date</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={10} className="empty">Loading...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={10} className="empty">No records found.</td></tr>
                                ) : (
                                    filtered.map((m) => (
                                        <tr key={m.id}>
                                            <td><b>{m.membership_no || '-'}</b></td>
                                            <td>{fullName(m) || '-'}</td>
                                            <td>{m.whatsapp_number || '-'}</td>
                                            <td>{m.email || '-'}</td>
                                            <td>{fmtDate(m.birth_date)}</td>
                                            <td>{m.area || '-'}</td>
                                            <td>{m.aadhaar_number || '-'}</td>
                                            <td>{m.submitted_at ? new Date(m.submitted_at).toLocaleDateString() : (m.created_at ? new Date(m.created_at).toLocaleDateString() : '-')}</td>
                                            <td><span className={`badge b-${m.status}`}>{LABELS[m.status] || m.status}</span></td>
                                            <td>{rowActions(m)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}

                    {tab === 'not_submitted' && (
                        <table>
                            <thead>
                                <tr><th>Mem. No.</th><th>Name</th><th>WhatsApp number</th><th>Native place</th><th>Area</th><th>Aadhaar number</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={8} className="empty">Loading...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={8} className="empty">No records found.</td></tr>
                                ) : (
                                    filtered.map((m) => (
                                        <tr key={m.id}>
                                            <td><b>{m.membership_no || '-'}</b></td>
                                            <td>{fullName(m) || '-'}</td>
                                            <td>{m.whatsapp_number || '-'}</td>
                                            <td>{m.native_place || '-'}</td>
                                            <td>{m.area || '-'}</td>
                                            <td>{m.aadhaar_number || '-'}</td>
                                            <td><span className={`badge b-${m.status}`}>{LABELS[m.status] || m.status}</span></td>
                                            <td>{rowActions(m)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            <MemberForm
                open={formOpen}
                member={editTarget}
                onClose={() => setFormOpen(false)}
                onSaved={() => fetchData()}
            />
        </div>
    );
}