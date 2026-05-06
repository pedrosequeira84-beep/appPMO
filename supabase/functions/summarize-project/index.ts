import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
    }

    try {
        const { history, projectName } = await req.json()

        if (!OPENAI_API_KEY) {
            return new Response(
                JSON.stringify({ error: 'OPENAI_API_KEY no configurada en Supabase secrets.' }),
                { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
            )
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `Eres un experto PMO. Analiza el historial de comentarios de un proyecto y genera un resumen ejecutivo profesional de máximo 4 oraciones. Enfócate en el progreso actual, hitos logrados y riesgos pendientes. Idioma: Español.`
                    },
                    {
                        role: 'user',
                        content: `Proyecto: ${projectName}\nHistorial:\n${history}`
                    }
                ],
                temperature: 0.7,
            }),
        })

        const data = await response.json()
        const summary = data.choices[0].message.content

        return new Response(
            JSON.stringify({ summary }),
            { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        )
    }
})
