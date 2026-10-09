import Link from 'next/link';
import { IconUsers } from './Icons';
import { initials, avatarColors } from '../lib/session';

// Left sidebar: team members ki list, har row mein sirf naam + View
export default function TeamSidebar({ team, loading, activeId }) {
    return (
        <aside className="td-sidebar" aria-label="Team members">
            <div className="td-sidebar-head">
                <span className="td-icon-chip td-icon-chip-soft"><IconUsers size={26} /></span>
                <div>
                    <h2 className="td-sidebar-title">Team Members</h2>
                    <span className="td-muted">{loading ? 'Loading...' : `${team.length} members`}</span>
                </div>
            </div>

            {!loading && team.length === 0 && (
                <p className="td-sidebar-empty">Abhi koi team member nahi hai. Upar "Add Member" se pehla member jodo.</p>
            )}

            <ul className="td-team-list">
                {team.map((m) => (
                    <li key={m.id} className={`td-team-row ${m.id === activeId ? 'is-active' : ''} ${m.is_active ? '' : 'is-off'}`}>
                        <span className="td-avatar" style={avatarColors(m.id)} aria-hidden="true">{initials(m.name)}</span>
                        <span className="td-team-name">
                            {m.name}
                            {!m.is_active && <span className="td-team-off">Inactive</span>}
                        </span>
                        <Link href={`/admin/team/${m.id}`} className="td-view-btn" aria-label={`View ${m.name}`}>View</Link>
                    </li>
                ))}
            </ul>
        </aside>
    );
}
