CREATE TYPE user_role AS ENUM ('administrador', 'asistente_actas', 'consulta');
CREATE TYPE leader_position AS ENUM ('rector', 'director');
CREATE TYPE act_status AS ENUM ('borrador', 'emitida', 'anulada');
CREATE TYPE movement_type AS ENUM ('entrada', 'salida', 'ajuste', 'anulacion');
CREATE TYPE document_type AS ENUM ('ingreso', 'entrega');

CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(150) NOT NULL,
  email varchar(150) NOT NULL,
  password_hash varchar(255) NOT NULL,
  role user_role NOT NULL,
  position varchar(150),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalized CHECK (email = lower(trim(email)))
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE district_authorities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  national_id varchar(20),
  first_names varchar(100) NOT NULL,
  last_names varchar(100) NOT NULL,
  position varchar(150) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX district_authorities_national_id_idx ON district_authorities (national_id);
CREATE INDEX district_authorities_active_idx ON district_authorities (active);

CREATE TABLE institutions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  amie_code varchar(30),
  name varchar(200) NOT NULL,
  circuit varchar(50),
  canton varchar(100),
  parish varchar(100),
  address text,
  phone varchar(30),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX institutions_amie_code_unique
  ON institutions (amie_code) WHERE amie_code IS NOT NULL;
CREATE INDEX institutions_name_idx ON institutions (name);

CREATE TABLE leaders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  institution_id bigint NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  national_id varchar(20) NOT NULL,
  first_names varchar(100) NOT NULL,
  last_names varchar(100) NOT NULL,
  position leader_position NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX leaders_one_active_per_institution
  ON leaders (institution_id) WHERE active = true;
CREATE INDEX leaders_institution_idx ON leaders (institution_id);

CREATE TABLE categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(100) NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categories_name_unique ON categories (lower(name));

CREATE TABLE measurement_units (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(100) NOT NULL,
  abbreviation varchar(20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX measurement_units_name_unique ON measurement_units (lower(name));

CREATE TABLE materials (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id bigint NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  measurement_unit_id bigint NOT NULL REFERENCES measurement_units(id) ON DELETE RESTRICT,
  code varchar(50),
  name varchar(200) NOT NULL,
  description text,
  current_stock numeric(12,2) NOT NULL DEFAULT 0,
  minimum_stock numeric(12,2),
  last_unit_value numeric(14,2),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT materials_stock_nonnegative CHECK (current_stock >= 0),
  CONSTRAINT materials_minimum_stock_nonnegative CHECK (minimum_stock IS NULL OR minimum_stock >= 0),
  CONSTRAINT materials_last_value_nonnegative CHECK (last_unit_value IS NULL OR last_unit_value >= 0)
);
CREATE UNIQUE INDEX materials_code_unique ON materials (code) WHERE code IS NOT NULL;
CREATE INDEX materials_name_idx ON materials (name);
CREATE INDEX materials_category_idx ON materials (category_id);

CREATE TABLE acquisition_processes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  process_code varchar(100),
  process_type varchar(100),
  purchase_object text,
  award_date date,
  supplier_name varchar(200),
  supplier_tax_id varchar(20),
  portal_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE entry_acts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  acquisition_process_id bigint REFERENCES acquisition_processes(id) ON DELETE RESTRICT,
  authorized_by_id bigint REFERENCES district_authorities(id) ON DELETE RESTRICT,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  period integer,
  sequence integer,
  act_number varchar(100),
  act_date date NOT NULL,
  concept text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  vat_total numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  status act_status NOT NULL DEFAULT 'borrador',
  cancellation_reason text,
  authority_snapshot jsonb,
  issued_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entry_acts_totals_nonnegative CHECK (subtotal >= 0 AND vat_total >= 0 AND total >= 0),
  CONSTRAINT entry_acts_issue_fields CHECK (
    status = 'borrador' OR
    (authorized_by_id IS NOT NULL AND period IS NOT NULL AND sequence IS NOT NULL AND act_number IS NOT NULL AND issued_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX entry_acts_period_sequence_unique ON entry_acts (period, sequence);
CREATE UNIQUE INDEX entry_acts_number_unique ON entry_acts (act_number) WHERE act_number IS NOT NULL;
CREATE INDEX entry_acts_status_date_idx ON entry_acts (status, act_date);

CREATE TABLE entry_act_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_act_id bigint NOT NULL REFERENCES entry_acts(id) ON DELETE CASCADE,
  material_id bigint NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL,
  unit_value numeric(14,2) NOT NULL,
  applies_vat boolean NOT NULL DEFAULT false,
  vat_percentage numeric(5,2) NOT NULL DEFAULT 0,
  subtotal numeric(14,2) NOT NULL,
  vat_value numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entry_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT entry_items_values_nonnegative CHECK (
    unit_value >= 0 AND vat_percentage >= 0 AND vat_percentage <= 100 AND
    subtotal >= 0 AND vat_value >= 0 AND total >= 0
  ),
  UNIQUE (entry_act_id, material_id)
);
CREATE INDEX entry_act_items_act_idx ON entry_act_items (entry_act_id);

CREATE TABLE delivery_acts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  institution_id bigint NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  leader_id bigint NOT NULL REFERENCES leaders(id) ON DELETE RESTRICT,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  period integer,
  sequence integer,
  act_number varchar(100),
  act_date date NOT NULL,
  subject varchar(200),
  notes text,
  status act_status NOT NULL DEFAULT 'borrador',
  cancellation_reason text,
  institution_snapshot jsonb,
  leader_snapshot jsonb,
  issued_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_acts_issue_fields CHECK (
    status = 'borrador' OR
    (period IS NOT NULL AND sequence IS NOT NULL AND act_number IS NOT NULL AND issued_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX delivery_acts_period_sequence_unique ON delivery_acts (period, sequence);
CREATE UNIQUE INDEX delivery_acts_number_unique ON delivery_acts (act_number) WHERE act_number IS NOT NULL;
CREATE INDEX delivery_acts_status_date_idx ON delivery_acts (status, act_date);

CREATE TABLE delivery_act_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  delivery_act_id bigint NOT NULL REFERENCES delivery_acts(id) ON DELETE CASCADE,
  material_id bigint NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  quantity numeric(12,2) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_items_quantity_positive CHECK (quantity > 0),
  UNIQUE (delivery_act_id, material_id)
);
CREATE INDEX delivery_act_items_act_idx ON delivery_act_items (delivery_act_id);

CREATE TABLE inventory_adjustments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  material_id bigint NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  difference numeric(12,2) NOT NULL,
  previous_stock numeric(12,2) NOT NULL,
  new_stock numeric(12,2) NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_adjustments_difference_nonzero CHECK (difference <> 0),
  CONSTRAINT inventory_adjustments_stock_nonnegative CHECK (previous_stock >= 0 AND new_stock >= 0)
);
CREATE INDEX inventory_adjustments_material_date_idx ON inventory_adjustments (material_id, created_at DESC);

CREATE TABLE inventory_movements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  material_id bigint NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  movement_type movement_type NOT NULL,
  quantity numeric(12,2) NOT NULL,
  previous_stock numeric(12,2) NOT NULL,
  new_stock numeric(12,2) NOT NULL,
  reference_type varchar(50) NOT NULL,
  reference_id bigint NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_quantity_positive CHECK (quantity > 0),
  CONSTRAINT inventory_movements_stock_nonnegative CHECK (previous_stock >= 0 AND new_stock >= 0),
  CONSTRAINT inventory_movements_reference_type CHECK (
    reference_type IN ('acta_ingreso', 'acta_entrega', 'ajuste', 'anulacion')
  )
);
CREATE INDEX inventory_movements_material_date_idx ON inventory_movements (material_id, created_at DESC);
CREATE INDEX inventory_movements_type_date_idx ON inventory_movements (movement_type, created_at DESC);
CREATE INDEX inventory_movements_reference_idx ON inventory_movements (reference_type, reference_id);

CREATE TABLE document_sequences (
  document_type document_type NOT NULL,
  period integer NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  PRIMARY KEY (document_type, period),
  CONSTRAINT document_sequences_value_nonnegative CHECK (last_value >= 0)
);

CREATE TABLE refresh_sessions (
  id uuid PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  user_agent varchar(500),
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_sessions_user_idx ON refresh_sessions (user_id);
CREATE INDEX refresh_sessions_expiry_idx ON refresh_sessions (expires_at);

CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL,
  entity_type varchar(100),
  entity_id bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_user_date_idx ON audit_logs (user_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'district_authorities', 'institutions', 'leaders', 'categories',
    'measurement_units', 'materials', 'acquisition_processes', 'entry_acts',
    'entry_act_items', 'delivery_acts', 'delivery_act_items'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      table_name, table_name
    );
  END LOOP;
END $$;
