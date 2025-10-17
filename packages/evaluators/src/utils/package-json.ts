import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Minimal helper to read JSON files synchronously.
 */
export function readJson(path: string): any {
	return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Until we add a full workspace graph, enumerate package.json files we care about.
 * This covers the root plus common fixture locations used in scenarios.
 */
export function getAllPackageJsonPaths(root: string): string[] {
	const paths: string[] = [];
	const rootPkg = join(root, 'package.json');
	if (existsSync(rootPkg)) paths.push(rootPkg);

	const common = ['apps/app/package.json', 'libs/util/package.json'];
	for (const rel of common) {
		const full = join(root, rel);
		if (existsSync(full)) paths.push(full);
	}

	return paths;
}
