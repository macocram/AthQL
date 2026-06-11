import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import type { QueryStatus, QueryTab } from "../types";
import type { ProcessedResult } from "../workers/resultProcessor.worker";
import ResultWorker from "../workers/resultProcessor.worker?worker";

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

function estimateCost(dataScannedBytes?: number): number | undefined {
  if (dataScannedBytes == null) return undefined;
  return Math.round((dataScannedBytes / 1024 ** 3) * 0.005 * 1_000_000) / 1_000_000;
}

export interface UseQueryExecutionOptions {
  outputLocation?: string;
  restoredStatus?: QueryTab["restoredStatus"];
}

export function useQueryExecution(
  executionId: string | undefined,
  options?: UseQueryExecutionOptions,
) {
  const { outputLocation, restoredStatus } = options ?? {};
  const isRestoredTerminal = restoredStatus != null && TERMINAL.has(restoredStatus.status);

  const statusQuery = useQuery({
    queryKey: ["query-status", executionId],
    queryFn: () => api.status(executionId!),
    enabled: !!executionId && !isRestoredTerminal,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || TERMINAL.has(status)) return false;
      return 1500;
    },
  });

  const effectiveStatus = useMemo<QueryStatus | undefined>(() => {
    if (isRestoredTerminal && restoredStatus) {
      return {
        id: executionId ?? "restored",
        status: restoredStatus.status,
        data_scanned_bytes: restoredStatus.data_scanned_bytes,
        execution_time_ms: restoredStatus.execution_time_ms,
        error_message: restoredStatus.error_message,
        cost_usd: restoredStatus.cost_usd ?? estimateCost(restoredStatus.data_scanned_bytes),
        output_location: outputLocation,
      };
    }
    return statusQuery.data;
  }, [isRestoredTerminal, restoredStatus, executionId, outputLocation, statusQuery.data]);

  const resultsQuery = useQuery({
    queryKey: ["query-results", executionId, outputLocation],
    queryFn: async () => {
      if (executionId) {
        try {
          return await api.results(executionId);
        } catch {
          if (outputLocation) {
            return await api.resultsByOutputLocation(outputLocation);
          }
          throw new Error("Results unavailable");
        }
      }
      if (outputLocation) {
        return await api.resultsByOutputLocation(outputLocation);
      }
      throw new Error("No results source");
    },
    enabled: effectiveStatus?.status === "SUCCEEDED" && (!!executionId || !!outputLocation),
  });

  const [processed, setProcessed] = useState<ProcessedResult | null>(null);

  useEffect(() => {
    if (!resultsQuery.data) {
      setProcessed(null);
      return;
    }

    const worker = new ResultWorker();
    worker.postMessage(resultsQuery.data);
    worker.onmessage = (event: MessageEvent<ProcessedResult>) => {
      setProcessed(event.data);
      worker.terminate();
    };

    return () => worker.terminate();
  }, [resultsQuery.data]);

  return {
    status: effectiveStatus,
    isPolling: !!executionId && !isRestoredTerminal && !TERMINAL.has(statusQuery.data?.status ?? ""),
    processed,
    isLoadingResults: resultsQuery.isLoading,
    error: statusQuery.error || resultsQuery.error,
  };
}
