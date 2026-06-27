import type { FastifyReply } from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { ActsService } from '../src/modules/acts/acts.service.js';
import { ActPdfService } from '../src/modules/acts/pdf.service.js';

const replyMock = () =>
  ({
    header: vi.fn().mockReturnThis(),
    send: vi.fn().mockImplementation((payload: unknown) => payload),
  }) as unknown as FastifyReply;

const pageCount = (pdf: Buffer) => pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0;

describe('ActPdfService', () => {
  it('genera un acta de ingreso normal en una sola página', async () => {
    const acts = {
      getEntry: vi.fn().mockResolvedValue({
        status: 'emitida',
        act_number: 'AI-2026-0001',
        act_date: '2026-06-21',
        concept: 'Ingreso de suministros de oficina',
        notes: null,
        registered_by: 'María Zambrano',
        authority_snapshot: { firstNames: 'Ana Lucía', lastNames: 'Pérez Ruiz' },
        authority_first_names: null,
        authority_last_names: null,
        acquisition_process_type: 'Ínfima cuantía',
        acquisition_process_code: 'IC-02D02-2026-001',
        support_document: 'Factura 001-001-000012345',
        supplier_name: 'Suministros Educativos S.A.',
        supplier_tax_id: '0999999999001',
        subtotal: '150.00',
        vat_total: '22.50',
        total: '172.50',
        items: [
          {
            material_code: 'MAT-001',
            material_name: 'Resmas de papel bond A4',
            unit: 'paq.',
            quantity: '5.00',
            unit_value: '10.00',
            vat_value: '7.50',
            total: '57.50',
          },
          {
            material_code: 'MAT-002',
            material_name: 'Tóner para impresora',
            unit: 'unid.',
            quantity: '2.00',
            unit_value: '50.00',
            vat_value: '15.00',
            total: '115.00',
          },
        ],
      }),
    } as unknown as ActsService;
    const pdf = (await new ActPdfService(acts).sendEntry('1', replyMock())) as unknown as Buffer;

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pageCount(pdf)).toBe(1);
  });

  it('genera un acta de entrega normal en una sola página', async () => {
    const acts = {
      getDelivery: vi.fn().mockResolvedValue({
        status: 'emitida',
        act_number: 'AE-2026-0001',
        act_date: '2026-06-21',
        subject: null,
        notes: null,
        registered_by: 'María Zambrano',
        institution_snapshot: { name: 'Unidad Educativa Chillanes', amieCode: '02H00001' },
        institution_name: 'Unidad Educativa Chillanes',
        leader_snapshot: {
          firstNames: 'Carlos Andrés',
          lastNames: 'López Mora',
          position: 'rector',
          nationalId: '0200000001',
        },
        leader_first_names: 'Carlos Andrés',
        leader_last_names: 'López Mora',
        leader_position: 'rector',
        items: [
          { material_name: 'Resmas de papel bond A4', unit: 'paq.', quantity: '5.00' },
          { material_name: 'Tóner para impresora', unit: 'unid.', quantity: '2.00' },
        ],
      }),
    } as unknown as ActsService;
    const pdf = (await new ActPdfService(acts).sendDelivery('1', replyMock())) as unknown as Buffer;

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pageCount(pdf)).toBe(1);
  });
});
