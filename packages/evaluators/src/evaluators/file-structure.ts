import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';

export class FileStructureEvaluator implements Evaluator {
	meta = { name: 'FileStructureEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		try {
			// Define required files for shadcn-generate-vite benchmark
			const requiredFiles = [
				'package.json',
				'vite.config.ts',
				'tsconfig.json',
				'tsconfig.app.json',
				'tsconfig.node.json',
				'index.html',
				'src/index.css',
				'src/main.tsx',
				'src/App.tsx',
				'src/components/ui/button.tsx',
				'src/lib/utils.ts',
				'components.json',
			];

			// Check which files exist
			const existingFiles: string[] = [];
			const missingFiles: string[] = [];

			for (const file of requiredFiles) {
				const filePath = path.join(ctx.workspaceDir, file);
				if (fs.existsSync(filePath)) {
					existingFiles.push(file);
				} else {
					missingFiles.push(file);
				}
			}

			// Calculate score
			const score = existingFiles.length / requiredFiles.length;

			// Build details
			const details = JSON.stringify({
				score: score.toFixed(2),
				total: requiredFiles.length,
				present: existingFiles.length,
				missing: missingFiles.length,
				missingFiles: missingFiles.length > 0 ? missingFiles : undefined,
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
}
