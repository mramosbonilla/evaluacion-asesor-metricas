# MVM V36 · Desarrollo aislado
Estado: prototipo de núcleo y adaptador de ensayo, **no listo para publicar**.
Fecha: 2026-11-26.
Producción: main (V35). Respaldo: respaldo-v35-20261126.
El formulario nuevo es común a todos los candidatos. No copiar contenido privado a este repositorio.

## Componentes
- `mvm-server-core.gs`: proyección de una sola etapa, versiones de guardado, cierre irreversible, plazo de servidor y puntuación objetiva independiente.
- `mvm-sandbox-adapter.gs`: adaptador de ensayo T36 deshabilitado por defecto, banco privado fijado por commit, identidad de navegador, bloqueo y acuse posterior al guardado. No procesa las invitaciones P00–P15.
- Banco: rama desarrollo-v36 del repositorio privado de resultados, ruta bancos/MVM-ASESOR-2026-V36.json. Contiene el contenido y las claves; no incluirlo en los activos públicos.

## Antes de desplegar
1. Revisar el banco y la rúbrica con el responsable; comprobar dificultad y resultados esperados.
2. Adaptar interfaz y cuatro simuladores para cargar exclusivamente datos de la etapa que autoriza el servidor, sin conservar contenido futuro en HTML/JS; preservar borradores y accesibilidad.
3. Crear calificación independiente de fórmulas, pivotes, SQL y Python. Nunca ejecutar código arbitrario en Apps Script; usar un entorno aislado o revisión controlada. Casos abiertos: rúbrica humana/asistida.
4. Integrar monitoreo y trazabilidad de sesión y validar coherencia; los eventos de navegador no son pruebas de fraude.
5. Preparar despliegue de ensayo separado y credencial de invitación T36 (no incluirla en código ni capturas). El adaptador aún no está conectado a doPost.
6. Comprobar guardado real, recuperación, vencimiento, bloqueo, ausencia de contenido anticipado, envío, informes, cuotas y concurrencia. Mantener V35 activa hasta autorización expresa.
7. Al terminar, adaptar el receptor para P06–P15 y el seguimiento de resultados a la versión definitiva. No alterar P00–P05 ni los resultados previos.

Limitaciones: las pruebas de núcleo/adaptador son simuladas, no pruebas integrales de navegador ni Google. No se puede impedir fotografiar el contenido ya entregado, usar otro dispositivo o copiar identificadores locales por un atacante avanzado. La interfaz pública no deberá contener los nuevos enunciados; los enunciados antiguos permanecen expuestos en el historial. No se contrata ningún servicio.

## Estructura estándar de la plataforma (criterio del responsable)
La experiencia del candidato mantiene el flujo de V35: identificación e instrucciones → preguntas de opción múltiple → simuladores prácticos → preguntas abiertas → finalización y entrega. Los simuladores conservan sus herramientas y navegación secuencial según el formulario; los estados técnicos internos no se convierten en nuevas etapas visibles por competencia. Las competencias profesionales son etiquetas privadas de configuración, evaluación y diagnóstico, no títulos de etapas. Para un mismo proceso, todos los candidatos reciben el mismo formulario, datos, orden, duración y rúbrica. El administrador podrá configurar contenidos, simuladores, cantidad de preguntas, duración y pesos para futuros procesos sin modificar esta estructura general. Mantener los comentarios de retroalimentación únicamente en pilotos. No cambiar la producción V35 ni publicar la V36 sin autorización.

## Prioridad acordada 2026-11-26
La V36 se limita a la evaluación de Asesor de Métricas para P06–P15: cerrar brechas de seguridad y mantener flujo, simuladores, ponderaciones, 75 minutos y formulario común. Posponer administrador, parametrización general y plataforma multiproceso hasta concluir la selección. No desplegar ni interrumpir V35/pilotos. No generar nuevas invitaciones de producción ni contratar servicios. Priorizar integración segura y una prueba integral aislada; si falta validación, no presentar la versión como lista.
