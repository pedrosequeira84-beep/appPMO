
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSequeira() {
    console.log('--- Checking Team Members ---');
    const { data: members, error: mErr } = await supabase
        .from('team_members')
        .select('*')
        .ilike('name', '%Sequeira%');
    
    if (mErr) console.error('Error fetching members:', mErr);
    console.log('Members found:', members);

    if (members && members.length > 0) {
        for (const m of members) {
            console.log(`\n--- Checking Assignments for ${m.name} (ID: ${m.id}) ---`);
            const { data: assignments, error: aErr } = await supabase
                .from('capacity_assignments')
                .select('*')
                .eq('member_id', m.id);
            
            if (aErr) console.error(`Error fetching assignments for ${m.id}:`, aErr);
            console.log(`Found ${assignments?.length || 0} assignments.`);
            if (assignments && assignments.length > 0) {
                // Show some samples from April
                const april = assignments.filter(a => a.date.includes('-04-'));
                console.log(`April assignments: ${april.length}`);
                if (april.length > 0) {
                    console.log('Sample April assignment:', april[0]);
                }
            }
        }
    }
}

checkSequeira();
