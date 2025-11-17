/**
 * Validator Module
 * Validates templates and detects potential issues
 * Uses agency-prompt-creator for template and mustache validation
 */

import { validateTemplate as validateAgencyTemplate, validateTemplateString } from 'agency-prompt-creator';
import type { SpecialistTemplate, ValidationResult, ValidationIssue } from '../types/index.js';

export function validate(template: SpecialistTemplate): ValidationResult {
  console.log('[Validator] Validating template...');

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const info: ValidationIssue[] = [];

  // Use agency-prompt-creator validation first
  console.log('[Validator] Running agency-prompt-creator validation...');
  const isValid = validateAgencyTemplate(template as any);
  if (!isValid) {
    warnings.push({
      type: 'warning',
      category: 'structure',
      message: 'Template structure does not fully conform to agency-prompt-creator specification',
      path: 'template'
    });
  }

  // Validate mustache syntax in prompts using agency-prompt-creator
  if (template.prompts?.default?.spawnerPrompt) {
    const issues = validateTemplateString(template.prompts.default.spawnerPrompt);
    issues.forEach(issue => {
      warnings.push({
        type: 'warning',
        category: 'quality',
        message: `Mustache syntax issue in spawnerPrompt: ${issue}`,
        path: 'prompts.default.spawnerPrompt'
      });
    });
  }

  // Check required fields
  if (!template.name) {
    errors.push({
      type: 'error',
      category: 'structure',
      message: 'Template name is required',
      path: 'name'
    });
  }

  if (!template.version) {
    errors.push({
      type: 'error',
      category: 'structure',
      message: 'Template version is required',
      path: 'version'
    });
  }

  if (!template.persona) {
    errors.push({
      type: 'error',
      category: 'structure',
      message: 'Persona section is required',
      path: 'persona'
    });
  }

  if (!template.capabilities) {
    errors.push({
      type: 'error',
      category: 'structure',
      message: 'Capabilities section is required',
      path: 'capabilities'
    });
  }

  if (!template.prompts) {
    errors.push({
      type: 'error',
      category: 'structure',
      message: 'Prompts section is required',
      path: 'prompts'
    });
  }

  // Check completeness
  if (template.documentation && template.documentation.length === 0) {
    warnings.push({
      type: 'warning',
      category: 'completeness',
      message: 'No documentation entries found',
      path: 'documentation',
      suggestion: 'Add documentation URLs to improve specialist quality'
    });
  }

  if (template.capabilities && template.capabilities.tags.length === 0) {
    warnings.push({
      type: 'warning',
      category: 'completeness',
      message: 'No capability tags defined',
      path: 'capabilities.tags',
      suggestion: 'Add capability tags for better organization'
    });
  }

  // Check consistency
  if (template.persona && template.persona.tech_stack && template.persona.tech_stack.length === 0) {
    warnings.push({
      type: 'warning',
      category: 'consistency',
      message: 'Tech stack is empty',
      path: 'persona.tech_stack',
      suggestion: 'Define the tech stack this specialist covers'
    });
  }

  const result: ValidationResult = {
    isValid: errors.length === 0,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    errors,
    warnings,
    info
  };

  console.log(`[Validator] Validation complete: ${result.isValid ? 'PASSED' : 'FAILED'}`);
  console.log(`[Validator] - Errors: ${errors.length}`);
  console.log(`[Validator] - Warnings: ${warnings.length}`);

  return result;
}