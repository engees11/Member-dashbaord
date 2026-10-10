import { useEffect, useState } from 'react';
import { authFetch } from '../lib/session';

const STATUS = {
    approved: { label: 'Approved', color: '#16a34a' },
    rejected: { label: 'Rejected', color: '#dc2626' },
    pending: { label: 'Pending', color: '#d97706' },
    need_review: { label: 'Need Review', color: '#9333ea' },
    expired: { label: 'Expired', color: '#64748b' },
    new: { label: 'New', color: '#2563eb' },
    deleted: { label: 'Deleted', color: '#B42318' },
};

const info = (s) => STATUS[s] || { label: s || '-', color: '#64748b' };
const fmt = (iso) =>
    new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// Vertical timeline of every status a member has had. Reloads whenever `status` changes.
export default function StatusTimeline({ memberId, status }) {
    const [events, setEvents] = useState(null);
    const [err, setErr] = useState('');

    useEffect(() => {
        let alive = true;
        setEvents(null);
        setErr('');
        (async () => {
            try {
                const res = await authFetch(`/api/member-timeline?id=${encodeURIComponent(memberId)}`);
                const data = await res.json();
                if (!alive) return;
                if (data.success) setEvents(data.events);
                else setErr(data.message || 'Could not load the timeline');
            } catch (e) {
                if (alive && e.message !== 'Session expired') setErr('Could not load the timeline');
            }
        })();
        return () => { alive = false; };
    }, [memberId, status]);

    if (err) return <div className="tl-empty">{err}</div>;
    if (!events) return <div className="tl-empty">Loading timeline...</div>;

    return (
        <ol className="tl-list">
            {events.map((e, i) => {
                const s = info(e.status);
                const last = i === events.length - 1;
                const what = e.label || (e.from ? `Changed from ${info(e.from).label}` : 'Status changed');
                const meta = [what, e.by ? `by ${e.by}` : '', e.at ? fmt(e.at) : ''].filter(Boolean).join(' · ');
                return (
                    <li key={e.id} className={`tl-item ${last ? 'is-current' : ''}`}>
                        <span className="tl-dot" style={{ background: s.color }} />
                        <div className="tl-body">
                            <div className="tl-title">
                                <span className="tl-pill" style={{ background: `${s.color}1a`, color: s.color }}>{s.label}</span>
                                {last && <span className="tl-now">Current</span>}
                            </div>
                            <div className="tl-meta">{meta}</div>
                            {e.note && <div className="tl-note">&ldquo;{e.note}&rdquo;</div>}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
