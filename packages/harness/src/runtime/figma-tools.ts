import chalk from 'chalk';
import type { ToolDefinition, ToolHandler } from './workspace-tools.ts';

/**
 * Design token extraction results
 */
interface TokenExtraction {
	colors: Map<string, string>;
	typography: Array<{ name: string; family: string; size: number; weight: number; lineHeight: number }>;
	spacing: Set<number>;
	borderRadius: Set<number>;
	shadows: Array<{ name: string; value: string }>;
	opacities: Set<number>;
}

/**
 * Create a summarized version of a large Figma API response
 * Extracts key information while keeping response size manageable
 * Based on patterns from figmagic, figma-context-mcp, and figma-extractor2
 */
export function createFigmaResponseSummary(data: any): string {
	const summary: string[] = [];
	const tokens: TokenExtraction = {
		colors: new Map(),
		typography: [],
		spacing: new Set(),
		borderRadius: new Set(),
		shadows: [],
		opacities: new Set(),
	};
	
	summary.push('# Figma File Summary\n');
	
	// File metadata
	if (data.name) summary.push(`**File Name**: ${data.name}`);
	if (data.lastModified) summary.push(`**Last Modified**: ${data.lastModified}`);
	if (data.version) summary.push(`**Version**: ${data.version}`);
	if (data.thumbnailUrl) summary.push(`**Thumbnail**: ${data.thumbnailUrl}\n`);
	
	// Extract design tokens from document tree
	if (data.document) {
		extractTokensFromNode(data.document, tokens, data.styles || {});
	}
	
	// Extract tokens from styles
	if (data.styles) {
		extractTokensFromStyles(data.styles, tokens);
	}
	
	// Document structure summary (simplified)
	if (data.document) {
		summary.push('## Document Structure\n');
		const docSummary = summarizeNodeStructure(data.document, 0, 2); // Max depth 2 for structure
		summary.push(docSummary);
	}
	
	// Design Tokens Section
	summary.push('\n## Design Tokens\n');
	
	// Colors
	if (tokens.colors.size > 0) {
		summary.push('\n### Colors\n');
		const sortedColors = Array.from(tokens.colors.entries())
			.slice(0, 50) // Limit to 50 colors
			.sort((a, b) => a[0].localeCompare(b[0]));
		sortedColors.forEach(([name, value]) => {
			summary.push(`- **${name}**: \`${value}\``);
		});
		if (tokens.colors.size > 50) {
			summary.push(`\n*... and ${tokens.colors.size - 50} more colors*`);
		}
	}
	
	// Typography
	if (tokens.typography.length > 0) {
		summary.push('\n### Typography\n');
		const uniqueTypography = deduplicateTypography(tokens.typography).slice(0, 30);
		uniqueTypography.forEach((typo) => {
			summary.push(`- **${typo.name}**: ${typo.family}, ${typo.size}px, weight ${typo.weight}, line-height ${typo.lineHeight}px`);
		});
		if (tokens.typography.length > 30) {
			summary.push(`\n*... and ${tokens.typography.length - 30} more typography styles*`);
		}
	}
	
	// Spacing
	if (tokens.spacing.size > 0) {
		summary.push('\n### Spacing Scale\n');
		const sortedSpacing = Array.from(tokens.spacing).sort((a, b) => a - b).slice(0, 20);
		sortedSpacing.forEach((space) => {
			summary.push(`- \`${space}px\``);
		});
		if (tokens.spacing.size > 20) {
			summary.push(`\n*... and ${tokens.spacing.size - 20} more spacing values*`);
		}
	}
	
	// Border Radius
	if (tokens.borderRadius.size > 0) {
		summary.push('\n### Border Radius\n');
		const sortedRadius = Array.from(tokens.borderRadius).sort((a, b) => a - b).slice(0, 15);
		sortedRadius.forEach((radius) => {
			summary.push(`- \`${radius}px\``);
		});
		if (tokens.borderRadius.size > 15) {
			summary.push(`\n*... and ${tokens.borderRadius.size - 15} more radius values*`);
		}
	}
	
	// Shadows
	if (tokens.shadows.length > 0) {
		summary.push('\n### Shadows\n');
		tokens.shadows.slice(0, 15).forEach((shadow) => {
			summary.push(`- **${shadow.name}**: \`${shadow.value}\``);
		});
		if (tokens.shadows.length > 15) {
			summary.push(`\n*... and ${tokens.shadows.length - 15} more shadows*`);
		}
	}
	
	// Opacities
	if (tokens.opacities.size > 0) {
		summary.push('\n### Opacities\n');
		const sortedOpacities = Array.from(tokens.opacities).sort((a, b) => a - b).slice(0, 10);
		sortedOpacities.forEach((opacity) => {
			summary.push(`- \`${opacity}\``);
		});
		if (tokens.opacities.size > 10) {
			summary.push(`\n*... and ${tokens.opacities.size - 10} more opacity values*`);
		}
	}
	
	// Styles summary (Figma named styles)
	if (data.styles) {
		summary.push('\n## Figma Named Styles\n');
		const styleCounts: Record<string, number> = {};
		const styleSamples: Record<string, any[]> = {};
		
		Object.entries(data.styles as Record<string, any>).forEach(([key, style]: [string, any]) => {
			const type = style.styleType || 'unknown';
			styleCounts[type] = (styleCounts[type] || 0) + 1;
			if (!styleSamples[type]) styleSamples[type] = [];
			if (styleSamples[type].length < 5) {
				styleSamples[type].push({ key, style });
			}
		});
		
		Object.entries(styleCounts).forEach(([type, count]) => {
			summary.push(`\n### ${type} (${count} style${count !== 1 ? 's' : ''})`);
			if (styleSamples[type]) {
				styleSamples[type].forEach(({ key, style }) => {
					summary.push(`- **${style.name || key}**`);
					if (style.description) summary.push(`  - ${style.description}`);
				});
			}
		});
	}
	
	// Components summary
	if (data.components) {
		summary.push('\n## Components\n');
		const componentEntries = Object.entries(data.components);
		summary.push(`Total components: ${componentEntries.length}`);
		
		if (componentEntries.length > 0) {
			summary.push('\n**Component Samples (first 25):**');
			componentEntries.slice(0, 25).forEach(([key, component]: [string, any]) => {
				summary.push(`\n### ${component.name || key}`);
				if (component.description) summary.push(`**Description**: ${component.description}`);
				if (component.componentSetId) summary.push(`**Component Set**: ${component.componentSetId}`);
				if (component.key) summary.push(`**Key**: ${component.key}`);
			});
			if (componentEntries.length > 25) {
				summary.push(`\n*... and ${componentEntries.length - 25} more components*`);
			}
		}
	}
	
	// Component sets summary
	if (data.componentSets) {
		summary.push('\n## Component Sets\n');
		const setEntries = Object.entries(data.componentSets);
		summary.push(`Total component sets: ${setEntries.length}`);
		if (setEntries.length > 0) {
			setEntries.slice(0, 10).forEach(([key, set]: [string, any]) => {
				summary.push(`- **${set.name || key}** (${set.componentPropertyDefinitions ? Object.keys(set.componentPropertyDefinitions).length : 0} properties)`);
			});
			if (setEntries.length > 10) {
				summary.push(`*... and ${setEntries.length - 10} more component sets*`);
			}
		}
	}
	
	summary.push('\n---');
	summary.push('\n**Note**: This is a summarized version optimized for AI analysis. For detailed node information, fetch specific nodes using the `node_ids` parameter.');
	summary.push(`\n**Full response size**: ${(JSON.stringify(data).length / 1024).toFixed(1)} KB`);
	
	const finalSummary = summary.join('\n');
	summary.push(`\n**Summary size**: ${(finalSummary.length / 1024).toFixed(1)} KB`);
	
	return finalSummary;
}

/**
 * Extract design tokens from a node tree recursively
 * Based on patterns from figmagic and figma-extractor2
 */
function extractTokensFromNode(node: any, tokens: TokenExtraction, styles: Record<string, any>, parentName: string = ''): void {
	if (!node) return;
	
	const nodeName = node.name || '';
	const fullName = parentName ? `${parentName}/${nodeName}` : nodeName;
	const nodeType = node.type || '';
	
	// Extract colors from fills (following figmagic pattern)
	if (node.fills && Array.isArray(node.fills)) {
		node.fills.forEach((fill: any) => {
			if (fill.type === 'SOLID' && fill.color) {
				const color = rgbaToHex(fill.color, fill.opacity !== undefined ? fill.opacity : 1);
				// Use naming convention: if name contains "color", use it; otherwise generate
				const colorName = extractColorName(nodeName, fullName) || `color-${tokens.colors.size + 1}`;
				if (!tokens.colors.has(colorName)) {
					tokens.colors.set(colorName, color);
				}
			}
		});
	}
	
	// Extract colors from strokes
	if (node.strokes && Array.isArray(node.strokes)) {
		node.strokes.forEach((stroke: any) => {
			if (stroke.type === 'SOLID' && stroke.color) {
				const color = rgbaToHex(stroke.color, stroke.opacity !== undefined ? stroke.opacity : 1);
				const colorName = extractColorName(nodeName, fullName, 'stroke') || `stroke-${tokens.colors.size + 1}`;
				if (!tokens.colors.has(colorName)) {
					tokens.colors.set(colorName, color);
				}
			}
		});
	}
	
	// Extract typography from TEXT nodes
	if (nodeType === 'TEXT' && node.style) {
		const typo = {
			name: nodeName || 'text-default',
			family: node.style.fontFamily || 'unknown',
			size: node.style.fontSize || 16,
			weight: node.style.fontWeight || 400,
			lineHeight: node.style.lineHeightPx || node.style.fontSize || 16,
		};
		tokens.typography.push(typo);
	}
	
	// Extract spacing from dimensions (following figma-extractor2 pattern)
	if (node.absoluteBoundingBox) {
		const width = node.absoluteBoundingBox.width;
		const height = node.absoluteBoundingBox.height;
		// If name suggests spacing (padding, margin, gap, space)
		if (isSpacingNode(nodeName)) {
			tokens.spacing.add(Math.round(width));
			tokens.spacing.add(Math.round(height));
		}
		// Extract padding/margin from layout properties
		if (node.paddingLeft) tokens.spacing.add(Math.round(node.paddingLeft));
		if (node.paddingRight) tokens.spacing.add(Math.round(node.paddingRight));
		if (node.paddingTop) tokens.spacing.add(Math.round(node.paddingTop));
		if (node.paddingBottom) tokens.spacing.add(Math.round(node.paddingBottom));
	}
	
	// Extract border radius
	if (node.cornerRadius !== undefined && node.cornerRadius > 0) {
		tokens.borderRadius.add(Math.round(node.cornerRadius));
	}
	if (node.rectangleCornerRadii && Array.isArray(node.rectangleCornerRadii)) {
		node.rectangleCornerRadii.forEach((radius: number) => {
			if (radius > 0) tokens.borderRadius.add(Math.round(radius));
		});
	}
	
	// Extract shadows/effects
	if (node.effects && Array.isArray(node.effects)) {
		node.effects.forEach((effect: any) => {
			if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
				const shadowValue = effectToCSS(effect);
				const shadowName = extractShadowName(nodeName) || `shadow-${tokens.shadows.length + 1}`;
				tokens.shadows.push({ name: shadowName, value: shadowValue });
			}
		});
	}
	
	// Extract opacity
	if (node.opacity !== undefined && node.opacity < 1) {
		tokens.opacities.add(Math.round(node.opacity * 100) / 100);
	}
	
	// Recurse into children (limit depth to prevent stack overflow)
	if (node.children && Array.isArray(node.children) && fullName.split('/').length < 10) {
		node.children.forEach((child: any) => {
			extractTokensFromNode(child, tokens, styles, fullName);
		});
	}
}

/**
 * Extract tokens from Figma named styles
 */
function extractTokensFromStyles(styles: Record<string, any>, tokens: TokenExtraction): void {
	Object.values(styles).forEach((style: any) => {
		if (style.styleType === 'FILL' && style.paints && Array.isArray(style.paints)) {
			style.paints.forEach((paint: any) => {
				if (paint.type === 'SOLID' && paint.color) {
					const color = rgbaToHex(paint.color, paint.opacity !== undefined ? paint.opacity : 1);
					const colorName = style.name || `style-${tokens.colors.size + 1}`;
					if (!tokens.colors.has(colorName)) {
						tokens.colors.set(colorName, color);
					}
				}
			});
		}
		if (style.styleType === 'TEXT' && style.fontSize) {
			tokens.typography.push({
				name: style.name || 'text-style',
				family: style.fontFamily || 'unknown',
				size: style.fontSize,
				weight: style.fontWeight || 400,
				lineHeight: style.lineHeightPx || style.fontSize,
			});
		}
	});
}

/**
 * Summarize node structure (simplified, just hierarchy)
 */
function summarizeNodeStructure(node: any, depth: number, maxDepth: number): string {
	if (depth > maxDepth) {
		return '  '.repeat(depth) + `... (${countChildren(node)} children)`;
	}
	
	const lines: string[] = [];
	const indent = '  '.repeat(depth);
	const nodeType = node.type || 'unknown';
	const nodeName = node.name || nodeType;
	
	lines.push(`${indent}- **${nodeName}** (${nodeType})`);
	
	if (node.id && depth === 0) {
		lines.push(`${indent}  ID: ${node.id}`);
	}
	
	// Show key info for important node types
	if (nodeType === 'COMPONENT' || nodeType === 'INSTANCE') {
		if (node.description) lines.push(`${indent}  Description: ${node.description}`);
		if (node.componentSetId) lines.push(`${indent}  Component Set: ${node.componentSetId}`);
	}
	
	// Limit children shown
	if (node.children && Array.isArray(node.children) && node.children.length > 0) {
		const childrenToShow = node.children.slice(0, 8);
		childrenToShow.forEach((child: any) => {
			lines.push(summarizeNodeStructure(child, depth + 1, maxDepth));
		});
		if (node.children.length > 8) {
			lines.push(`${indent}  ... and ${node.children.length - 8} more children`);
		}
	}
	
	return lines.join('\n');
}

function countChildren(node: any): number {
	if (!node.children || !Array.isArray(node.children)) return 0;
	let count = node.children.length;
	node.children.forEach((child: any) => {
		count += countChildren(child);
	});
	return count;
}

/**
 * Convert RGBA color to hex string
 */
function rgbaToHex(color: { r: number; g: number; b: number }, opacity: number = 1): string {
	const r = Math.round(color.r * 255);
	const g = Math.round(color.g * 255);
	const b = Math.round(color.b * 255);
	const a = Math.round(opacity * 255);
	
	if (a === 255) {
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${a.toString(16).padStart(2, '0')}`;
}

/**
 * Extract color name from node name using naming conventions
 * Patterns: "color-primary", "primary-color", "bg-primary", etc.
 */
function extractColorName(nodeName: string, fullName: string, prefix: string = ''): string | null {
	const name = nodeName.toLowerCase();
	const full = fullName.toLowerCase();
	
	// Check for color naming patterns
	if (name.includes('color') || name.includes('colour')) {
		// Extract meaningful parts
		const parts = name.split(/[-_\s]+/).filter(p => p && p !== 'color' && p !== 'colour');
		if (parts.length > 0) {
			return `color-${parts.join('-')}`;
		}
	}
	
	// Check for semantic color names
	const semanticColors = ['primary', 'secondary', 'accent', 'background', 'bg', 'foreground', 'fg', 'text', 'border', 'error', 'warning', 'success', 'info'];
	for (const semantic of semanticColors) {
		if (name.includes(semantic)) {
			const parts = name.split(/[-_\s]+/).filter(p => p && p !== semantic);
			return `color-${semantic}${parts.length > 0 ? '-' + parts.join('-') : ''}`;
		}
	}
	
	// Use full path if it's short and meaningful
	if (full.split('/').length <= 3 && full.length < 50) {
		return full.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
	}
	
	return null;
}

/**
 * Check if node name suggests spacing
 */
function isSpacingNode(name: string): boolean {
	const spacingKeywords = ['spacing', 'space', 'padding', 'margin', 'gap', 'gutter', 'inset'];
	const lowerName = name.toLowerCase();
	return spacingKeywords.some(keyword => lowerName.includes(keyword));
}

/**
 * Extract shadow name from node name
 */
function extractShadowName(name: string): string | null {
	const lowerName = name.toLowerCase();
	if (lowerName.includes('shadow') || lowerName.includes('elevation')) {
		const parts = name.split(/[-_\s]+/).filter(p => p && p.toLowerCase() !== 'shadow' && p.toLowerCase() !== 'elevation');
		return `shadow-${parts.length > 0 ? parts.join('-') : 'default'}`;
	}
	return null;
}

/**
 * Convert Figma effect to CSS shadow string
 */
function effectToCSS(effect: any): string {
	const { color, offset, radius, spread } = effect;
	const r = Math.round((color?.r || 0) * 255);
	const g = Math.round((color?.g || 0) * 255);
	const b = Math.round((color?.b || 0) * 255);
	const a = effect.opacity !== undefined ? effect.opacity : (color?.a !== undefined ? color.a : 1);
	
	const x = offset?.x || 0;
	const y = offset?.y || 0;
	const blur = radius || 0;
	const spreadValue = spread || 0;
	const type = effect.type === 'INNER_SHADOW' ? 'inset' : '';
	
	return `${type} ${x}px ${y}px ${blur}px ${spreadValue}px rgba(${r}, ${g}, ${b}, ${a})`.trim();
}

/**
 * Deduplicate typography entries
 */
function deduplicateTypography(typography: Array<{ name: string; family: string; size: number; weight: number; lineHeight: number }>): Array<{ name: string; family: string; size: number; weight: number; lineHeight: number }> {
	const seen = new Set<string>();
	const unique: typeof typography = [];
	
	typography.forEach((typo) => {
		const key = `${typo.family}-${typo.size}-${typo.weight}-${typo.lineHeight}`;
		if (!seen.has(key)) {
			seen.add(key);
			unique.push(typo);
		}
	});
	
	return unique;
}

/**
 * Create Figma API fetch tool definition
 * Allows agents to fetch Figma file data from the Figma API
 */
export function createFigmaFetchTool(): ToolDefinition {
	return {
		name: 'fetchFigmaFile',
		description: 'Fetch Figma file data from Figma API. Requires FIGMA_API_KEY environment variable. Can fetch the entire file or specific nodes. Returns the Figma file JSON structure including nodes, styles, and metadata.',
		input_schema: {
			type: 'object',
			properties: {
				file_id: {
					type: 'string',
					description: 'Figma file ID (extract from Figma URL: figma.com/file/{file_id}/...). Example: "tXwpNdVwzZSVppFJjAmjSQ"'
				},
				node_ids: {
					type: 'string',
					description: 'Optional: Comma-separated list of node IDs to fetch specific nodes (e.g., "3:8446" or "3:8446,3:8447"). If provided, fetches only those nodes. If omitted, fetches the entire file.'
				},
				file_key: {
					type: 'string',
					description: 'Optional: Specific file version key for fetching a particular version of the file'
				}
			},
			required: ['file_id']
		}
	};
}

/**
 * Create Figma API fetch tool handler
 * Makes authenticated requests to Figma API using FIGMA_API_KEY
 */
export function createFigmaFetchHandler(): ToolHandler {
	return async (input: { file_id: string; node_ids?: string; file_key?: string }): Promise<string> => {
		// Log the request parameters the agent is making
		console.log(chalk.cyan(`[fetchFigmaFile] ========== AGENT REQUEST ==========`));
		console.log(chalk.cyan(`[fetchFigmaFile] Agent called fetchFigmaFile with:`));
		console.log(chalk.cyan(`[fetchFigmaFile]   file_id: ${input.file_id}`));
		if (input.node_ids) {
			console.log(chalk.cyan(`[fetchFigmaFile]   node_ids: ${input.node_ids}`));
		}
		if (input.file_key) {
			console.log(chalk.cyan(`[fetchFigmaFile]   file_key: ${input.file_key}`));
		}
		console.log(chalk.cyan(`[fetchFigmaFile] Full input: ${JSON.stringify(input, null, 2)}`));
		console.log(chalk.cyan(`[fetchFigmaFile] ====================================`));
		
		const apiKey = process.env.FIGMA_API_KEY;
		
		// Debug: Log API key status (without exposing the key)
		console.log(chalk.gray(`[fetchFigmaFile] API key check: ${apiKey ? `✓ Found (${apiKey.substring(0, 10)}...)` : '✗ Not found'}`));
		console.log(chalk.gray(`[fetchFigmaFile] Environment check: NODE_ENV=${process.env.NODE_ENV || 'undefined'}`));
		
		if (!apiKey) {
			const error = 'FIGMA_API_KEY environment variable not set. Please set it in your .env file or environment.';
			console.error(chalk.red(`[fetchFigmaFile] ${error}`));
			console.error(chalk.yellow(`[fetchFigmaFile] Tip: Add FIGMA_API_KEY=your_key_here to your .env file in the project root`));
			return `Error: ${error}`;
		}

		// Build URL based on whether we're fetching specific nodes or the entire file
		let url: string;
		if (input.node_ids) {
			// Fetch specific nodes: /v1/files/{file_id}/nodes?ids={node_ids}
			const nodeIdsParam = input.node_ids.split(',').map(id => id.trim()).join(',');
			url = `https://api.figma.com/v1/files/${input.file_id}/nodes?ids=${encodeURIComponent(nodeIdsParam)}`;
			if (input.file_key) {
				url += `&version=${encodeURIComponent(input.file_key)}`;
			}
		} else {
			// Fetch entire file: /v1/files/{file_id}
			url = input.file_key
				? `https://api.figma.com/v1/files/${input.file_id}?version=${encodeURIComponent(input.file_key)}`
				: `https://api.figma.com/v1/files/${input.file_id}`;
		}

		const fetchType = input.node_ids ? `nodes (${input.node_ids})` : 'entire file';
		console.log(chalk.blue(`[fetchFigmaFile] Fetching Figma ${fetchType}: ${input.file_id}${input.file_key ? ` (version: ${input.file_key})` : ''}`));
		console.log(chalk.gray(`[fetchFigmaFile] Request URL: ${url}`));
		console.log(chalk.gray(`[fetchFigmaFile] Request headers: X-Figma-Token: ${apiKey.substring(0, 10)}...`));

		try {
			console.log(chalk.gray(`[fetchFigmaFile] Sending fetch request...`));
			const response = await fetch(url, {
				headers: {
					'X-Figma-Token': apiKey
				}
			});

			console.log(chalk.gray(`[fetchFigmaFile] Response status: ${response.status} ${response.statusText}`));
			console.log(chalk.gray(`[fetchFigmaFile] Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`));

			if (!response.ok) {
				const errorText = await response.text();
				console.error(chalk.red(`[fetchFigmaFile] ✗ API Error Response:`));
				console.error(chalk.red(`[fetchFigmaFile]   Status: ${response.status} ${response.statusText}`));
				console.error(chalk.red(`[fetchFigmaFile]   Body: ${errorText.substring(0, 500)}${errorText.length > 500 ? '...' : ''}`));
				const error = `Figma API error (${response.status} ${response.statusText}): ${errorText}`;
				return `Error: ${error}`;
			}

			const responseText = await response.text();
			console.log(chalk.gray(`[fetchFigmaFile] Response body length: ${responseText.length} characters`));
			console.log(chalk.gray(`[fetchFigmaFile] Response body preview (first 500 chars):\n${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`));

			let data: any;
			try {
				data = JSON.parse(responseText);
			} catch (parseError) {
				console.error(chalk.red(`[fetchFigmaFile] ✗ Failed to parse JSON response`));
				console.error(chalk.red(`[fetchFigmaFile]   Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
				console.error(chalk.red(`[fetchFigmaFile]   Response text: ${responseText.substring(0, 1000)}`));
				return `Error: Failed to parse Figma API response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
			}

			const dataSize = JSON.stringify(data).length;
			console.log(chalk.green(`[fetchFigmaFile] ✓ Successfully fetched Figma ${fetchType} (${dataSize} bytes)`));
			console.log(chalk.gray(`[fetchFigmaFile] Response structure: ${Object.keys(data).join(', ')}`));
			
			// Handle large responses by summarizing or truncating
			const MAX_RESPONSE_SIZE = 500000; // ~500KB to leave room for conversation context
			const formattedJson = JSON.stringify(data, null, 2);
			
			if (formattedJson.length > MAX_RESPONSE_SIZE) {
				console.log(chalk.yellow(`[fetchFigmaFile] ⚠️  Response is very large (${formattedJson.length} chars), creating summary...`));
				
				// Create a summarized version
				const summary = createFigmaResponseSummary(data);
				console.log(chalk.gray(`[fetchFigmaFile] Summary length: ${summary.length} characters`));
				console.log(chalk.yellow(`[fetchFigmaFile] Returning summarized response instead of full JSON`));
				return summary;
			}
			
			console.log(chalk.gray(`[fetchFigmaFile] Returning ${formattedJson.length} characters of formatted JSON to agent`));
			return formattedJson;
		} catch (error) {
			const errorMessage = `Error fetching Figma file: ${error instanceof Error ? error.message : String(error)}`;
			console.error(chalk.red(`[fetchFigmaFile] ✗ Fetch error:`));
			console.error(chalk.red(`[fetchFigmaFile]   ${errorMessage}`));
			if (error instanceof Error && error.stack) {
				console.error(chalk.gray(`[fetchFigmaFile]   Stack: ${error.stack}`));
			}
			return `Error: ${errorMessage}`;
		}
	};
}

