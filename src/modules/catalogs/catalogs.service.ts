import { sql, type Kysely, type Transaction } from 'kysely';
import { ConflictError, NotFoundError } from '../../core/errors.js';
import { pageOf, paginated, type PageInput } from '../../core/pagination.js';
import { cleanOptional } from '../../core/text.js';
import { db } from '../../db/database.js';
import type { Database } from '../../db/types.js';

type NamedInput = { name: string; description?: string | null; active?: boolean };
type UnitInput = { name: string; abbreviation?: string | null };
type AuthorityInput = {
  nationalId?: string | null;
  firstNames: string;
  lastNames: string;
  position: string;
  active?: boolean;
};
type InstitutionInput = {
  amieCode?: string | null;
  name: string;
  circuit?: string | null;
  canton?: string | null;
  parish?: string | null;
  address?: string | null;
  phone?: string | null;
  active?: boolean;
};
type LeaderInput = {
  institutionId: string;
  nationalId: string;
  firstNames: string;
  lastNames: string;
  position: 'rector' | 'director';
  active?: boolean;
};
type MaterialInput = {
  categoryId: string;
  measurementUnitId: string;
  code?: string | null;
  name: string;
  description?: string | null;
  minimumStock?: number | null;
  active?: boolean;
};
type AcquisitionInput = {
  processCode?: string | null;
  processType?: string | null;
  purchaseObject?: string | null;
  awardDate?: string | null;
  supplierName?: string | null;
  supplierTaxId?: string | null;
  supportDocument?: string | null;
  portalUrl?: string | null;
  notes?: string | null;
};

export class CatalogsService {
  async listCategories(input: PageInput & { search?: string; active?: boolean }) {
    const { page, pageSize, offset } = pageOf(input);
    let query = db.selectFrom('categories');
    if (input.search) query = query.where('name', 'ilike', `%${input.search.trim()}%`);
    if (input.active !== undefined) query = query.where('active', '=', input.active);
    const [data, count] = await Promise.all([
      query.selectAll().orderBy('name').limit(pageSize).offset(offset).execute(),
      query.select(sql<number>`count(*)::int`.as('total')).executeTakeFirstOrThrow(),
    ]);
    return paginated(data, count.total, page, pageSize);
  }

  async createCategory(input: NamedInput, actorId: string, ip: string) {
    return db.transaction().execute(async (trx) => {
      const row = await trx
        .insertInto('categories')
        .values({
          name: input.name.trim(),
          description: cleanOptional(input.description),
          active: input.active ?? true,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.writeAudit(trx, actorId, 'categories.create', 'category', row.id, ip);
      return row;
    });
  }

  async updateCategory(id: string, input: Partial<NamedInput>, actorId: string, ip: string) {
    const current = await db.selectFrom('categories').selectAll().where('id', '=', id).executeTakeFirst();
    if (!current) throw new NotFoundError('Categoría');
    const row = await db
      .updateTable('categories')
      .set({
        name: input.name?.trim() ?? current.name,
        description: input.description === undefined ? current.description : cleanOptional(input.description),
        active: input.active ?? current.active,
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.writeAudit(db, actorId, 'categories.update', 'category', id, ip);
    return row;
  }

  async listUnits(input: PageInput & { search?: string }) {
    const { page, pageSize, offset } = pageOf(input);
    let query = db.selectFrom('measurement_units');
    if (input.search) query = query.where('name', 'ilike', `%${input.search.trim()}%`);
    const [data, count] = await Promise.all([
      query.selectAll().orderBy('name').limit(pageSize).offset(offset).execute(),
      query.select(sql<number>`count(*)::int`.as('total')).executeTakeFirstOrThrow(),
    ]);
    return paginated(data, count.total, page, pageSize);
  }

  async createUnit(input: UnitInput, actorId: string, ip: string) {
    const row = await db
      .insertInto('measurement_units')
      .values({ name: input.name.trim(), abbreviation: cleanOptional(input.abbreviation) })
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.writeAudit(db, actorId, 'units.create', 'measurement_unit', row.id, ip);
    return row;
  }

  async updateUnit(id: string, input: Partial<UnitInput>, actorId: string, ip: string) {
    const current = await db
      .selectFrom('measurement_units')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!current) throw new NotFoundError('Unidad de medida');
    const row = await db
      .updateTable('measurement_units')
      .set({
        name: input.name?.trim() ?? current.name,
        abbreviation:
          input.abbreviation === undefined ? current.abbreviation : cleanOptional(input.abbreviation),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.writeAudit(db, actorId, 'units.update', 'measurement_unit', id, ip);
    return row;
  }

  async listAuthorities(input: PageInput & { search?: string; active?: boolean }) {
    const { page, pageSize, offset } = pageOf(input);
    let query = db.selectFrom('district_authorities');
    if (input.search)
      query = query.where((eb) =>
        eb.or([
          eb('first_names', 'ilike', `%${input.search}%`),
          eb('last_names', 'ilike', `%${input.search}%`),
          eb('national_id', 'ilike', `%${input.search}%`),
        ]),
      );
    if (input.active !== undefined) query = query.where('active', '=', input.active);
    const [data, count] = await Promise.all([
      query.selectAll().orderBy('last_names').orderBy('first_names').limit(pageSize).offset(offset).execute(),
      query.select(sql<number>`count(*)::int`.as('total')).executeTakeFirstOrThrow(),
    ]);
    return paginated(data, count.total, page, pageSize);
  }

  async createAuthority(input: AuthorityInput, actorId: string, ip: string) {
    const row = await db
      .insertInto('district_authorities')
      .values({
        national_id: cleanOptional(input.nationalId),
        first_names: input.firstNames.trim(),
        last_names: input.lastNames.trim(),
        position: input.position.trim(),
        active: input.active ?? true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.writeAudit(db, actorId, 'authorities.create', 'district_authority', row.id, ip);
    return row;
  }

  async updateAuthority(id: string, input: Partial<AuthorityInput>, actorId: string, ip: string) {
    const current = await db
      .selectFrom('district_authorities')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!current) throw new NotFoundError('Autoridad distrital');
    const row = await db
      .updateTable('district_authorities')
      .set({
        national_id: input.nationalId === undefined ? current.national_id : cleanOptional(input.nationalId),
        first_names: input.firstNames?.trim() ?? current.first_names,
        last_names: input.lastNames?.trim() ?? current.last_names,
        position: input.position?.trim() ?? current.position,
        active: input.active ?? current.active,
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.writeAudit(db, actorId, 'authorities.update', 'district_authority', id, ip);
    return row;
  }

  async listInstitutions(input: PageInput & { search?: string; active?: boolean }) {
    const { page, pageSize, offset } = pageOf(input);
    let query = db.selectFrom('institutions');
    if (input.search)
      query = query.where((eb) =>
        eb.or([eb('name', 'ilike', `%${input.search}%`), eb('amie_code', 'ilike', `%${input.search}%`)]),
      );
    if (input.active !== undefined) query = query.where('active', '=', input.active);
    const [data, count] = await Promise.all([
      query.selectAll().orderBy('name').limit(pageSize).offset(offset).execute(),
      query.select(sql<number>`count(*)::int`.as('total')).executeTakeFirstOrThrow(),
    ]);
    return paginated(data, count.total, page, pageSize);
  }

  async createInstitution(input: InstitutionInput, actorId: string, ip: string) {
    const row = await db
      .insertInto('institutions')
      .values(this.institutionValues(input))
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.writeAudit(db, actorId, 'institutions.create', 'institution', row.id, ip);
    return row;
  }

  async updateInstitution(id: string, input: Partial<InstitutionInput>, actorId: string, ip: string) {
    const current = await db.selectFrom('institutions').selectAll().where('id', '=', id).executeTakeFirst();
    if (!current) throw new NotFoundError('Institución');
    const row = await db
      .updateTable('institutions')
      .set({
        amie_code: input.amieCode === undefined ? current.amie_code : cleanOptional(input.amieCode),
        name: input.name?.trim() ?? current.name,
        circuit: input.circuit === undefined ? current.circuit : cleanOptional(input.circuit),
        canton: input.canton === undefined ? current.canton : cleanOptional(input.canton),
        parish: input.parish === undefined ? current.parish : cleanOptional(input.parish),
        address: input.address === undefined ? current.address : cleanOptional(input.address),
        phone: input.phone === undefined ? current.phone : cleanOptional(input.phone),
        active: input.active ?? current.active,
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.writeAudit(db, actorId, 'institutions.update', 'institution', id, ip);
    return row;
  }

  async listLeaders(input: PageInput & { institutionId?: string; active?: boolean }) {
    const { page, pageSize, offset } = pageOf(input);
    let query = db
      .selectFrom('leaders')
      .innerJoin('institutions', 'institutions.id', 'leaders.institution_id');
    if (input.institutionId) query = query.where('leaders.institution_id', '=', input.institutionId);
    if (input.active !== undefined) query = query.where('leaders.active', '=', input.active);
    const [data, count] = await Promise.all([
      query
        .select([
          'leaders.id',
          'leaders.institution_id',
          'leaders.national_id',
          'leaders.first_names',
          'leaders.last_names',
          'leaders.position',
          'leaders.active',
          'institutions.name as institution_name',
          'leaders.created_at',
        ])
        .orderBy('leaders.last_names')
        .limit(pageSize)
        .offset(offset)
        .execute(),
      query.select(sql<number>`count(*)::int`.as('total')).executeTakeFirstOrThrow(),
    ]);
    return paginated(data, count.total, page, pageSize);
  }

  async createLeader(input: LeaderInput, actorId: string, ip: string) {
    return db.transaction().execute(async (trx) => {
      const institution = await trx
        .selectFrom('institutions')
        .select(['id', 'active'])
        .where('id', '=', input.institutionId)
        .forUpdate()
        .executeTakeFirst();
      if (!institution) throw new NotFoundError('Institución');
      if (!institution.active)
        throw new ConflictError('No se puede asignar un líder a una institución inactiva');
      if (input.active ?? true)
        await trx
          .updateTable('leaders')
          .set({ active: false })
          .where('institution_id', '=', input.institutionId)
          .where('active', '=', true)
          .execute();
      const row = await trx
        .insertInto('leaders')
        .values({
          institution_id: input.institutionId,
          national_id: input.nationalId.trim(),
          first_names: input.firstNames.trim(),
          last_names: input.lastNames.trim(),
          position: input.position,
          active: input.active ?? true,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.writeAudit(trx, actorId, 'leaders.create', 'leader', row.id, ip);
      return row;
    });
  }

  async updateLeader(id: string, input: Partial<LeaderInput>, actorId: string, ip: string) {
    return db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('leaders')
        .selectAll()
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!current) throw new NotFoundError('Líder');
      const institutionId = input.institutionId ?? current.institution_id;
      if (
        input.active === true ||
        (current.active && input.institutionId && input.institutionId !== current.institution_id)
      ) {
        await trx
          .updateTable('leaders')
          .set({ active: false })
          .where('institution_id', '=', institutionId)
          .where('id', '!=', id)
          .where('active', '=', true)
          .execute();
      }
      const row = await trx
        .updateTable('leaders')
        .set({
          institution_id: institutionId,
          national_id: input.nationalId?.trim() ?? current.national_id,
          first_names: input.firstNames?.trim() ?? current.first_names,
          last_names: input.lastNames?.trim() ?? current.last_names,
          position: input.position ?? current.position,
          active: input.active ?? current.active,
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.writeAudit(trx, actorId, 'leaders.update', 'leader', id, ip);
      return row;
    });
  }

  async listMaterials(input: PageInput & { search?: string; categoryId?: string; active?: boolean }) {
    const { page, pageSize, offset } = pageOf(input);
    let query = db
      .selectFrom('materials')
      .innerJoin('categories', 'categories.id', 'materials.category_id')
      .innerJoin('measurement_units', 'measurement_units.id', 'materials.measurement_unit_id');
    if (input.search)
      query = query.where((eb) =>
        eb.or([
          eb('materials.name', 'ilike', `%${input.search}%`),
          eb('materials.code', 'ilike', `%${input.search}%`),
        ]),
      );
    if (input.categoryId) query = query.where('materials.category_id', '=', input.categoryId);
    if (input.active !== undefined) query = query.where('materials.active', '=', input.active);
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
        ])
        .orderBy('materials.name')
        .limit(pageSize)
        .offset(offset)
        .execute(),
      query.select(sql<number>`count(*)::int`.as('total')).executeTakeFirstOrThrow(),
    ]);
    return paginated(data, count.total, page, pageSize);
  }

  async createMaterial(input: MaterialInput, actorId: string, ip: string) {
    const row = await db
      .insertInto('materials')
      .values({
        category_id: input.categoryId,
        measurement_unit_id: input.measurementUnitId,
        code: cleanOptional(input.code),
        name: input.name.trim(),
        description: cleanOptional(input.description),
        minimum_stock: input.minimumStock ?? null,
        last_unit_value: null,
        current_stock: 0,
        active: input.active ?? true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.writeAudit(db, actorId, 'materials.create', 'material', row.id, ip);
    return row;
  }

  async updateMaterial(id: string, input: Partial<MaterialInput>, actorId: string, ip: string) {
    const current = await db.selectFrom('materials').selectAll().where('id', '=', id).executeTakeFirst();
    if (!current) throw new NotFoundError('Material');
    const row = await db
      .updateTable('materials')
      .set({
        category_id: input.categoryId ?? current.category_id,
        measurement_unit_id: input.measurementUnitId ?? current.measurement_unit_id,
        code: input.code === undefined ? current.code : cleanOptional(input.code),
        name: input.name?.trim() ?? current.name,
        description: input.description === undefined ? current.description : cleanOptional(input.description),
        minimum_stock: input.minimumStock === undefined ? current.minimum_stock : input.minimumStock,
        active: input.active ?? current.active,
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.writeAudit(db, actorId, 'materials.update', 'material', id, ip);
    return row;
  }

  async listAcquisitions(input: PageInput & { search?: string }) {
    const { page, pageSize, offset } = pageOf(input);
    let query = db.selectFrom('acquisition_processes');
    if (input.search)
      query = query.where((eb) =>
        eb.or([
          eb('process_code', 'ilike', `%${input.search}%`),
          eb('supplier_name', 'ilike', `%${input.search}%`),
          eb('purchase_object', 'ilike', `%${input.search}%`),
        ]),
      );
    const [data, count] = await Promise.all([
      query.selectAll().orderBy('created_at', 'desc').limit(pageSize).offset(offset).execute(),
      query.select(sql<number>`count(*)::int`.as('total')).executeTakeFirstOrThrow(),
    ]);
    return paginated(data, count.total, page, pageSize);
  }

  async createAcquisition(input: AcquisitionInput, actorId: string, ip: string) {
    const row = await db
      .insertInto('acquisition_processes')
      .values(this.acquisitionValues(input))
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.writeAudit(db, actorId, 'acquisitions.create', 'acquisition_process', row.id, ip);
    return row;
  }

  async updateAcquisition(id: string, input: Partial<AcquisitionInput>, actorId: string, ip: string) {
    const current = await db
      .selectFrom('acquisition_processes')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!current) throw new NotFoundError('Proceso de adquisición');
    const values = this.acquisitionValues({
      processCode: input.processCode === undefined ? current.process_code : input.processCode,
      processType: input.processType === undefined ? current.process_type : input.processType,
      purchaseObject: input.purchaseObject === undefined ? current.purchase_object : input.purchaseObject,
      awardDate: input.awardDate === undefined ? current.award_date : input.awardDate,
      supplierName: input.supplierName === undefined ? current.supplier_name : input.supplierName,
      supplierTaxId: input.supplierTaxId === undefined ? current.supplier_tax_id : input.supplierTaxId,
      supportDocument: input.supportDocument === undefined ? current.support_document : input.supportDocument,
      portalUrl: input.portalUrl === undefined ? current.portal_url : input.portalUrl,
      notes: input.notes === undefined ? current.notes : input.notes,
    });
    const row = await db
      .updateTable('acquisition_processes')
      .set(values)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await this.writeAudit(db, actorId, 'acquisitions.update', 'acquisition_process', id, ip);
    return row;
  }

  private institutionValues(input: InstitutionInput) {
    return {
      amie_code: cleanOptional(input.amieCode),
      name: input.name.trim(),
      circuit: cleanOptional(input.circuit),
      canton: cleanOptional(input.canton),
      parish: cleanOptional(input.parish),
      address: cleanOptional(input.address),
      phone: cleanOptional(input.phone),
      active: input.active ?? true,
    };
  }

  private acquisitionValues(input: AcquisitionInput) {
    return {
      process_code: cleanOptional(input.processCode),
      process_type: cleanOptional(input.processType),
      purchase_object: cleanOptional(input.purchaseObject),
      award_date: input.awardDate ?? null,
      supplier_name: cleanOptional(input.supplierName),
      supplier_tax_id: cleanOptional(input.supplierTaxId),
      support_document: cleanOptional(input.supportDocument),
      portal_url: cleanOptional(input.portalUrl),
      notes: cleanOptional(input.notes),
    };
  }

  private async writeAudit(
    client: Kysely<Database> | Transaction<Database>,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    ip: string,
  ) {
    await client
      .insertInto('audit_logs')
      .values({ user_id: actorId, action, entity_type: entityType, entity_id: entityId, ip, metadata: {} })
      .execute();
  }
}
