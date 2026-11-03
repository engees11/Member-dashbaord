import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { authFetch, getToken, getUser } from '../../lib/session';
import { fmtDate } from '../../lib/format';
import MemberForm from '../../components/MemberForm';
import { skippedToInitial } from '../../lib/skippedToMember';

const fullName = (r) => [r.first_name, r.father_name, r.last_name].filter(Boolean).join(' ') || '-';
const maskAadhaar = (v) => { const d = String(v || '').replace(/\D/g, ''); return d.length >= 4 ? `XXXX-XXXX-${d.slice(-4)}` : (v || '-'); };

function download(rows) {
    const head = ['Date', 'Reason', 'Why', 'Row in file', 'Sr No', 'Membership No', 'Name', 'Mobile', 'Birth date', 'Aadhaar'];
    const cell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = rows.map((r) => [fmtDate(r.created_at), r.reason, r.detail, r.file_row, r.sr_no, r.membership_no, fullName(r), r.whatsapp_number, r.birth_date, r.aadhaar_number].map(cell).join(','));
    const blob = new Blob(['\uFEFF' + [head.map(cell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `duplicates-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export default function Duplicates() {
    const router = useRouter();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [needsSetup, setNeedsSetup] = useState(false);
    const [reason, setReason] = useState('all');
    const [search, setSearch] = useState('');
    const [err, setErr] = useState('');
    const [addFor, setAddFor] = useState(null); // the skipped row being added as a member

    const load = async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await authFetch('/api/skipped-entries');
            const data = await res.json();
            if (data.success) { setRows(data.rows); setNeedsSetup(!!data.needsSetup); } else setErr(data.message || 'Could not load the list');
        } catch (e) {
            if (e.message !== 'Session expired') setErr('Could not load the list. Check your connection.');
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!getToken()) { router.push('/'); return; }
        if ((getUser() || { role: 'admin' }).role !== 'admin') { router.push('/admin'); return; }
        load();
    }, []);

    const post = async (body) => {
        setErr('');
        try {
            const res = await authFetch('/api/skipped-entries', { method: 'POST', body });
            const data = await res.json();
            if (!data.success) setErr(data.message || 'Could not do that');
            return !!data.success;
        } catch (e) {
            if (e.message !== 'Session expired') setErr('Network error, please try again.');
            return false;
        }
    };
    const remove = async (r) => { if (await post({ action: 'remove', id: r.id })) setRows((l) => l.filter((x) => x.id !== r.id)); };
    const clearAll = async () => {
        if (!confirm('Remove every row from this list? Nothing in your members is touched.')) return;
        if (await post({ action: 'clear' })) setRows([]);
    };

    const reasons = [...new Set(rows.map((r) => r.reason))];
    const counts = rows.reduce((m, r) => { m[r.reason] = (m[r.reason] || 0) + 1; return m; }, {}); // how many of each reason
    const q = search.trim().toLowerCase();
    const shown = rows.filter((r) => (reason === 'all' || r.reason === reason) && (!q || fullName(r).toLowerCase().includes(q) || String(r.whatsapp_number || '').includes(q.replace(/\s/g, '')) || String(r.membership_no || '').toLowerCase().includes(q)));

    return (
        <div className="page">
            <Head><title>Duplicates</title></Head>
            <div className="topbar">
                <div>
                    <h1>Duplicates</h1>
                    <p>Rows an import found as duplicates, or with a problem, with the reason. Check and tally them here. Nothing here changed your members.</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-blue" disabled={!shown.length} onClick={() => download(shown)}>Download list</button>
                    <button className="btn btn-gray" disabled={!rows.length} onClick={clearAll}>Clear all</button>
                </div>
            </div>

            {err && <div className="msg msg-err" style={{ marginBottom: 16 }}>{err}</div>}
            {needsSetup && <div className="msg msg-err" style={{ marginBottom: 16 }}>This list needs one database update. Run <b>supabase/import-skipped.sql</b> in the Supabase SQL Editor.</div>}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <button className={reason === 'all' ? 'btn btn-blue btn-sm' : 'btn btn-gray btn-sm'} onClick={() => setReason('all')}>All ({rows.length})</button>
                {reasons.map((x) => (
                    <button key={x} className={reason === x ? 'btn btn-blue btn-sm' : 'btn btn-gray btn-sm'} onClick={() => setReason(x)}>{x} ({counts[x]})</button>
                ))}
            </div>

            <div className="table-card">
                <div className="table-head" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>{shown.length} rows</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <input className="searchbar" placeholder="Search name or mobile" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>Date</th><th>Reason</th><th>Name</th><th>Mobile</th><th>Mem. No.</th><th>Aadhaar</th><th>Why</th><th>Action</th></tr></thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} className="empty">Loading...</td></tr>
                            ) : shown.length === 0 ? (
                                <tr><td colSpan={8} className="empty">No duplicates.</td></tr>
                            ) : (
                                shown.map((r) => (
                                    <tr key={r.id}>
                                        <td>{fmtDate(r.created_at)}</td>
                                        <td><b>{r.reason}</b></td>
                                        <td>{fullName(r)}</td>
                                        <td>{r.whatsapp_number || '-'}</td>
                                        <td>{r.membership_no || '-'}</td>
                                        <td>{maskAadhaar(r.aadhaar_number)}</td>
                                        <td>{r.detail || '-'}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                <button className="btn btn-blue btn-sm" onClick={() => setAddFor({ id: r.id, ...skippedToInitial(r) })}>Add as member</button>
                                                <button className="btn btn-gray btn-sm" onClick={() => remove(r)}>Remove</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <MemberForm
                open={!!addFor}
                member={null}
                initial={addFor ? addFor.initial : undefined}
                note={addFor ? addFor.note : ''}
                onClose={() => setAddFor(null)}
                onSaved={async () => {
                    // saved as a member: it leaves the Duplicates list
                    if (addFor && await post({ action: 'remove', id: addFor.id })) setRows((l) => l.filter((x) => x.id !== addFor.id));
                }}
            />
        </div>
    );
}
