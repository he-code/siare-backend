import { Decimal } from 'decimal.js';
import { sql } from 'kysely';
import { BadRequestError, ConflictError, NotFoundError } from '../../core/errors.js';
import { pageOf, paginated, type PageInput } from '../../core/pagination.js';
import type { MovementType } from '../../core/roles.js';
import { db } from '../../db/database.js';

interface MovementQuery extends PageInput {
  materialId?: string;
  type?: MovementType;
  dateFrom?: string;
  dateTo?: string;
}

export class InventoryService {
  async listMovements(input: MovementQuery) {
    const { page, pageSize, offset } = pageOf(input);
    let query = db
      .selectFrom('inventory_movements')
      .innerJoin('materials', 'materials.id', 'inventory_movements.material_id')
      .innerJoin('users', 'users.id', 'inventory_movements.user_id');
    if (input.materialId) query = query.where('inventory_movements.material_id', '=', input.materialId);
    if (input.type) query = query.where('inventory_movements.movement_type', '=', input.type);
    if (input.dateFrom)
      query = query.where(
        'inventory_movements.created_at',
        '>=',
        new Date(`${input.dateFrom}T00:00:00.000Z`),
      );
    if (input.dateTo)
      query = query.where(
        'inventory_movements.created_at',
        '<',
        new Date(new Date(`${input.dateTo}T00:00:00.000Z`).getTime() + 86_400_000),
      );
    const [data, count] = await Promise.all([
      query
        .select([
          'inventory_movements.id',
          'inventory_movements.material_id',
          'materials.code as material_code',
          'materials.name as material_name',
          'inventory_movements.movement_type',
          'inventory_movements.quantity',
          'inventory_movements.previous_stock',
          'inventory_movements.new_stock',
          'inventory_movements.reference_type',
          'inventory_movements.reference_id',
          'inventory_movements.notes',
          'inventory_movements.user_id',
          'users.name as responsible_user',
          'inventory_movements.created_at',
        ])
        .orderBy('inventory_movements.created_at', 'desc')
        .limit(pageSize)
        .offset(offset)
        .execute(),
      query.select(sql<number>`count(*)::int`.as('total')).executeTakeFirstOrThrow(),
    ]);
    return paginated(data, count.total, page, pageSize);
  }

  async adjust(materialId: string, differenceInput: number, reason: string, userId: string, ip: string) {
    const difference = new Decimal(differenceInput).toDecimalPlaces(2);
    if (difference.isZero()) throw new BadRequestError('El ajuste no puede ser cero');
    return db
      .transaction()
      .setIsolationLevel('serializable')
      .execute(async (trx) => {
        const material = await trx
          .selectFrom('materials')
          .select(['id', 'name', 'current_stock', 'active'])
          .where('id', '=', materialId)
          .forUpdate()
          .executeTakeFirst();
        if (!material) throw new NotFoundError('Material');
        if (!material.active) throw new ConflictError('No se puede ajustar un material inactivo');
        const next = new Decimal(material.current_stock).plus(difference);
        if (next.isNegative())
          throw new ConflictError('El ajuste produciría stock negativo', 'INSUFFICIENT_STOCK');
        const newStock = next.toFixed(2);
        const adjustment = await trx
          .insertInto('inventory_adjustments')
          .values({
            material_id: materialId,
            user_id: userId,
            difference: difference.toFixed(2),
            previous_stock: material.current_stock,
            new_stock: newStock,
            reason: reason.trim(),
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        await trx
          .updateTable('materials')
          .set({ current_stock: newStock })
          .where('id', '=', materialId)
          .execute();
        await trx
          .insertInto('inventory_movements')
          .values({
            material_id: materialId,
            user_id: userId,
            movement_type: 'ajuste',
            quantity: difference.abs().toFixed(2),
            previous_stock: material.current_stock,
            new_stock: newStock,
            reference_type: 'ajuste',
            reference_id: adjustment.id,
            notes: reason.trim(),
          })
          .execute();
        await trx
          .insertInto('audit_logs')
          .values({
            user_id: userId,
            action: 'inventory.adjust',
            entity_type: 'inventory_adjustment',
            entity_id: adjustment.id,
            ip,
            metadata: { difference: difference.toFixed(2) },
          })
          .execute();
        return adjustment;
      });
  }

  async summary() {
    const totals = await db
      .selectFrom('materials')
      .select([
        sql<number>`count(*) filter (where active)::int`.as('active_materials'),
        sql<number>`count(*) filter (where active and minimum_stock is not null and current_stock <= minimum_stock)::int`.as(
          'low_stock_materials',
        ),
        sql<string>`coalesce(sum(current_stock) filter (where active), 0)::text`.as('total_units'),
      ])
      .executeTakeFirstOrThrow();
    const latest = await db
      .selectFrom('inventory_movements')
      .innerJoin('materials', 'materials.id', 'inventory_movements.material_id')
      .select([
        'inventory_movements.id',
        'materials.name as material_name',
        'inventory_movements.movement_type',
        'inventory_movements.quantity',
        'inventory_movements.created_at',
      ])
      .orderBy('inventory_movements.created_at', 'desc')
      .limit(10)
      .execute();
    return { ...totals, latestMovements: latest };
  }
}
