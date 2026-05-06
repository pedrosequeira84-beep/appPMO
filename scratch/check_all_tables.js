
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllTables() {
    console.log('--- ESTADO GENERAL DE LA BASE DE DATOS ---');
    
    const tables = ['projects', 'team_members', 'capacity_assignments', 'risks'];
    
    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.log(`Tabla ${table}: ERROR - ${error.message}`);
        } else {
            console.log(`Tabla ${table}: ${count} registros encontrados.`);
        }
    }
}

checkAllTables();
