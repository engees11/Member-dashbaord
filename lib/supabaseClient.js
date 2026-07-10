import { createClient } from '@supabase/supabase-js';

export const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);


const ALLOWED = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf'
];

const MAX = 10 * 1024 * 1024;


export function validateFile(file) {

    if (!file) {
        return 'File select karna zaroori hai.';
    }

    if (!ALLOWED.includes(file.type)) {
        return 'Only JPG, PNG, WEBP or PDF allowed.';
    }

    if (file.size > MAX) {
        return 'File size should be less than 10MB.';
    }

    return null;
}



export async function uploadDoc(folder, phone, file) {


    const clean = file.name.replace(
        /[^a-zA-Z0-9.]/g,
        '_'
    );


    const path =
        `${folder}/${phone}-${Date.now()}-${clean}`;


    const { data, error } =
        await supabaseClient.storage
            .from('member-documents')
            .upload(
                path,
                file,
                {
                    contentType: file.type,
                    upsert: false
                }
            );


    if (error) {
        throw new Error(
            'Upload failed: ' + error.message
        );
    }


    const { data: urlData } =
        supabaseClient.storage
            .from('member-documents')
            .getPublicUrl(data.path);


    return urlData.publicUrl;
}