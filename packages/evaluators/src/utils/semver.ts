type Ver = {
	major: number;
	minor: number;
	patch: number;
};

function parseVer(version: string): Ver | null {
	const cleaned = version.trim().replace(/^[^0-9]*/, '');
	const match = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
	if (!match) return null;
	return {
		major: parseInt(match[1] || '0', 10),
		minor: parseInt(match[2] || '0', 10),
		patch: parseInt(match[3] || '0', 10),
	};
}

function compare(a: Ver, b: Ver): number {
	if (a.major !== b.major) return a.major - b.major;
	if (a.minor !== b.minor) return a.minor - b.minor;
	return a.patch - b.patch;
}

function withinCaret(base: Ver, cur: Ver): boolean {
	const upper: Ver = { major: base.major + 1, minor: 0, patch: 0 };
	return compare(cur, base) >= 0 && compare(cur, upper) < 0;
}

function withinTilde(base: Ver, cur: Ver): boolean {
	const upper: Ver = { major: base.major, minor: base.minor + 1, patch: 0 };
	return compare(cur, base) >= 0 && compare(cur, upper) < 0;
}

function satisfiesComparator(comparator: string, cur: Ver): boolean {
	const caret = comparator.startsWith('^');
	const tilde = comparator.startsWith('~');
	if (caret || tilde) {
		const base = parseVer(comparator.slice(1));
		if (!base) return false;
		return caret ? withinCaret(base, cur) : withinTilde(base, cur);
	}

	const match = comparator.match(/^(>=|<=|>|<)?\s*(\d+(?:\.\d+){0,2})$/);
	if (match) {
		const op = match[1] || '>=';
		const base = parseVer(match[2]!);
		if (!base) return false;
		const delta = compare(cur, base);
		switch (op) {
			case '>':
				return delta > 0;
			case '>=':
				return delta >= 0;
			case '<':
				return delta < 0;
			case '<=':
				return delta <= 0;
			default:
				return false;
		}
	}

	const base = parseVer(comparator);
	return !!base && compare(cur, base) === 0;
}

export function versionSatisfies(range: string | undefined, current: string | undefined): boolean {
	if (!range) return true;
	if (!current) return false;

	const cur = parseVer(current);
	if (!cur) return false;

	const parts = range.split(/\s+/).filter(Boolean);
	return parts.every((part) => satisfiesComparator(part.trim(), cur));
}
