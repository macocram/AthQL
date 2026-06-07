import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { ProcessedResult } from "../workers/resultProcessor.worker";
import ResultWorker from "../workers/resultProcessor.worker?worker";

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

export function useQueryExecution(executionId: string | undefined) {
  const statusQuery = useQuery({
    queryKey: ["query-status", executionId],
    queryFn: () => api.status(executionId!),
    enabled: !!executionId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || TERMINAL.has(status)) return false;
      return 1500;
    },
  });

  const resultsQuery = useQuery({
    queryKey: ["query-results", executionId],
    queryFn: () => api.results(executionId!),
    enabled: statusQuery.data?.status === "SUCCEEDED",
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
    status: statusQuery.data,
    isPolling: !!executionId && !TERMINAL.has(statusQuery.data?.status ?? ""),
    processed,
    isLoadingResults: resultsQuery.isLoading,
    error: statusQuery.error || resultsQuery.error,
  };
}
