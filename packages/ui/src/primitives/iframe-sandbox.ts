// Fase 8 (ARCH-LANDING-EDITOR-02, hardening) — política compartida por los 4
// <iframe> del repo (todos embeben video de un proveedor externo elegido
// por el admin, YouTube/Vimeo/Wistia/etc., nunca contenido propio). Sin
// `allow-same-origin`, un iframe sandboxeado no puede leer cookies/storage
// de SU PROPIO origen (necesario para que el reproductor recuerde
// preferencias/sesión) — como el origen siempre es el del proveedor de
// video, nunca el nuestro, no hay riesgo de que "escape" y toque nuestro
// origen. Fullscreen NO tiene token de `sandbox` propio (verificado contra
// Chromium real: `allow-fullscreen` no existe como flag de sandbox y el
// navegador lo descarta con un warning) — se habilita aparte, vía el
// atributo `allowFullScreen`/`allow="fullscreen"` que cada iframe ya trae.
export const VIDEO_IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-presentation allow-popups";
