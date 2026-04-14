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
  const claudeAliases = new Set(["claude", "claude-code", "cloude", "cloude-code"]);

  if (normalizedCmd === "opencode") {
    const args = ["run"];
    if (!options.isFirstMessage) {
      args.push("--continue");
    }
    args.push(commandText);
    return { executable, args };
  }

  if (claudeAliases.has(normalizedCmd)) {
    // 保持历史兼容：自动修正 cloude，并统一走 claude 命令
    executable = "claude";
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
