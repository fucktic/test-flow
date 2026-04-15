import { useState, useRef } from "react";
import { useLocale } from "next-intl";
import { executeAgentCommand } from "../agents/executor";

export const useAgent = () => {
  const [executingCount, setExecutingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const locale = useLocale();

  const runCommand = async (
    agentName: string,
    args: string[],
    cwd: string,
    onProgress?: (chunk: string) => void,
  ) => {
    setExecutingCount((prev) => prev + 1);
    setError(null);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    try {
      const result = await executeAgentCommand(
        agentName,
        args,
        cwd,
        onProgress,
        abortController.signal,
        locale,
      );
      return result;
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Unknown error");
      }
      throw err;
    } finally {
      setExecutingCount((prev) => Math.max(0, prev - 1));
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  const stopCommand = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  return { runCommand, stopCommand, isExecuting: executingCount > 0, error };
};
