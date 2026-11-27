import { useEffect, useRef, useState } from 'react';
import { authFetch } from '../lib/session';
import { IconBell } from './Icons';

const SEEN_KEY = 'notif_seen_at';
// "<person> <what they did>", all in English
const statusText = (label, status) => ({
    approved: `approved ${label}`,
    rejected: `rejected ${label}`,
    need_review: `marked ${label} as Need Review`,
    expired: `marked ${label} as expired`,
    pending: `marked ${label} as pending`,
    new: `marked ${label} as new`,
    retired: `marked ${label} as retired`,
}[status] || `changed the status of ${label} to ${status}`);

export function describeActivity(a) {
    const who = a.member_label || 'a member';
    switch (a.action) {
        case 'status_change': return statusText(who, a.new_status);
        case 'member_edit': return `edited the details of ${who}`;
        case 'member_delete': return `deleted ${who}`;
        case 'member_restore': return `restored ${who}`;
        case 'member_create': return `added ${a.member_label || 'a new member'}`;
        case 'import': return 'imported a CSV file';
        case 'team_add': return `added ${who} to the team`;
        case 'team_deactivate': return `made ${who} inactive`;
        case 'team_activate': return `made ${who} active`;
        case 'team_delete': return `removed ${who} from the team`;
        case 'team_restore': return `restored ${who} to the team`;
        case 'team_make_admin': return `made ${who} an admin`;
        case 'team_make_member': return `made ${who} a team member`;
        case 'password_reset': return `reset the password of ${who}`;
        default: return String(a.action || 'did something').replace(/_/g, ' ');
    }
}

export function timeAgo(iso, now = Date.now()) {
    const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
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
                    <p className="td-muted td-small" style={{ margin: '0 0 8px' }}>Last 24 hours</p>
                    {items.length === 0 ? (
                        <p className="td-muted td-small">No activity in the last 24 hours.</p>
                    ) : (
                        <ul>
                            {items.map((a) => (
                                <li key={a.id}>
                                    <span><b>{a.actor_name}</b> {describeActivity(a)}</span>
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
