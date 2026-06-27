import { Decimal } from 'decimal.js';
import { ConflictError } from '../../core/errors.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const roundMoney = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(2).toFixed(2);
export const roundQuantity = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(2).toFixed(2);

export interface EconomicLine {
  quantity: Decimal.Value;
  unitValue: Decimal.Value;
  appliesVat: boolean;
  vatPercentage: Decimal.Value;
}

export const calculateEconomicLines = <T extends EconomicLine>(lines: T[]) => {
  let subtotal = new Decimal(0);
  let vatTotal = new Decimal(0);
  let total = new Decimal(0);
  const items = lines.map((line) => {
    const lineSubtotal = new Decimal(line.quantity).times(line.unitValue).toDecimalPlaces(2);
    const vatValue = line.appliesVat
      ? lineSubtotal.times(line.vatPercentage).dividedBy(100).toDecimalPlaces(2)
      : new Decimal(0);
    const lineTotal = lineSubtotal.plus(vatValue);
    subtotal = subtotal.plus(lineSubtotal);
    vatTotal = vatTotal.plus(vatValue);
    total = total.plus(lineTotal);
    return {
      source: line,
      subtotal: roundMoney(lineSubtotal),
      vatValue: roundMoney(vatValue),
      total: roundMoney(lineTotal),
    };
  });
  return { items, subtotal: roundMoney(subtotal), vatTotal: roundMoney(vatTotal), total: roundMoney(total) };
};

export const changeStock = (current: Decimal.Value, delta: Decimal.Value) => {
  const next = new Decimal(current).plus(delta);
  if (next.isNegative()) throw new ConflictError('Stock insuficiente', 'INSUFFICIENT_STOCK');
  return roundQuantity(next);
};

export const formatActNumber = (type: 'ingreso' | 'entrega', sequence: number, period: number) => {
  const code = type === 'ingreso' ? 'ING' : 'ENT';
  return `MINEDUC-CZ5-UDA-${code}-${String(sequence).padStart(3, '0')}-${period}`;
};
