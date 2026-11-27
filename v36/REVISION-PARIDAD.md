# Revisión de paridad V35 / V36.4
## Alcance y estado
Referencia funcional: respaldo-v35-20261126 y estructuras de entregas P00/P01. Producción: V36.3. Esta rama es de revisión; no desplegar todavía. El banco privado (commit a1dbca0bf960a123ec18bc0c6d8b8ccfab6120fc) y sus ponderaciones no cambian.
## Regresiones verificadas y correcciones preparadas
- Portal: restaurar opciones verticales A–D, navegación anterior/siguiente y continuación directa desde última pregunta, accesos a 14/15, índice de pregunta local, barra de progreso, reloj y espacio ancho de V35.
- Excel: conservar el asistente de 21 funciones V36.3; guardar/restaurar fórmulas, orden de filas y configuración visual. No utilizar una nota del navegador como nota oficial.
- Pivots: conservar arreglo de meses V36.2, persistir los ejercicios cerrados y el ejercicio en curso (campos, filtro, orden, respuestas). Recalcular los totales del informe en el servidor.
- SQL/Python: conservar código, evidencia de la última ejecución, salidas, número de ejecuciones y, para Python, indicador de motor. Evidencia de cliente no es calificación independiente.
- Integridad: recuperar acumulación de métricas por intento al reingresar, resumen y reglas orientativas de P00/P01, registro de bloqueos de otros navegadores y pestañas. No equiparar una alerta a prueba de fraude.
- Cierre: corregir redibujado si el servidor cierra por tiempo durante un guardado; comentarios fuera del tiempo.
## Resultados de pruebas realizadas
- Nueve archivos de interfaz en main: sintaxis válida.
- Receptor de esta rama: 20 comprobaciones de funciones puras con banco real y respuestas de prueba, todas pasadas (incluye progreso, cierres, auditoría, borradores, evidencias, plazos, informe y recuperación).
- Portal de esta rama: 14 comprobaciones integradas con DOM y transporte simulados y receptor de esta rama, todas pasadas.
- SQL/Python: 11 comprobaciones con DOM, SQLite/Pyodide y transporte simulados, todas pasadas. No se ejecutaron los motores CDN reales.
- Pruebas anteriores: 21 funciones de Excel y el asistente con datos sintéticos; reparación de pivots con filtros y tres ejercicios.
## Aceptación obligatoria antes de publicar a candidatos
- Probar en un navegador real los cuatro simuladores (incluye conexión y carga de SQLite, Pyodide/pandas), rangos y selección táctil, navegación y cierre.
- Comprobar reingreso y recuperación de datos/alertas, cronómetro real, guardado en GitHub privado y entrega de prueba sin afectar P00/P01 ni invitaciones ajenas.
- Calificación independiente y rúbrica de todos los módulos. No usar las salidas del navegador como evidencia definitiva de corrección.
- Revisar equivalencia de dificultad del banco de preguntas con V35 y aprobación del responsable antes de cambiarlo.
## Limitaciones
Los resultados de esta revisión no equivalen a una validación 100 % en producción. El receptor integrado de esta rama no se ha instalado en Google Apps Script ni las mejoras de la rama se han publicado en GitHub Pages. La conexión de diagnóstico anterior sí se confirmó, pero la interfaz completa requiere prueba real. No se consumieron invitaciones, no se alteraron entregas ni se activaron servicios de pago.
