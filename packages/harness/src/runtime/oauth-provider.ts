import http from 'http';
import { URL } from 'url';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import chalk from 'chalk';
import { logger } from '@ze/logger';
import type { OAuthClientInformationMixed, OAuthClientProvider, OAuthTokens } from '@modelcontextprotocol/sdk/client/auth.js';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';

const log = logger.mcpTools;

const OAUTH_STORAGE_PATH = path.join(os.homedir(), '.ze-benchmarks', 'mcp-oauth.json');
const DEFAULT_REDIRECT_PORT = 8123;
const DEFAULT_CALLBACK_PATH = '/mcp/callback';

type StoredData = {
	tokens: Record<string, OAuthTokens>;
	clients: Record<string, OAuthClientInformationMixed>;
};

async function readStore(): Promise<StoredData> {
	try {
		const raw = await fs.readFile(OAUTH_STORAGE_PATH, 'utf-8');
		const parsed = JSON.parse(raw) as Partial<StoredData>;
		return {
			tokens: parsed.tokens || {},
			clients: parsed.clients || {},
		};
	} catch {
		return {
			tokens: {},
			clients: {},
		};
	}
}

async function writeStore(store: StoredData): Promise<void> {
	await fs.mkdir(path.dirname(OAUTH_STORAGE_PATH), { recursive: true });
	await fs.writeFile(OAUTH_STORAGE_PATH, JSON.stringify(store, null, 2), { mode: 0o600 });
}

function openBrowser(url: string): void {
	const platform = process.platform;
	const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
	const args = platform === 'win32' ? [''] : [];
	const child = spawn(cmd, [...args, url], { stdio: 'ignore', shell: platform === 'win32' });
	child.on('error', error => {
		log.warn(`[MCP OAuth] Failed to open browser automatically: ${error instanceof Error ? error.message : String(error)}`);
	});
}

export class BrowserOAuthProvider implements OAuthClientProvider {
	private codeVerifierValue: string | null = null;
	private pendingCode: Promise<string | null> | null = null;
	private resolveCode: ((code: string | null) => void) | null = null;
	private server: http.Server | null = null;
	private readonly redirectUrlValue: string;
	private readonly clientId: string | null;
	private readonly scope?: string;
	private readonly redirectPort: number;
	private readonly redirectPath: string;

	constructor(private serverName: string, private serverUrl: string, options?: { clientId?: string; scope?: string; redirectPort?: number; redirectPath?: string }) {
		const port = options?.redirectPort || DEFAULT_REDIRECT_PORT;
		const path = options?.redirectPath || DEFAULT_CALLBACK_PATH;
		this.redirectUrlValue = `http://127.0.0.1:${port}${path.startsWith('/') ? path : `/${path}`}`;
		this.clientId = options?.clientId || null;
		this.scope = options?.scope;
		this.redirectPort = port;
		this.redirectPath = path.startsWith('/') ? path : `/${path}`;
	}

	get redirectUrl(): string | URL {
		return this.redirectUrlValue;
	}

	get clientMetadata() {
		return {
			redirect_uris: [this.redirectUrlValue],
			token_endpoint_auth_method: 'none',
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			client_name: `ze-benchmarks-${this.serverName}`,
			scope: this.scope || 'offline_access',
		};
	}

	async clientInformation() {
		// If caller provided a clientId, treat it as static information
		if (this.clientId) {
			return {
				client_id: this.clientId,
				redirect_uris: [this.redirectUrlValue],
				token_endpoint_auth_method: 'none',
			};
		}

		// Otherwise, try to load a dynamically registered client
		const store = await readStore();
		const saved = store.clients[this.serverName];
		if (saved) {
			return saved;
		}

		// Returning undefined triggers dynamic registration
		return undefined;
	}

	async saveClientInformation(clientInformation: OAuthClientInformationMixed): Promise<void> {
		log.info(chalk.blue(`[MCP OAuth] Saved client registration for ${this.serverName}`));
		const store = await readStore();
		store.clients[this.serverName] = clientInformation;
		await writeStore(store);
	}

	async tokens(): Promise<OAuthTokens | undefined> {
		const store = await readStore();
		return store.tokens[this.serverName];
	}

	async saveTokens(tokens: OAuthTokens): Promise<void> {
		log.info(chalk.blue(`[MCP OAuth] Received tokens for ${this.serverName}`));
		const store = await readStore();
		store.tokens[this.serverName] = tokens;
		await writeStore(store);
	}

	async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
		log.info(chalk.blue(`[MCP OAuth] Opening browser for ${this.serverName}`));
		log.info(chalk.gray(`[MCP OAuth] Auth URL: ${authorizationUrl.toString()}`));
		openBrowser(authorizationUrl.toString());
	}

	async saveCodeVerifier(codeVerifier: string): Promise<void> {
		this.codeVerifierValue = codeVerifier;
	}

	async codeVerifier(): Promise<string> {
		if (!this.codeVerifierValue) {
			throw new Error(`[MCP OAuth] No code verifier set for ${this.serverName}`);
		}
		return this.codeVerifierValue;
	}

	private async ensureServer(): Promise<void> {
		if (this.server) return;
		this.server = http.createServer((req, res) => {
			const url = req.url ? new URL(req.url, this.redirectUrlValue) : null;
			const code = url?.searchParams.get('code');
			if (code) {
				log.info(chalk.green(`[MCP OAuth] Received authorization code for ${this.serverName}`));
				res.statusCode = 200;
				res.setHeader('Content-Type', 'text/plain');
				res.end('Login complete. You can close this window.');
				if (this.resolveCode) {
					this.resolveCode(code);
					this.resolveCode = null;
				}
			} else {
				res.statusCode = 400;
				res.end('Missing authorization code');
			}
		});

		await new Promise<void>((resolve, reject) => {
			this.server?.listen(this.redirectPort, '127.0.0.1', () => {
				log.info(chalk.gray(`[MCP OAuth] Listening for callback on ${this.redirectUrlValue}`));
				resolve();
			});
			this.server?.on('error', reject);
		});
	}

	async waitForAuthorizationCode(): Promise<string | null> {
		await this.ensureServer();
		if (!this.pendingCode) {
			this.pendingCode = new Promise(resolve => {
				this.resolveCode = resolve;
				setTimeout(() => resolve(null), 5 * 60 * 1000); // 5 minutes timeout
			});
		}
		const code = await this.pendingCode;
		this.pendingCode = null;
		return code;
	}
}

/**
 * Run a full OAuth flow up front so we can wait for the browser login before attempting MCP connection.
 */
export async function ensureOAuthFlow(provider: BrowserOAuthProvider, serverUrl: string): Promise<void> {
	const first = await auth(provider, { serverUrl });
	if (first === 'REDIRECT') {
		const code = await provider.waitForAuthorizationCode();
		if (!code) {
			throw new Error('[MCP OAuth] Authorization timed out or no code received');
		}
		const second = await auth(provider, { serverUrl, authorizationCode: code });
		if (second === 'REDIRECT') {
			throw new Error('[MCP OAuth] Unexpected second redirect');
		}
	}
}
