import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tsxPath = resolve(__dirname, '../../node_modules/.bin/tsx');
console.log('tsxPath:', tsxPath);
console.log('exists:', existsSync(tsxPath));
