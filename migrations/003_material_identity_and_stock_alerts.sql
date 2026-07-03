-- Evita duplicar materiales activos que representan el mismo insumo.
-- La procedencia del ingreso se controla en el proceso/acta, no creando un nuevo material.
CREATE UNIQUE INDEX IF NOT EXISTS materials_active_identity_unique
  ON materials (category_id, measurement_unit_id, lower(btrim(name)))
  WHERE active = true;

-- Acelera la consulta de materiales agotados o por debajo del mínimo.
CREATE INDEX IF NOT EXISTS materials_low_stock_idx
  ON materials (current_stock, minimum_stock)
  WHERE active = true AND minimum_stock IS NOT NULL;
