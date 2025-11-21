# Comprehensive Figma Design Analysis

Perform a thorough analysis of the Figma design file specified in the scenario configuration. This is a comprehensive design system analysis task requiring attention to detail and systematic extraction of design information.

## Detailed Instructions

### Step 1: Fetch and Understand the Design File

Use the `fetchFigmaFile` tool with file ID `tXwpNdVwzZSVppFJjAmjSQ` to retrieve the Figma file structure. You can fetch:
- The entire file: `fetchFigmaFile({ file_id: "tXwpNdVwzZSVppFJjAmjSQ" })`
- Specific nodes: `fetchFigmaFile({ file_id: "tXwpNdVwzZSVppFJjAmjSQ", node_ids: "3:8446" })`

Start by fetching the entire file to understand the structure, then fetch specific nodes if needed for detailed analysis. Examine:
- Document structure and node hierarchy
- Component definitions and instances
- Style definitions (fills, strokes, effects, typography)
- Layout constraints and auto-layout properties

### Step 2: Extract Design Tokens Systematically

**Color System**:
- Extract all color values (hex, rgba) from fills and strokes
- Identify semantic color usage (primary, secondary, error, warning, success, etc.)
- Document color variants (light/dark themes if present)
- Note color usage context (backgrounds, text, borders, accents)

**Typography Scale**:
- Extract font families used
- Document font sizes, weights, line heights
- Identify typography hierarchy (headings, body, captions, etc.)
- Note text styles and their usage patterns

**Spacing System**:
- Extract padding and margin values
- Identify spacing scale (4px, 8px, 16px base units)
- Document gap values in auto-layout containers
- Note spacing relationships and patterns

**Visual Effects**:
- Extract shadow/elevation values (blur, spread, offset, color)
- Document border radius values
- Note opacity and blend modes where relevant

### Step 3: Component Analysis

For each component identified:
- **Name and Purpose**: Clear component name and intended use
- **Structure**: Node hierarchy and composition
- **Variants**: All variant properties and combinations
- **States**: Default, hover, active, disabled, focus states
- **Props/Parameters**: Component properties that can be configured
- **Composition**: How components nest and combine
- **Usage Context**: Where and how components should be used

### Step 4: Layout Pattern Analysis

- **Grid Systems**: Identify grid structures, column counts, gutters
- **Breakpoints**: Document responsive breakpoints and adaptive behavior
- **Auto-Layout**: Analyze flex/grid patterns in auto-layout frames
- **Spacing Relationships**: Document consistent spacing patterns
- **Content Hierarchy**: Visual hierarchy and information architecture

### Step 5: Accessibility Evaluation

- **Color Contrast**: Calculate contrast ratios for all text/background combinations (WCAG AA: 4.5:1 for normal text, 3:1 for large text)
- **Semantic Structure**: Identify heading hierarchy, list structures, landmark regions
- **Interactive Elements**: Evaluate button, link, form control accessibility
- **ARIA Needs**: Recommend ARIA attributes for complex components
- **Keyboard Navigation**: Note keyboard interaction patterns needed

### Step 6: Generate Structured Specifications

Create comprehensive documentation including:

**Design Token Documentation**:
```
Colors:
  - Primary: #hex (usage: buttons, links)
  - Secondary: #hex (usage: accents)
  ...

Typography:
  - Heading 1: Font Family, 32px, Bold, 1.2 line-height
  ...

Spacing:
  - xs: 4px
  - sm: 8px
  - md: 16px
  ...
```

**Component Specifications**:
```
Component: Button
  Props:
    - variant: 'primary' | 'secondary' | 'outline'
    - size: 'sm' | 'md' | 'lg'
    - disabled: boolean
  States: default, hover, active, disabled, focus
  Accessibility: WCAG AA compliant, keyboard navigable
  Usage: Primary actions, form submissions
```

**Implementation Guidance**:
- CSS variable definitions for design tokens
- Component API recommendations
- Accessibility implementation notes
- Responsive behavior implementation
- Best practices and patterns

## Quality Standards

- **Accuracy**: All extracted values must be precise
- **Completeness**: All components, tokens, and patterns documented
- **Clarity**: Well-organized, easy to navigate specifications
- **Actionability**: Clear implementation guidance provided
- **Accessibility**: Comprehensive accessibility evaluation and recommendations

Provide a thorough, professional analysis that would enable a developer to accurately implement this design system.

