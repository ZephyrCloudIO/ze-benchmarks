# Figma Extract Suite Fixtures

This directory contains fixtures for deterministic testing of Figma design token extraction and component understanding scenarios.

## Directory Structure

```
fixtures/
├── figma-files/           # JSON exports of Figma file structures
└── figma-api-responses/   # Mocked Figma API responses
```

## Fixture Files

### Figma Files (`figma-files/`)

These are JSON representations of Figma file structures, mimicking what you'd get from the Figma REST API's file endpoints.

#### 1. `design-tokens-sample.json`
**Purpose**: Complete design token system with colors, typography, and spacing.

**Contents**:
- Color tokens: Primary (500, 600, 700) and Neutral (50, 100, 900)
- Typography tokens: Headings (h1, h2) and Body text (regular, small)
- Spacing tokens: xs (4px), sm (8px), md (16px), lg (24px), xl (32px)

**Use Cases**:
- Design token extraction scenarios
- Style guide generation
- Token-to-code conversion
- Theme system development

**Example Usage in Tests**:
```typescript
import designTokens from './fixtures/figma-files/design-tokens-sample.json';

test('extracts color tokens correctly', () => {
  const colors = extractColors(designTokens);
  expect(colors).toContainEqual({
    name: 'primary/500',
    value: { r: 0.0, g: 0.47, b: 1.0 }
  });
});
```

#### 2. `minimal-button.json`
**Purpose**: Simple single-component file for basic component extraction testing.

**Contents**:
- Single Button component
- Basic styling (background, text)
- Standard component structure

**Use Cases**:
- Component extraction basics
- Component property parsing
- Simple component understanding tests

**Example Usage**:
```typescript
import buttonComponent from './fixtures/figma-files/minimal-button.json';

test('parses button component structure', () => {
  const component = parseComponent(buttonComponent);
  expect(component.name).toBe('Button');
  expect(component.children).toHaveLength(2); // Background + Label
});
```

#### 3. `component-variants.json`
**Purpose**: Component with multiple variants (sizes and styles).

**Contents**:
- Button component set
- Variants: primary/secondary styles × small/medium/large sizes
- Component property definitions
- Variant naming conventions

**Use Cases**:
- Component variant extraction
- Property mapping
- Variant naming analysis
- Component set understanding

**Example Usage**:
```typescript
import variants from './fixtures/figma-files/component-variants.json';

test('identifies all button variants', () => {
  const componentSet = parseComponentSet(variants);
  expect(componentSet.variants).toHaveLength(4);
  expect(componentSet.properties).toEqual(['variant', 'size']);
});
```

#### 4. `full-component-set.json`
**Purpose**: Complete design system with multiple component types.

**Contents**:
- Multiple component categories: Buttons, Inputs, Cards, Avatars
- Various component types demonstrating different patterns
- Comprehensive component library structure

**Use Cases**:
- Full design system extraction
- Multi-component analysis
- Component categorization
- Design system understanding

**Example Usage**:
```typescript
import fullSystem from './fixtures/figma-files/full-component-set.json';

test('extracts all component types', () => {
  const components = extractComponents(fullSystem);
  expect(components).toContainEqual(
    expect.objectContaining({ type: 'Button' }),
    expect.objectContaining({ type: 'Input' }),
    expect.objectContaining({ type: 'Card' })
  );
});
```

#### 5. `color-system.json`
**Purpose**: Comprehensive color system with multiple themes and variations.

**Contents**:
- Complete color palette structure
- Theme variations
- Color naming conventions

**Use Cases**:
- Color token extraction
- Theme system generation
- Color palette analysis

---

### API Responses (`figma-api-responses/`)

These are mocked Figma API responses for testing error handling and API integration.

#### 1. `get-file-response.json`
**Purpose**: Successful file retrieval response from `/v1/files/:key`.

**Contents**:
- Standard success response structure
- File metadata (name, version, lastModified)
- Document structure
- Component and style information

**Use Cases**:
- Testing successful API integration
- Response parsing validation
- Data structure verification

**Example Usage**:
```typescript
import successResponse from './fixtures/figma-api-responses/get-file-response.json';

test('handles successful file response', () => {
  const result = parseFigmaResponse(successResponse);
  expect(result.status).toBe(200);
  expect(result.name).toBe('Design System');
});
```

#### 2. `get-node-response.json`
**Purpose**: Successful node retrieval response from `/v1/files/:key/nodes`.

**Contents**:
- Node-specific response structure
- Detailed component information
- Child node hierarchy

**Use Cases**:
- Testing node-specific extraction
- Component detail parsing
- Node hierarchy understanding

**Example Usage**:
```typescript
import nodeResponse from './fixtures/figma-api-responses/get-node-response.json';

test('extracts node details correctly', () => {
  const node = parseNodeResponse(nodeResponse);
  expect(node.nodes['1:2'].document.name).toBe('Button');
});
```

#### 3. `rate-limit-error.json`
**Purpose**: 429 rate limit error response.

**Contents**:
- 429 status code
- Rate limit error message
- Retry-After information

**Use Cases**:
- Rate limit error handling
- Retry logic testing
- Error recovery testing

**Example Usage**:
```typescript
import rateLimitError from './fixtures/figma-api-responses/rate-limit-error.json';

test('handles rate limit errors gracefully', () => {
  expect(() => handleResponse(rateLimitError)).toThrow('Rate limit exceeded');
});
```

#### 4. `invalid-token-error.json`
**Purpose**: 403 authentication error response.

**Contents**:
- 403 status code
- Authentication error message

**Use Cases**:
- Authentication error handling
- Token validation testing
- Error message display

**Example Usage**:
```typescript
import authError from './fixtures/figma-api-responses/invalid-token-error.json';

test('handles authentication errors', () => {
  expect(() => handleResponse(authError)).toThrow('Invalid token');
});
```

---

## Usage Guidelines

### In Scenario Tests

Each scenario's `repo-fixture/fixtures/` directory contains copies of these fixtures for use in tests:

```typescript
// In scenario test files
import designTokens from './repo-fixture/fixtures/figma-files/design-tokens-sample.json';
import apiResponse from './repo-fixture/fixtures/figma-api-responses/get-file-response.json';

test('scenario test', () => {
  // Use fixtures instead of live API calls
  const result = processDesignTokens(designTokens);
  expect(result).toBeDefined();
});
```

### In Scenario Configuration

Reference fixtures in `scenario.yaml`:

```yaml
fixtures:
  figma_file: "./repo-fixture/fixtures/figma-files/design-tokens-sample.json"
  api_responses:
    success: "./repo-fixture/fixtures/figma-api-responses/get-file-response.json"
    rate_limit: "./repo-fixture/fixtures/figma-api-responses/rate-limit-error.json"
```

### Benefits of Using Fixtures

1. **Deterministic Tests**: Same input always produces same output
2. **No API Dependencies**: Tests run without internet or API tokens
3. **Faster Execution**: No network latency
4. **Rate Limit Avoidance**: No risk of hitting Figma API limits
5. **Reproducibility**: Anyone can run tests with same results
6. **Version Control**: Fixtures are committed, ensuring consistency

---

## Fixture Design Principles

These fixtures follow these principles:

1. **Minimal but Complete**: Include only essential properties, but enough for comprehensive testing
2. **Representative**: Mirror real Figma API structures accurately
3. **Diverse**: Cover various component types, patterns, and edge cases
4. **Well-Documented**: Each fixture has clear purpose and use cases
5. **Maintainable**: Simple structure makes updates easy

---

## Updating Fixtures

If you need to update fixtures (e.g., to reflect Figma API changes):

1. **Export from Figma**: Use Figma API to export current file structure
2. **Minimize**: Remove unnecessary properties to keep fixtures lean
3. **Validate**: Ensure structure matches Figma API documentation
4. **Document**: Update this README with any changes
5. **Test**: Run all scenarios to verify fixtures still work

For automated fixture export, see `/reference-repos/ze-benchmarks/scripts/export-figma-fixtures.ts` (if available).

---

## Related Documentation

- Suite-level policy: `../prompts/policy.yaml`
- Scenario configurations: `../scenarios/*/scenario.yaml`
- Figma API Documentation: https://www.figma.com/developers/api

---

## Questions?

If you have questions about fixture usage or need additional fixtures, please:
1. Review the scenario-specific documentation
2. Check the Figma API documentation
3. Examine existing test files for usage examples
