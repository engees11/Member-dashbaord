import crypto from 'crypto';

// Padhne mein aasaan temporary password (0/O, 1/l jaise confusing letters nahi)
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function generatePassword(length = 10) {
    const bytes = crypto.randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) out += CHARS[bytes[i] % CHARS.length];
    return out;
}
