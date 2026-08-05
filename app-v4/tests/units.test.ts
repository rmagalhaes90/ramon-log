import { describe, expect, it } from 'vitest';
import {
  cmToIn,
  displayLength,
  displayWeight,
  inToCm,
  kgToLb,
  lbToKg,
  lengthUnitLabel,
  parseLengthInput,
  parseWeightInput,
  weightUnitLabel,
} from '../src/core/units';

describe('unit conversion', () => {
  it('round-trips kg/lb and cm/in within rounding tolerance', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 2);
    expect(lbToKg(kgToLb(100))).toBeCloseTo(100, 6);
    expect(cmToIn(180)).toBeCloseTo(70.866, 2);
    expect(inToCm(cmToIn(180))).toBeCloseTo(180, 6);
  });

  it('leaves metric values untouched and converts imperial for display', () => {
    expect(displayWeight(80, 'metric')).toBe(80);
    expect(displayWeight(80, 'imperial')).toBeCloseTo(176.4, 1);
    expect(displayLength(50, 'metric')).toBe(50);
    expect(displayLength(50, 'imperial')).toBeCloseTo(19.7, 1);
  });

  it('parses typed input back into metric for storage', () => {
    expect(parseWeightInput(80, 'metric')).toBe(80);
    expect(parseWeightInput(176.4, 'imperial')).toBeCloseTo(80, 0);
    expect(parseLengthInput(50, 'metric')).toBe(50);
    expect(parseLengthInput(19.7, 'imperial')).toBeCloseTo(50, 0);
  });

  it('labels units correctly', () => {
    expect(weightUnitLabel('metric')).toBe('kg');
    expect(weightUnitLabel('imperial')).toBe('lb');
    expect(lengthUnitLabel('metric')).toBe('cm');
    expect(lengthUnitLabel('imperial')).toBe('in');
  });
});
