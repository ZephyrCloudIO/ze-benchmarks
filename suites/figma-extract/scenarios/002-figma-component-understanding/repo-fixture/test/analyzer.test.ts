import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  analyzeAllComponents,
  findComponents,
  analyzeComponent,
  classifyComponent,
  extractVariants,
  extractProperties
} from '../src/analyzer.js';
import type { FigmaFile } from '../src/types.js';

describe('Component Analysis', () => {
  describe('Component finding', () => {
    test('finds components in component-variants fixture', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'component-variants.json');
      const content = readFileSync(fixturePath, 'utf-8');
      const figmaFile: FigmaFile = JSON.parse(content);
      
      const components = findComponents(figmaFile);
      
      expect(components.length).toBeGreaterThan(0);
    });

    test('finds multiple component types in full-component-set', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'full-component-set.json');
      const content = readFileSync(fixturePath, 'utf-8');
      const figmaFile: FigmaFile = JSON.parse(content);
      
      const components = findComponents(figmaFile);
      
      expect(components.length).toBeGreaterThanOrEqual(6); // At least 6 components
    });
  });

  describe('Component classification', () => {
    test('classifies button components correctly', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'component-variants.json');
      const content = readFileSync(fixturePath, 'utf-8');
      const figmaFile: FigmaFile = JSON.parse(content);
      
      const components = findComponents(figmaFile);
      const buttonComponent = components.find(c => c.name.toLowerCase().includes('button'));
      
      expect(buttonComponent).toBeDefined();
      const type = classifyComponent(buttonComponent!);
      expect(type).toBe('button');
    });

    test('classifies different component types', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'full-component-set.json');
      const content = readFileSync(fixturePath, 'utf-8');
      const figmaFile: FigmaFile = JSON.parse(content);
      
      const analyses = analyzeAllComponents(figmaFile);
      const types = analyses.map(a => a.type);
      
      expect(types).toContain('button');
      expect(types).toContain('input');
      expect(types).toContain('card');
      expect(types).toContain('avatar');
    });
  });

  describe('Variant extraction', () => {
    test('extracts button variants', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'component-variants.json');
      const content = readFileSync(fixturePath, 'utf-8');
      const figmaFile: FigmaFile = JSON.parse(content);
      
      const components = findComponents(figmaFile);
      const buttonSet = components.find(c => c.type === 'COMPONENT_SET');
      
      if (buttonSet) {
        const variants = extractVariants(buttonSet);
        expect(variants.length).toBeGreaterThan(0);
        expect(variants[0]).toHaveProperty('name');
        expect(variants[0]).toHaveProperty('properties');
      }
    });

    test('parses variant properties correctly', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'component-variants.json');
      const content = readFileSync(fixturePath, 'utf-8');
      const figmaFile: FigmaFile = JSON.parse(content);
      
      const components = findComponents(figmaFile);
      const buttonSet = components.find(c => c.type === 'COMPONENT_SET');
      
      if (buttonSet) {
        const variants = extractVariants(buttonSet);
        const primaryMd = variants.find(v => 
          v.properties.variant === 'primary' && v.properties.size === 'md'
        );
        expect(primaryMd).toBeDefined();
      }
    });
  });

  describe('Property extraction', () => {
    test('extracts component properties', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'full-component-set.json');
      const content = readFileSync(fixturePath, 'utf-8');
      const figmaFile: FigmaFile = JSON.parse(content);
      
      const components = findComponents(figmaFile);
      const buttonComponent = components.find(c => c.name.includes('Button'));
      
      if (buttonComponent) {
        const properties = extractProperties(buttonComponent);
        expect(properties.length).toBeGreaterThan(0);
      }
    });

    test('property structure is correct', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'full-component-set.json');
      const content = readFileSync(fixturePath, 'utf-8');
      const figmaFile: FigmaFile = JSON.parse(content);
      
      const components = findComponents(figmaFile);
      const component = components[0];
      
      if (component) {
        const properties = extractProperties(component);
        if (properties.length > 0) {
          expect(properties[0]).toHaveProperty('name');
          expect(properties[0]).toHaveProperty('value');
          expect(properties[0]).toHaveProperty('type');
        }
      }
    });
  });

  describe('Full component analysis', () => {
    test('analyzes all components successfully', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'full-component-set.json');
      const content = readFileSync(fixturePath, 'utf-8');
      const figmaFile: FigmaFile = JSON.parse(content);
      
      const analyses = analyzeAllComponents(figmaFile);
      
      expect(analyses.length).toBeGreaterThan(0);
      
      analyses.forEach(analysis => {
        expect(analysis).toHaveProperty('id');
        expect(analysis).toHaveProperty('name');
        expect(analysis).toHaveProperty('type');
        expect(analysis).toHaveProperty('variants');
        expect(analysis).toHaveProperty('properties');
        expect(analysis).toHaveProperty('children');
      });
    });

    test('component analysis includes all data', () => {
      const fixturePath = join(process.cwd(), 'fixtures', 'component-variants.json');
      const content = readFileSync(fixturePath, 'utf-8');
      const figmaFile: FigmaFile = JSON.parse(content);
      
      const components = findComponents(figmaFile);
      if (components.length > 0) {
        const analysis = analyzeComponent(components[0]);
        
        expect(analysis.id).toBeTruthy();
        expect(analysis.name).toBeTruthy();
        expect(analysis.type).toBeTruthy();
      }
    });
  });
});
