
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpTeam() {
    console.log('--- Dumping Team Members ---');
    const { data: members, error: mErr } = await supabase
        .from('team_members')
        .select('*');
    
    if (mErr) console.error('Error fetching members:', mErr);
    console.log('Members found:', JSON.stringify(members, null, 2));

    console.log('\n--- Checking Assignments Count ---');
    const { data: count, error: cErr } = await supabase
        .from('capacity_assignments')
        .select('count', { count: 'exact' });
    console.log('Total assignments in DB:', count?.[0]?.count || 0);
}

dumpTeam();
