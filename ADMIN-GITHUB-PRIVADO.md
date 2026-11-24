# MVM — Activación segura de 15 evaluaciones (V25)

**Estado actual: BLOQUEADO PARA ENTREGAS REALES.** El código fue reforzado y probado con simulaciones, pero las evaluaciones NO pueden iniciarse hasta configurar un receptor y verificar una entrega auténtica. No se deben distribuir las invitaciones antiguas \`?tester=P01&v=24\`: carecen de una clave privada.

## Resultado esperado

1. Cada candidato recibe **SU enlace privado**, con código P01–P15 y clave larga no adivinable. P00 está reservado para el ensayo.
2. Acepta el compromiso de integridad, desarrolla la evaluación durante 75 minutos y puede añadir comentarios.
3. Pulsa **Guardar y enviar evaluación**. La app conserva una copia local inmutable y reintenta el mismo contenido si hay fallos.
4. Un servicio Google Apps Script valida la invitación, el esquema y la privacidad del destino. Guarda un JSON en un repositorio **GitHub PRIVADO**.
5. El candidato solo ve **Evaluación recibida** tras respuesta positiva del receptor. No descarga archivos ni necesita cuenta GitHub.
6. Desde ChatGPT puedes pedirme leer las nuevas entregas con la conexión GitHub (autoriza también el nuevo repo privado) y generar informes Word y ranking Excel.

**La recepción no envía mensajes automáticamente a ChatGPT.** Los informes se generan aquí cuando los solicitas.

## Parte A — GitHub privado

1. En GitHub pulsa **+ → New repository**.
2. Nombre sugerido: \`MVM-Resultados-Privados\`.
3. Selecciona **Private** y créalo. No uses \`evaluacion-asesor-metricas\`, que es público.
4. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens. Genera una credencial **solo para ese repositorio privado**, con permiso **Contents: Read and write**, y vencimiento controlado. No marques "All repositories".
5. **No introduzcas esta credencial en ChatGPT ni en archivos del repositorio público.** Cópiala solamente al panel privado de propiedades de Google Apps Script.

## Parte B — Receptor Google Apps Script

1. Abre [Google Apps Script](https://script.google.com/) y crea un proyecto nuevo bajo tu cuenta.
2. Copia el contenido de [receptor-mvm-a-github.gs](./receptor-mvm-a-github.gs) al editor y guarda.
3. En **Configuración del proyecto → Propiedades de secuencia de comandos** agrega:
   - \`MVM_GITHUB_TOKEN\` = token GitHub restringido al repositorio privado.
   - \`MVM_TARGET_REPO\` = \`mramosbonilla/MVM-Resultados-Privados\` (o tu nombre elegido).
4. Ejecuta desde el editor la función \`mvmProvisionInvitations\` **una sola vez**. Autoriza los permisos solicitados. La función guarda solo hashes SHA-256 y presenta en el **Registro de ejecución privado** 16 enlaces con claves de 64 caracteres: **P00 para el ensayo** y P01–P15 para candidatos reales.
5. **Copia esos enlaces en un lugar privado y distribuye uno a cada candidato.** No los subas a GitHub, no los compartas públicamente ni los pegues en chats grupales. Si pierdes las claves originales, no se recuperan de los hashes: hay que rotar las invitaciones y crear enlaces nuevos.
6. En Apps Script, **Implementar → Nueva implementación → Aplicación web**. Configura ejecutar como **Yo** y acceso **Cualquier persona** (necesario para participantes sin cuenta Google). Confirma autorizaciones. Copia la URL HTTPS terminada en \`/exec\`.
7. En el repositorio público, edita [mvm-config.js](./mvm-config.js) y coloca **solo la URL HTTPS del receptor** en \`endpoint\`. Deja \`requireSecureDelivery:true\`. El URL del receptor **no es una clave secreta**, pero el token de GitHub y los hashes de invitaciones sí lo son.

## Parte C — Prueba obligatoria antes de enviar las invitaciones

1. Utiliza exclusivamente la invitación **P00** para probar el sistema. Quedará ocupada tras la entrega, mientras las 15 invitaciones reales P01–P15 permanecen intactas.
2. Completa el examen, agrega comentarios y pulsa **Guardar y enviar evaluación**.
3. Debe aparecer **Evaluación recibida ✓**.
4. En el repositorio privado debe existir \`entregas/2026/P01.json\` con \`knowledge\`, \`openCases\`, \`practical\` y \`monitoring\`. No copies aquí credenciales ni enlaces secretos.
5. Repite el envío de la **misma entrega** para comprobar que no duplica ni sobrescribe. Una entrega diferente con la misma invitación debe rechazarse.
6. Confirma que el repositorio de resultados también está autorizado en la **conexión GitHub de ChatGPT**; si el conector no puede verlo, ChatGPT no podrá leer el JSON automáticamente.
7. Pídeme: **«Busca las nuevas entregas MVM en el repositorio privado, genera informes individuales Word, diagnóstico de integridad, ranking y Excel acumulado»**.

No actives un proceso oficial hasta completar una prueba real en PC y otra en un teléfono, verificar los acuses, y comprobar que los informes se generan con los datos completos.

## Controles implementados

- **Invitación secreta:** 15 tokens aleatorios por candidato; solo se almacena SHA-256 de cada token en propiedades privadas del receptor.
- **Rechazo por defecto:** sin clave válida, configuración o receptor activo, no se inicia ni acepta una evaluación real.
- **Acceso privado:** el receptor comprueba que GitHub confirme \`private:true\` antes de escribir.
- **Sin secretos en navegador:** la credencial de GitHub solo vive en propiedades privadas del script.
- **Un único resultado por invitación:** ruta fija \`entregas/AAAA/Pxx.json\`, no se sobrescribe, y el reintento idéntico se confirma sin nueva escritura.
- **Respaldo local y reintento:** el cliente conserva exactamente el JSON que intentó enviar.
- **Acuse verificable:** se valida origen Google, versión, identificador y nonce criptográfico; no se muestra «recibido» solo por pulsar el botón.
- **No se guardan datos personales en el repositorio público.**

## Límites de seguridad que NO debemos ocultar

1. **El navegador no es inviolable.** El candidato podría inspeccionar la página, alterar el JSON o simular algunos eventos. Las alertas (copiar/pegar, pestañas, velocidad de escritura) requieren revisión contextual y no demuestran fraude.
2. Las preguntas y parte de la lógica práctica están en archivos públicos de GitHub Pages. **No se puede garantizar secreto absoluto de respuestas ni supervisión antitrampas** sin cambiar la arquitectura a un backend que entregue/controla preguntas y califique en el servidor.
3. Un enlace secreto puede ser compartido por su destinatario. Con esta solución no se verifica la identidad real de la persona: solo la posesión de su enlace.
4. El receptor Apps Script sigue siendo accesible por Internet, aunque rechaza entregas sin clave. Sus cuotas y su resistencia al abuso no equivalen a un servicio empresarial.
5. El candidato puede perder su respaldo local si borra datos del navegador o cambia de dispositivo antes de que se confirme el envío. Hay botón de copia de emergencia ante error.
6. No almacenar archivos personales más tiempo del necesario. Define una fecha de eliminación y quién puede acceder al repositorio privado.
7. Las credenciales GitHub vencen: establece una fecha de renovación y prueba la recepción de nuevo. Un token vencido hace que la entrega falle sin confirmación.

## Estado

El código V25 **ha pasado pruebas automatizadas simuladas**, pero **no está desplegado ni validado con un servicio real**, ya que la configuración del repositorio privado, token y Apps Script requiere la acción del propietario. No existe todavía garantía de recepción operativa para candidatos reales.
