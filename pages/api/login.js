import jwt from 'jsonwebtoken';

export default function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { email, password } = req.body || {};

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin', email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        return res.json({ success: true, token });
    }
    return res.status(401).json({ success: false, message: 'Galat email ya password' });
}