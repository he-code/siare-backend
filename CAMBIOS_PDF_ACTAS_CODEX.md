# Cambios PDF actas SIARE (para Codex)

## Objetivo
Ajustar PDFs de acta de ingreso y acta de entrega para que coincidan con los modelos aprobados. Mantener la lógica de emisión, stock y numeración. Priorizar una sola página A4 para documentos normales.

## Archivos principales
- `src/modules/acts/pdf.service.ts` (principal)
- `src/modules/acts/acts.service.ts` (solo para exponer datos faltantes)
- `src/modules/catalogs/catalogs.routes.ts` y `src/modules/catalogs/catalogs.service.ts` (solo si se agrega `supportDocument`)
- `src/db/types.ts` y `migrations/*.sql` (solo si se agrega `support_document`)

---

## 0) Logo institucional
Agregar el logo oficial del Ministerio de Educación en el encabezado de ambas actas.

Asset recomendado:
- Usar el archivo PNG transparente/optimizado del logo del Ministerio de Educación.
- Guardarlo en el repo como: `src/assets/logos/ministerio-educacion.png` o `public/logos/ministerio-educacion.png`, según la estructura actual del proyecto.
- No usar JPG/JPEG para el logo.

Uso en PDF:
- Mostrar el logo en la parte superior izquierda del encabezado.
- Mantener proporción; no estirar ni deformar.
- Tamaño sugerido: ancho 110-140 px aprox., alto automático.
- Si el archivo no existe, no romper la generación del PDF; continuar solo con el texto del encabezado.
- Aplicar tanto en `ACTA DE INGRESO DE MATERIALES` como en `ACTA DE ENTREGA-RECEPCIÓN DE MATERIALES`.

## 1) Acta de entrega: formato requerido

### Encabezado
Mostrar centrado:
- `MINISTERIO DE EDUCACIÓN`
- `COORDINACIÓN ZONAL 5`
- `DIRECCIÓN DISTRITAL 02D02 CHILLANES-EDUCACIÓN`
- `UNIDAD DISTRITAL ADMINISTRATIVA`
- Título: `ACTA DE ENTREGA-RECEPCIÓN DE MATERIALES`

Mostrar en la misma línea:
- izquierda: `Acta N.º: {act.act_number}`
- derecha: `Fecha: {act.act_date}`

No es obligatorio agregar logos si no existen assets en el repo.

### Sección `1. Datos de la entrega`
Usar tabla compacta de 2 columnas:

| etiqueta | valor |
|---|---|
| Unidad que entrega | Unidad Distrital Administrativa |
| Institución receptora | `institution_snapshot.name ?? act.institution_name` |
| Código AMIE | `institution_snapshot.amieCode ?? '-'` |
| Líder institucional | nombre completo del líder |
| Cargo | cargo del líder con primera letra mayúscula |
| Cédula | `leader_snapshot.nationalId ?? '-'` |
| Concepto | `act.subject ?? 'Entrega de materiales para uso administrativo e institucional'` |

### Sección `2. Detalle de materiales entregados`
La tabla debe tener SOLO estas columnas:

| N.º | Descripción del material | Cantidad | Unidad |
|---:|---|---:|---|

Reglas:
- No mostrar código.
- No mostrar categoría.
- No mostrar observación por ítem.
- `N.º` es índice desde 1.
- Descripción = `item.material_name`.
- Cantidad = `item.quantity`.
- Unidad = `item.unit ?? '-'`.

### Sección `3. Observación`
Mostrar en un recuadro:
- Si `act.notes` existe, usarlo.
- Si no existe, usar:
`Los materiales detallados en la presente acta son entregados en buen estado, nuevos y completos, para uso de la institución educativa receptora. La institución beneficiaria recibe los materiales a entera satisfacción, comprometiéndose a utilizarlos para fines administrativos, académicos o institucionales, según corresponda.`

### Sección `4. Firmas de responsabilidad`
Tabla de 2 columnas:
- izquierda: `Entrega conforme`
- derecha: `Recibe conforme`

Contenido:
- Línea de firma.
- `Nombre: {act.registered_by}`
- `Nombre: {leaderFullName}`

No mostrar cargo en firmas.

---

## 2) Acta de ingreso: formato requerido

### Encabezado
Mostrar centrado:
- `MINISTERIO DE EDUCACIÓN`
- `COORDINACIÓN ZONAL 5`
- `DIRECCIÓN DISTRITAL 02D02 CHILLANES-EDUCACIÓN`
- `UNIDAD DISTRITAL ADMINISTRATIVA`
- Título: `ACTA DE INGRESO DE MATERIALES`

Mostrar en la misma línea:
- izquierda: `Acta N.º: {act.act_number}`
- derecha: `Fecha: {act.act_date}`

### Sección `1. Datos del ingreso`
Usar tabla compacta de 2 columnas:

| etiqueta | valor |
|---|---|
| Unidad responsable | Unidad Distrital Administrativa |
| Autoriza | solo nombre completo de autoridad |
| Proceso de adquisición | `acquisition.process_type ?? '-'` |
| Código del proceso | `acquisition.process_code ?? '-'` |
| Documento de respaldo | `acquisition.support_document ?? '-'` |
| Proveedor | `acquisition.supplier_name ?? '-'` |
| RUC proveedor | `acquisition.supplier_tax_id ?? '-'` |
| Concepto | `act.concept ?? '-'` |

Importante:
- En `Autoriza` mostrar SOLO nombre y apellido.
- No mostrar cargo ni cédula de la autoridad.

### Sección `2. Detalle de materiales ingresados`
Tabla única con detalle y totales dentro de la misma tabla:

| N.º | Código | Descripción del material | Unidad | Cantidad | Valor unitario | IVA | Total |
|---:|---|---|---|---:|---:|---:|---:|

Reglas:
- `N.º` es índice desde 1.
- Código = `item.material_code ?? '-'`.
- Descripción = `item.material_name`.
- Unidad = `item.unit ?? '-'`.
- IVA = `item.vat_value`.
- Total = `item.total`.
- Al final agregar filas dentro de la misma tabla:
  - `Subtotal` => `act.subtotal`
  - `IVA` => `act.vat_total`
  - `TOTAL` => `act.total`

No crear un bloque separado de resumen económico.

### Sección `3. Observación`
Mostrar en recuadro:
- Si `act.notes` existe, usarlo.
- Si no existe, usar:
`Los materiales detallados en la presente acta son recibidos en buen estado y serán registrados en el inventario de la Unidad Distrital Administrativa mediante el sistema SIARE.`

### Sección `4. Firmas de responsabilidad`
Tabla de 2 columnas:
- izquierda: `Recibe conforme`
- derecha: `Registra en el sistema`

Contenido:
- Línea de firma.
- `Nombre: {nombre_recibe_bodega}` si existe; si no, usar `Nombre: ___________________________`.
- `Nombre: {act.registered_by}`.
- Mostrar cargo solo si ya existe en el modelo actual para ingreso. No modificar base por este dato ahora.

---

## 3) Datos faltantes para acta de ingreso
Actualmente `getEntry()` no expone datos del proceso de adquisición. Agregar `leftJoin('acquisition_processes', ...)` en `src/modules/acts/acts.service.ts`.

Seleccionar al menos:
- `acquisition_processes.process_type as acquisition_process_type`
- `acquisition_processes.process_code as acquisition_process_code`
- `acquisition_processes.supplier_name as supplier_name`
- `acquisition_processes.supplier_tax_id as supplier_tax_id`
- `acquisition_processes.support_document as support_document` si se agrega el campo.

### Si no existe `support_document`
Agregarlo como nullable:

```sql
ALTER TABLE acquisition_processes ADD COLUMN support_document varchar(150);
```

Actualizar también:
- `src/db/types.ts`: `support_document: string | null;`
- `AcquisitionBody`: `supportDocument: nullableString(150)`
- `AcquisitionInput`: `supportDocument?: string | null`
- `acquisitionValues()`: `support_document: cleanOptional(input.supportDocument)`
- `updateAcquisition()`: conservar valor anterior si `supportDocument === undefined`

---

## 4) Helpers sugeridos en `pdf.service.ts`
Para reducir duplicación, crear helpers privados:

- `header(doc, title, actNumber, date)`
- `infoTable(doc, rows)`
- `simpleTable(doc, headers, rows, widths, options?)`
- `observationBox(doc, text)`
- `signatureBox(doc, leftTitle, leftName, rightTitle, rightName)`
- `fullName(firstNames, lastNames)`
- `titleCasePosition(position)`
- `money(value)`
- `qty(value)`

Usar márgenes compactos:
- A4.
- `layout: 'portrait'`.
- Márgenes aprox: top 36, bottom 36, left 42, right 42.
- Fuente 8-10 pt.
- Evitar `moveDown(4)` antes de firmas; usar espacios controlados.

---

## 5) Criterios de aceptación

### Entrega
- PDF emitido muestra título `ACTA DE ENTREGA-RECEPCIÓN DE MATERIALES`.
- Datos incluyen Código AMIE, cédula y cargo del líder.
- Detalle solo tiene: `N.º`, `Descripción del material`, `Cantidad`, `Unidad`.
- Firmas solo muestran nombre; no muestran cargo.
- No aparece columna código en detalle de entrega.

### Ingreso
- PDF emitido muestra título `ACTA DE INGRESO DE MATERIALES`.
- `Autoriza` muestra solo nombre completo, sin cargo ni cédula.
- Datos incluyen Proveedor y RUC proveedor.
- Datos incluyen Documento de respaldo.
- Detalle y totales están en una sola tabla.
- No existe bloque separado de resumen económico.

### General
- No cambiar reglas de emisión, stock, anulación ni numeración.
- No romper endpoints existentes.
- Ejecutar: `npm run lint`, `npm run build`, `npm test`.
