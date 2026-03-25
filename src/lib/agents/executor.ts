export const executeAgentCommand = async (agentName: string, command: string, cwd: string) => {
  // 这应该调用一个本地 API（例如 Next.js Route Handler）来执行命令
  try {
    const response = await fetch("/api/agents/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentName, command, cwd }),
    });

    if (!response.ok) {
      throw new Error("Command execution failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Error executing agent command:", error);
    throw error;
  }
};
