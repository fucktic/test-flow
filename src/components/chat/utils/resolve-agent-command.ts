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
  const executable = (agent.endpoint || agent.name || "").trim();
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
    // prompt 很长时在 Windows cmd.exe 下会被 8191 字符限制截断。
    // 后端（route.ts）会将 -p 后面的正文移走、改由 stdin 传入，规避这个限制。
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
