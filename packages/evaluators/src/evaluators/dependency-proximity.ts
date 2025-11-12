import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as semver from 'semver';

export class DependencyProximityEvaluator implements Evaluator {
	meta = { name: 'DependencyProximityEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		try {
			// Get reference directory path
			const referencePath = this.getReferencePath(ctx);
			if (!referencePath || !fs.existsSync(referencePath)) {
				return {
					name: this.meta.name,
					score: 0,
					details: 'Reference implementation not found',
				};
			}

			const workspacePkgPath = path.join(ctx.workspaceDir, 'package.json');
			const referencePkgPath = path.join(referencePath, 'package.json');

			if (!fs.existsSync(workspacePkgPath)) {
				return {
					name: this.meta.name,
					score: 0,
					details: 'package.json not found in workspace',
				};
			}

			const workspacePkg = JSON.parse(fs.readFileSync(workspacePkgPath, 'utf-8'));
			const referencePkg = JSON.parse(fs.readFileSync(referencePkgPath, 'utf-8'));

			// Key dependencies to check
			const keyDeps = [
				'vite',
				'react',
				'react-dom',
				'tailwindcss',
				'@tailwindcss/vite',
				'typescript',
				'@types/node',
			];

			const results = keyDeps.map((dep) => this.compareDependency(
				dep,
				workspacePkg,
				referencePkg
			)).filter(r => r !== null);

			if (results.length === 0) {
				return {
					name: this.meta.name,
					score: 0,
					details: 'No key dependencies found',
				};
			}

			const avgScore = results.reduce((sum, r) => sum + r!.score, 0) / results.length;

			const details = JSON.stringify({
				score: avgScore.toFixed(2),
				dependencies: results,
			});

			return {
				name: this.meta.name,
				score: avgScore,
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

	private getReferencePath(ctx: EvaluationContext): string | null {
		if (!ctx.scenario.reference_path) {
			return null;
		}

		// Find the ze-benchmarks root by looking for suites directory
		let currentDir = __dirname;
		let suitesDir = null;

		// Go up max 10 levels to find suites directory
		for (let i = 0; i < 10; i++) {
			const possibleSuitesDir = path.join(currentDir, 'suites');
			if (fs.existsSync(possibleSuitesDir)) {
				suitesDir = possibleSuitesDir;
				break;
			}
			const parent = path.dirname(currentDir);
			if (parent === currentDir) break; // Reached root
			currentDir = parent;
		}

		if (!suitesDir) {
			return null;
		}

		// Construct path: suites/{suite}/scenarios/{scenario-name}/../reference_path
		const scenarioDir = path.join(suitesDir, ctx.scenario.suite, 'scenarios', ctx.scenario.id.replace('ZE_', ''));
		const referencePath = path.resolve(scenarioDir, ctx.scenario.reference_path);

		return fs.existsSync(referencePath) ? referencePath : null;
	}

	private compareDependency(
		name: string,
		workspacePkg: any,
		referencePkg: any
	): { name: string; score: number; workspace: string; reference: string; reason: string } | null {
		// Check both dependencies and devDependencies
		const workspaceVersion = workspacePkg.dependencies?.[name] || workspacePkg.devDependencies?.[name];
		const referenceVersion = referencePkg.dependencies?.[name] || referencePkg.devDependencies?.[name];

		if (!referenceVersion) {
			// Not in reference, skip
			return null;
		}

		if (!workspaceVersion) {
			return {
				name,
				score: 0,
				workspace: 'missing',
				reference: referenceVersion,
				reason: 'Dependency not installed',
			};
		}

		// Try to compare versions
		const score = this.compareVersions(workspaceVersion, referenceVersion);

		return {
			name,
			score,
			workspace: workspaceVersion,
			reference: referenceVersion,
			reason: score === 1 ? 'Exact or compatible version' : score > 0.5 ? 'Close version' : 'Version mismatch',
		};
	}

	private compareVersions(workspaceVersion: string, referenceVersion: string): number {
		try {
			// Clean version strings (remove ^ ~ etc)
			const cleanWorkspace = semver.coerce(workspaceVersion);
			const cleanReference = semver.coerce(referenceVersion);

			if (!cleanWorkspace || !cleanReference) {
				// If we can't parse, just check if they're the same string
				return workspaceVersion === referenceVersion ? 1 : 0;
			}

			// Exact match
			if (semver.eq(cleanWorkspace, cleanReference)) {
				return 1;
			}

			// Same major version
			if (cleanWorkspace.major === cleanReference.major) {
				// Same minor version
				if (cleanWorkspace.minor === cleanReference.minor) {
					return 0.9; // Same major.minor, different patch
				}
				return 0.7; // Same major, different minor
			}

			// Different major version
			return 0.3;
		} catch (error) {
			// If comparison fails, just check string equality
			return workspaceVersion === referenceVersion ? 1 : 0;
		}
	}
}
