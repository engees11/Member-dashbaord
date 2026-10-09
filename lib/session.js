// Browser-side login session helpers
const TOKEN_KEY = 'admin_token';
const USER_KEY = 'admin_user';

export function getToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
    if (typeof window === 'undefined') return null;
    try {
        return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
        return null;
    }
}

export function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || null));
}

export function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

// fetch + Authorization header. 401 aaye to login par bhej do.
export async function authFetch(url, options = {}) {
    const headers = { ...(options.headers || {}), Authorization: `Bearer ${getToken()}` };
    if (options.body && typeof options.body !== 'string') {
        headers['Content-Type'] = 'application/json';
        options = { ...options, body: JSON.stringify(options.body) };
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        clearSession();
        window.location.href = '/';
        throw new Error('Session expired');
    }
    return res;
}

export function initials(name) {
    return String(name || '?')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();
}

const AVATARS = [
    ['#DCE6FF', '#1F3FA8'], ['#FDE7D3', '#9A4A0B'], ['#D7F2E1', '#136C34'], ['#F6DDEB', '#9F1A6B'],
    ['#DFF0FB', '#0B5A8A'], ['#E4E7EC', '#475467'], ['#EDE4FB', '#5B2BA6'],
];

export function avatarColors(key) {
    let h = 0;
    const s = String(key || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    const [bg, fg] = AVATARS[h % AVATARS.length];
    return { background: bg, color: fg };
}
