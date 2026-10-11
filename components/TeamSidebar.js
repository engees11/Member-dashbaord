import { useState } from 'react';
import Link from 'next/link';
import { IconUsers } from './Icons';
import { initials, avatarColors } from '../lib/session';

function Group({ title, people, activeId }) {
    const [open, setOpen] = useState(false); // closed to begin with, click to open

    return (
        <section className="td-group">
            <button type="button" className="td-group-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
                <span className={`td-chevron ${open ? 'is-open' : ''}`} aria-hidden="true">›</span>
                <span className="td-group-title">{title}</span>
                <span className="td-group-count">{people.length}</span>
            </button>

            {open && (
                <ul className="td-team-list">
                    {people.length === 0 && <li className="td-sidebar-empty">No one yet</li>}
                    {people.map((m) => (
                        <li key={m.id} className={`td-team-row ${m.id === activeId ? 'is-active' : ''} ${m.is_active ? '' : 'is-off'}`}>
                            <Link href={`/admin/team/${m.id}`} className="td-team-link">
                                <span className="td-avatar" style={avatarColors(m.id)} aria-hidden="true">{initials(m.name)}</span>
                                <span className="td-team-name">
                                    {m.name}
                                    {m.main && <span className="td-team-tag">Main</span>}
                                    {!m.is_active && <span className="td-team-off">Inactive</span>}
                                </span>
                            </Link>
                            <Link href={`/admin/team/${m.id}`} className="td-view-btn" aria-label={`View ${m.name}`}>View</Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

// Left sidebar: two sections, Admin and Team members. Each name opens that person's page (name or View).
export default function TeamSidebar({ team, main, loading, activeId }) {
    const admins = [...(main ? [main] : []), ...team.filter((m) => m.role === 'admin')];
    const members = team.filter((m) => m.role !== 'admin');

    return (
        <aside className="td-sidebar" aria-label="Team">
            <div className="td-sidebar-head">
                <span className="td-icon-chip td-icon-chip-soft"><IconUsers size={26} /></span>
                <div>
                    <h2 className="td-sidebar-title">Team</h2>
                    <span className="td-muted">{loading ? 'Loading...' : `${admins.length + members.length} log`}</span>
                </div>
            </div>

            {!loading && <Group title="Admin" people={admins} activeId={activeId} />}
            {!loading && <Group title="Team members" people={members} activeId={activeId} />}
        </aside>
    );
}
