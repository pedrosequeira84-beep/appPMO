import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { GoogleGenerativeAI } from "npm:@google/generative-ai"

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

    // Consultas en paralelo para optimizar el tiempo de respuesta
    const [
      { data: projects },
      { data: milestones },
      { data: risks },
      { data: changes },
      { data: expenses },
      { data: team },
      { data: capacity }
    ] = await Promise.all([
      supabaseClient.from('projects').select('id, name, client_name, pm, opportunity_number, status, progress, health_status, vertical').limit(100),
      supabaseClient.from('milestones').select('id, project_id, description, amount, date, real_date, is_received, currency').limit(200),
      supabaseClient.from('risks').select('id, project_id, description, probability, impact, is_problem, is_mitigated, plan, date').limit(200),
      supabaseClient.from('changes').select('id, project_id, description, type, date, registration_number').limit(200),
      supabaseClient.from('expenses').select('id, project_id, date, category, amount, description').limit(200),
      supabaseClient.from('team_members').select('id, name, role, email, is_active').limit(100),
      supabaseClient.from('capacity_assignments').select('id, member_id, type, project_id, date, hours, observations').limit(500)
    ]);

    // Instanciar el cliente de Google Gemini
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
       throw new Error('La variable de entorno GEMINI_API_KEY no está configurada en Supabase.')
    }
    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" })

    // Preparar el Prompt Inyectando el contexto obtenido
    const systemInstruction = `
Eres un asistente de IA experto en la gestión de proyectos de BGH (PMO).
Utiliza exclusivamente el siguiente contexto (proveniente de la base de datos de la PMO) para responder a las preguntas del usuario.
Si el usuario pregunta algo que no está en el contexto, indícale amablemente que no tienes esa información. No inventes datos.
Puedes cruzar la información usando los IDs (ej: project_id enlaza con projects.id, member_id enlaza con team_members.id).

REGLAS DE RESPUESTA MUY IMPORTANTES:
1. NUNCA imprimas los IDs o UUIDs internos de la base de datos (ej: c2d4f79f...). En su lugar, utiliza el Número de Oportunidad del proyecto (opportunity_number, ej: "TP-AR-1234").
2. Formatea SIEMPRE tu respuesta usando Markdown para que sea fácil y atractiva de leer. Usa listas con viñetas, negritas, separadores, y emojis profesionales donde corresponda. No entregues bloques de texto gigantes.

--- DATOS DE LA BASE DE DATOS ---
PROYECTOS: ${JSON.stringify(projects)}
HITOS (MILESTONES): ${JSON.stringify(milestones)}
RIESGOS Y PROBLEMAS: ${JSON.stringify(risks)}
CONTROLES DE CAMBIOS: ${JSON.stringify(changes)}
GASTOS (EXPENSES): ${JSON.stringify(expenses)}
EQUIPO DE TRABAJO: ${JSON.stringify(team)}
CARGA DE HORAS (CAPACITY): ${JSON.stringify(capacity)}
----------------------------------
    `;

    const prompt = `${systemInstruction}\n\nPregunta del usuario: ${question}`

    // Llamar a Gemini
    const result = await model.generateContent(prompt)
    const response = await result.response;
    const text = response.text()

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
