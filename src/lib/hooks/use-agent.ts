import { useState } from "react";
import { executeAgentCommand } from "../agents/executor";

export const useAgent = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCommand = async (
    agentName: string,
    command: string,
    cwd: string,
    onProgress?: (chunk: string) => void,
  ) => {
    setIsExecuting(true);
    setError(null);
    try {
      const result = await executeAgentCommand(agentName, command, cwd, onProgress);
      return result;
    } catch (err: any) {
      setError(err.message || "Unknown error");
      throw err;
    } finally {
      setIsExecuting(false);
    }
  };

  return { runCommand, isExecuting, error };
};
