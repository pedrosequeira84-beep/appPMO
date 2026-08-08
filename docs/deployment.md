# Despliegue

Esta app es un SPA estático (Vite + React) que habla directo con Supabase — no hay backend propio
que desplegar.

## Variables de entorno

Definidas en `.env.local` (no versionado) y en la configuración del hosting:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Base de datos (Supabase)

1. Aplicar en orden los archivos de `supabase/migrations/` contra el proyecto de Supabase
   (dashboard → SQL editor, `supabase db push` con el CLI, o el MCP de Supabase):
   - `20260807_operaciones_sd_schema.sql`
   - `20260807_operaciones_sd_rls.sql` (leer la advertencia del encabezado antes de correrlo)
   - `20260807_operaciones_sd_business_rules.sql`
2. Confirmar que el bucket de Storage `sd-attachments` haya quedado creado (lo crea el primer
   archivo).
3. (Opcional) cargar `supabase/seed_operaciones_sd_demo.sql` para tener datos de prueba.

## Build

```bash
npm install
npm run build      # genera dist/
npm run test       # corre las pruebas unitarias (Vitest)
```

`dist/` es 100% estático: se puede servir desde cualquier hosting de archivos estáticos (Vercel,
Netlify, un bucket con CDN, etc.). No requiere Node en runtime.

## Checklist antes de publicar un cambio

- `npm run build` sin errores.
- `npm test` en verde.
- Si el cambio tocó `supabase/migrations/`, aplicarlas contra Supabase **antes** de publicar el
  build (el frontend nuevo puede depender de columnas/tablas que todavía no existen).
