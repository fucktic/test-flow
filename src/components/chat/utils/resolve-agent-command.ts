import { Agent } from "@/lib/types/agent.types";

interface ResolveAgentCommandOptions {
  isFirstMessage: boolean;
  sessionId?: string;
}

export interface ResolvedAgentCommand {
  executable: string;
  args: string[];
}

export const resolveAgentCommand = (
  agent: Agent,
  commandText: string,
  options: ResolveAgentCommandOptions,
): ResolvedAgentCommand => {
  let executable = (agent.endpoint || agent.name || "").trim();
  const normalizedCmd = executable.toLowerCase();

  if (normalizedCmd === "opencode") {
    const args = ["run"];
    if (!options.isFirstMessage) {
      args.push("--continue");
    }
    args.push(commandText);
    return { executable, args };
  }

  if (normalizedCmd === "claude") {
    // 保持历史兼容：自动修正 cloude，并统一走 claude 命令
    return { executable, args: ["-p", commandText] };
  }

  if (normalizedCmd === "codex") {
    return { executable, args: ["exec", commandText] };
  }

  if (normalizedCmd === "openclaw") {
    const args = ["agent"];
    if (options.sessionId) {
      args.push("--session-id", options.sessionId);
    }
    args.push("--message", commandText);
    return { executable, args };
  }

  return { executable, args: [commandText] };
};
