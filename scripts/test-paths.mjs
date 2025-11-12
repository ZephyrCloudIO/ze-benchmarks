import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('__dirname:', __dirname);
console.log('cliPath:', resolve(__dirname, '../packages/harness/src/cli.ts'));
console.log('cwd:', resolve(__dirname, '..'));
