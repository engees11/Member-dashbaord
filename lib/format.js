// Indian date format and PAN helpers (safe in the browser and on the server)

// 1992-09-17 (or an ISO timestamp)  ->  17/09/1992
export function fmtDate(v) {
    if (!v) return '-';
    const s = String(v);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

function validIso(y, mo, d) {
    const Y = Number(y), M = Number(mo), D = Number(d);
    const dt = new Date(Date.UTC(Y, M - 1, D));
    if (dt.getUTCFullYear() !== Y || dt.getUTCMonth() !== M - 1 || dt.getUTCDate() !== D) return null;
    if (Y < 1900 || Y > new Date().getUTCFullYear()) return null;
    return `${String(Y).padStart(4, '0')}-${String(M).padStart(2, '0')}-${String(D).padStart(2, '0')}`;
}

// 17/09/1992 (also 17-09-1992, 17.9.1992 or 1992-09-17)  ->  1992-09-17.  '' stays '' (cleared), a bad date gives null
export function dmyToIso(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s) return '';
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return validIso(m[3], m[2], m[1]);
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return validIso(m[1], m[2], m[3]);
    return null;
}

export const normalizePan = (v) => String(v == null ? '' : v).replace(/\s/g, '').toUpperCase();
export const isValidPan = (v) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v);
