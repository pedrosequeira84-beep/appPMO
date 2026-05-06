
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnostic() {
    console.log('--- DIAGNÓSTICO DE CAPACIDAD ---');
    
    // 1. Contar total de registros en la tabla
    const { count, error: cErr } = await supabase
        .from('capacity_assignments')
        .select('*', { count: 'exact', head: true });
    
    console.log('Total de registros en DB:', count);

    // 2. Buscar registros específicamente de ABRIL 2026
    const { data: aprilData, error: aErr } = await supabase
        .from('capacity_assignments')
        .select('id, member_id, date, hours')
        .like('date', '2026-04%');
    
    if (aErr) console.error('Error en abril:', aErr);
    console.log('Registros encontrados para Abril 2026:', aprilData?.length || 0);

    if (aprilData && aprilData.length > 0) {
        // Agrupar por member_id para ver quién tiene datos
        const stats = aprilData.reduce((acc, curr) => {
            acc[curr.member_id] = (acc[curr.member_id] || 0) + 1;
            return acc;
        }, {});
        console.log('Distribución por ID de miembro:', stats);
    }
}

diagnostic();
