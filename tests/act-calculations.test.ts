import { describe, expect, it } from 'vitest';
import {
  calculateEconomicLines,
  changeStock,
  formatActNumber,
} from '../src/modules/acts/act-calculations.js';

describe('cálculos económicos de actas', () => {
  it('calcula IVA por línea y totales sin errores de punto flotante', () => {
    const result = calculateEconomicLines([
      { quantity: 3, unitValue: 10.1, appliesVat: true, vatPercentage: 15 },
      { quantity: 2, unitValue: 5.25, appliesVat: false, vatPercentage: 15 },
    ]);
    expect(result.items[0]).toMatchObject({ subtotal: '30.30', vatValue: '4.55', total: '34.85' });
    expect(result.items[1]).toMatchObject({ subtotal: '10.50', vatValue: '0.00', total: '10.50' });
    expect(result).toMatchObject({ subtotal: '40.80', vatTotal: '4.55', total: '45.35' });
  });
});

describe('reglas de inventario y numeración', () => {
  it('rechaza cualquier transición que produzca stock negativo', () => {
    expect(() => changeStock('2.00', '-2.01')).toThrowError(/Stock insuficiente/);
    expect(changeStock('2.00', '-2.00')).toBe('0.00');
  });

  it('genera numeración independiente con el formato institucional', () => {
    expect(formatActNumber('ingreso', 1, 2026)).toBe('MINEDUC-CZ5-UDA-ING-001-2026');
    expect(formatActNumber('entrega', 42, 2027)).toBe('MINEDUC-CZ5-UDA-ENT-042-2027');
  });
});
