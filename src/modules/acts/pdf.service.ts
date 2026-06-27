import { existsSync } from 'node:fs';
import path from 'node:path';
import type { FastifyReply } from 'fastify';
import PDFDocument from 'pdfkit';
import { ConflictError } from '../../core/errors.js';
import { escapePdfText } from '../../core/text.js';
import type { ActsService } from './acts.service.js';

type Snapshot = Record<string, string | null | undefined>;
type Alignment = 'left' | 'center' | 'right';
type TableOptions = { alignments?: Alignment[]; boldRows?: ReadonlySet<number> };

const ENTRY_OBSERVATION =
  'Los materiales detallados en la presente acta son recibidos en buen estado y serán registrados en el inventario de la Unidad Distrital Administrativa mediante el sistema SIARE.';
const DELIVERY_OBSERVATION =
  'Los materiales detallados en la presente acta son entregados en buen estado, nuevos y completos, para uso de la institución educativa receptora. La institución beneficiaria recibe los materiales a entera satisfacción, comprometiéndose a utilizarlos para fines administrativos, académicos o institucionales, según corresponda.';

export class ActPdfService {
  constructor(private readonly acts: ActsService) {}

  async sendEntry(id: string, reply: FastifyReply) {
    const act = await this.acts.getEntry(id);
    if (act.status !== 'emitida') throw new ConflictError('Solo se puede generar PDF de un acta emitida');

    const authority = (act.authority_snapshot ?? {}) as Snapshot;
    const authorityName = this.fullName(
      authority['firstNames'] ?? act.authority_first_names,
      authority['lastNames'] ?? act.authority_last_names,
    );
    const doc = this.document(act.act_number ?? 'ACTA');

    this.header(doc, 'ACTA DE INGRESO DE MATERIALES', act.act_number ?? '', act.act_date);
    this.sectionTitle(doc, '1. Datos del ingreso');
    this.infoTable(doc, [
      ['Unidad responsable', 'Unidad Distrital Administrativa'],
      ['Autoriza', authorityName || '-'],
      ['Proceso de adquisición', act.acquisition_process_type ?? '-'],
      ['Código del proceso', act.acquisition_process_code ?? '-'],
      ['Documento de respaldo', act.support_document ?? '-'],
      ['Proveedor', act.supplier_name ?? '-'],
      ['RUC proveedor', act.supplier_tax_id ?? '-'],
      ['Concepto', act.concept ?? '-'],
    ]);

    this.sectionTitle(doc, '2. Detalle de materiales ingresados');
    const detailRows: unknown[][] = act.items.map((item, index) => [
      index + 1,
      item.material_code ?? '-',
      item.material_name,
      item.unit ?? '-',
      this.qty(item.quantity),
      this.money(item.unit_value),
      this.money(item.vat_value),
      this.money(item.total),
    ]);
    detailRows.push(
      ['', '', '', '', '', '', 'Subtotal', this.money(act.subtotal)],
      ['', '', '', '', '', '', 'IVA', this.money(act.vat_total)],
      ['', '', '', '', '', '', 'TOTAL', this.money(act.total)],
    );
    this.simpleTable(
      doc,
      ['N.º', 'Código', 'Descripción del material', 'Unidad', 'Cantidad', 'Valor unitario', 'IVA', 'Total'],
      detailRows,
      [25, 52, 150, 45, 48, 67, 56, 68],
      {
        alignments: ['center', 'left', 'left', 'center', 'right', 'right', 'right', 'right'],
        boldRows: new Set([detailRows.length - 3, detailRows.length - 2, detailRows.length - 1]),
      },
    );

    this.sectionTitle(doc, '3. Observación');
    this.observationBox(doc, act.notes ?? ENTRY_OBSERVATION);
    this.sectionTitle(doc, '4. Firmas de responsabilidad');
    this.signatureBox(
      doc,
      'Recibe conforme',
      '___________________________',
      'Registra en el sistema',
      act.registered_by,
    );
    return this.finish(doc, reply, act.act_number ?? `ingreso-${id}`);
  }

  async sendDelivery(id: string, reply: FastifyReply) {
    const act = await this.acts.getDelivery(id);
    if (act.status !== 'emitida') throw new ConflictError('Solo se puede generar PDF de un acta emitida');

    const institution = (act.institution_snapshot ?? {}) as Snapshot;
    const leader = (act.leader_snapshot ?? {}) as Snapshot;
    const leaderName = this.fullName(
      leader['firstNames'] ?? act.leader_first_names,
      leader['lastNames'] ?? act.leader_last_names,
    );
    const doc = this.document(act.act_number ?? 'ACTA');

    this.header(doc, 'ACTA DE ENTREGA-RECEPCIÓN DE MATERIALES', act.act_number ?? '', act.act_date);
    this.sectionTitle(doc, '1. Datos de la entrega');
    this.infoTable(doc, [
      ['Unidad que entrega', 'Unidad Distrital Administrativa'],
      ['Institución receptora', institution['name'] ?? act.institution_name],
      ['Código AMIE', institution['amieCode'] ?? '-'],
      ['Líder institucional', leaderName || '-'],
      ['Cargo', this.titleCasePosition(leader['position'] ?? act.leader_position)],
      ['Cédula', leader['nationalId'] ?? '-'],
      ['Concepto', act.subject ?? 'Entrega de materiales para uso administrativo e institucional'],
    ]);

    this.sectionTitle(doc, '2. Detalle de materiales entregados');
    this.simpleTable(
      doc,
      ['N.º', 'Descripción del material', 'Cantidad', 'Unidad'],
      act.items.map((item, index) => [
        index + 1,
        item.material_name,
        this.qty(item.quantity),
        item.unit ?? '-',
      ]),
      [35, 326, 75, 75],
      { alignments: ['center', 'left', 'right', 'center'] },
    );

    this.sectionTitle(doc, '3. Observación');
    this.observationBox(doc, act.notes ?? DELIVERY_OBSERVATION);
    this.sectionTitle(doc, '4. Firmas de responsabilidad');
    this.signatureBox(doc, 'Entrega conforme', act.registered_by, 'Recibe conforme', leaderName || '-');
    return this.finish(doc, reply, act.act_number ?? `entrega-${id}`);
  }

  private document(number: string) {
    return new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margins: { top: 36, bottom: 36, left: 42, right: 42 },
      info: {
        Title: escapePdfText(number),
        Author: 'SIARE - Unidad Distrital Administrativa',
        Subject: 'Acta institucional',
      },
    });
  }

  private header(doc: PDFKit.PDFDocument, title: string, actNumber: string, date: unknown) {
    const left = doc.page.margins.left;
    const width = this.contentWidth(doc);
    const top = doc.page.margins.top;
    const logo = this.logoPath();
    if (logo) {
      try {
        doc.image(logo, left, top, { width: 120 });
      } catch {
        // El encabezado de texto mantiene utilizable el PDF si el recurso está dañado.
      }
    }

    doc.font('Helvetica-Bold').fillColor('#111827').fontSize(8.5);
    doc.text('MINISTERIO DE EDUCACIÓN', left, top, { width, align: 'center', lineGap: 0 });
    doc.fontSize(8).text('COORDINACIÓN ZONAL 5', { width, align: 'center', lineGap: 0 });
    doc.text('DIRECCIÓN DISTRITAL 02D02 CHILLANES-EDUCACIÓN', { width, align: 'center', lineGap: 0 });
    doc.text('UNIDAD DISTRITAL ADMINISTRATIVA', { width, align: 'center', lineGap: 0 });
    doc.moveDown(0.45).fontSize(11).text(escapePdfText(title), { width, align: 'center' });

    const metaY = doc.y + 5;
    doc.font('Helvetica-Bold').fontSize(8.5);
    doc.text(`Acta N.º: ${escapePdfText(actNumber)}`, left, metaY, { width: width / 2, align: 'left' });
    doc.text(`Fecha: ${escapePdfText(date)}`, left + width / 2, metaY, { width: width / 2, align: 'right' });
    doc.y = metaY + 14;
  }

  private infoTable(doc: PDFKit.PDFDocument, rows: [string, unknown][]) {
    const left = doc.page.margins.left;
    const totalWidth = this.contentWidth(doc);
    const labelWidth = 135;
    const valueWidth = totalWidth - labelWidth;
    for (const [label, rawValue] of rows) {
      const value = escapePdfText(rawValue ?? '-');
      doc.fontSize(8);
      const labelHeight = doc.font('Helvetica-Bold').heightOfString(label, { width: labelWidth - 12 });
      const valueHeight = doc.font('Helvetica').heightOfString(value, { width: valueWidth - 12 });
      const rowHeight = Math.max(17, labelHeight, valueHeight) + 6;
      this.ensureSpace(doc, rowHeight);
      const y = doc.y;
      doc.rect(left, y, labelWidth, rowHeight).fillAndStroke('#eef3f7', '#aeb8c2');
      doc.rect(left + labelWidth, y, valueWidth, rowHeight).fillAndStroke('#ffffff', '#aeb8c2');
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(escapePdfText(label), left + 6, y + 5, {
          width: labelWidth - 12,
        });
      doc.font('Helvetica').text(value, left + labelWidth + 6, y + 5, { width: valueWidth - 12 });
      doc.y = y + rowHeight;
    }
  }

  private simpleTable(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: unknown[][],
    widths: number[],
    options: TableOptions = {},
  ) {
    const left = doc.page.margins.left;
    const totalWidth = widths.reduce((sum, width) => sum + width, 0);
    if (Math.abs(totalWidth - this.contentWidth(doc)) > 1)
      throw new Error('El ancho de la tabla no coincide con el área imprimible');

    const drawHeader = () => {
      doc.font('Helvetica-Bold').fontSize(7.2);
      const headerHeight =
        Math.max(
          20,
          ...headers.map((header, index) =>
            doc.heightOfString(escapePdfText(header), { width: (widths[index] ?? 50) - 8, align: 'center' }),
          ),
        ) + 5;
      this.ensureSpace(doc, headerHeight);
      const y = doc.y;
      let x = left;
      headers.forEach((header, index) => {
        const width = widths[index] ?? 50;
        doc.rect(x, y, width, headerHeight).fillAndStroke('#1f4e78', '#173b5c');
        doc
          .fillColor('#ffffff')
          .font('Helvetica-Bold')
          .fontSize(7.2)
          .text(escapePdfText(header), x + 4, y + 5, {
            width: width - 8,
            align: 'center',
          });
        x += width;
      });
      doc.fillColor('#111827');
      doc.y = y + headerHeight;
    };

    drawHeader();
    rows.forEach((row, rowIndex) => {
      const bold = options.boldRows?.has(rowIndex) ?? false;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.4);
      const rowHeight =
        Math.max(
          16,
          ...row.map((value, index) =>
            doc.heightOfString(escapePdfText(value), {
              width: (widths[index] ?? 50) - 8,
              align: options.alignments?.[index] ?? 'left',
            }),
          ),
        ) + 6;
      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        drawHeader();
      }

      const y = doc.y;
      let x = left;
      row.forEach((value, index) => {
        const width = widths[index] ?? 50;
        doc.rect(x, y, width, rowHeight).fillAndStroke(rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc', '#c7cfd7');
        doc
          .fillColor('#111827')
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(7.4)
          .text(escapePdfText(value), x + 4, y + 4, {
            width: width - 8,
            align: options.alignments?.[index] ?? 'left',
          });
        x += width;
      });
      doc.y = y + rowHeight;
    });
  }

  private observationBox(doc: PDFKit.PDFDocument, text: unknown) {
    const left = doc.page.margins.left;
    const width = this.contentWidth(doc);
    const value = escapePdfText(text);
    doc.font('Helvetica').fontSize(8);
    const height = Math.max(34, doc.heightOfString(value, { width: width - 16, lineGap: 1 }) + 16);
    this.ensureSpace(doc, height);
    const y = doc.y;
    doc.rect(left, y, width, height).fillAndStroke('#f8fafc', '#aeb8c2');
    doc
      .fillColor('#111827')
      .font('Helvetica')
      .fontSize(8)
      .text(value, left + 8, y + 8, {
        width: width - 16,
        lineGap: 1,
        align: 'justify',
      });
    doc.y = y + height;
  }

  private signatureBox(
    doc: PDFKit.PDFDocument,
    leftTitle: string,
    leftName: unknown,
    rightTitle: string,
    rightName: unknown,
  ) {
    const left = doc.page.margins.left;
    const totalWidth = this.contentWidth(doc);
    const columnWidth = totalWidth / 2;
    const height = 70;
    this.ensureSpace(doc, height);
    const y = doc.y;
    [
      { x: left, title: leftTitle, name: leftName },
      { x: left + columnWidth, title: rightTitle, name: rightName },
    ].forEach(({ x, title, name }) => {
      doc.rect(x, y, columnWidth, height).strokeColor('#aeb8c2').stroke();
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(escapePdfText(title), x + 8, y + 7, {
          width: columnWidth - 16,
          align: 'center',
        });
      doc
        .moveTo(x + 28, y + 40)
        .lineTo(x + columnWidth - 28, y + 40)
        .strokeColor('#4b5563')
        .stroke();
      doc
        .font('Helvetica')
        .fontSize(7.8)
        .text(`Nombre: ${escapePdfText(name)}`, x + 8, y + 47, {
          width: columnWidth - 16,
          align: 'center',
        });
    });
    doc.y = y + height;
  }

  private sectionTitle(doc: PDFKit.PDFDocument, title: string) {
    this.ensureSpace(doc, 22);
    doc.moveDown(0.45).fillColor('#1f2937').font('Helvetica-Bold').fontSize(9).text(escapePdfText(title));
    doc.moveDown(0.25);
  }

  private fullName(firstNames: unknown, lastNames: unknown) {
    return `${escapePdfText(firstNames)} ${escapePdfText(lastNames)}`.replace(/\s+/g, ' ').trim();
  }

  private titleCasePosition(position: unknown) {
    const value = escapePdfText(position).trim();
    return value ? `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}` : '-';
  }

  private money(value: unknown) {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) ? `$ ${amount.toFixed(2)}` : '$ 0.00';
  }

  private qty(value: unknown) {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return '0';
    return amount
      .toFixed(2)
      .replace(/\.00$/, '')
      .replace(/(\.\d)0$/, '$1');
  }

  private logoPath() {
    const candidates = [
      path.resolve(process.cwd(), 'public/logos/ministerio-educacion.png'),
      path.resolve(process.cwd(), 'src/assets/logos/ministerio-educacion.png'),
    ];
    return candidates.find((candidate) => existsSync(candidate));
  }

  private contentWidth(doc: PDFKit.PDFDocument) {
    return doc.page.width - doc.page.margins.left - doc.page.margins.right;
  }

  private ensureSpace(doc: PDFKit.PDFDocument, height: number) {
    if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
  }

  private async finish(doc: PDFKit.PDFDocument, reply: FastifyReply, filename: string) {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const completed = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
    doc.end();
    const buffer = await completed;
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}.pdf"`)
      .send(buffer);
  }
}
