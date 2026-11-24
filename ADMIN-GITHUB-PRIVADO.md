# MVM · Entrega automática de evaluaciones a GitHub privado

## Qué hará el candidato

Al cerrar y comentar la prueba, pulsará **Guardar y enviar evaluación**. Si el receptor confirma el registro, la pantalla mostrará **Evaluación recibida ✓**. No tendrá que descargar un archivo ni acceder a GitHub.

## Qué ocurre detrás de la pantalla

1. La aplicación está publicada en GitHub Pages, que es un sitio estático y no puede escribir en GitHub por sí mismo.
2. Un receptor HTTPS gratuito y ligero en Google Apps Script recibe el archivo de entrega.
3. El receptor usa un token limitado, guardado **solo en las propiedades privadas del script**, para escribir `entregas/AAAA/MVM-XXXXXXXX-XXXXXX.json` en un **repositorio GitHub privado** del propietario.
4. La aplicación confirma el envío únicamente cuando el receptor responde. En caso de error no afirma que lo haya recibido.

No hay que habilitar correos ni pedir al candidato que descargue resultados. **ChatGPT no recibe eventos automáticamente**, pero puede buscar los nuevos archivos en el repositorio mediante la conexión de GitHub cuando el propietario lo solicite, y generar los informes Word y el consolidado Excel. El nuevo repositorio privado debe estar autorizado para el conector de GitHub en ChatGPT.

## Configuración única necesaria

### 1. Crear el repositorio de resultados

En tu GitHub crea un nuevo repositorio **Private**, por ejemplo `MVM-Resultados-Privados`. **No utilices el repositorio público** `evaluacion-asesor-metricas` para respuestas ni alertas de participantes.

En GitHub: `+` → `New repository` → nombre → **Private** → `Create repository`.

### 2. Crear un token de alcance limitado

En GitHub: `Settings` → `Developer settings` → `Personal access tokens` → `Fine-grained tokens` → `Generate new token`. Selecciona solo el repositorio privado de resultados y otorga **Contents: Read and write**. Usa un vencimiento breve y luego renuévalo cuando corresponda.

**No pegues el token en este chat ni en archivos del repositorio público.** Guárdalo únicamente en las propiedades privadas del Google Apps Script en el siguiente paso.

### 3. Desplegar el receptor

En Google Apps Script crea un proyecto nuevo y pega el contenido del archivo [receptor-mvm-a-github.gs](./receptor-mvm-a-github.gs).

En `Configuración del proyecto` → `Propiedades de secuencia de comandos`, crea:
- `MVM_GITHUB_TOKEN` = el token privado de GitHub
- `MVM_TARGET_REPO` = `mramosbonilla/MVM-Resultados-Privados` (ajusta si usas otro nombre)

En Apps Script: `Implementar` → `Nueva implementación` → `Aplicación web`, ejecuta como **Yo** y permite acceso a **Cualquier persona**, para que los participantes no necesiten una cuenta Google. Autoriza los permisos necesarios.

El receptor público es una excepción de seguridad para este **piloto supervisado**. Antes de utilizarlo para contratación real, añade autenticación de participantes, prevención de spam, validación de integridad del envío y medidas de privacidad acordes con tu organización.

### 4. Conectar la evaluación al receptor

Copia la URL de la aplicación web de Apps Script (acaba en `/exec`). En el archivo público [mvm-config.js](./mvm-config.js), cambia únicamente `endpoint: ""` por `endpoint: "https://script.google.com/macros/s/.../exec"`.

**Importante:** la URL del receptor se hace pública en el navegador. No es una clave. El token de GitHub debe permanecer exclusivamente en las propiedades del script.

### 5. Probar antes de enviar cuatro invitaciones

Completa una prueba ficticia en el enlace V24, añade los comentarios y pulsa **Guardar y enviar evaluación**.

Comprueba:
1. Pantalla de confirmación **Evaluación recibida**.
2. Archivo JSON nuevo en el repositorio privado, con el ID del intento y respuestas, casos, ejercicios y `monitoring.alerts`.
3. El repositorio privado está disponible en la conexión GitHub de ChatGPT.

Si algo falla, no envíes invitaciones reales hasta corregirlo. La pantalla nunca debe mostrar una recepción no confirmada.

## Generar los informes

Cuando haya entregas, escribe en esta conversación:

> Busca las nuevas evaluaciones MVM del repositorio GitHub privado, califícalas con la rúbrica de 100 puntos, genera un informe Word individual por candidato, un Word con el ranking detallado, un resumen ejecutivo Word y el Excel acumulativo. Incluye las alertas de integridad como observaciones separadas de las calificaciones y distingue los intentos simulados.

Este proceso se hará aquí con la conexión de GitHub. Para que ocurra sin que tengas que pedirlo, habrá que configurar expresamente una tarea programada compatible; la recepción en GitHub por sí sola no inicia mensajes en ChatGPT.

## Límites del piloto

El JSON del navegador puede ser manipulado por alguien con conocimientos técnicos; los indicadores de integridad no constituyen pruebas de fraude y no modifican automáticamente la nota. El receptor anónimo puede recibir envíos no deseados y las cuotas gratuitas de Apps Script o las API pueden cambiar. Usa este procedimiento para los cuatro evaluadores piloto, no como infraestructura final de contratación sin endurecer su seguridad.
