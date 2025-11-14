import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  BenchmarkRun,
  BatchRun,
  GlobalStats,
  AgentStats,
  RunDetails,
  BatchDetails,
} from '@/lib/api-client';

// Query keys for cache management
export const queryKeys = {
  runs: {
    all: ['runs'] as const,
    list: (params?: {
      limit?: number;
      suite?: string;
      scenario?: string;
      agent?: string;
      status?: string;
    }) => [...queryKeys.runs.all, 'list', params] as const,
    detail: (runId: string) => [...queryKeys.runs.all, 'detail', runId] as const,
    evaluations: (runId: string) => [...queryKeys.runs.all, 'evaluations', runId] as const,
    telemetry: (runId: string) => [...queryKeys.runs.all, 'telemetry', runId] as const,
  },
  batches: {
    all: ['batches'] as const,
    list: (limit?: number) => [...queryKeys.batches.all, 'list', limit] as const,
    detail: (batchId: string) => [...queryKeys.batches.all, 'detail', batchId] as const,
  },
  stats: {
    all: ['stats'] as const,
    global: () => [...queryKeys.stats.all, 'global'] as const,
    agents: () => [...queryKeys.stats.all, 'agents'] as const,
    dashboard: () => [...queryKeys.stats.all, 'dashboard'] as const,
    topPerformers: (limit?: number) => [...queryKeys.stats.all, 'topPerformers', limit] as const,
    scoreDistribution: () => [...queryKeys.stats.all, 'scoreDistribution'] as const,
  },
};

// Runs queries
export function useRuns(
  params?: {
    limit?: number;
    suite?: string;
    scenario?: string;
    agent?: string;
    status?: string;
  },
  options?: Omit<UseQueryOptions<BenchmarkRun[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.runs.list(params),
    queryFn: () => apiClient.listRuns(params),
    staleTime: 30000, // Data is fresh for 30 seconds
    ...options,
  });
}

export function useRunDetails(
  runId: string,
  options?: Omit<UseQueryOptions<RunDetails>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.runs.detail(runId),
    queryFn: () => apiClient.getRunDetails(runId),
    staleTime: 60000, // Run details are more stable
    ...options,
  });
}

// Batches queries
export function useBatches(
  limit?: number,
  options?: Omit<UseQueryOptions<BatchRun[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.batches.list(limit),
    queryFn: () => apiClient.listBatches(limit),
    staleTime: 30000,
    ...options,
  });
}

export function useBatchDetails(
  batchId: string,
  options?: Omit<UseQueryOptions<BatchDetails>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.batches.detail(batchId),
    queryFn: () => apiClient.getBatchDetails(batchId),
    staleTime: 60000,
    ...options,
  });
}

// Stats queries
export function useGlobalStats(
  options?: Omit<UseQueryOptions<GlobalStats>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.stats.global(),
    queryFn: () => apiClient.getGlobalStats(),
    staleTime: 30000,
    ...options,
  });
}

export function useAgentStats(
  options?: Omit<UseQueryOptions<AgentStats[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.stats.agents(),
    queryFn: () => apiClient.getAgentStats(),
    staleTime: 30000,
    ...options,
  });
}

export function useDashboardStats(
  options?: Omit<
    UseQueryOptions<{
      totalRuns: number;
      successRate: number;
      avgScore: number;
      avgCost: number;
    }>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.stats.dashboard(),
    queryFn: () => apiClient.getDashboardStats(),
    staleTime: 30000,
    ...options,
  });
}

export function useTopPerformers(
  limit: number = 5,
  options?: Omit<
    UseQueryOptions<
      Array<{
        agent: string;
        model: string;
        avgScore: number;
        runCount: number;
        avgCost: number;
      }>
    >,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.stats.topPerformers(limit),
    queryFn: () => apiClient.getTopPerformers(limit),
    staleTime: 60000,
    ...options,
  });
}

export function useScoreDistribution(
  options?: Omit<
    UseQueryOptions<Array<{ range: string; count: number }>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.stats.scoreDistribution(),
    queryFn: () => apiClient.getScoreDistribution(),
    staleTime: 60000,
    ...options,
  });
}
