# MVM · Activación de recepción privada de evaluaciones

**Estado inicial:** el cliente web está preparado, pero el receptor NO está desplegado y `mvm-config.js` contiene `endpoint: ""`. No existe envío automático hasta que el propietario complete estos pasos y confirme una recepción real.

## Configuración gratuita para el piloto con Google

1. Con tu cuenta Google, crea una **Hoja de cálculo privada** llamada `MVM - Recepciones`. No la compartas con los aspirantes.
2. Abre **Extensiones → Apps Script**.
3. Reemplaza el contenido de `Código.gs` por el archivo [receptor-mvm-apps-script.gs](./receptor-mvm-apps-script.gs) de este repositorio. Guarda el proyecto.
4. En Apps Script, selecciona **Implementar → Nueva implementación → Aplicación web**. Configura **Ejecutar como: Yo** y acceso **Cualquier persona** para permitir entregas sin que cada aspirante tenga cuenta Google. Autoriza los permisos solicitados por Google para la hoja, Drive y notificaciones por correo.
5. Copia el enlace HTTPS de la aplicación web, que debe tener la forma `https://script.google.com/macros/s/.../exec`.
6. Edita [mvm-config.js](./mvm-config.js) en el repositorio y pega ese enlace en la propiedad `endpoint`. **Nunca pegues contraseñas, claves de API ni tokens** en el repositorio público. El enlace de la aplicación web es un punto de recepción, no una credencial secreta.
7. Realiza una prueba completa desde una de las invitaciones (P01 a P04) y pulsa **Guardar y enviar evaluación**. Confirma que la pantalla muestra **Entrega recibida**, que aparece una fila en la hoja `Recepciones` y que el archivo JSON está en tu Google Drive privado. No consideres activado el servicio antes de comprobar esos tres puntos.

## Funcionamiento una vez configurado

El formulario envía el JSON completo (respuestas, prácticas, observaciones y registros de interacción) a tu aplicación web privada de Apps Script. El servidor guarda una copia en Drive, añade un índice en Sheets y procura enviar una notificación por correo al propietario. Se evita duplicar el mismo ID de intento. El navegador muestra una confirmación **solo después de recibir un acuse del receptor**.

**Importante:** este flujo **no entrega resultados directamente a ChatGPT**. Para que yo los califique y actualice el ranking, deberás compartir los archivos o solicitar revisar los nuevos archivos desde una fuente conectada compatible, cuando esté disponible.

## Seguridad y límites

Este ejemplo usa un receptor **anónimo** accesible a quien conozca su URL y por tanto es apropiado solo para las cuatro pruebas piloto supervisadas. La validación del navegador, el código de invitación y el JSON son modificables por un participante con conocimientos técnicos. Para contratación oficial, migra a autenticación de candidatos, controles de abuso, protección contra alteraciones, política de retención de datos y una solución con cumplimiento de privacidad validado por tu organización.

El uso de Google Apps Script, Drive y Sheets puede estar sujeto a límites y cuotas de la cuenta. El flujo debe probarse desde un dispositivo móvil y desde un PC antes de enviar invitaciones.
