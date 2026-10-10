import { requireUser } from '../../lib/auth';

// GET /api/me -> who am I right now (the role is read from the database, so a new role shows without logging in again)
export default async function handler(req, res) {
    const user = await requireUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    return res.json({
        success: true,
        user: { id: user.id, name: user.name, email: user.email || null, phone: user.phone || null, role: user.role },
    });
}
