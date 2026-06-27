import { Decimal } from 'decimal.js';
import { sql, type Transaction } from 'kysely';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors.js';
import { pageOf, paginated, type PageInput } from '../../core/pagination.js';
import { cleanOptional } from '../../core/text.js';
import { db } from '../../db/database.js';
import type { Database, JsonValue } from '../../db/types.js';
import {
  calculateEconomicLines,
  formatActNumber,
  roundMoney as money,
  roundQuantity as quantity,
} from './act-calculations.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

const periodFromDate = (value: string | Date) =>
  typeof value === 'string' ? Number(value.slice(0, 4)) : value.getUTCFullYear();

export interface EntryItemInput {
  materialId: string;
  quantity: number;
  unitValue: number;
  appliesVat: boolean;
  vatPercentage: number;
  notes?: string | null;
}

export interface EntryDraftInput {
  acquisitionProcessId?: string | null;
  authorizedById?: string | null;
  actDate: string;
  concept?: string | null;
  notes?: string | null;
  items: EntryItemInput[];
}

export interface DeliveryItemInput {
  materialId: string;
  quantity: number;
  notes?: string | null;
}

export interface DeliveryDraftInput {
  institutionId: string;
  leaderId: string;
  actDate: string;
  subject?: string | null;
  notes?: string | null;
  items: DeliveryItemInput[];
}

type ListActsInput = PageInput & {
  period?: number;
  status?: 'borrador' | 'emitida' | 'anulada';
  number?: string;
  dateFrom?: string;
  dateTo?: string;
};

export class ActsService {
  async createEntry(input: EntryDraftInput, userId: string, ip: string) {
    const totals = await this.validateAndCalculateEntryItems(input.items);
    return db.transaction().execute(async (trx) => {
      const act = await trx
        .insertInto('entry_acts')
        .values({
          acquisition_process_id: input.acquisitionProcessId ?? null,
          authorized_by_id: input.authorizedById ?? null,
          user_id: userId,
          act_date: input.actDate,
          concept: cleanOptional(input.concept),
          notes: cleanOptional(input.notes),
          subtotal: totals.subtotal,
          vat_total: totals.vatTotal,
          total: totals.total,
          status: 'borrador',
          period: null,
          sequence: null,
          act_number: null,
          cancellation_reason: null,
          authority_snapshot: null,
          issued_at: null,
          cancelled_at: null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('entry_act_items')
        .values(totals.items.map((item) => ({ entry_act_id: act.id, ...item })))
        .execute();
      await this.audit(trx, userId, 'entry_acts.create', 'entry_act', act.id, ip);
      return this.getEntry(act.id, trx);
    });
  }

  async updateEntry(id: string, input: EntryDraftInput, userId: string, ip: string) {
    const totals = await this.validateAndCalculateEntryItems(input.items);
    return db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('entry_acts')
        .select(['id', 'status'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!current) throw new NotFoundError('Acta de ingreso');
      if (current.status !== 'borrador') throw new ConflictError('Solo se puede editar un acta en borrador');
      await trx
        .updateTable('entry_acts')
        .set({
          acquisition_process_id: input.acquisitionProcessId ?? null,
          authorized_by_id: input.authorizedById ?? null,
          act_date: input.actDate,
          concept: cleanOptional(input.concept),
          notes: cleanOptional(input.notes),
          subtotal: totals.subtotal,
          vat_total: totals.vatTotal,
          total: totals.total,
        })
        .where('id', '=', id)
        .execute();
      await trx.deleteFrom('entry_act_items').where('entry_act_id', '=', id).execute();
      await trx
        .insertInto('entry_act_items')
        .values(totals.items.map((item) => ({ entry_act_id: id, ...item })))
        .execute();
      await this.audit(trx, userId, 'entry_acts.update', 'entry_act', id, ip);
      return this.getEntry(id, trx);
    });
  }

  async emitEntry(id: string, userId: string, ip: string) {
    return db
      .transaction()
      .setIsolationLevel('serializable')
      .execute(async (trx) => {
        const act = await trx
          .selectFrom('entry_acts')
          .selectAll()
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst();
        if (!act) throw new NotFoundError('Acta de ingreso');
        if (act.status !== 'borrador') throw new ConflictError('El acta ya fue emitida o anulada');
        if (!act.authorized_by_id)
          throw new BadRequestError('Debe seleccionar la autoridad que autoriza el ingreso');
        const authority = await trx
          .selectFrom('district_authorities')
          .selectAll()
          .where('id', '=', act.authorized_by_id)
          .executeTakeFirst();
        if (!authority?.active) throw new ConflictError('La autoridad seleccionada no está activa');
        const items = await trx
          .selectFrom('entry_act_items')
          .selectAll()
          .where('entry_act_id', '=', id)
          .orderBy('material_id')
          .execute();
        if (!items.length) throw new BadRequestError('El acta debe tener al menos un material');

        const period = periodFromDate(act.act_date);
        const { sequence, number } = await this.nextNumber(trx, 'ingreso', period);
        for (const item of items) {
          const material = await trx
            .selectFrom('materials')
            .select(['id', 'current_stock', 'active'])
            .where('id', '=', item.material_id)
            .forUpdate()
            .executeTakeFirst();
          if (!material?.active)
            throw new ConflictError(`El material ${item.material_id} no existe o está inactivo`);
          const newStock = quantity(new Decimal(material.current_stock).plus(item.quantity));
          await trx
            .updateTable('materials')
            .set({ current_stock: newStock, last_unit_value: item.unit_value })
            .where('id', '=', material.id)
            .execute();
          await trx
            .insertInto('inventory_movements')
            .values({
              material_id: material.id,
              user_id: userId,
              movement_type: 'entrada',
              quantity: item.quantity,
              previous_stock: material.current_stock,
              new_stock: newStock,
              reference_type: 'acta_ingreso',
              reference_id: id,
              notes: `Emisión ${number}`,
            })
            .execute();
        }
        await trx
          .updateTable('entry_acts')
          .set({
            period,
            sequence,
            act_number: number,
            status: 'emitida',
            issued_at: new Date(),
            authority_snapshot: {
              nationalId: authority.national_id,
              firstNames: authority.first_names,
              lastNames: authority.last_names,
              position: authority.position,
            },
          })
          .where('id', '=', id)
          .execute();
        await this.audit(trx, userId, 'entry_acts.emit', 'entry_act', id, ip, { number });
        return this.getEntry(id, trx);
      });
  }

  async cancelEntry(id: string, reason: string, userId: string, ip: string) {
    return db
      .transaction()
      .setIsolationLevel('serializable')
      .execute(async (trx) => {
        const act = await trx
          .selectFrom('entry_acts')
          .selectAll()
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst();
        if (!act) throw new NotFoundError('Acta de ingreso');
        if (act.status !== 'emitida') throw new ConflictError('Solo se puede anular un acta emitida');
        const items = await trx
          .selectFrom('entry_act_items')
          .selectAll()
          .where('entry_act_id', '=', id)
          .orderBy('material_id')
          .execute();
        for (const item of items) {
          const material = await trx
            .selectFrom('materials')
            .select(['id', 'current_stock'])
            .where('id', '=', item.material_id)
            .forUpdate()
            .executeTakeFirstOrThrow();
          const newStock = new Decimal(material.current_stock).minus(item.quantity);
          if (newStock.isNegative())
            throw new ConflictError(
              `No se puede anular: el material ${item.material_id} ya no tiene existencias suficientes`,
              'INSUFFICIENT_STOCK_FOR_REVERSAL',
            );
          await trx
            .updateTable('materials')
            .set({ current_stock: quantity(newStock) })
            .where('id', '=', material.id)
            .execute();
          await trx
            .insertInto('inventory_movements')
            .values({
              material_id: material.id,
              user_id: userId,
              movement_type: 'anulacion',
              quantity: item.quantity,
              previous_stock: material.current_stock,
              new_stock: quantity(newStock),
              reference_type: 'anulacion',
              reference_id: id,
              notes: `Anulación de ingreso ${act.act_number}`,
            })
            .execute();
        }
        await trx
          .updateTable('entry_acts')
          .set({ status: 'anulada', cancellation_reason: reason.trim(), cancelled_at: new Date() })
          .where('id', '=', id)
          .execute();
        await this.audit(trx, userId, 'entry_acts.cancel', 'entry_act', id, ip, { reason });
        return this.getEntry(id, trx);
      });
  }

  async createDelivery(input: DeliveryDraftInput, userId: string, ip: string) {
    await this.validateDeliveryItems(input.items);
    return db.transaction().execute(async (trx) => {
      await this.validateDeliveryParties(trx, input.institutionId, input.leaderId, false);
      const act = await trx
        .insertInto('delivery_acts')
        .values({
          institution_id: input.institutionId,
          leader_id: input.leaderId,
          user_id: userId,
          act_date: input.actDate,
          subject: cleanOptional(input.subject),
          notes: cleanOptional(input.notes),
          status: 'borrador',
          period: null,
          sequence: null,
          act_number: null,
          cancellation_reason: null,
          institution_snapshot: null,
          leader_snapshot: null,
          issued_at: null,
          cancelled_at: null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('delivery_act_items')
        .values(
          input.items.map((item) => ({
            delivery_act_id: act.id,
            material_id: item.materialId,
            quantity: quantity(item.quantity),
            notes: cleanOptional(item.notes),
          })),
        )
        .execute();
      await this.audit(trx, userId, 'delivery_acts.create', 'delivery_act', act.id, ip);
      return this.getDelivery(act.id, trx);
    });
  }

  async updateDelivery(id: string, input: DeliveryDraftInput, userId: string, ip: string) {
    await this.validateDeliveryItems(input.items);
    return db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('delivery_acts')
        .select(['id', 'status'])
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!current) throw new NotFoundError('Acta de entrega');
      if (current.status !== 'borrador') throw new ConflictError('Solo se puede editar un acta en borrador');
      await this.validateDeliveryParties(trx, input.institutionId, input.leaderId, false);
      await trx
        .updateTable('delivery_acts')
        .set({
          institution_id: input.institutionId,
          leader_id: input.leaderId,
          act_date: input.actDate,
          subject: cleanOptional(input.subject),
          notes: cleanOptional(input.notes),
        })
        .where('id', '=', id)
        .execute();
      await trx.deleteFrom('delivery_act_items').where('delivery_act_id', '=', id).execute();
      await trx
        .insertInto('delivery_act_items')
        .values(
          input.items.map((item) => ({
            delivery_act_id: id,
            material_id: item.materialId,
            quantity: quantity(item.quantity),
            notes: cleanOptional(item.notes),
          })),
        )
        .execute();
      await this.audit(trx, userId, 'delivery_acts.update', 'delivery_act', id, ip);
      return this.getDelivery(id, trx);
    });
  }

  async emitDelivery(id: string, userId: string, ip: string) {
    return db
      .transaction()
      .setIsolationLevel('serializable')
      .execute(async (trx) => {
        const act = await trx
          .selectFrom('delivery_acts')
          .selectAll()
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst();
        if (!act) throw new NotFoundError('Acta de entrega');
        if (act.status !== 'borrador') throw new ConflictError('El acta ya fue emitida o anulada');
        const parties = await this.validateDeliveryParties(trx, act.institution_id, act.leader_id, true);
        const items = await trx
          .selectFrom('delivery_act_items')
          .selectAll()
          .where('delivery_act_id', '=', id)
          .orderBy('material_id')
          .execute();
        if (!items.length) throw new BadRequestError('El acta debe tener al menos un material');
        const period = periodFromDate(act.act_date);
        const { sequence, number } = await this.nextNumber(trx, 'entrega', period);
        for (const item of items) {
          const material = await trx
            .selectFrom('materials')
            .select(['id', 'current_stock', 'active'])
            .where('id', '=', item.material_id)
            .forUpdate()
            .executeTakeFirst();
          if (!material?.active)
            throw new ConflictError(`El material ${item.material_id} no existe o está inactivo`);
          const newStock = new Decimal(material.current_stock).minus(item.quantity);
          if (newStock.isNegative())
            throw new ConflictError(
              `Stock insuficiente para el material ${item.material_id}`,
              'INSUFFICIENT_STOCK',
            );
          await trx
            .updateTable('materials')
            .set({ current_stock: quantity(newStock) })
            .where('id', '=', material.id)
            .execute();
          await trx
            .insertInto('inventory_movements')
            .values({
              material_id: material.id,
              user_id: userId,
              movement_type: 'salida',
              quantity: item.quantity,
              previous_stock: material.current_stock,
              new_stock: quantity(newStock),
              reference_type: 'acta_entrega',
              reference_id: id,
              notes: `Emisión ${number}`,
            })
            .execute();
        }
        await trx
          .updateTable('delivery_acts')
          .set({
            period,
            sequence,
            act_number: number,
            status: 'emitida',
            issued_at: new Date(),
            institution_snapshot: {
              amieCode: parties.institution.amie_code,
              name: parties.institution.name,
              circuit: parties.institution.circuit,
              canton: parties.institution.canton,
              parish: parties.institution.parish,
              address: parties.institution.address,
            },
            leader_snapshot: {
              nationalId: parties.leader.national_id,
              firstNames: parties.leader.first_names,
              lastNames: parties.leader.last_names,
              position: parties.leader.position,
            },
          })
          .where('id', '=', id)
          .execute();
        await this.audit(trx, userId, 'delivery_acts.emit', 'delivery_act', id, ip, { number });
        return this.getDelivery(id, trx);
      });
  }

  async cancelDelivery(id: string, reason: string, userId: string, ip: string) {
    return db
      .transaction()
      .setIsolationLevel('serializable')
      .execute(async (trx) => {
        const act = await trx
          .selectFrom('delivery_acts')
          .selectAll()
          .where('id', '=', id)
          .forUpdate()
          .executeTakeFirst();
        if (!act) throw new NotFoundError('Acta de entrega');
        if (act.status !== 'emitida') throw new ConflictError('Solo se puede anular un acta emitida');
        const items = await trx
          .selectFrom('delivery_act_items')
          .selectAll()
          .where('delivery_act_id', '=', id)
          .orderBy('material_id')
          .execute();
        for (const item of items) {
          const material = await trx
            .selectFrom('materials')
            .select(['id', 'current_stock'])
            .where('id', '=', item.material_id)
            .forUpdate()
            .executeTakeFirstOrThrow();
          const newStock = quantity(new Decimal(material.current_stock).plus(item.quantity));
          await trx
            .updateTable('materials')
            .set({ current_stock: newStock })
            .where('id', '=', material.id)
            .execute();
          await trx
            .insertInto('inventory_movements')
            .values({
              material_id: material.id,
              user_id: userId,
              movement_type: 'anulacion',
              quantity: item.quantity,
              previous_stock: material.current_stock,
              new_stock: newStock,
              reference_type: 'anulacion',
              reference_id: id,
              notes: `Anulación de entrega ${act.act_number}`,
            })
            .execute();
        }
        await trx
          .updateTable('delivery_acts')
          .set({ status: 'anulada', cancellation_reason: reason.trim(), cancelled_at: new Date() })
          .where('id', '=', id)
          .execute();
        await this.audit(trx, userId, 'delivery_acts.cancel', 'delivery_act', id, ip, { reason });
        return this.getDelivery(id, trx);
      });
  }

  async getEntry(id: string, client: typeof db | Transaction<Database> = db) {
    const act = await client
      .selectFrom('entry_acts')
      .innerJoin('users', 'users.id', 'entry_acts.user_id')
      .leftJoin('district_authorities', 'district_authorities.id', 'entry_acts.authorized_by_id')
      .leftJoin('acquisition_processes', 'acquisition_processes.id', 'entry_acts.acquisition_process_id')
      .select([
        'entry_acts.id',
        'entry_acts.acquisition_process_id',
        'entry_acts.authorized_by_id',
        'entry_acts.user_id',
        'users.name as registered_by',
        'entry_acts.period',
        'entry_acts.sequence',
        'entry_acts.act_number',
        'entry_acts.act_date',
        'entry_acts.concept',
        'entry_acts.subtotal',
        'entry_acts.vat_total',
        'entry_acts.total',
        'entry_acts.notes',
        'entry_acts.status',
        'entry_acts.cancellation_reason',
        'entry_acts.authority_snapshot',
        'entry_acts.issued_at',
        'entry_acts.cancelled_at',
        'entry_acts.created_at',
        'district_authorities.first_names as authority_first_names',
        'district_authorities.last_names as authority_last_names',
        'district_authorities.position as authority_position',
        'acquisition_processes.process_type as acquisition_process_type',
        'acquisition_processes.process_code as acquisition_process_code',
        'acquisition_processes.supplier_name as supplier_name',
        'acquisition_processes.supplier_tax_id as supplier_tax_id',
        'acquisition_processes.support_document as support_document',
      ])
      .where('entry_acts.id', '=', id)
      .executeTakeFirst();
    if (!act) throw new NotFoundError('Acta de ingreso');
    const items = await client
      .selectFrom('entry_act_items')
      .innerJoin('materials', 'materials.id', 'entry_act_items.material_id')
      .innerJoin('measurement_units', 'measurement_units.id', 'materials.measurement_unit_id')
      .select([
        'entry_act_items.id',
        'entry_act_items.material_id',
        'materials.code as material_code',
        'materials.name as material_name',
        'measurement_units.abbreviation as unit',
        'entry_act_items.quantity',
        'entry_act_items.unit_value',
        'entry_act_items.applies_vat',
        'entry_act_items.vat_percentage',
        'entry_act_items.subtotal',
        'entry_act_items.vat_value',
        'entry_act_items.total',
        'entry_act_items.notes',
      ])
      .where('entry_act_items.entry_act_id', '=', id)
      .orderBy('materials.name')
      .execute();
    return { ...act, items };
  }

  async getDelivery(id: string, client: typeof db | Transaction<Database> = db) {
    const act = await client
      .selectFrom('delivery_acts')
      .innerJoin('users', 'users.id', 'delivery_acts.user_id')
      .innerJoin('institutions', 'institutions.id', 'delivery_acts.institution_id')
      .innerJoin('leaders', 'leaders.id', 'delivery_acts.leader_id')
      .select([
        'delivery_acts.id',
        'delivery_acts.institution_id',
        'institutions.name as institution_name',
        'delivery_acts.leader_id',
        'leaders.first_names as leader_first_names',
        'leaders.last_names as leader_last_names',
        'leaders.position as leader_position',
        'delivery_acts.user_id',
        'users.name as registered_by',
        'delivery_acts.period',
        'delivery_acts.sequence',
        'delivery_acts.act_number',
        'delivery_acts.act_date',
        'delivery_acts.subject',
        'delivery_acts.notes',
        'delivery_acts.status',
        'delivery_acts.cancellation_reason',
        'delivery_acts.institution_snapshot',
        'delivery_acts.leader_snapshot',
        'delivery_acts.issued_at',
        'delivery_acts.cancelled_at',
        'delivery_acts.created_at',
      ])
      .where('delivery_acts.id', '=', id)
      .executeTakeFirst();
    if (!act) throw new NotFoundError('Acta de entrega');
    const items = await client
      .selectFrom('delivery_act_items')
      .innerJoin('materials', 'materials.id', 'delivery_act_items.material_id')
      .innerJoin('measurement_units', 'measurement_units.id', 'materials.measurement_unit_id')
      .select([
        'delivery_act_items.id',
        'delivery_act_items.material_id',
        'materials.code as material_code',
        'materials.name as material_name',
        'measurement_units.abbreviation as unit',
        'delivery_act_items.quantity',
        'delivery_act_items.notes',
      ])
      .where('delivery_act_items.delivery_act_id', '=', id)
      .orderBy('materials.name')
      .execute();
    return { ...act, items };
  }

  async listEntries(input: ListActsInput) {
    const { page, pageSize, offset } = pageOf(input);
    let query = db.selectFrom('entry_acts').innerJoin('users', 'users.id', 'entry_acts.user_id');
    if (input.period) query = query.where('entry_acts.period', '=', input.period);
    if (input.status) query = query.where('entry_acts.status', '=', input.status);
    if (input.number) query = query.where('entry_acts.act_number', 'ilike', `%${input.number}%`);
    if (input.dateFrom) query = query.where('entry_acts.act_date', '>=', input.dateFrom);
    if (input.dateTo) query = query.where('entry_acts.act_date', '<=', input.dateTo);
    const [data, count] = await Promise.all([
      query
        .select([
          'entry_acts.id',
          'entry_acts.act_number',
          'entry_acts.act_date',
          'entry_acts.period',
          'entry_acts.status',
          'entry_acts.total',
          'users.name as registered_by',
          'entry_acts.created_at',
        ])
        .orderBy('entry_acts.created_at', 'desc')
        .limit(pageSize)
        .offset(offset)
        .execute(),
      query.select(sql<number>`count(*)::int`.as('total')).executeTakeFirstOrThrow(),
    ]);
    return paginated(data, count.total, page, pageSize);
  }

  async listDeliveries(input: ListActsInput) {
    const { page, pageSize, offset } = pageOf(input);
    let query = db
      .selectFrom('delivery_acts')
      .innerJoin('institutions', 'institutions.id', 'delivery_acts.institution_id')
      .innerJoin('users', 'users.id', 'delivery_acts.user_id');
    if (input.period) query = query.where('delivery_acts.period', '=', input.period);
    if (input.status) query = query.where('delivery_acts.status', '=', input.status);
    if (input.number) query = query.where('delivery_acts.act_number', 'ilike', `%${input.number}%`);
    if (input.dateFrom) query = query.where('delivery_acts.act_date', '>=', input.dateFrom);
    if (input.dateTo) query = query.where('delivery_acts.act_date', '<=', input.dateTo);
    const [data, count] = await Promise.all([
      query
        .select([
          'delivery_acts.id',
          'delivery_acts.act_number',
          'delivery_acts.act_date',
          'delivery_acts.period',
          'delivery_acts.status',
          'institutions.name as institution_name',
          'users.name as registered_by',
          'delivery_acts.created_at',
        ])
        .orderBy('delivery_acts.created_at', 'desc')
        .limit(pageSize)
        .offset(offset)
        .execute(),
      query.select(sql<number>`count(*)::int`.as('total')).executeTakeFirstOrThrow(),
    ]);
    return paginated(data, count.total, page, pageSize);
  }

  private async validateAndCalculateEntryItems(items: EntryItemInput[]) {
    this.ensureUniqueMaterials(items);
    if (!items.length) throw new BadRequestError('El acta debe contener al menos un material');
    const ids = items.map((item) => item.materialId);
    const materials = await db
      .selectFrom('materials')
      .select(['id', 'active'])
      .where('id', 'in', ids)
      .execute();
    if (materials.length !== ids.length || materials.some((item) => !item.active))
      throw new BadRequestError('Uno o más materiales no existen o están inactivos');
    const totals = calculateEconomicLines(items);
    const calculated = totals.items.map(({ source: item, subtotal, vatValue, total }) => ({
      material_id: item.materialId,
      quantity: quantity(item.quantity),
      unit_value: money(item.unitValue),
      applies_vat: item.appliesVat,
      vat_percentage: item.appliesVat ? quantity(item.vatPercentage) : '0.00',
      subtotal,
      vat_value: vatValue,
      total,
      notes: cleanOptional(item.notes),
    }));
    return { items: calculated, subtotal: totals.subtotal, vatTotal: totals.vatTotal, total: totals.total };
  }

  private async validateDeliveryItems(items: DeliveryItemInput[]) {
    this.ensureUniqueMaterials(items);
    if (!items.length) throw new BadRequestError('El acta debe contener al menos un material');
    const ids = items.map((item) => item.materialId);
    const materials = await db
      .selectFrom('materials')
      .select(['id', 'active'])
      .where('id', 'in', ids)
      .execute();
    if (materials.length !== ids.length || materials.some((item) => !item.active))
      throw new BadRequestError('Uno o más materiales no existen o están inactivos');
  }

  private ensureUniqueMaterials(items: Array<{ materialId: string }>) {
    if (new Set(items.map((item) => item.materialId)).size !== items.length)
      throw new BadRequestError('No se puede repetir un material dentro de la misma acta');
  }

  private async validateDeliveryParties(
    trx: Transaction<Database>,
    institutionId: string,
    leaderId: string,
    requireActive: boolean,
  ) {
    const institution = await trx
      .selectFrom('institutions')
      .selectAll()
      .where('id', '=', institutionId)
      .executeTakeFirst();
    const leader = await trx.selectFrom('leaders').selectAll().where('id', '=', leaderId).executeTakeFirst();
    if (!institution || !leader) throw new BadRequestError('La institución o el líder no existen');
    if (leader.institution_id !== institution.id)
      throw new BadRequestError('El líder no pertenece a la institución seleccionada');
    if (requireActive && (!institution.active || !leader.active))
      throw new ConflictError('La institución y el líder deben estar activos al emitir');
    return { institution, leader };
  }

  private async nextNumber(trx: Transaction<Database>, type: 'ingreso' | 'entrega', period: number) {
    const result = await trx
      .insertInto('document_sequences')
      .values({ document_type: type, period, last_value: 1 })
      .onConflict((conflict) =>
        conflict
          .columns(['document_type', 'period'])
          .doUpdateSet({ last_value: sql<number>`document_sequences.last_value + 1` }),
      )
      .returning('last_value')
      .executeTakeFirstOrThrow();
    const sequence = result.last_value;
    return { sequence, number: formatActNumber(type, sequence, period) };
  }

  private async audit(
    trx: Transaction<Database>,
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    ip: string,
    metadata: { [key: string]: JsonValue } = {},
  ) {
    await trx
      .insertInto('audit_logs')
      .values({ user_id: userId, action, entity_type: entityType, entity_id: entityId, ip, metadata })
      .execute();
  }
}
