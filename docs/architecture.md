# Arquitectura y reglas transaccionales

## Límites del sistema

La API es el único componente autorizado a modificar existencias. PostgreSQL es la fuente de verdad; `materials.current_stock` es una proyección rápida cuyo valor queda respaldado por `inventory_movements`.

Los catálogos no se eliminan cuando ya participaron en documentos: se desactivan. Al emitir, las actas guardan también una fotografía JSON controlada por el servidor de la autoridad, institución y líder. Esto protege el contenido histórico ante cambios posteriores de nombres o cargos.

## Emisión

La emisión se ejecuta con aislamiento `SERIALIZABLE`:

1. Bloquea el borrador y comprueba su estado.
2. Valida partes activas y al menos un detalle.
3. Incrementa atómicamente `document_sequences` por tipo y año.
4. Bloquea materiales en orden estable para reducir interbloqueos.
5. Valida stock, actualiza existencias e inserta un movimiento por material.
6. Marca el acta como emitida y almacena número, fecha y fotografías históricas.
7. Registra el evento en `audit_logs`.

Si un paso falla, PostgreSQL revierte todo. Un borrador no consume secuencial y dos emisiones concurrentes no pueden compartir número.

## Anulación

Una anulación nunca borra ni edita movimientos anteriores. Crea movimientos compensatorios dentro de otra transacción serializable. La reversión de un ingreso se rechaza si produciría stock negativo; primero debe resolverse la trazabilidad de las salidas posteriores.

## Decimales

Cantidades y dinero se almacenan como `numeric`, se reciben con máximo dos decimales y se calculan con `decimal.js`. No se usa aritmética binaria de punto flotante para valores económicos.

## Evolución

- Los módulos pueden separarse por dominio sin cambiar contratos HTTP.
- Para alta disponibilidad, varias instancias pueden compartir PostgreSQL; las invariantes se conservan en la base.
- Los PDF son efímeros. Si se requiere archivo legal inmutable, puede agregarse almacenamiento de objetos con hash y firma, sin cambiar la emisión.
- Los reportes pesados pueden leer de una réplica, mientras escrituras y stock permanecen en la primaria.
