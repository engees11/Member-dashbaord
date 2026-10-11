import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import NotificationBell from './NotificationBell';
import { IconGrid, IconUsers, IconTeam, IconTrash, IconSettings, IconLogout, IconSearch, IconMenu, IconChevron } from './Icons';
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
                    {people.length === 0 && <span className="sh-empty">Koi nahi hai</span>}
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

// Dark left menu + top bar around every /admin page
export default function AppShell({ children }) {
    const router = useRouter();
    const path = router.pathname;
    const [user, setUser] = useState(null);
    const [open, setOpen] = useState(true);
    const [team, setTeam] = useState([]);
    const [main, setMain] = useState(null);
    const [q, setQ] = useState('');

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
                    <Link href="/admin/members?status=all" className={`sh-nav ${onMembers ? 'on' : ''}`}>
                        <IconUsers size={20} />Members
                        <span className={`sh-chev ${onMembers ? 'open' : ''}`}><IconChevron size={16} /></span>
                    </Link>
                    {onMembers && (
                        <div className="sh-sub">
                            {STATUS_LINKS.map(([k, label]) => (
                                <Link key={k} href={`/admin/members?status=${k}`} className={status === k ? 'on' : ''}>{label}</Link>
                            ))}
                        </div>
                    )}
                    {admin && <PeopleGroup title="Admin" people={admins} path={path} />}
                    {admin && <PeopleGroup title="Team members" people={others} path={path} />}

                    {admin && <div className="sh-lbl">DATA</div>}
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
                    <div className="sh-chip"><span className="sh-av">{initials(user.name)}</span><div><b>{user.name}</b><small>{admin ? 'Admin' : 'Team member'}</small></div></div>
                </header>
                <div className="sh-content">{children}</div>
            </div>
        </div>
    );
}
