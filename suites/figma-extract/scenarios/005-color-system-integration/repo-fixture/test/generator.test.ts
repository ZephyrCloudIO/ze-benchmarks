import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  generateCSSVariables,
  generateTailwindConfig,
  generateThemeConfig,
  extractColorScales,
} from '../src/generator.js';
import type { ColorToken } from '../src/generator.js';

describe('Color System Integration', () => {
  let colorTokens: ColorToken[];

  test('loads fixture', () => {
    const fixturePath = join(process.cwd(), 'fixtures', 'color-system.json');
    const content = readFileSync(fixturePath, 'utf-8');
    const figmaFile = JSON.parse(content);
    expect(figmaFile).toBeDefined();
  });

  describe('CSS variable generation', () => {
    test('generates CSS custom properties', () => {
      const tokens: ColorToken[] = [
        { name: 'Primary/Blue/500', value: '#0066FF' },
        { name: 'Secondary/Orange/500', value: '#FF6B00' },
      ];

      const css = generateCSSVariables(tokens);

      expect(css).toContain('--color-primary-blue-500');
      expect(css).toContain('#0066FF');
      expect(css).toContain('--color-secondary-orange-500');
      expect(css).toContain('#FF6B00');
    });

    test('CSS output is valid', () => {
      const tokens: ColorToken[] = [
        { name: 'Primary/Blue/500', value: '#0066FF' },
      ];

      const css = generateCSSVariables(tokens);

      expect(css).toMatch(/^:root\s*\{/);
      expect(css).toMatch(/\}$/);
    });
  });

  describe('Tailwind config generation', () => {
    test('generates Tailwind config', () => {
      const scales = extractColorScales([
        { name: 'Blue/100', value: '#E0F0FF' },
        { name: 'Blue/500', value: '#0066FF' },
        { name: 'Blue/900', value: '#001A40' },
      ]);

      const config = generateTailwindConfig(scales);

      expect(config).toContain('blue');
      expect(config).toContain('#0066FF');
    });

    test('config is valid JavaScript', () => {
      const scales = extractColorScales([
        { name: 'Blue/500', value: '#0066FF' },
      ]);

      const config = generateTailwindConfig(scales);

      expect(config).toContain('module.exports');
      expect(config).toContain('theme');
      expect(config).toContain('colors');
    });
  });

  describe('Theme config generation', () => {
    test('generates light and dark themes', () => {
      const lightTokens: ColorToken[] = [
        { name: 'Background', value: '#FFFFFF' },
        { name: 'Text', value: '#000000' },
      ];
      const darkTokens: ColorToken[] = [
        { name: 'Background', value: '#000000' },
        { name: 'Text', value: '#FFFFFF' },
      ];

      const themes = generateThemeConfig(lightTokens, darkTokens);

      expect(themes.light).toHaveProperty('Background');
      expect(themes.dark).toHaveProperty('Background');
      expect(themes.light.Background).toBe('#FFFFFF');
      expect(themes.dark.Background).toBe('#000000');
    });
  });

  describe('Color scale extraction', () => {
    test('extracts color scales from tokens', () => {
      const tokens: ColorToken[] = [
        { name: 'Blue/100', value: '#E0F0FF' },
        { name: 'Blue/200', value: '#B3D9FF' },
        { name: 'Blue/500', value: '#0066FF' },
        { name: 'Red/500', value: '#FF0000' },
      ];

      const scales = extractColorScales(tokens);

      expect(scales.length).toBe(2);
      expect(scales[0].name).toBe('Blue');
      expect(scales[0].colors[500]).toBe('#0066FF');
      expect(scales[1].name).toBe('Red');
    });

    test('handles semantic colors', () => {
      const tokens: ColorToken[] = [
        { name: 'Success', value: '#00FF00' },
        { name: 'Error', value: '#FF0000' },
      ];

      const scales = extractColorScales(tokens);

      expect(scales.length).toBeGreaterThanOrEqual(2);
    });
  });
});
