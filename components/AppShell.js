import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import NotificationBell from './NotificationBell';
import { IconGrid, IconUsers, IconTeam, IconTrash, IconUpload, IconDownload, IconSettings, IconLogout, IconSearch, IconMenu, IconChevron } from './Icons';
import { authFetch, clearSession, getToken, getUser, saveUser, initials } from '../lib/session';

const STATUS_LINKS = [
    ['all', 'All members'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'],
    ['expired', 'Expired'], ['new', 'New'], ['need_review', 'Need Review'],
];

function PeopleGroup({ title, people, path }) {
    const [open, setOpen] = useState(false); // closed until clicked
    return (
        <div>
            <button type="button" className="sh-nav" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
                <IconTeam size={20} />{title}
                <span className="sh-count">{people.length}</span>
                <span className={`sh-chev ${open ? 'open' : ''}`}><IconChevron size={16} /></span>
            </button>
            {open && (
                <div className="sh-sub">
                    {people.length === 0 && <span className="sh-empty">No one yet</span>}
                    {people.map((m) => (
                        <Link key={m.id} href={`/admin/team/${m.id}`} className={path === '/admin/team/[id]' ? '' : ''}>
                            {m.name}{m.main ? ' (Main)' : ''}{m.is_active === false ? ' (Inactive)' : ''}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

// Name chip in the top bar: click it to open a small menu with Settings and Logout
function ProfileMenu({ user, admin, onLogout }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div className="sh-pm" ref={ref}>
            <button type="button" className="sh-chip" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
                <span className="sh-av">{initials(user.name)}</span>
                <div><b>{user.name}</b><small>{admin ? 'Admin' : 'Team member'}</small></div>
                <span className={`sh-chev ${open ? 'open' : ''}`}><IconChevron size={16} /></span>
            </button>
            {open && (
                <div className="sh-pm-menu" role="menu">
                    <div className="sh-pm-head"><b>{user.name}</b><small>{admin ? 'Admin' : 'Team member'}</small></div>
                    <Link href="/admin/settings" role="menuitem" className="sh-pm-item" onClick={() => setOpen(false)}><IconSettings size={18} />Settings</Link>
                    <button type="button" role="menuitem" className="sh-pm-item sh-pm-danger" onClick={() => { setOpen(false); onLogout(); }}><IconLogout size={18} />Logout</button>
                </div>
            )}
        </div>
    );
}

// Dark left menu + top bar around every /admin page
export default function AppShell({ children }) {
    const router = useRouter();
    const path = router.pathname;
    const [user, setUser] = useState(null);
    const [open, setOpen] = useState(true);
    const [team, setTeam] = useState([]);
    const [main, setMain] = useState(null);
    const [q, setQ] = useState('');
    const onMembersPage = path.startsWith('/admin/members');
    const [membersOpen, setMembersOpen] = useState(onMembersPage);

    // open the Members list automatically when you go to a members page
    useEffect(() => { if (onMembersPage) setMembersOpen(true); }, [onMembersPage]);

    const admin = user && user.role === 'admin';

    const loadTeam = async () => {
        try {
            const res = await authFetch('/api/team');
            const data = await res.json();
            if (data.success) { setTeam(data.team); setMain(data.main || null); }
        } catch { /* sidebar just stays short */ }
    };

    useEffect(() => {
        if (!getToken()) return undefined;
        const u = getUser() || { role: 'admin', name: 'Admin' };
        setUser(u);
        if (window.innerWidth < 900) setOpen(false);
        if (u.role === 'admin') loadTeam();
        (async () => {
            try {
                const res = await authFetch('/api/me');
                const data = await res.json();
                if (data.success && data.user) {
                    saveUser(data.user);
                    setUser(data.user);
                    if (data.user.role === 'admin' && u.role !== 'admin') loadTeam();
                }
            } catch { /* a 401 sends the person to the login page */ }
        })();
        const onTeam = () => loadTeam();
        window.addEventListener('team-changed', onTeam);
        return () => window.removeEventListener('team-changed', onTeam);
    }, []);

    if (!user) return <>{children}</>;

    const onMembers = path.startsWith('/admin/members');
    const status = router.query.status || 'all';
    const admins = [...(main ? [main] : []), ...team.filter((m) => m.role === 'admin')];
    const others = team.filter((m) => m.role !== 'admin');

    const logout = () => {
        if (!window.confirm('Are you sure you want to log out?')) return;
        clearSession();
        router.push('/');
    };
    const search = (e) => {
        e.preventDefault();
        router.push(`/admin/members?status=all&q=${encodeURIComponent(q.trim())}`);
    };

    return (
        <div className={`sh-app ${open ? '' : 'sh-closed'}`}>
            <aside className="sh-side" aria-label="Main menu">
                <div className="sh-brand">
                    <span className="sh-logo">TY</span>
                    <div><b>TYP Surat</b><small>Member Dashboard</small></div>
                </div>
                <nav className="sh-nav-list">
                    <div className="sh-lbl">MENU</div>
                    <Link href="/admin" className={`sh-nav ${path === '/admin' ? 'on' : ''}`}><IconGrid size={20} />Dashboard</Link>
                    <div className="sh-split">
                        <Link href="/admin/members?status=all" className={`sh-nav ${onMembers ? 'on' : ''}`}>
                            <IconUsers size={20} />Members
                        </Link>
                        <button
                            type="button"
                            className={`sh-split-btn ${onMembers ? 'on' : ''}`}
                            onClick={() => setMembersOpen((o) => !o)}
                            aria-expanded={membersOpen}
                            aria-label={membersOpen ? 'Hide member filters' : 'Show member filters'}
                        >
                            <span className={`sh-chev ${membersOpen ? 'open' : ''}`}><IconChevron size={16} /></span>
                        </button>
                    </div>
                    {membersOpen && (
                        <div className="sh-sub">
                            {STATUS_LINKS.map(([k, label]) => (
                                <Link key={k} href={`/admin/members?status=${k}`} className={onMembers && status === k ? 'on' : ''}>{label}</Link>
                            ))}
                        </div>
                    )}
                    {admin && <PeopleGroup title="Admin" people={admins} path={path} />}
                    {admin && <PeopleGroup title="Team members" people={others} path={path} />}

                    {admin && <div className="sh-lbl">DATA</div>}
                    {admin && <Link href="/admin/import" className={`sh-nav ${path === '/admin/import' ? 'on' : ''}`}><IconUpload size={20} />Import</Link>}
                    {admin && <Link href="/admin/export" className={`sh-nav ${path === '/admin/export' ? 'on' : ''}`}><IconDownload size={20} />Export</Link>}
                    {admin && <Link href="/admin/deleted" className={`sh-nav ${path === '/admin/deleted' ? 'on' : ''}`}><IconTrash size={20} />Deleted</Link>}

                    <div className="sh-lbl">ACCOUNT</div>
                    <Link href="/admin/settings" className={`sh-nav ${path === '/admin/settings' ? 'on' : ''}`}><IconSettings size={20} />Settings</Link>
                    <button type="button" className="sh-nav" onClick={logout}><IconLogout size={20} />Logout</button>
                </nav>
                <div className="sh-me">
                    <span className="sh-av">{initials(user.name)}</span>
                    <div><b>{user.name}</b><small>{admin ? 'Admin' : 'Team member'}</small></div>
                </div>
            </aside>

            <div className="sh-main">
                <header className="sh-top">
                    <button type="button" className="sh-ib" onClick={() => setOpen((o) => !o)} aria-label="Show or hide the menu"><IconMenu size={20} /></button>
                    <form className="sh-search" onSubmit={search}>
                        <IconSearch size={18} />
                        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, mobile or membership no." aria-label="Search members" />
                    </form>
                    <span className="sh-spacer" />
                    <NotificationBell />
                    <ProfileMenu user={user} admin={admin} onLogout={logout} />
                </header>
                <div className="sh-content">{children}</div>
            </div>
        </div>
    );
}
