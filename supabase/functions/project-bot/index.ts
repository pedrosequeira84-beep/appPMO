import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Manejo de peticiones CORS preflight (OPCIONES)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { question } = await req.json()

    if (!question) {
      return new Response(
        JSON.stringify({ error: 'La pregunta (question) es requerida en el cuerpo de la petición.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Extraer el JWT del header de la petición (Authorization: Bearer <token>)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No se proveyó el header de autorización.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Crear el cliente de Supabase instanciándolo con el JWT del usuario
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Consultas en paralelo para optimizar el tiempo de respuesta y superar el límite de 1000 de Supabase PostgREST
    const [
      { data: projects },
      { data: milestones },
      { data: risks },
      { data: changes },
      { data: expenses },
      { data: team },
      { data: capacityPage1 },
      { data: capacityPage2 }
    ] = await Promise.all([
      supabaseClient.from('projects').select('id, name, client_name, pm, opportunity_number, status, progress, health_status, vertical').range(0, 999),
      supabaseClient.from('milestones').select('id, project_id, description, amount, date, real_date, is_received, currency, parent_id, received_amount').range(0, 999),
      supabaseClient.from('risks').select('id, project_id, description, probability, impact, is_problem, is_mitigated, plan, date').range(0, 999),
      supabaseClient.from('changes').select('id, project_id, description, type, date, registration_number').range(0, 999),
      supabaseClient.from('expenses').select('id, project_id, date, category, amount, description').range(0, 999),
      supabaseClient.from('team_members').select('id, name, role, email, is_active').range(0, 999),
      supabaseClient.from('capacity_assignments')
        .select('id, member_id, user_email, type, project_id, date, week_start, hours, observations')
        .gt('hours', 0)
        .order('date', { ascending: false, nullsFirst: false })
        .range(0, 999),
      supabaseClient.from('capacity_assignments')
        .select('id, member_id, user_email, type, project_id, date, week_start, hours, observations')
        .gt('hours', 0)
        .order('date', { ascending: false, nullsFirst: false })
        .range(1000, 1999)
    ]);

    const capacity = [...(capacityPage1 || []), ...(capacityPage2 || [])];

    // Mapa rápido para buscar proyectos y miembros del equipo por ID, Email o capacity_id
    const projectMap = new Map((projects || []).map((p: any) => [p.id, `${p.opportunity_number ? `${p.opportunity_number} - ` : ''}${p.name}`]));
    const teamMap = new Map((team || []).map((t: any) => [t.id, t.name]));
    if (team) {
      team.forEach((t: any) => {
        if (t.email) teamMap.set(t.email.toLowerCase(), t.name);
      });
    }

    // Pre-calcular sumas exactas por Fila (Recurso + Actividad/Proyecto + Mes) igual que en el frontend
    const capacitySummaryMap = new Map<string, { recurso: string, actividadProyecto: string, tipo: string, mes: string, totalHoras: number, dias: { fecha: string, horas: number, obs: string }[] }>();

    for (const c of (capacity || [])) {
      const recurso = teamMap.get(c.member_id) || teamMap.get((c.user_email || '').toLowerCase()) || c.member_id || c.user_email || 'Desconocido';
      
      let actividadProyecto = '';
      if (c.project_id) {
        actividadProyecto = projectMap.get(c.project_id) || c.project_id;
      } else {
        const typeNames: Record<string, string> = {
          'capacitaciones': 'CAPACITACIONES',
          'reuniones': 'REUNIONES',
          'licencias': 'LICENCIAS',
          'sp-bau': 'SP-BAU',
          'tableros-reportes': 'TABLEROS-REPORTES',
          'gestion-general': 'GESTION-GENERAL',
          'preventiva-poc': 'PREVENTIVA-POC',
          'consultoria': 'CONSULTORIA',
          'logistica': 'LOGISTICA',
          'facturacion': 'FACTURACION'
        };
        actividadProyecto = typeNames[c.type] || (c.type ? String(c.type).toUpperCase() : 'GENERAL-BAU');
      }

      const fecha = (c.date || c.week_start || '').split('T')[0];
      if (!fecha || fecha.length < 7) continue;
      const mes = fecha.substring(0, 7); // ej: "2026-06"
      const hrs = Number(c.hours) || 0;
      if (hrs <= 0) continue;

      const key = `${recurso.toLowerCase()}|${actividadProyecto.toLowerCase()}|${mes}`;
      if (!capacitySummaryMap.has(key)) {
        capacitySummaryMap.set(key, {
          recurso,
          actividadProyecto,
          tipo: c.type || 'General',
          mes,
          totalHoras: 0,
          dias: []
        });
      }
      const entry = capacitySummaryMap.get(key)!;
      entry.totalHoras += hrs;
      entry.dias.push({ fecha, horas: hrs, obs: c.observations || '' });
    }

    const precomputedCapacitySummary = Array.from(capacitySummaryMap.values()).map(s => {
      const diasStr = s.dias.map(d => `${d.fecha}:${d.horas}h${d.obs ? `(${d.obs})` : ''}`).join(', ');
      return `- RECURSO: "${s.recurso}" | FILA_TABLA: "${s.actividadProyecto}" | MES: ${s.mes} | TOTAL_ENCUADRADO_FILA: ${s.totalHoras} hs | DÍAS: [${diasStr}]`;
    }).join('\n');

    // Enriquecer Hitos, Riesgos, Gastos y Cambios con formato claro para el modelo
    const enrichedMilestones = (milestones || []).map((m: any) => {
      const projName = projectMap.get(m.project_id) || m.project_id;
      const fechaEfectiva = (m.real_date || m.date || '').split('T')[0];
      const mes = fechaEfectiva.length >= 7 ? fechaEfectiva.substring(0, 7) : 'Sin Fecha';
      const estado = m.is_received ? 'Recepcionado/Cobrado' : ((m.received_amount || 0) > 0 ? 'Parcial' : 'Pendiente');
      const tipo = m.parent_id ? 'Sub-hito' : 'Hito Principal';
      return `- Proyecto: "${projName}" | Hito: "${m.description}" (${tipo}) | Monto: ${m.currency || 'USD'} ${m.amount} | Estado: ${estado} | Fecha Teórica: ${m.date || 'N/A'} | Fecha Real: ${m.real_date || 'N/A'} | Fecha Efectiva: ${fechaEfectiva} | Mes: ${mes}`;
    }).join('\n');

    const enrichedRisks = (risks || []).map((r: any) => ({
      proyecto: projectMap.get(r.project_id) || r.project_id,
      descripcion: r.description,
      probabilidad: r.probability,
      impacto: r.impact,
      es_problema: r.is_problem ? 'Sí' : 'No',
      mitigado: r.is_mitigated ? 'Sí' : 'No',
      plan_mitigacion: r.plan || ''
    }));

    const enrichedExpenses = (expenses || []).map((e: any) => ({
      proyecto: projectMap.get(e.project_id) || e.project_id,
      fecha: e.date,
      categoria: e.category,
      monto: e.amount,
      descripcion: e.description || ''
    }));

    const enrichedChanges = (changes || []).map((c: any) => ({
      proyecto: projectMap.get(c.project_id) || c.project_id,
      descripcion: c.description,
      tipo: c.type,
      fecha: c.date,
      num_registro: c.registration_number || ''
    }));

    // Autenticar con la Cuenta de Servicio de Google Cloud
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!serviceAccountJson) {
       throw new Error('Las credenciales GOOGLE_SERVICE_ACCOUNT_JSON no están configuradas en Supabase.')
    }
    const sa = JSON.parse(serviceAccountJson)

    // Crear JWT manualmente para autenticar contra la API de Gemini
    const now = Math.floor(Date.now() / 1000)
    const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const jwtPayload = btoa(JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/cloud-platform'
    })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

    // Importar clave privada y firmar el JWT
    const pemKey = sa.private_key.replace(/\\n/g, '\n')
    const keyData = pemKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '')
    const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0))
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8', binaryKey.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    )
    const signingInput = `${jwtHeader}.${jwtPayload}`
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput))
    const b64Signature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const jwt = `${signingInput}.${b64Signature}`

    // Intercambiar JWT por access token de Google
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
    })
    const tokenData = await tokenResponse.json()
    if (!tokenData.access_token) {
      throw new Error(`Error obteniendo token de Google: ${JSON.stringify(tokenData)}`)
    }
    const accessToken = tokenData.access_token

    // Preparar el Prompt Inyectando el contexto obtenido
    const systemInstruction = `
Eres un asistente de IA experto en la gestión de proyectos de BGH (PMO).
Utiliza exclusivamente el siguiente contexto (proveniente de la base de datos de la PMO) para responder a las preguntas del usuario sobre proyectos, hitos de facturación, riesgos, gastos, equipo y horas imputadas / capacity plan.
Si el usuario pregunta algo que no está en el contexto, indícale amablemente que no tienes esa información. No inventes datos.

REGLAS PARA HITOS DE FACTURACIÓN (MILESTONES):
1. **TODOS LOS HITOS SON DE FACTURACIÓN:**
   - Cada Hito o Sub-hito registrado en la lista de HITOS representa un Hito de Facturación/Cobro.
   - Tanto los hitos en estado "Pendiente", "Parcial" como "Recepcionado/Cobrado" son Hitos de Facturación.
2. **CONSULTAS POR MES DE FACTURACIÓN:**
   - Cuando pregunten qué proyectos tienen hitos de facturación en un mes específico (ej: "agosto 2026" o "2026-08"):
     * Revisa la "Fecha Efectiva", "Mes" o "Fecha Teórica" / "Fecha Real" de cada hito.
     * Lista TODOS los proyectos que tengan hitos programados en ese mes (ej: mes 2026-08).
     * Muestra el Nombre del Proyecto, Número de Oportunidad, Nombre del Hito (especificando si es Sub-hito), Monto, Estado (Pendiente/Parcial/Cobrado) y Fecha.
   - Si existen hitos en el mes solicitado, NUNCA digas que no tienes información. Lista detalladamente los proyectos y sus hitos.

REGLAS DE RESPUESTA CRÍTICAS PARA CARGA DE HORAS (CAPACITY):
1. **SIEMPRE PRIORIZAR EL TOTAL DEL MES COMPLETO:**
   - El valor encuadrado principal de la grilla de la PMO es el **TOTAL DEL MES COMPLETO** (TOTAL_ENCUADRADO_FILA).
   - Incluso si el usuario menciona un día específico o una errata como "Julio 27" o "27 de Julio", **DECLARA SIEMPRE EL TOTAL DEL MES COMPLETO** en la primera línea en negrita.
   - Ejemplo: "**Nelson Ciffoni imputó un total de 21 horas en el mes de Julio de 2026 en Networking Edif Regionales - Salta y Misiones (TP-AR-22721)** (con 2 horas registradas el día 27 de Julio)."
2. **USAR EL TOTAL CALCULADO DIRECTAMENTE:**
   - En la sección "RESUMEN PRECALCULADO DE CARGA DE HORAS POR FILA", usa el valor exacto de TOTAL_ENCUADRADO_FILA para responder el total mensual de la fila. NUNCA inventes o recalcules valores.
3. **DESGLOSE Y TABLA:**
   - Presenta la tabla Markdown descriptiva (Fecha, Proyecto/Actividad, Horas, Observaciones).

--- DATOS DE LA BASE DE DATOS ---
PROYECTOS: ${JSON.stringify(projects)}
HITOS DE FACTURACIÓN:
${enrichedMilestones}
RIESGOS Y PROBLEMAS: ${JSON.stringify(enrichedRisks)}
CONTROLES DE CAMBIOS: ${JSON.stringify(enrichedChanges)}
GASTOS: ${JSON.stringify(enrichedExpenses)}
EQUIPO DE TRABAJO: ${JSON.stringify(team)}
RESUMEN PRECALCULADO DE CARGA DE HORAS POR FILA:
${precomputedCapacitySummary}
----------------------------------
    `;

    // Llamar a Vertex AI (Agent Platform) via REST API - usa facturación de Google Cloud
    const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT') || 'bgh-pmo-ai'
    const location = 'us-central1'
    const modelId = 'gemini-3.5-flash-lite' // Gemini 3.5 Flash Lite en Vertex AI
    const vertexUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`

    const vertexResponse = await fetch(vertexUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: question }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 3072
        }
      })
    })

    if (!vertexResponse.ok) {
      const errText = await vertexResponse.text()
      throw new Error(`Vertex AI API error: ${vertexResponse.status} - ${errText}`)
    }

    const data = await vertexResponse.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar una respuesta.'

    // Devolver la respuesta generada al frontend
    return new Response(
      JSON.stringify({ answer: text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('Error processing request:', error)
    // Retornamos 200 para que supabase.functions.invoke no oculte el error con un genérico "non-2xx status code"
    return new Response(
      JSON.stringify({ error: error.message || 'Error interno en la Edge Function' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})

