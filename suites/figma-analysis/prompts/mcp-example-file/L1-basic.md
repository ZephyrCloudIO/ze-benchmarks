# Analyze Figma Design File

Analyze the Figma design file specified in the scenario configuration and extract comprehensive design specifications.

## Task

1. **Fetch the Figma File**: Use the `fetchFigmaFile` tool with file_id `"tXwpNdVwzZSVppFJjAmjSQ"` to retrieve the design file data. You can fetch the entire file or specific nodes using the `node_ids` parameter (e.g., `node_ids: "3:8446"` for a specific node).

   **Example tool call**: `fetchFigmaFile({ file_id: "tXwpNdVwzZSVppFJjAmjSQ" })`

2. **Extract Design Tokens**:
   - Color palette (hex values, semantic usage, theme support)
   - Typography scale (font families, sizes, weights, line heights)
   - Spacing scale (padding, margins, gaps, layout spacing)
   - Shadow/elevation tokens
   - Border radius values
   - Any other design properties

3. **Analyze Component Structure**:
   - Identify all components and their hierarchy
   - Document component variants and states
   - Analyze component composition and nesting
   - Note component relationships and dependencies

4. **Layout Analysis**:
   - Identify grid systems and breakpoints
   - Analyze responsive behavior patterns
   - Document spacing and alignment patterns
   - Note content hierarchy and visual flow

5. **Accessibility Audit**:
   - Evaluate color contrast ratios (WCAG AA standards)
   - Identify semantic structure needs
   - Check interactive element accessibility
   - Provide ARIA attribute recommendations

6. **Generate Specifications**:
   - Create structured component specifications
   - Document usage guidelines
   - Provide implementation notes
   - Include design-to-code translation guidance

## Output Format

Structure your analysis clearly with the following sections:

- **Design Tokens**: Organized by category with values and usage
- **Component Specifications**: Detailed specs for each component
- **Layout Patterns**: Grid systems, responsive behavior, spacing
- **Accessibility Findings**: Contrast ratios, semantic needs, recommendations
- **Implementation Guidance**: Actionable steps for implementation

Be thorough, accurate, and provide clear, actionable specifications.

