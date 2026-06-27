import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';
import type { ActStatus, LeaderPosition, MovementType, Role } from '../core/roles.js';

type Timestamp = ColumnType<Date, Date | string, Date | string>;
type TimestampDefault = ColumnType<Date, Date | string | undefined, Date | string>;
type DateOnly = ColumnType<string, string, string>;
type Numeric = ColumnType<string, string | number, string | number>;
type NumericDefault = ColumnType<string, string | number | undefined, string | number>;
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type Json = ColumnType<JsonValue, JsonValue, JsonValue>;
type JsonDefault = ColumnType<JsonValue, JsonValue | undefined, JsonValue>;

interface AuditColumns {
  created_at: TimestampDefault;
  updated_at: TimestampDefault;
}

export interface UsersTable extends AuditColumns {
  id: Generated<string>;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  position: string | null;
  active: Generated<boolean>;
}

export interface DistrictAuthoritiesTable extends AuditColumns {
  id: Generated<string>;
  national_id: string | null;
  first_names: string;
  last_names: string;
  position: string;
  active: Generated<boolean>;
}

export interface InstitutionsTable extends AuditColumns {
  id: Generated<string>;
  amie_code: string | null;
  name: string;
  circuit: string | null;
  canton: string | null;
  parish: string | null;
  address: string | null;
  phone: string | null;
  active: Generated<boolean>;
}

export interface LeadersTable extends AuditColumns {
  id: Generated<string>;
  institution_id: string;
  national_id: string;
  first_names: string;
  last_names: string;
  position: LeaderPosition;
  active: Generated<boolean>;
}

export interface CategoriesTable extends AuditColumns {
  id: Generated<string>;
  name: string;
  description: string | null;
  active: Generated<boolean>;
}

export interface MeasurementUnitsTable extends AuditColumns {
  id: Generated<string>;
  name: string;
  abbreviation: string | null;
}

export interface MaterialsTable extends AuditColumns {
  id: Generated<string>;
  category_id: string;
  measurement_unit_id: string;
  code: string | null;
  name: string;
  description: string | null;
  current_stock: NumericDefault;
  minimum_stock: Numeric | null;
  last_unit_value: Numeric | null;
  active: Generated<boolean>;
}

export interface AcquisitionProcessesTable extends AuditColumns {
  id: Generated<string>;
  process_code: string | null;
  process_type: string | null;
  purchase_object: string | null;
  award_date: DateOnly | null;
  supplier_name: string | null;
  supplier_tax_id: string | null;
  support_document: string | null;
  portal_url: string | null;
  notes: string | null;
}

export interface EntryActsTable extends AuditColumns {
  id: Generated<string>;
  acquisition_process_id: string | null;
  authorized_by_id: string | null;
  user_id: string;
  period: number | null;
  sequence: number | null;
  act_number: string | null;
  act_date: DateOnly;
  concept: string | null;
  subtotal: NumericDefault;
  vat_total: NumericDefault;
  total: NumericDefault;
  notes: string | null;
  status: Generated<ActStatus>;
  cancellation_reason: string | null;
  authority_snapshot: Json | null;
  issued_at: Timestamp | null;
  cancelled_at: Timestamp | null;
}

export interface EntryActItemsTable extends AuditColumns {
  id: Generated<string>;
  entry_act_id: string;
  material_id: string;
  quantity: Numeric;
  unit_value: Numeric;
  applies_vat: Generated<boolean>;
  vat_percentage: NumericDefault;
  subtotal: Numeric;
  vat_value: NumericDefault;
  total: Numeric;
  notes: string | null;
}

export interface DeliveryActsTable extends AuditColumns {
  id: Generated<string>;
  institution_id: string;
  leader_id: string;
  user_id: string;
  period: number | null;
  sequence: number | null;
  act_number: string | null;
  act_date: DateOnly;
  subject: string | null;
  notes: string | null;
  status: Generated<ActStatus>;
  cancellation_reason: string | null;
  institution_snapshot: Json | null;
  leader_snapshot: Json | null;
  issued_at: Timestamp | null;
  cancelled_at: Timestamp | null;
}

export interface DeliveryActItemsTable extends AuditColumns {
  id: Generated<string>;
  delivery_act_id: string;
  material_id: string;
  quantity: Numeric;
  notes: string | null;
}

export interface InventoryMovementsTable {
  id: Generated<string>;
  material_id: string;
  user_id: string;
  movement_type: MovementType;
  quantity: Numeric;
  previous_stock: Numeric;
  new_stock: Numeric;
  reference_type: 'acta_ingreso' | 'acta_entrega' | 'ajuste' | 'anulacion';
  reference_id: string;
  notes: string | null;
  created_at: TimestampDefault;
}

export interface InventoryAdjustmentsTable {
  id: Generated<string>;
  material_id: string;
  user_id: string;
  difference: Numeric;
  previous_stock: Numeric;
  new_stock: Numeric;
  reason: string;
  created_at: TimestampDefault;
}

export interface DocumentSequencesTable {
  document_type: 'ingreso' | 'entrega';
  period: number;
  last_value: Generated<number>;
}

export interface RefreshSessionsTable {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Timestamp;
  user_agent: string | null;
  ip: string | null;
  created_at: TimestampDefault;
}

export interface AuditLogsTable {
  id: Generated<string>;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: JsonDefault;
  ip: string | null;
  created_at: TimestampDefault;
}

export interface MigrationTable {
  name: string;
  applied_at: TimestampDefault;
}

export interface Database {
  users: UsersTable;
  district_authorities: DistrictAuthoritiesTable;
  institutions: InstitutionsTable;
  leaders: LeadersTable;
  categories: CategoriesTable;
  measurement_units: MeasurementUnitsTable;
  materials: MaterialsTable;
  acquisition_processes: AcquisitionProcessesTable;
  entry_acts: EntryActsTable;
  entry_act_items: EntryActItemsTable;
  delivery_acts: DeliveryActsTable;
  delivery_act_items: DeliveryActItemsTable;
  inventory_adjustments: InventoryAdjustmentsTable;
  inventory_movements: InventoryMovementsTable;
  document_sequences: DocumentSequencesTable;
  refresh_sessions: RefreshSessionsTable;
  audit_logs: AuditLogsTable;
  _migrations: MigrationTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;
export type Material = Selectable<MaterialsTable>;
