import { describe, test, expect } from 'vitest';
import { compareColors, compareLayout, validateComponent } from '../src/validator.js';

describe('Visual Validation', () => {
  describe('Color comparison', () => {
    test('matches identical colors', () => {
      const result = compareColors('#0066FF', '#0066FF');
      expect(result).toBe(true);
    });

    test('matches colors with small differences', () => {
      const result = compareColors('#0066FF', '#0065FE');
      expect(result).toBe(true);
    });
  });

  describe('Layout comparison', () => {
    test('matches identical dimensions', () => {
      const result = compareLayout(
        { width: 100, height: 50 },
        { width: 100, height: 50 }
      );
      expect(result).toBe(true);
    });

    test('matches dimensions within tolerance', () => {
      const result = compareLayout(
        { width: 100, height: 50 },
        { width: 101, height: 49 }
      );
      expect(result).toBe(true);
    });
  });

  describe('Component validation', () => {
    test('validates a matching component', () => {
      const figmaComponent = {
        width: 100,
        height: 50,
        fills: [{ color: '#0066FF' }],
      };
      const renderedComponent = {
        width: 100,
        height: 50,
        backgroundColor: '#0066FF',
      };

      const result = validateComponent(figmaComponent, renderedComponent);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(90);
    });

    test('detects differences', () => {
      const figmaComponent = {
        width: 100,
        height: 50,
        fills: [{ color: '#0066FF' }],
      };
      const renderedComponent = {
        width: 120,
        height: 50,
        backgroundColor: '#FF0000',
      };

      const result = validateComponent(figmaComponent, renderedComponent);
      expect(result.passed).toBe(false);
      expect(result.diffs.length).toBeGreaterThan(0);
    });
  });
});
