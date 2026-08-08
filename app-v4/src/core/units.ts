export type UnitSystem = 'metric' | 'imperial';

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function cmToIn(cm: number): number {
  return cm / CM_PER_IN;
}

export function inToCm(inches: number): number {
  return inches * CM_PER_IN;
}

export function weightUnitLabel(unit: UnitSystem): 'kg' | 'lb' {
  return unit === 'imperial' ? 'lb' : 'kg';
}

export function lengthUnitLabel(unit: UnitSystem): 'cm' | 'in' {
  return unit === 'imperial' ? 'in' : 'cm';
}

/** Converts a stored kg value into the display value for the given unit system. */
export function displayWeight(kg: number, unit: UnitSystem, decimals = 1): number {
  const value = unit === 'imperial' ? kgToLb(kg) : kg;
  return Number(value.toFixed(decimals));
}

/** Converts a stored cm value into the display value for the given unit system. */
export function displayLength(cm: number, unit: UnitSystem, decimals = 1): number {
  const value = unit === 'imperial' ? cmToIn(cm) : cm;
  return Number(value.toFixed(decimals));
}

/** Converts a value the user typed (in their chosen unit) back into kg for storage. */
export function parseWeightInput(value: number, unit: UnitSystem): number {
  return unit === 'imperial' ? lbToKg(value) : value;
}

/** Converts a value the user typed (in their chosen unit) back into cm for storage. */
export function parseLengthInput(value: number, unit: UnitSystem): number {
  return unit === 'imperial' ? inToCm(value) : value;
}
