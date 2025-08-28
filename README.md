# Kairu Tech – Landing mínima (GitHub Pages)

Este repositorio contiene una landing estática lista para publicar gratis con **GitHub Pages**.

## Publicación rápida
1. Sube estos archivos a un repositorio público en GitHub.
2. Ve a **Settings → Pages** y elige **Deploy from a branch**, `main` y `/ (root)`.
3. En **Custom domain**, escribe `kairu.tech` (o `www.kairu.tech`).
4. Crea los registros DNS en tu registrador (ver más abajo).
5. Espera la propagación (30 min–24h).

## DNS (para apex y www)
Registra 4 **A records** para `@`:
- 185.199.108.153
- 185.199.109.153
- 185.199.110.153
- 185.199.111.153

Y un **CNAME** para `www` apuntando a: `tuusuario.github.io`

> Si prefieres solo `www.kairu.tech`, puedes usar únicamente el CNAME para `www` y redirigir el apex desde tu registrador.

## Notas
- Edita el archivo `CNAME` si usas `www.kairu.tech` en lugar de `kairu.tech`.
- Añade tu logo (`/logo.png`) y `og-image.jpg` cuando los tengas.
- Puedes usar Cloudflare Web Analytics (sin cookies) pegando tu token en el HTML.
