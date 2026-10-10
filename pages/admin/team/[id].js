import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { IconArrowLeft } from '../../../components/Icons';
import { formatPhone } from '../../../lib/phone';
import { authFetch, getToken, getUser, initials, avatarColors } from '../../../lib/session';

const STATUS = {
    approved: { label: 'Approved', cls: 'approved' },
    rejected: { label: 'Rejected', cls: 'rejected' },
    need_review: { label: 'Need Review', cls: 'review' },
    pending: { label: 'Pending', cls: 'pending' },
    expired: { label: 'Expired', cls: 'expired' },
    new: { label: 'New', cls: 'new' },
};

const OTHER_ACTIONS = {
    login: 'Login kiya',
    member_create: 'Naya member add kiya',
    member_delete: 'Member delete kiya',
    member_restore: 'Member wapas laaya (restore)',
    import: 'CSV import kiya',
};

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const fmtDateTime = (iso) => (iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : 'Kabhi nahi');

function StatusPill({ status }) {
    const s = STATUS[status] || { label: status || '-', cls: 'expired' };
    return <span className={`td-pill td-pill-${s.cls}`}>{s.label}</span>;
}

export default function TeamMemberDetail() {
    const router = useRouter();
    const { id } = router.query;
    const [user, setUser] = useState(null);
    const [date, setDate] = useState(todayStr());
    const [filter, setFilter] = useState('all');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);

    const admin = user && user.role === 'admin';

    const load = async () => {
        if (!id) return;
        setLoading(true);
        setErr('');
        const from = new Date(`${date}T00:00:00`);
        const to = new Date(from.getTime() + 24 * 3600 * 1000);
        try {
            const res = await authFetch(`/api/team/${id}?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
            const json = await res.json();
            if (json.success) setData(json);
            else setErr(json.message || 'Data load nahi hua');
        } catch (e) {
            if (e.message !== 'Session expired') setErr('Network error, dobara try karo');
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!getToken()) {
            router.push('/');
            return;
        }
        setUser(getUser() || { role: 'admin', name: 'Admin' });
    }, []);

    useEffect(() => { load(); }, [id, date]);

    const act = async (action) => {
        const name = data.member.name;
        const ask = {
            deactivate: `${name} ka login band karna hai?`,
            make_admin: `${name} ko admin banana hai? Wo members delete, CSV import aur team manage bhi kar payega.`,
            make_member: `${name} ko wapas team member banana hai? Admin ke kaam band ho jayenge.`,
            delete: `${name} ko delete karna hai? Login band ho jayega. Deleted list se wapas la sakte ho.`,
        }[action];
        if (ask && !confirm(ask)) return;
        setBusy(true);
        setErr('');
        try {
            const res = await authFetch(`/api/team/${id}`, { method: 'POST', body: { action } });
            const json = await res.json();
            if (!json.success) setErr(json.message || 'Action fail hua');
            else if (action === 'delete') router.push('/admin');
            else setData((d) => ({ ...d, member: json.member }));
        } catch (e) {
            if (e.message !== 'Session expired') setErr('Network error, dobara try karo');
        }
        setBusy(false);
    };

    const member = data && data.member;
    const stats = (data && data.stats) || { total: 0, approved: 0, rejected: 0, needReview: 0 };
    const rows = ((data && data.activity) || []).filter((a) => {
        if (filter === 'all') return true;
        if (filter === 'other') return a.action !== 'status_change';
        return a.action === 'status_change' && a.new_status === filter;
    });

    return (
        <div className="td-page">
            <Head><title>{member ? `${member.name} | Team` : 'Team member'}</title></Head>
            <div className="td-detail">
                <Link href="/admin" className="td-back"><IconArrowLeft size={18} />Team par wapas</Link>

                {err && <div className="msg msg-err">{err}</div>}

                {member && (
                    <header className="td-header td-profile">
                        <div className="td-header-title">
                            <span className="td-avatar td-avatar-lg" style={avatarColors(member.id)} aria-hidden="true">{initials(member.name)}</span>
                            <div>
                                <h1>
                                    {member.name}
                                    <span className="td-team-tag">{member.main ? 'Main admin' : member.role === 'admin' ? 'Admin' : 'Team member'}</span>
                                    {!member.is_active && <span className="td-team-off">Inactive</span>}
                                </h1>
                                {member.email && <p>{member.email}</p>}
                                {member.phone && <p>{formatPhone(member.phone)}</p>}
                                {!member.main && <p className="td-small">Team mein joined: {fmtDate(member.created_at)}</p>}
                                {!member.main && <p className="td-small">Last login: {fmtDateTime(member.last_login_at)}</p>}
                            </div>
                        </div>
                        {admin && !member.main && user.id !== member.id && (
                            <div className="td-header-actions">
                                {member.role === 'admin' ? (
                                    <button type="button" className="td-btn td-btn-soft" onClick={() => act('make_member')} disabled={busy}>
                                        Make member
                                    </button>
                                ) : (
                                    <button type="button" className="td-btn td-btn-soft" onClick={() => act('make_admin')} disabled={busy}>
                                        Make admin
                                    </button>
                                )}
                                {member.is_active ? (
                                    <button type="button" className="td-btn td-btn-danger" onClick={() => act('deactivate')} disabled={busy}>
                                        Deactivate
                                    </button>
                                ) : (
                                    <button type="button" className="td-btn td-btn-primary" onClick={() => act('activate')} disabled={busy}>
                                        Activate
                                    </button>
                                )}
                                <button type="button" className="td-btn td-btn-danger" onClick={() => act('delete')} disabled={busy}>
                                    Delete
                                </button>
                            </div>
                        )}
                    </header>
                )}

                <section className="td-mini-stats" aria-label="Is din ka kaam">
                    <div className="td-mini"><span>{date === todayStr() ? 'Aaj total' : 'Us din total'}</span><b>{loading ? '-' : stats.total}</b></div>
                    <div className="td-mini td-mini-approved"><span>Approved</span><b>{loading ? '-' : stats.approved}</b></div>
                    <div className="td-mini td-mini-rejected"><span>Rejected</span><b>{loading ? '-' : stats.rejected}</b></div>
                    <div className="td-mini td-mini-review"><span>Need Review</span><b>{loading ? '-' : stats.needReview}</b></div>
                </section>

                <section className="td-card" aria-label="Activity history">
                    <div className="td-card-head">
                        <div>
                            <h2 className="td-card-title">Activity history</h2>
                            <p className="td-muted td-small">{member ? `${member.name} ne kis member par kya action liya` : ''}</p>
                        </div>
                        <div className="td-filters">
                            <div className="td-field">
                                <label htmlFor="f-date">Date</label>
                                <input id="f-date" type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
                            </div>
                            <div className="td-field">
                                <label htmlFor="f-action">Action</label>
                                <select id="f-action" value={filter} onChange={(e) => setFilter(e.target.value)}>
                                    <option value="all">Sab actions</option>
                                    <option value="approved">Approve</option>
                                    <option value="rejected">Reject</option>
                                    <option value="need_review">Need Review</option>
                                    <option value="other">Baaki (login, delete...)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="td-table-wrap">
                        <table className="td-table">
                            <thead>
                                <tr><th>Time</th><th>Member</th><th>Status change</th><th>Note</th></tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={4} className="empty">Loading...</td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={4} className="empty">Is din koi activity nahi mili.</td></tr>
                                ) : (
                                    rows.map((a) => (
                                        <tr key={a.id}>
                                            <td className="td-nowrap td-muted">{fmtTime(a.created_at)}</td>
                                            <td>{a.member_label || (a.action === 'login' ? '-' : 'Unknown')}</td>
                                            <td>
                                                {a.action === 'status_change' ? (
                                                    <span className="td-change">
                                                        <StatusPill status={a.old_status} />
                                                        <span aria-label="to" className="td-muted">→</span>
                                                        <StatusPill status={a.new_status} />
                                                    </span>
                                                ) : (
                                                    <span className="td-muted">{OTHER_ACTIONS[a.action] || a.action}</span>
                                                )}
                                            </td>
                                            <td>{a.note || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}
