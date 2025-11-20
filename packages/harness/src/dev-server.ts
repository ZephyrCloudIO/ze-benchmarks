import { spawn, exec } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import { createServer } from 'net';
import { logger } from '@ze/logger';

// Constants
const DEFAULT_PORT = 3000;
const PORT_RANGE_MAX = 10;
const COMMON_DEV_PORTS = [3000];
const SERVER_STARTUP_TIMEOUT = 15000;
const GRACEFUL_SHUTDOWN_TIMEOUT = 2000;
const RETRY_DELAY = 500;
const CLEANUP_DELAY = 100;
const MAX_STARTUP_ATTEMPTS = 3;

let serverProcess: any = null;
let serverUrl: string | null = null;

// OS-agnostic function to check if a port is available
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

// OS-agnostic function to kill processes on a specific port
function killProcessOnPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const command = isWindows 
      ? `netstat -ano | findstr :${port}` 
      : `lsof -ti:${port}`;
    
    exec(command, (error, stdout) => {
      if (error || !stdout.trim()) {
        // No process found on port, continue
        resolve();
        return;
      }
      
      if (isWindows) {
        // Parse Windows netstat output to get PID
        const lines = stdout.trim().split('\n');
        const pids = lines
          .map(line => {
            const parts = line.trim().split(/\s+/);
            return parts[parts.length - 1]; // Last column is PID
          })
          .filter(pid => pid && !isNaN(Number(pid)));
        
        if (pids.length > 0) {
          let completed = 0;
          pids.forEach(pid => {
            exec(`taskkill /PID ${pid} /F`, () => {
              completed++;
              if (completed === pids.length) {
                resolve();
              }
            });
          });
        } else {
          resolve();
        }
      } else {
        // Unix/Linux - kill processes directly
        const pids = stdout.trim().split('\n').filter(pid => pid && !isNaN(Number(pid)));
        if (pids.length > 0) {
          exec(`kill -9 ${pids.join(' ')}`, () => {
            resolve();
          });
        } else {
          resolve();
        }
      }
    });
  });
}

// OS-agnostic function to find an available port
async function findAvailablePort(startPort: number = DEFAULT_PORT, maxAttempts: number = PORT_RANGE_MAX): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
  }
  throw new Error(`No available ports found in range ${startPort}-${startPort + maxAttempts - 1}`);
}

// Note: Database sync functions removed - database is now created directly in public/

export async function startDevServer(): Promise<string> {
  if (serverUrl) {
    return serverUrl;
  }
  
  // Ensure we stop any existing server first
  try {
    stopDevServer();
    // Brief pause for process cleanup
    await new Promise(resolve => setTimeout(resolve, CLEANUP_DELAY));
  } catch (err) {
    // Ignore errors when stopping
  }
  
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const reportDir = join(__dirname, '../../../benchmark-report');
  
  // Check if benchmark-report directory exists
  if (!existsSync(reportDir)) {
    const error = new Error(`Benchmark report directory not found: ${reportDir}`);
    throw error;
  }
  
  // Check if package.json exists
  const packageJsonPath = join(reportDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    const error = new Error(`Package.json not found: ${packageJsonPath}`);
    throw error;
  }
  
  // Note: Database is now created directly in public/ directory by BenchmarkLogger
  
  // Kill processes on common dev server ports to ensure clean start
  await Promise.all(COMMON_DEV_PORTS.map(port => killProcessOnPort(port)));
  
  // Find an available port (OS-agnostic)
  const availablePort = await findAvailablePort(DEFAULT_PORT, PORT_RANGE_MAX);
  
  // Retry mechanism for dev server startup
  let attempts = 0;
  
  while (attempts < MAX_STARTUP_ATTEMPTS) {
    try {
      const result = await startDevServerProcess(reportDir, availablePort);
      return result;
    } catch (err) {
      attempts++;
      if (attempts >= MAX_STARTUP_ATTEMPTS) {
        throw err;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  
  // This should never be reached due to the while loop, but TypeScript needs it
  throw new Error('Failed to start dev server after all attempts');
}

async function startDevServerProcess(reportDir: string, availablePort: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // Set the port environment variable for RSbuild
    const env = { ...process.env, PORT: availablePort.toString() };
    
    serverProcess = spawn('pnpm', ['dev'], {
      cwd: reportDir,
      stdio: 'pipe',
      shell: true,
      detached: false,
      env
    });
    
    let resolved = false;
    let hasStarted = false;
    
    serverProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      
      // Look for server URL in output or construct it from our port
      const match = output.match(/http:\/\/localhost:\d+/);
      if (match && !serverUrl && !resolved) {
        serverUrl = match[0];
        resolved = true;
        resolve(serverUrl);
      } else if (output.includes('ready') || output.includes('built')) {
        // If we don't find a URL in output, construct it from our port
        if (!serverUrl && !resolved) {
          serverUrl = `http://localhost:${availablePort}`;
          resolved = true;
          resolve(serverUrl);
        }
      }
      
      // Check for build completion
      if (output.includes('ready') || output.includes('built')) {
        hasStarted = true;
      }
    });
    
    serverProcess.stderr.on('data', (data: Buffer) => {
      const errorOutput = data.toString();
      // Log critical errors only
      if (errorOutput.includes('error') || errorOutput.includes('Error')) {
        logger.execution.error('Dev server error:', errorOutput.trim());
      }
    });
    
    serverProcess.on('error', (err: Error) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });
    
    serverProcess.on('exit', (code: number, signal: string) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Dev server process exited with code ${code}`));
      }
    });
    
    // Timeout after configured duration
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Dev server failed to start within ${SERVER_STARTUP_TIMEOUT / 1000} seconds`));
      }
    }, SERVER_STARTUP_TIMEOUT);
  });
}

export function getServerUrl(): string | null {
  return serverUrl;
}

// Note: Database sync functions removed - database is now created directly in public/

export function stopDevServer(): void {
  if (serverProcess) {
    try {
      // Try graceful shutdown first
      serverProcess.kill('SIGTERM');
      
      // Force kill if it doesn't stop gracefully
      setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
      }, GRACEFUL_SHUTDOWN_TIMEOUT);
      
    } catch (err) {
      // Silently handle stop errors
    }
    
    serverProcess = null;
    serverUrl = null;
  }
  
  // Also kill any processes on common dev server ports (OS-agnostic)
  // Note: This is fire-and-forget to avoid async issues
  COMMON_DEV_PORTS.forEach(port => killProcessOnPort(port));
}
