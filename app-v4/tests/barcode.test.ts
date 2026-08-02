import { describe, expect, it } from 'vitest';
import { parseBarcodeProduct, validBarcode } from '../src/features/nutrition/barcode';
describe('barcode nutrition', () => {
  it('accepts GTIN lengths and rejects injected paths', () => {
    expect(validBarcode('3017620422003')).toBe(true);
    expect(validBarcode('../etc/passwd')).toBe(false);
  });
  it('maps bounded per-100g nutrients and rejects missing products', () => {
    expect(
      parseBarcodeProduct({
        product: {
          product_name: 'Food',
          nutriments: {
            energy_kcal_100g: 250,
            proteins_100g: 10,
            carbohydrates_100g: 20,
            fat_100g: 5,
          },
        },
      }),
    ).toEqual({ name: 'Food', kcal: 250, protein: 10, carb: 20, fat: 5 });
    expect(parseBarcodeProduct({ status: 0 })).toBeNull();
  });
});
