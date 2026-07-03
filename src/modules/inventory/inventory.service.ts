import { sql } from 'kysely';
import { pageOf, paginated, type PageInput } from '../../core/pagination.js';
import type { MovementType } from '../../core/roles.js';
import { db } from '../../db/database.js';

interface MovementQuery extends PageInput {
  materialId?: string;
  type?: MovementType;
  dateFrom?: string;
  dateTo?: string;
}

interface StockQuery extends PageInput {
  search?: string;
  categoryId?: string;
  active?: boolean;
  lowStock?: boolean;
}

export class InventoryService {
  async listStock(input: StockQuery) {
    const { page, pageSize, offset } = pageOf(input);
    const query = this.stockBaseQuery(input);

    const [data, count] = await Promise.all([
      query
        .select([
          'materials.id',
          'materials.code',
          'materials.name',
          'materials.description',
          'materials.current_stock',
          'materials.minimum_stock',
          'materials.last_unit_value',
          'materials.active',
          'materials.category_id',
          'categories.name as category_name',
          'materials.measurement_unit_id',
          'measurement_units.name as unit_name',
          'measurement_units.abbreviation as unit_abbreviation',
          sql<boolean>`(
            materials.active
            and materials.minimum_stock is not null
            and materials.current_stock <= materials.minimum_stock
          )`.as('low_stock'),
          sql<string>`case
            when materials.minimum_stock is not null and materials.current_stock < materials.minimum_stock
            then (materials.minimum_stock - materials.current_stock)::text
            else '0'
          end`.as('stock_deficit'),
        ])
        .orderBy('materials.name')
        .limit(pageSize)
        .offset(offset)
        .execute(),
      query.select(sql<number>`count(*)::int`.as('total')).executeTakeFirstOrThrow(),
    ]);

    return paginated(data, count.total, page, pageSize);
  }

  async listLowStockAlerts(input: Omit<StockQuery, 'active' | 'lowStock'>) {
    return this.listStock({ ...input, active: true, lowStock: true });
  }

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
    const alerts = await this.listLowStockAlerts({ page: 1, pageSize: 10 });
    return { ...totals, lowStockAlerts: alerts.data, latestMovements: latest };
  }

  private stockBaseQuery(input: StockQuery) {
    let query = db
      .selectFrom('materials')
      .innerJoin('categories', 'categories.id', 'materials.category_id')
      .innerJoin('measurement_units', 'measurement_units.id', 'materials.measurement_unit_id');

    if (input.search) {
      const term = `%${input.search.trim()}%`;
      query = query.where((eb) =>
        eb.or([eb('materials.name', 'ilike', term), eb('materials.code', 'ilike', term)]),
      );
    }
    if (input.categoryId) query = query.where('materials.category_id', '=', input.categoryId);
    if (input.active !== undefined) query = query.where('materials.active', '=', input.active);
    if (input.lowStock)
      query = query
        .where('materials.minimum_stock', 'is not', null)
        .whereRef('materials.current_stock', '<=', 'materials.minimum_stock');

    return query;
  }
}
