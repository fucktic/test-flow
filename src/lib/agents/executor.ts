export const executeAgentCommand = async (
  agentName: string,
  command: string,
  cwd: string,
  onProgress?: (chunk: string) => void,
  signal?: AbortSignal,
) => {
  const abortController = new AbortController();
  const effectiveSignal = signal || abortController.signal;

  try {
    const response = await fetch("/api/agents/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName, command, cwd }),
      signal: effectiveSignal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Command execution failed");
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullOutput = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullOutput += chunk;
        if (onProgress) {
          onProgress(chunk);
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { stdout: fullOutput, stderr: "" };
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.log("Fetch aborted");
    } else {
      console.error("Error executing agent command:", error);
    }
    throw error;
  }
};
