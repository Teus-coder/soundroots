# SoundRoots - Estado actual

## URLs y servicios
- **Web en producción:** https://soundroots.onrender.com
- **Repositorio:** https://github.com/Teus-coder/soundroots
- **Hosting:** Render.com (free tier, se duerme tras 15min de inactividad)
- **Dominio futuro:** soundroots.com (disponible, ~$10-12/año en Namecheap o Porkbun)

## APIs integradas
- **ACRCloud** — Reconocimiento de audio por tarareo
  - Dashboard: https://console.acrcloud.com
  - Proyecto: SoundRoots, ID 104175
  - Host: identify-eu-west-1.acrcloud.com
  - Engine: Cover Song (Humming) Identification
  - Plan: Trial 14 días (creado 10 jun 2026)

- **Anthropic Claude** — Búsqueda de origen, normalización de título e año
  - Dashboard: https://console.anthropic.com
  - Modelo usado: claude-haiku-4-5-20251001
  - Saldo añadido: $5
  - API key: en .env local y en Render > Environment

- **TMDB** — Imágenes de películas y series
  - Dashboard: https://themoviedb.org/settings/api
  - API key: en .env local y en Render > Environment

- **RAWG** — Imágenes de videojuegos
  - Dashboard: https://rawg.io/apidocs
  - API key: en .env local y en Render > Environment

## Variables de entorno
En `.env` local y en Render > soundroots > Environment:
- ACR_ACCESS_KEY
- ACR_ACCESS_SECRET
- ANTHROPIC_API_KEY
- TMDB_API_KEY
- RAWG_API_KEY

## Funcionalidades completadas
- ✅ Reconocimiento de canciones por tarareo (ACRCloud)
- ✅ Búsqueda de origen con Claude (película, serie, videojuego, anuncio)
- ✅ Imagen del medio donde aparece (TMDB + RAWG)
- ✅ Lista de todas las apariciones de la canción
- ✅ Candidatos alternativos con score dentro de la carta principal
- ✅ Badge "Original" en versiones alternativas
- ✅ Normalización de título en idioma original (evita títulos en japonés etc)
- ✅ Año original de la canción (no remasters)
- ✅ Priorización de versión de estudio sobre lives y remixes
- ✅ Links a Spotify y YouTube
- ✅ Botón toggle (pulsar para grabar, pulsar para parar)
- ✅ Tutorial "cómo funciona" que desaparece al mostrar resultado
- ✅ Responsive para móvil
- ✅ Credenciales protegidas con variables de entorno
- ✅ Desplegado en Render con redeploy automático desde GitHub

## Pendiente
- ⬜ Sistema de corrección de resultados con moderación (requiere base de datos)
- ⬜ Dominio personalizado (soundroots.com)
- ⬜ Resolver sleep de Render en free tier (upgrade o keep-alive)
- ⬜ Renovar/pagar ACRCloud cuando expire el trial (10 jul 2026)

## Archivos del proyecto
- `server.js` — Servidor Node.js, rutas /identify y /origin, firma HMAC para ACRCloud
- `app.js` — Lógica frontend, grabación, manejo de resultados
- `index.html` — Estructura de la página
- `style.css` — Estilos, dark mode, responsive
- `.env` — Credenciales locales (NO subir a GitHub, está en .gitignore)
- `.gitignore` — Excluye .env y node_modules

## Para retomar contexto en un nuevo chat
Pega este archivo completo al inicio de la conversación con Claude.