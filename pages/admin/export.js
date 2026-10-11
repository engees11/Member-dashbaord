import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { authFetch, getToken, getUser } from '../../lib/session';
import { IconDownload } from '../../components/Icons';

// Download all members as Excel or CSV (admin only)
export default function ExportMembers() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [withDeleted, setWithDeleted] = useState(false);
    const [busy, setBusy] = useState('');
    const [msg, setMsg] = useState(null);

    useEffect(() => {
        if (!getToken()) { router.push('/'); return; }
        setUser(getUser() || { role: 'admin', name: 'Admin' });
    }, []);

    const doExport = async (format) => {
        setBusy(format);
        setMsg(null);
        try {
            const res = await authFetch(`/api/export-members?format=${format}&deleted=${withDeleted ? 1 : 0}`);
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                setMsg({ ok: false, text: j.message || 'Export failed.' });
            } else {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `members-${new Date().toISOString().slice(0, 10)}.${format === 'csv' ? 'csv' : 'xlsx'}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                setMsg({ ok: true, text: 'Your file has been downloaded.' });
            }
        } catch (e) {
            if (e.message !== 'Session expired') setMsg({ ok: false, text: 'Export failed. Check your connection.' });
        }
        setBusy('');
    };

    if (!user) return null;
    const admin = user.role === 'admin';

    return (
        <div>
            <Head><title>Export members</title></Head>
            <div className="st-head"><h1>Export members</h1></div>
            <div className="st-grid st-grid-one">
                <section className="st-card">
                    <h2>Download all members</h2>
                    {admin ? (
                        <>
                            <p>Every member in one file, as Excel or CSV.</p>
                            <div className="st-row">
                                <span>Include deleted members</span>
                                <input type="checkbox" checked={withDeleted} onChange={(e) => setWithDeleted(e.target.checked)} aria-label="Include deleted members" />
                            </div>
                            <div className="st-row">
                                <span>Choose a format</span>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button type="button" className="btn btn-blue" disabled={!!busy} onClick={() => doExport('xlsx')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                        <IconDownload size={18} />{busy === 'xlsx' ? 'Preparing...' : 'Excel (.xlsx)'}
                                    </button>
                                    <button type="button" className="btn btn-gray" disabled={!!busy} onClick={() => doExport('csv')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                        <IconDownload size={18} />{busy === 'csv' ? 'Preparing...' : 'CSV'}
                                    </button>
                                </div>
                            </div>
                            {msg && <div className={`msg ${msg.ok ? 'msg-ok' : 'msg-err'}`} style={{ marginTop: 12 }}>{msg.text}</div>}
                        </>
                    ) : (
                        <p>Only an admin can export members.</p>
                    )}
                </section>
            </div>
        </div>
    );
}
