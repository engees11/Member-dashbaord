import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { authFetch, getToken, getUser } from '../../lib/session';
import { IconUpload } from '../../components/Icons';

// Import members from a CSV file (admin only)
export default function ImportMembers() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (!getToken()) { router.push('/'); return; }
        setUser(getUser() || { role: 'admin', name: 'Admin' });
    }, []);

    const onFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImporting(true);
        setResult(null);
        try {
            const text = await file.text();
            const res = await authFetch('/api/import-members', { method: 'POST', body: { csv: text } });
            setResult(await res.json());
        } catch (err) {
            if (err.message !== 'Session expired') {
                setResult({ success: false, message: 'Could not read or upload the file: ' + err.message });
            }
        }
        setImporting(false);
        e.target.value = '';
    };

    if (!user) return null;
    const admin = user.role === 'admin';

    return (
        <div>
            <Head><title>Import members</title></Head>
            <div className="st-head"><h1>Import members</h1></div>
            <div className="st-grid st-grid-one">
                <section className="st-card">
                    <h2>Import from a CSV file</h2>
                    {admin ? (
                        <>
                            <p>Choose a .csv file. Members already in the list are updated, new ones are added.</p>
                            <div className="st-row">
                                <span>{importing ? 'Importing, please wait...' : 'Select the CSV file to import'}</span>
                                <label className={`btn btn-blue ${importing ? 'is-busy' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <IconUpload size={18} />
                                    {importing ? 'Importing...' : 'Choose CSV'}
                                    <input type="file" accept=".csv" className="td-hidden-input" onChange={onFile} disabled={importing} />
                                </label>
                            </div>
                            {result && (
                                <div className={`msg ${result.success ? 'msg-ok' : 'msg-err'}`} style={{ marginTop: 12 }}>
                                    {result.success
                                        ? `Import done: ${result.inserted} added/updated, ${result.skipped} skipped, total ${result.total}.`
                                        : result.message}
                                    {result.errors && result.errors.length > 0 && (
                                        <details style={{ marginTop: 8 }}>
                                            <summary style={{ cursor: 'pointer' }}>Show details</summary>
                                            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                                                {result.errors.map((er, i) => <li key={i}>{er}</li>)}
                                            </ul>
                                        </details>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <p>Only an admin can import members.</p>
                    )}
                </section>
            </div>
        </div>
    );
}
