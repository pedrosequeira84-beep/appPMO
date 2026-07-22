import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase
        .from('capacity_assignments')
        .select('*')
        .ilike('user_email', '%useche%');
    
    console.log('Error:', error);
    console.log('Found records:', data?.length);
    if (data && data.length > 0) {
        console.log('Sample:', data[0]);
    }
}
check();
