import { config } from 'dotenv';
import type {
  SubmitRunPayload,
  SubmitBatchPayload,
  BenchmarkRun,
  BatchRun,
  RunStatistics,
  DetailedRunStatistics,
  BatchStatistics,
  SnapshotMetadata,
  UploadSnapshotPayload,
  UploadSnapshotResponse,
  DownloadSnapshotResponse,
  ListSnapshotsResponse,
} from './types';

// Load environment variables
config();

export interface WorkerClientConfig {
  workerUrl: string;
  apiKey?: string;
  timeout?: number;
}

export class WorkerClient {
  private workerUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config?: Partial<WorkerClientConfig>) {
    this.workerUrl = config?.workerUrl || process.env.ZE_BENCHMARKS_WORKER_URL || 'http://localhost:8787';
    this.apiKey = config?.apiKey || process.env.ZE_BENCHMARKS_API_KEY || 'dev-local-key';
    this.timeout = config?.timeout || 30000;

    // Ensure workerUrl doesn't end with slash
    this.workerUrl = this.workerUrl.replace(/\/$/, '');
  }

  private async fetch(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.workerUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string> || {}),
    };

    // Add auth header for POST requests
    if (options?.method === 'POST' && this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Worker API error (${response.status}): ${errorText}`);
      }

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Worker API request timed out after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Check if worker is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetch('/health');
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Submit a benchmark run with evaluations and telemetry
   */
  async submitRun(payload: SubmitRunPayload): Promise<{ runId: string }> {
    const response = await this.fetch('/api/results', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return await response.json() as { runId: string };
  }

  /**
   * Submit a batch record
   */
  async submitBatch(payload: SubmitBatchPayload): Promise<{ batchId: string }> {
    const response = await this.fetch('/api/results/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return await response.json() as { batchId: string };
  }

  /**
   * List all runs with optional filters
   */
  async listRuns(params?: {
    suite?: string;
    scenario?: string;
    agent?: string;
    limit?: number;
  }): Promise<BenchmarkRun[]> {
    const queryParams = new URLSearchParams();
    if (params?.suite) queryParams.set('suite', params.suite);
    if (params?.scenario) queryParams.set('scenario', params.scenario);
    if (params?.agent) queryParams.set('agent', params.agent);
    if (params?.limit) queryParams.set('limit', params.limit.toString());

    const path = `/api/runs${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await this.fetch(path);

    return await response.json() as BenchmarkRun[];
  }

  /**
   * Get detailed run information including evaluations and telemetry
   */
  async getRunDetails(runId: string): Promise<DetailedRunStatistics> {
    const response = await this.fetch(`/api/runs/${runId}`);
    return await response.json() as DetailedRunStatistics;
  }

  /**
   * List all batches
   */
  async listBatches(params?: { limit?: number }): Promise<BatchRun[]> {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());

    const path = `/api/batches${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await this.fetch(path);

    return await response.json() as BatchRun[];
  }

  /**
   * Get detailed batch information including all runs
   */
  async getBatchDetails(batchId: string): Promise<BatchStatistics> {
    const response = await this.fetch(`/api/batches/${batchId}`);
    return await response.json() as BatchStatistics;
  }

  /**
   * Get global statistics
   */
  async getGlobalStats(): Promise<RunStatistics> {
    const response = await this.fetch('/api/stats');
    return await response.json() as RunStatistics;
  }

  /**
   * Get agent-specific statistics
   */
  async getAgentStats(): Promise<Array<{ agent: string; stats: RunStatistics }>> {
    const response = await this.fetch('/api/stats/agents');
    return await response.json() as Array<{ agent: string; stats: RunStatistics }>;
  }

  // ==================== Snapshot Methods (R2 Storage) ====================

  /**
   * Upload a snapshot to R2
   */
  async uploadSnapshot(
    snapshot: Record<string, any>,
    metadata: SnapshotMetadata
  ): Promise<UploadSnapshotResponse> {
    const payload: UploadSnapshotPayload = { snapshot, metadata };
    const response = await this.fetch('/api/snapshots', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return await response.json() as UploadSnapshotResponse;
  }

  /**
   * Download a snapshot from R2
   */
  async downloadSnapshot(
    specialistName: string,
    version: string,
    snapshotId: string
  ): Promise<DownloadSnapshotResponse> {
    const response = await this.fetch(`/api/snapshots/${specialistName}/${version}/${snapshotId}`);
    return await response.json() as DownloadSnapshotResponse;
  }

  /**
   * List snapshots, optionally filtered by specialist and/or version
   */
  async listSnapshots(params?: {
    specialistName?: string;
    version?: string;
  }): Promise<ListSnapshotsResponse> {
    let path = '/api/snapshots';
    if (params?.specialistName) {
      path += `/${params.specialistName}`;
      if (params?.version) {
        path += `/${params.version}`;
      }
    }

    const response = await this.fetch(path);
    return await response.json() as ListSnapshotsResponse;
  }

  /**
   * Delete a snapshot from R2
   */
  async deleteSnapshot(
    specialistName: string,
    version: string,
    snapshotId: string
  ): Promise<{ success: boolean; deleted: string[] }> {
    const response = await this.fetch(`/api/snapshots/${specialistName}/${version}/${snapshotId}`, {
      method: 'DELETE',
    });

    return await response.json() as { success: boolean; deleted: string[] };
  }
}

/**
 * Singleton instance for convenient access
 */
let clientInstance: WorkerClient | null = null;

export function getWorkerClient(config?: Partial<WorkerClientConfig>): WorkerClient {
  if (!clientInstance || config) {
    clientInstance = new WorkerClient(config);
  }
  return clientInstance;
}
