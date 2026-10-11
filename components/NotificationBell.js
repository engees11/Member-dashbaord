import { useEffect, useRef, useState } from 'react';
import { authFetch } from '../lib/session';
import { IconBell } from './Icons';

const SEEN_KEY = 'notif_seen_at';
const STATUS_TEXT = { approved: 'Approve', rejected: 'Reject', need_review: 'Need Review', expired: 'Expired', pending: 'Pending', new: 'New' };

function describe(a) {
    switch (a.action) {
        case 'status_change': return `ne ${a.member_label || 'member'} ko ${STATUS_TEXT[a.new_status] || a.new_status} kiya`;
        case 'member_edit': return `ne ${a.member_label || 'member'} ki details edit ki`;
        case 'member_delete': return `ne ${a.member_label || 'member'} ko delete kiya`;
        case 'member_restore': return `ne ${a.member_label || 'member'} ko wapas laaya (restore kiya)`;
        case 'member_create': return `ne ${a.member_label || 'naya member'} add kiya`;
        case 'import': return 'ne CSV import kiya';
        case 'team_add': return `ne ${a.member_label} ko team mein add kiya`;
        case 'team_deactivate': return `ne ${a.member_label} ko inactive kiya`;
        case 'team_activate': return `ne ${a.member_label} ko active kiya`;
        case 'team_delete': return `ne ${a.member_label} ko team se delete kiya`;
        case 'team_restore': return `ne ${a.member_label} ko team mein wapas laaya`;
        case 'team_make_admin': return `ne ${a.member_label} ko admin banaya`;
        case 'team_make_member': return `ne ${a.member_label} ko team member banaya`;
        case 'password_reset': return `ne ${a.member_label} ka password reset kiya`;
        default: return a.action;
    }
}

function timeAgo(iso) {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'abhi';
    if (s < 3600) return `${Math.floor(s / 60)} min pehle`;
    if (s < 86400) return `${Math.floor(s / 3600)} ghante pehle`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationBell() {
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [seenAt, setSeenAt] = useState(0);
    const wrapRef = useRef(null);

    const load = async () => {
        try {
            const res = await authFetch('/api/notifications');
            const data = await res.json();
            if (data.success) setItems(data.items);
        } catch { /* bell optional hai, error ignore */ }
    };

    useEffect(() => {
        setSeenAt(Number(localStorage.getItem(SEEN_KEY) || 0));
        load();
        const t = setInterval(load, 60000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (!open) return;
        const onDown = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
        const onKey = (e) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const unread = items.filter((a) => new Date(a.created_at).getTime() > seenAt).length;

    const toggle = () => {
        const next = !open;
        setOpen(next);
        if (next) {
            const now = Date.now();
            localStorage.setItem(SEEN_KEY, String(now));
            setSeenAt(now);
        }
    };

    return (
        <div className="td-bell-wrap" ref={wrapRef}>
            <button type="button" className="td-bell" onClick={toggle} aria-expanded={open}
                aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}>
                <IconBell />
                {unread > 0 && <span className="td-bell-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
            </button>
            {open && (
                <div className="td-bell-panel">
                    <h3>Notifications</h3>
                    {items.length === 0 ? (
                        <p className="td-muted td-small">Abhi tak koi activity nahi hai.</p>
                    ) : (
                        <ul>
                            {items.map((a) => (
                                <li key={a.id}>
                                    <span><b>{a.actor_name}</b> {describe(a)}</span>
                                    <span className="td-muted td-small">{timeAgo(a.created_at)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
