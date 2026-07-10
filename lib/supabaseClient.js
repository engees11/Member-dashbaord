import { createClient } from '@supabase/supabase-js';

export const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
const MAX = 10 * 1024 * 1024;

export function validateFile(file) {
    if (!file) return 'File select karna zaroori hai.';
    if (!ALLOWED.includes(file.type)) return 'Sirf JPG, PNG, WEBP ya PDF allowed hai.';
    if (file.size > MAX) return 'File 10MB se chhoti honi chahiye.';
    return null;
}

export async function uploadDoc(folder, phone, file) {
    const clean = (file.name || 'doc').replace(/[^a-zA-Z0-9.]/g, '_');
    const path = `${folder}/${phone}-${Date.now()}-${clean}`;
    const { error } = await supabaseClient.storage
        .from('member-documents')
        .upload(path, file, { contentType: file.type });
    if (error) throw new Error('Upload fail: ' + error.message);
    const { data } = supabaseClient.storage.from('member-documents').getPublicUrl(path);
    return data.publicUrl;
}