import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { 
  extractDesignTokens, 
  extractColors, 
  extractTypography,
  extractSpacing,
  extractEffects,
  colorToHex 
} from '../src/extractor.js';
import type { FigmaFile } from '../src/types.js';

describe('Design Token Extraction', () => {
  let figmaFile: FigmaFile;

  test('loads fixture file', () => {
    const fixturePath = join(process.cwd(), 'fixtures', 'design-tokens-sample.json');
    const content = readFileSync(fixturePath, 'utf-8');
    figmaFile = JSON.parse(content);
    expect(figmaFile).toBeDefined();
    expect(figmaFile.document).toBeDefined();
  });

  describe('Color extraction', () => {
    test('extracts all color tokens', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'design-tokens-sample.json');
      const content = readFileSync(fixturePath, 'utf-8');
      figmaFile = JSON.parse(content);
      
      const colors = extractColors(figmaFile);
      
      expect(colors.length).toBeGreaterThan(0);
      expect(colors.length).toBe(5); // Should extract 5 colors from fixture
    });

    test('color tokens have correct structure', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'design-tokens-sample.json');
      const content = readFileSync(fixturePath, 'utf-8');
      figmaFile = JSON.parse(content);
      
      const colors = extractColors(figmaFile);
      const firstColor = colors[0];
      
      expect(firstColor).toHaveProperty('name');
      expect(firstColor).toHaveProperty('value');
      expect(typeof firstColor.name).toBe('string');
      expect(typeof firstColor.value).toBe('string');
      expect(firstColor.value).toMatch(/^#[0-9A-F]{6}$/i); // Valid hex color
    });

    test('extracts primary blue color correctly', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'design-tokens-sample.json');
      const content = readFileSync(fixturePath, 'utf-8');
      figmaFile = JSON.parse(content);
      
      const colors = extractColors(figmaFile);
      const primaryBlue = colors.find(c => c.name.includes('Blue/500'));
      
      expect(primaryBlue).toBeDefined();
      expect(primaryBlue?.value).toBe('#0066FF');
    });
  });

  describe('Typography extraction', () => {
    test('extracts all typography tokens', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'design-tokens-sample.json');
      const content = readFileSync(fixturePath, 'utf-8');
      figmaFile = JSON.parse(content);
      
      const typography = extractTypography(figmaFile);
      
      expect(typography.length).toBeGreaterThan(0);
      expect(typography.length).toBe(4); // Should extract 4 text styles
    });

    test('typography tokens have correct structure', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'design-tokens-sample.json');
      const content = readFileSync(fixturePath, 'utf-8');
      figmaFile = JSON.parse(content);
      
      const typography = extractTypography(figmaFile);
      const firstTypo = typography[0];
      
      expect(firstTypo).toHaveProperty('name');
      expect(firstTypo).toHaveProperty('fontFamily');
      expect(firstTypo).toHaveProperty('fontSize');
      expect(firstTypo).toHaveProperty('fontWeight');
      expect(firstTypo).toHaveProperty('lineHeight');
    });

    test('extracts H1 heading correctly', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'design-tokens-sample.json');
      const content = readFileSync(fixturePath, 'utf-8');
      figmaFile = JSON.parse(content);
      
      const typography = extractTypography(figmaFile);
      const h1 = typography.find(t => t.name.includes('H1'));
      
      expect(h1).toBeDefined();
      expect(h1?.fontFamily).toBe('Inter');
      expect(h1?.fontSize).toBe(32);
      expect(h1?.fontWeight).toBe(700);
      expect(h1?.lineHeight).toBe(40);
    });
  });

  describe('Spacing extraction', () => {
    test('extracts all spacing tokens', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'design-tokens-sample.json');
      const content = readFileSync(fixturePath, 'utf-8');
      figmaFile = JSON.parse(content);
      
      const spacing = extractSpacing(figmaFile);
      
      expect(spacing.length).toBeGreaterThan(0);
      expect(spacing.length).toBe(5); // Should extract 5 spacing values
    });

    test('spacing tokens have correct structure', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'design-tokens-sample.json');
      const content = readFileSync(fixturePath, 'utf-8');
      figmaFile = JSON.parse(content);
      
      const spacing = extractSpacing(figmaFile);
      const firstSpace = spacing[0];
      
      expect(firstSpace).toHaveProperty('name');
      expect(firstSpace).toHaveProperty('value');
      expect(typeof firstSpace.value).toBe('number');
    });
  });

  describe('Effects extraction', () => {
    test('extracts all effect tokens', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'design-tokens-sample.json');
      const content = readFileSync(fixturePath, 'utf-8');
      figmaFile = JSON.parse(content);
      
      const effects = extractEffects(figmaFile);
      
      expect(effects.length).toBeGreaterThan(0);
      expect(effects.length).toBe(3); // Should extract 3 shadow effects
    });

    test('effect tokens have correct structure', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'design-tokens-sample.json');
      const content = readFileSync(fixturePath, 'utf-8');
      figmaFile = JSON.parse(content);
      
      const effects = extractEffects(figmaFile);
      const firstEffect = effects[0];
      
      expect(firstEffect).toHaveProperty('name');
      expect(firstEffect).toHaveProperty('type');
      expect(firstEffect.type).toBe('shadow');
    });
  });

  describe('Full token extraction', () => {
    test('extracts all token types', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'design-tokens-sample.json');
      const content = readFileSync(fixturePath, 'utf-8');
      figmaFile = JSON.parse(content);
      
      const tokens = extractDesignTokens(figmaFile);
      
      expect(tokens.colors.length).toBeGreaterThan(0);
      expect(tokens.typography.length).toBeGreaterThan(0);
      expect(tokens.spacing.length).toBeGreaterThan(0);
      expect(tokens.effects.length).toBeGreaterThan(0);
    });
  });

  describe('Color conversion', () => {
    test('converts Figma color to hex', () => {
      const color = { r: 0.0, g: 0.4, b: 1.0, a: 1.0 };
      const hex = colorToHex(color);
      expect(hex).toBe('#0066FF');
    });

    test('converts white to hex', () => {
      const color = { r: 1.0, g: 1.0, b: 1.0, a: 1.0 };
      const hex = colorToHex(color);
      expect(hex).toBe('#FFFFFF');
    });

    test('converts black to hex', () => {
      const color = { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };
      const hex = colorToHex(color);
      expect(hex).toBe('#000000');
    });
  });
});
