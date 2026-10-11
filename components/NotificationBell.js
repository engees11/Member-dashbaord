import { useEffect, useRef, useState } from 'react';
import { authFetch } from '../lib/session';
import { IconBell } from './Icons';

const SEEN_KEY = 'notif_seen_at';
const STATUS_TEXT = { approved: 'Approved', rejected: 'Rejected', need_review: 'Need Review', expired: 'Expired', pending: 'Pending', new: 'New' };

function describe(a) {
    switch (a.action) {
        case 'status_change': return `marked ${a.member_label || 'a member'} as ${STATUS_TEXT[a.new_status] || a.new_status}`;
        case 'member_edit': return `edited the details of ${a.member_label || 'a member'}`;
        case 'member_delete': return `deleted ${a.member_label || 'a member'}`;
        case 'member_restore': return `restored ${a.member_label || 'a member'}`;
        case 'member_create': return `added ${a.member_label || 'a new member'}`;
        case 'import': return 'imported a CSV';
        case 'team_add': return `added ${a.member_label} to the team`;
        case 'team_deactivate': return `deactivated ${a.member_label}`;
        case 'team_activate': return `activated ${a.member_label}`;
        case 'team_delete': return `removed ${a.member_label} from the team`;
        case 'team_restore': return `restored ${a.member_label} to the team`;
        case 'team_make_admin': return `made ${a.member_label} an admin`;
        case 'team_make_member': return `made ${a.member_label} a team member`;
        case 'password_reset': return `reset the password of ${a.member_label}`;
        default: return a.action;
    }
}

function timeAgo(iso) {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
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
        } catch { /* the bell is optional, ignore errors */ }
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
                        <p className="td-muted td-small">No activity yet.</p>
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
