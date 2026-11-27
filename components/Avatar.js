import { useEffect, useState } from 'react';

const COLORS = ['#3B5BDB', '#0E9384', '#C4320A', '#7A5AF8', '#DD2590', '#B54708', '#067647', '#175CD3'];
const initialOf = (m) => (String((m && (m.first_name || m.last_name || m.email)) || '?').trim()[0] || '?').toUpperCase();
const colorOf = (m) => {
    const s = String((m && (m.id || m.first_name)) || '');
    let h = 0;
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
};

// A round photo; with no photo (or a photo that does not load) it shows the first letter of the name on a colour.
// With onClick (and a photo) it is a button, used to open the big photo.
export default function Avatar({ member, size = 36, src, onClick, title }) {
    const url = src !== undefined ? src : member && member.photo_url;
    const [bad, setBad] = useState(false);
    useEffect(() => { setBad(false); }, [url]);
    const shown = !!url && !bad;
    const base = {
        width: size, height: size, borderRadius: '50%', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', background: colorOf(member), color: '#fff', fontWeight: 800, fontSize: Math.round(size * 0.4), padding: 0,
        border: size >= 60 ? '3px solid #fff' : 'none', boxShadow: size >= 60 ? '0 0 0 2px #C7D2EA' : 'none',
    };
    const inner = shown
        ? <img src={url} alt="" loading="lazy" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setBad(true)} />
        : initialOf(member);
    if (onClick && shown) {
        return <button type="button" className="av av-btn" onClick={onClick} title={title || 'View photo'} aria-label={title || 'View photo'} style={{ ...base, cursor: 'zoom-in' }}>{inner}</button>;
    }
    return <span className="av" style={base} aria-hidden="true">{inner}</span>;
}
