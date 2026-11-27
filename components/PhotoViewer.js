import { useEffect } from 'react';

// The big photo. Closes with the x, a click outside the photo, or Esc.
export default function PhotoViewer({ url, name, onClose }) {
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    if (!url) return null;
    return (
        <div role="dialog" aria-modal="true" aria-label="Photo" className="pv-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(16,24,40,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ position: 'relative' }}>
                <button type="button" className="pv-close" onClick={onClose} aria-label="Close"
                    style={{ position: 'absolute', top: -14, right: -14, width: 40, height: 40, borderRadius: '50%', border: 0, background: '#fff', color: '#344054', fontSize: 24, lineHeight: 1, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,.3)' }}>×</button>
                <img src={url} alt={name || 'Member photo'} style={{ display: 'block', maxWidth: '90vw', maxHeight: '80vh', borderRadius: 16, background: '#fff' }} />
            </div>
        </div>
    );
}
