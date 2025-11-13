import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { findProjectDir } from '../utils/workspace.ts';

export class ConfigAccuracyEvaluator implements Evaluator {
	meta = { name: 'ConfigAccuracyEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		try {
			// Log the paths received from context
			console.log(chalk.blue(`[ConfigAccuracyEvaluator] Suites dir from context: ${ctx.suitesDir || 'not provided'}`));
			console.log(chalk.blue(`[ConfigAccuracyEvaluator] Reference path from context: ${ctx.referencePath || 'not provided'}`));
			console.log(chalk.blue(`[ConfigAccuracyEvaluator] Workspace dir: ${ctx.workspaceDir}`));

			// Use reference path from context (no filesystem traversal needed)
			if (!ctx.referencePath || !fs.existsSync(ctx.referencePath)) {
				console.error(chalk.red(`[ConfigAccuracyEvaluator] ❌ Reference not found: ${ctx.referencePath || 'undefined'}`));
				return {
					name: this.meta.name,
					score: 0,
					details: 'Reference implementation not found',
				};
			}

			const contents = fs.readdirSync(ctx.referencePath);
			console.log(chalk.green(`[ConfigAccuracyEvaluator] ✓ Reference found`));
			console.log(chalk.blue(`[ConfigAccuracyEvaluator] Contents (${contents.length} items): [${contents.slice(0, 5).join(', ')}${contents.length > 5 ? '...' : ''}]`));

			// Find the generated project directory (not 'control')
			const projectDir = findProjectDir(ctx.workspaceDir);
			if (!projectDir) {
				return {
					name: this.meta.name,
					score: 0,
					details: 'Generated project directory not found in workspace',
				};
			}

			const checks = [
				this.checkViteConfig(projectDir, ctx.referencePath),
				this.checkTailwindSetup(projectDir, ctx.referencePath),
				this.checkTsConfig(projectDir, ctx.referencePath),
				this.checkComponentsJson(projectDir, ctx.referencePath),
			];

			const results = await Promise.all(checks);
			const score = results.reduce((sum, r) => sum + r.score, 0) / results.length;

			const details = JSON.stringify({
				score: score.toFixed(2),
				checks: results.map((r) => ({ name: r.name, score: r.score, reason: r.reason })),
			});

			return {
				name: this.meta.name,
				score,
				details,
			};
		} catch (error) {
			return {
				name: this.meta.name,
				score: 0,
				details: `Evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	private checkViteConfig(workspaceDir: string, referencePath: string): { name: string; score: number; reason: string } {
		const viteConfigPath = path.join(workspaceDir, 'vite.config.ts');
		if (!fs.existsSync(viteConfigPath)) {
			return { name: 'vite.config.ts', score: 0, reason: 'File does not exist' };
		}

		const content = fs.readFileSync(viteConfigPath, 'utf-8');

		// Check for required patterns in vite.config.ts
		const hasReactPlugin = /react\(\)/.test(content) || /@vitejs\/plugin-react/.test(content);
		const hasTailwindPlugin = /tailwindcss\(\)/.test(content) || /@tailwindcss\/vite/.test(content);
		const hasPathAlias = /@.*path\.resolve/.test(content) || /resolve:/.test(content);

		let score = 0;
		const reasons = [];
		if (hasReactPlugin) { score += 0.33; } else { reasons.push('missing React plugin'); }
		if (hasTailwindPlugin) { score += 0.34; } else { reasons.push('missing Tailwind plugin'); }
		if (hasPathAlias) { score += 0.33; } else { reasons.push('missing path alias config'); }

		return {
			name: 'vite.config.ts',
			score,
			reason: score === 1 ? 'All checks passed' : reasons.join(', ')
		};
	}

	private checkTailwindSetup(workspaceDir: string, referencePath: string): { name: string; score: number; reason: string } {
		const indexCssPath = path.join(workspaceDir, 'src/index.css');
		if (!fs.existsSync(indexCssPath)) {
			return { name: 'tailwind-setup', score: 0, reason: 'src/index.css does not exist' };
		}

		const content = fs.readFileSync(indexCssPath, 'utf-8');

		// Check for Tailwind v4 syntax (@import "tailwindcss") or v3 syntax (@tailwind directives)
		const hasTailwindV4 = /@import\s+["']tailwindcss["']/.test(content);
		const hasTailwindV3 = /@tailwind\s+(base|components|utilities)/.test(content);

		if (hasTailwindV4 || hasTailwindV3) {
			return { name: 'tailwind-setup', score: 1, reason: 'Tailwind properly configured' };
		}

		return { name: 'tailwind-setup', score: 0, reason: 'No Tailwind imports found' };
	}

	private checkTsConfig(workspaceDir: string, referencePath: string): { name: string; score: number; reason: string } {
		const tsconfigPath = path.join(workspaceDir, 'tsconfig.json');
		const tsconfigAppPath = path.join(workspaceDir, 'tsconfig.app.json');

		if (!fs.existsSync(tsconfigPath)) {
			return { name: 'tsconfig', score: 0, reason: 'tsconfig.json does not exist' };
		}

		let score = 0.5; // Base score for having tsconfig.json
		const reasons = ['tsconfig.json exists'];

		if (fs.existsSync(tsconfigAppPath)) {
			score += 0.25;
			reasons.push('tsconfig.app.json exists');
		} else {
			reasons.push('missing tsconfig.app.json');
		}

		// Check for path aliases in tsconfig.json
		const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf-8');
		const hasPathAlias = /"paths"\s*:\s*\{/.test(tsconfigContent) || /@\/\*/.test(tsconfigContent);
		if (hasPathAlias) {
			score += 0.25;
			reasons.push('path aliases configured');
		} else {
			reasons.push('missing path aliases');
		}

		return { name: 'tsconfig', score, reason: reasons.join(', ') };
	}

	private checkComponentsJson(workspaceDir: string, referencePath: string): { name: string; score: number; reason: string } {
		const componentsJsonPath = path.join(workspaceDir, 'components.json');
		if (!fs.existsSync(componentsJsonPath)) {
			return { name: 'components.json', score: 0, reason: 'components.json does not exist (shadcn not initialized)' };
		}

		try {
			const content = JSON.parse(fs.readFileSync(componentsJsonPath, 'utf-8'));

			// Check for required fields
			const hasStyle = content.style !== undefined;
			const hasAliases = content.aliases !== undefined;
			const hasTsConfig = content.tsx !== undefined || content.aliases?.components !== undefined;

			let score = 0;
			const reasons = [];
			if (hasStyle) { score += 0.33; } else { reasons.push('missing style config'); }
			if (hasAliases) { score += 0.34; } else { reasons.push('missing aliases'); }
			if (hasTsConfig) { score += 0.33; } else { reasons.push('missing component paths'); }

			return {
				name: 'components.json',
				score,
				reason: score === 1 ? 'Properly configured' : reasons.join(', ')
			};
		} catch (error) {
			return { name: 'components.json', score: 0, reason: 'Invalid JSON' };
		}
	}
}
