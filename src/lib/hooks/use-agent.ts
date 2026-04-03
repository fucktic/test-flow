import { useState } from "react";
import { executeAgentCommand } from "../agents/executor";

export const useAgent = () => {
  const [executingCount, setExecutingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const runCommand = async (
    agentName: string,
    command: string,
    cwd: string,
    onProgress?: (chunk: string) => void,
  ) => {
    setExecutingCount((prev) => prev + 1);
    setError(null);
    try {
      const result = await executeAgentCommand(agentName, command, cwd, onProgress);
      return result;
    } catch (err: any) {
      setError(err.message || "Unknown error");
      throw err;
    } finally {
      setExecutingCount((prev) => prev - 1);
    }
  };

  return { runCommand, isExecuting: executingCount > 0, error };
};
