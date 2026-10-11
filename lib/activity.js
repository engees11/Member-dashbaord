import { supabase } from './supabase';

// Writes the activity log. If logging fails, the real action must still go through,
// so this never throws.
export async function logActivity(user, action, fields = {}) {
    try {
        const { error } = await supabase.from('member_activity').insert({
            actor_id: user && user.id ? user.id : null,
            actor_name: (user && user.name) || 'Unknown',
            action,
            member_id: fields.memberId != null ? String(fields.memberId) : null,
            member_label: fields.memberLabel || null,
            old_status: fields.oldStatus || null,
            new_status: fields.newStatus || null,
            note: fields.note || null,
            meta: fields.meta || null,
        });
        if (error) console.error('activity log failed:', error.message);
    } catch (e) {
        console.error('activity log failed:', e.message);
    }
}

export function memberLabel(m) {
    if (!m) return null;
    const name = [m.first_name, m.father_name, m.last_name].filter(Boolean).join(' ');
    return name || m.email || m.whatsapp_number || null;
}
