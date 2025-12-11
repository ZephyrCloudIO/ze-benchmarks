import type { Env } from '../types';
import { jsonResponse } from '../utils/response';

export interface SnapshotMetadata {
  specialistName: string;
  specialistVersion: string;
  snapshotId: string;
  createdAt: string;
  batchId?: string;
  templateVersion: string;
  isEnriched: boolean;
  runCount: number;
  avgScore?: number;
}

export interface UploadSnapshotPayload {
  snapshot: Record<string, any>;
  metadata: SnapshotMetadata;
}

/**
 * Generate R2 key for a snapshot
 * Format: snapshots/{specialistName}/{version}/snapshot-{id}.json
 */
function getSnapshotKey(metadata: SnapshotMetadata): string {
  return `snapshots/${metadata.specialistName}/${metadata.specialistVersion}/snapshot-${metadata.snapshotId}.json`;
}

/**
 * Generate R2 key for snapshot metadata
 */
function getMetadataKey(metadata: SnapshotMetadata): string {
  return `snapshots/${metadata.specialistName}/${metadata.specialistVersion}/snapshot-${metadata.snapshotId}.meta.json`;
}

/**
 * Upload a snapshot to R2
 * POST /api/snapshots
 */
export async function uploadSnapshot(request: Request, env: Env): Promise<Response> {
  try {
    const payload: UploadSnapshotPayload = await request.json();

    // Validate payload
    if (!payload.snapshot || !payload.metadata) {
      return jsonResponse({ error: 'Missing snapshot or metadata' }, 400);
    }

    const { snapshot, metadata } = payload;

    // Validate required metadata fields
    if (!metadata.specialistName || !metadata.specialistVersion || !metadata.snapshotId) {
      return jsonResponse({
        error: 'Missing required metadata fields: specialistName, specialistVersion, snapshotId'
      }, 400);
    }

    const snapshotKey = getSnapshotKey(metadata);
    const metadataKey = getMetadataKey(metadata);

    console.debug(`[Worker:Snapshots] Uploading snapshot to R2: ${snapshotKey}`);

    // Upload snapshot JSON
    await env.SNAPSHOTS.put(snapshotKey, JSON.stringify(snapshot, null, 2), {
      httpMetadata: {
        contentType: 'application/json',
      },
      customMetadata: {
        specialistName: metadata.specialistName,
        specialistVersion: metadata.specialistVersion,
        snapshotId: metadata.snapshotId,
        createdAt: metadata.createdAt,
        batchId: metadata.batchId || '',
      },
    });

    // Upload metadata JSON
    await env.SNAPSHOTS.put(metadataKey, JSON.stringify(metadata, null, 2), {
      httpMetadata: {
        contentType: 'application/json',
      },
    });

    console.debug(`[Worker:Snapshots] Snapshot uploaded successfully: ${snapshotKey}`);

    return jsonResponse({
      success: true,
      key: snapshotKey,
      metadataKey,
      url: `r2://ze-benchmarks-snapshots/${snapshotKey}`,
    }, 201);
  } catch (err: any) {
    console.error('Failed to upload snapshot:', err);
    return jsonResponse({ error: 'Failed to upload snapshot', details: err.message }, 500);
  }
}

/**
 * Download a snapshot from R2
 * GET /api/snapshots/:specialistName/:version/:snapshotId
 */
export async function downloadSnapshot(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Expected: /api/snapshots/{specialistName}/{version}/{snapshotId}
    if (pathParts.length < 5) {
      return jsonResponse({ error: 'Invalid path. Expected: /api/snapshots/{specialistName}/{version}/{snapshotId}' }, 400);
    }

    const [, , specialistName, version, snapshotId] = pathParts;
    const key = `snapshots/${specialistName}/${version}/snapshot-${snapshotId}.json`;

    console.debug(`[Worker:Snapshots] Downloading snapshot from R2: ${key}`);

    const object = await env.SNAPSHOTS.get(key);

    if (!object) {
      return jsonResponse({ error: 'Snapshot not found' }, 404);
    }

    const snapshot = await object.json();

    return jsonResponse({
      snapshot,
      metadata: object.customMetadata,
      key,
    });
  } catch (err: any) {
    console.error('Failed to download snapshot:', err);
    return jsonResponse({ error: 'Failed to download snapshot', details: err.message }, 500);
  }
}

/**
 * List snapshots for a specialist
 * GET /api/snapshots/:specialistName?version=X
 */
export async function listSnapshots(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Get specialist name from path or list all
    let prefix = 'snapshots/';
    if (pathParts.length >= 3) {
      const specialistName = pathParts[2];
      prefix = `snapshots/${specialistName}/`;

      // If version is specified in path
      if (pathParts.length >= 4) {
        const version = pathParts[3];
        prefix = `snapshots/${specialistName}/${version}/`;
      }
    }

    // Also check query params for version
    const versionParam = url.searchParams.get('version');
    if (versionParam && pathParts.length === 3) {
      const specialistName = pathParts[2];
      prefix = `snapshots/${specialistName}/${versionParam}/`;
    }

    console.debug(`[Worker:Snapshots] Listing snapshots with prefix: ${prefix}`);

    const listed = await env.SNAPSHOTS.list({ prefix });

    // Filter to only include .meta.json files and extract metadata
    const metadataKeys = listed.objects
      .filter(obj => obj.key.endsWith('.meta.json'))
      .map(obj => obj.key);

    // Fetch all metadata
    const snapshots = await Promise.all(
      metadataKeys.map(async (key) => {
        try {
          const obj = await env.SNAPSHOTS.get(key);
          if (obj) {
            return await obj.json();
          }
          return null;
        } catch {
          return null;
        }
      })
    );

    // Filter out nulls and sort by createdAt descending
    const validSnapshots = snapshots
      .filter((s): s is SnapshotMetadata => s !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return jsonResponse({
      snapshots: validSnapshots,
      count: validSnapshots.length,
      prefix,
    });
  } catch (err: any) {
    console.error('Failed to list snapshots:', err);
    return jsonResponse({ error: 'Failed to list snapshots', details: err.message }, 500);
  }
}

/**
 * Delete a snapshot from R2
 * DELETE /api/snapshots/:specialistName/:version/:snapshotId
 */
export async function deleteSnapshot(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts.length < 5) {
      return jsonResponse({ error: 'Invalid path. Expected: /api/snapshots/{specialistName}/{version}/{snapshotId}' }, 400);
    }

    const [, , specialistName, version, snapshotId] = pathParts;
    const snapshotKey = `snapshots/${specialistName}/${version}/snapshot-${snapshotId}.json`;
    const metadataKey = `snapshots/${specialistName}/${version}/snapshot-${snapshotId}.meta.json`;

    console.debug(`[Worker:Snapshots] Deleting snapshot from R2: ${snapshotKey}`);

    // Delete both snapshot and metadata
    await Promise.all([
      env.SNAPSHOTS.delete(snapshotKey),
      env.SNAPSHOTS.delete(metadataKey),
    ]);

    return jsonResponse({
      success: true,
      deleted: [snapshotKey, metadataKey],
    });
  } catch (err: any) {
    console.error('Failed to delete snapshot:', err);
    return jsonResponse({ error: 'Failed to delete snapshot', details: err.message }, 500);
  }
}
