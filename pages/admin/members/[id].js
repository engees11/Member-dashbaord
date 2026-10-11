import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { authFetch, getToken, getUser } from '../../../lib/session';
import StatusTimeline from '../../../components/StatusTimeline';
import MemberForm from '../../../components/MemberForm';
import { fmtDate } from '../../../lib/format';

const LABELS = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', expired: 'Expired', new: 'New', need_review: 'Need Review' };
const fullName = (m) => [m.first_name, m.father_name, m.last_name].filter(Boolean).join(' ');
const rowType = (m) => m.form_type || 'not_submitted';

// Full page for one member: details, Aadhaar images, timeline and actions
export default function MemberDetail() {
    const router = useRouter();
    const { id, from } = router.query;
    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [tlKey, setTlKey] = useState(0);

    const isAdmin = () => (getUser() || { role: 'admin' }).role === 'admin';
    const backHref = `/admin/members?status=${from || 'all'}`;

    const load = async () => {
        if (!id) return;
        setLoading(true);
        setErr('');
        try {
            const res = await authFetch(`/api/member?id=${encodeURIComponent(id)}`);
            const data = await res.json();
            if (data.success) setMember(data.member);
            else setErr(data.message || 'Could not load this member.');
        } catch (e) {
            if (e.message !== 'Session expired') setErr('Could not load this member. Check your connection.');
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!getToken()) { router.push('/'); return; }
    }, []);

    useEffect(() => { load(); }, [id]);

    const closeForm = () => setFormOpen(false);

    const updateStatus = async (newStatus) => {
        let note = '';
        if (newStatus === 'rejected' || newStatus === 'need_review') {
            const reply = prompt(newStatus === 'rejected' ? 'Reason for rejecting? (optional)' : 'Reason for review? (optional)', '');
            if (reply === null) return;
            note = reply.trim();
        }
        setErr('');
        try {
            const res = await authFetch('/api/update-status', { method: 'POST', body: { id: member.id, status: newStatus, note } });
            const data = await res.json();
            if (data.success) {
                setMember((m) => ({ ...m, status: newStatus }));
                setTlKey((k) => k + 1);
            } else {
                setErr(data.message || 'Could not update status.');
            }
        } catch (e) {
            if (e.message !== 'Session expired') setErr('Network error while updating status.');
        }
    };

    const deleteMember = async () => {
        if (!confirm('This member will move to the Deleted list. You can restore them from there. Delete?')) return;
        setErr('');
        try {
            const res = await authFetch('/api/delete-member', { method: 'POST', body: { id: member.id } });
            const data = await res.json();
            if (data.success) router.push(backHref);
            else setErr(data.message || 'Could not delete member.');
        } catch (e) {
            if (e.message !== 'Session expired') setErr('Network error while deleting member.');
        }
    };

    return (
        <div className="page">
            <Head><title>{member ? `${fullName(member) || member.membership_no || 'Member'} | Member` : 'Member'}</title></Head>
            <div className="topbar">
                <div>
                    <h1>{member ? (fullName(member) || member.email || 'Member detail') : 'Member detail'}</h1>
                    <p>Full record and Aadhaar images</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {member && <button className="btn btn-blue" onClick={() => setFormOpen(true)}>Edit details</button>}
                    <button className="btn btn-gray" onClick={() => router.push(backHref)}>Back to list</button>
                </div>
            </div>

            {err && <div className="msg msg-err" style={{ marginBottom: 16 }}>{err}</div>}
            {loading && !member && <div className="table-card"><p className="empty" style={{ padding: 24 }}>Loading...</p></div>}

            {member && (
                <div className="table-card detail-view" style={{ marginBottom: 24 }}>
                    <div className="table-head">
                        <div>
                            <h3>Membership no: {member.membership_no || '-'}</h3>
                            <p>Status: <span className={`badge b-${member.status}`}>{LABELS[member.status] || member.status || '-'}</span></p>
                        </div>
                    </div>
                    <div className="detail-grid">
                        {rowType(member) !== 'aadhaar_update' && (
                            <>
                                <div className="item"><b>First name</b>{member.first_name || '-'}</div>
                                <div className="item"><b>Father name</b>{member.father_name || '-'}</div>
                                <div className="item"><b>Last name</b>{member.last_name || '-'}</div>
                                <div className="item"><b>Birth date</b>{fmtDate(member.birth_date)}</div>
                                <div className="item"><b>Native place</b>{member.native_place || '-'}</div>
                                <div className="item"><b>Address</b>{member.address || '-'}</div>
                                <div className="item"><b>Area</b>{member.area || '-'}</div>
                            </>
                        )}
                        <div className="item"><b>Membership no</b>{member.membership_no || '-'}</div>
                        <div className="item"><b>Email</b>{member.email || '-'}</div>
                        <div className="item"><b>WhatsApp number</b>{member.whatsapp_number || '-'}</div>
                        <div className="item"><b>Aadhaar number</b>{member.aadhaar_number || '-'}</div>
                        <div className="item"><b>PAN number</b>{member.pan_number || '-'}</div>
                        <div className="item"><b>Aadhaar front</b>{member.aadhaar_front_url ? <a href={member.aadhaar_front_url} target="_blank" rel="noreferrer">View image</a> : 'Not uploaded'}</div>
                        <div className="item"><b>Aadhaar back</b>{member.aadhaar_back_url ? <a href={member.aadhaar_back_url} target="_blank" rel="noreferrer">View image</a> : 'Not uploaded'}</div>
                    </div>
                    <div className="tl-wrap">
                        <b className="tl-heading">Status timeline</b>
                        <StatusTimeline key={tlKey} memberId={member.id} status={member.status} />
                    </div>
                    <div style={{ padding: '0 26px 24px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button className="btn btn-green" disabled={member.status === 'approved'} onClick={() => updateStatus('approved')}>Approve</button>
                        <button className="btn btn-red" disabled={member.status === 'rejected'} onClick={() => updateStatus('rejected')}>Reject</button>
                        <button className="btn btn-gray" disabled={member.status === 'expired'} onClick={() => updateStatus('expired')}>Mark expired</button>
                        <button className="btn btn-gray" disabled={member.status === 'need_review'} onClick={() => updateStatus('need_review')}>Need Review</button>
                        {member.status !== 'pending' && (
                            <button className="btn btn-gray" onClick={() => updateStatus('pending')}>Mark pending</button>
                        )}
                        {isAdmin() && (
                            <button className="btn btn-red" onClick={deleteMember} style={{ marginLeft: 'auto' }}>Delete member</button>
                        )}
                    </div>
                </div>
            )}

            <MemberForm
                open={formOpen}
                member={member}
                onClose={closeForm}
                onSaved={(m) => { if (m) setMember(m); else load(); setTlKey((k) => k + 1); }}
            />
        </div>
    );
}
