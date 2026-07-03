# Trazabilidad del documento funcional

| Requisito                             | Implementación principal                                              |
| ------------------------------------- | --------------------------------------------------------------------- |
| HU-01/HU-02 sesión                    | `/auth/login`, `/refresh`, `/logout`, `/me`                           |
| HU-03 usuarios                        | `/users` con rol administrador, correo único y Argon2id               |
| HU-04 instituciones                   | `/instituciones`, activación sin borrado                              |
| HU-05 líderes                         | `/lideres`, índice parcial de un activo por institución               |
| HU-06 autoridades                     | `/autoridades-distritales`, selección obligatoria al emitir ingreso   |
| HU-07/HU-08 catálogos                 | `/categorias`, `/unidades-medida`                                     |
| HU-09 materiales                      | `/materiales`; el contrato no expone escritura de `current_stock`     |
| HU-10 adquisiciones                   | `/procesos-adquisicion`, relación opcional con ingresos               |
| HU-11/HU-12 ingreso borrador/economía | `POST/PUT /actas-ingreso`, cálculo decimal por línea                  |
| HU-13 emisión de ingreso              | `/actas-ingreso/:id/emitir`, transacción y movimientos de entrada     |
| HU-14 borrador de entrega             | `POST/PUT /actas-entrega`, institución, líder y materiales            |
| HU-15 emisión de entrega              | `/actas-entrega/:id/emitir`, bloqueo y validación de stock            |
| HU-16 PDF                             | `/:id/pdf` para cada tipo, solo estado emitido                        |
| HU-17 inventario                      | `/inventario/existencias`, búsqueda, categoría, stock y alertas       |
| HU-18 movimientos                     | `/inventario/movimientos`, filtros y referencia documental            |
| HU-19 anulación                       | `/:id/anular`, motivo obligatorio y movimientos compensatorios        |
| HU-20 consulta de actas               | listados y detalle con filtros por año, estado, número y fecha        |
| HU-21 numeración                      | `document_sequences`, independiente por tipo/año y asignada al emitir |

La regla de inventario se resuelve con actas: las actas de ingreso aumentan existencias y las actas de entrega disminuyen existencias. `POST /inventario/ajustes` queda deshabilitado por seguridad para evitar modificaciones manuales sin documento formal. La consulta de stock actual se realiza con `GET /inventario/existencias`, las alertas de materiales agotados o por debajo del mínimo con `GET /inventario/alertas-bajo-stock` y el historial con `GET /inventario/movimientos`. El maestro de materiales evita duplicados activos por código o por nombre normalizado + categoría + unidad; si cambia el proveedor, la orden o el proceso, se registra una nueva acta/proceso sobre el mismo material existente.
