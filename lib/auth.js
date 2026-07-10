import jwt from 'jsonwebtoken';

export function verifyAdmin(req) {
    const header = req.headers.authorization || '';
    const token = header.replace('Bearer ', '');
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

export function calcAge(dob) {
    if (!dob) return null;
    const d = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age;
}

export function effectiveStatus(member) {
    if (member.status === 'approved') {
        const age = calcAge(member.dob);
        if (age !== null && age >= 45) return 'expired';
    }
    return member.status;
}