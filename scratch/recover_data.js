
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findLostData() {
    console.log('--- BUSCANDO DATOS PERDIDOS DE ABRIL ---');
    
    // 1. Obtener todos los miembros actuales para comparar
    const { data: members } = await supabase.from('team_members').select('id, name');
    const memberIds = members?.map(m => m.id) || [];
    
    // 2. Traer todos los registros de Abril
    const { data: assignments, error } = await supabase
        .from('capacity_assignments')
        .select('*');
    
    if (error) return console.error('Error:', error);

    const april = assignments.filter(a => a.date.includes('-04-'));
    console.log(`Total de registros de Abril encontrados: ${april.length}`);

    const orphaned = april.filter(a => !memberIds.includes(a.member_id));
    if (orphaned.length > 0) {
        console.log(`¡ATENCIÓN! Se encontraron ${orphaned.length} registros sin dueño (el ID del usuario ya no existe).`);
        console.log('IDs de dueños desaparecidos:', [...new Set(orphaned.map(o => o.member_id))]);
    } else {
        console.log('No se encontraron registros huérfanos. Si el total es bajo, los datos podrían haber sido borrados.');
    }
}

findLostData();
